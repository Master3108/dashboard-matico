/**
 * pregenerateWithImages.js
 * ────────────────────────
 * Genera preguntas con image_score + imágenes selectivas → Supabase directo.
 *
 * PROTOCOLO DE IMÁGENES:
 *   - La IA puntúa cada pregunta con image_score (0-10)
 *   - Solo las preguntas con image_score >= 5 son candidatas a imagen
 *   - Se genera imagen para las top N por fase (máximo 6, puede ser menos)
 *   - Si menos de 6 preguntas necesitan imagen, se generan menos (nunca forzado)
 *
 * Uso:
 *   node scripts/pregenerateWithImages.js --subject MATEMATICA --from 1 --to 5
 *   node scripts/pregenerateWithImages.js --subject FISICA --from 1 --to 46 --maxSessions 5
 *   node scripts/pregenerateWithImages.js --subject COMPETENCIA_LECTORA --retrofit --from 1 --to 46
 *   node scripts/pregenerateWithImages.js --subject MATEMATICA --from 1 --to 1 --dry-run
 *
 * Flags:
 *   --subject          MATEMATICA | COMPETENCIA_LECTORA | FISICA
 *   --from / --to      Rango de sesiones (default 1-46)
 *   --phase            Fase específica (1,2,3). Omitir = todas
 *   --maxSessions      Máximo de sesiones a procesar (0 = sin límite)
 *   --imageCap         Imágenes máximas por fase (default 6)
 *   --minImageScore    Score mínimo para generar imagen (default 5)
 *   --retries          Reintentos por fase fallida (default 2)
 *   --imageProvider    openai (default) | skip
 *   --imageSize        1024x1024 (default)
 *   --imageQuality     low (default) | medium | high
 *   --retrofit         Solo agregar imágenes a preguntas existentes sin imagen (usa scoring)
 *   --dry-run          Solo muestra qué haría
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { resolveMoralejaContext } from '../moralejaCompetenciaLectora.js';
import { resolveMoralejaMatematicaContext } from '../moralejaMatematica.js';
import { resolveMoralejaFisicaContext } from '../moralejaFisica.js';
import { resolveMoralejaSessionReference } from '../moralejaSessionCatalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ─── Config ────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Faltan SUPABASE_URL / SUPABASE_KEY en .env');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_IMAGE_API_KEY = process.env.OPENAI_IMAGE_API_KEY || OPENAI_API_KEY;
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const OPENAI_IMAGE_BASE_URL = process.env.OPENAI_IMAGE_BASE_URL || 'https://api.openai.com/v1';

const AI_PROVIDER = (process.env.AI_PROVIDER || '').trim().toLowerCase() || (
    (process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY) ? 'kimi'
        : (process.env.OPENAI_API_KEY ? 'openai' : 'deepseek')
);
const AI_API_KEY = AI_PROVIDER === 'kimi'
    ? (process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || '')
    : (AI_PROVIDER === 'openai' ? OPENAI_API_KEY : (process.env.DEEPSEEK_API_KEY || ''));
const AI_BASE_URL = AI_PROVIDER === 'kimi'
    ? (process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1')
    : (AI_PROVIDER === 'openai' ? 'https://api.openai.com/v1' : (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'));
const AI_MODEL = AI_PROVIDER === 'kimi'
    ? (process.env.KIMI_FAST_MODEL || 'kimi-k2-turbo-preview')
    : (AI_PROVIDER === 'openai' ? (process.env.OPENAI_FAST_MODEL || 'gpt-4.1-mini') : (process.env.DEEPSEEK_FAST_MODEL || 'deepseek-chat'));

const textAI = new OpenAI({ apiKey: AI_API_KEY, baseURL: AI_BASE_URL });
const imageAI = new OpenAI({ apiKey: OPENAI_IMAGE_API_KEY, baseURL: OPENAI_IMAGE_BASE_URL });
const LOCAL_UPLOADS_DIR = process.env.LOCAL_UPLOADS_DIR || path.join(__dirname, '..', 'uploads');

const PHASES = [
    { phase: '1', levelName: 'BASICO' },
    { phase: '2', levelName: 'INTERMEDIO' },
    { phase: '3', levelName: 'AVANZADO' }
];

const SUBJECT_CONFIG = {
    MATEMATICA: {
        code: 'MAT', displayName: 'Matematica', temperature: 0.35,
        resolveContext: ({ session, topic, phase }) => resolveMoralejaMatematicaContext({ session, topic, phase, mode: 'quiz' })
    },
    COMPETENCIA_LECTORA: {
        code: 'LEN', displayName: 'Lenguaje y Comunicacion', temperature: 0.45,
        resolveContext: ({ session, topic, phase }) => resolveMoralejaContext({ session, topic, phase, mode: 'quiz' })
    },
    FISICA: {
        code: 'FIS', displayName: 'Fisica', temperature: 0.4,
        resolveContext: ({ session, topic, phase }) => resolveMoralejaFisicaContext({ session, topic, phase, mode: 'quiz' })
    }
};

const SLOTS_PER_PHASE = 15;
const PROPOSALS_PER_SLOT = 3;

// ─── Helpers ───────────────────────────────────────────────────────

const generateId = (prefix = 'QB') => `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
const sanitize = (v = '') => String(v).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'archivo';
const normalizeText = (v = '') => String(v || '').replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const parseArgs = (argv) => {
    const result = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const next = argv[i + 1];
            if (next && !next.startsWith('--')) { result[key] = next; i++; }
            else result[key] = true;
        }
    }
    return result;
};

// ─── Image generation ──────────────────────────────────────────────

const generateImage = async ({ prompt, size = '1024x1024', quality = 'low' }) => {
    const styledPrompt = 'Dibujo simple en blanco y negro, estilo libro escolar, linea limpia, minimalista, fondo blanco. ' + prompt;
    const payload = { model: OPENAI_IMAGE_MODEL, prompt: styledPrompt, size };
    if (/^dall-e/i.test(OPENAI_IMAGE_MODEL)) payload.response_format = 'b64_json';

    const response = await imageAI.images.generate(payload);
    const first = response?.data?.[0];
    if (!first) throw new Error('OpenAI no devolvió imagen');

    if (first.b64_json) return { buffer: Buffer.from(first.b64_json, 'base64'), mimeType: 'image/png' };
    if (first.url) {
        const res = await fetch(first.url);
        if (!res.ok) throw new Error(`No se pudo descargar imagen (${res.status})`);
        return { buffer: Buffer.from(await res.arrayBuffer()), mimeType: res.headers.get('content-type') || 'image/png' };
    }
    throw new Error('OpenAI no devolvió b64 ni URL');
};

const saveImageToDisk = async (buffer, topic, subject) => {
    const dir = path.join(LOCAL_UPLOADS_DIR, 'quiz-assets');
    await fs.mkdir(dir, { recursive: true });
    const name = `${sanitize((topic || subject || 'qb').slice(0, 50)).toLowerCase()}_${Date.now()}.png`;
    await fs.writeFile(path.join(dir, name), buffer);
    return { publicUrl: `/uploads/quiz-assets/${name}`, fileName: name };
};

const createAssetInSupabase = async ({ title, subject, topicTags, fileUrl, mimeType, altText, caption }) => {
    const asset_id = generateId('IMG');
    const { data, error } = await supabase.from('pedagogical_assets').insert({
        asset_id, title: (title || '').slice(0, 180), subject: subject || null,
        topic_tags: topicTags || '', kind: 'diagram', storage_path: fileUrl,
        public_url: fileUrl, mime_type: mimeType || 'image/png',
        alt_text: (altText || '').slice(0, 180), caption: (caption || '').slice(0, 300),
        source_type: 'ai_pregenerate', status: 'approved'
    }).select('asset_id').single();
    if (error) throw new Error(`createAsset: ${error.message}`);
    return data.asset_id;
};

// ─── Question generation (phase batch con image scoring) ───────────

const buildPhasePrompt = ({ subject, subjectDisplayName, session, phase, levelName, topic, guidance, slotsPerPhase, proposalsPerSlot }) => {
    const totalQuestions = slotsPerPhase * proposalsPerSlot;
    const slotRules = Array.from({ length: slotsPerPhase }, (_, i) => i + 1)
        .map((s) => `- slot ${s}: exactamente ${proposalsPerSlot} propuestas (proposal_index 1..${proposalsPerSlot})`)
        .join('\n');

    return {
        system: [
            `Eres Matico, profesor chileno experto en ${subjectDisplayName} del curriculum de 1 medio.`,
            `Generas preguntas pedagogicas de seleccion multiple (4 alternativas) para una fase concreta.`,
            `Tu mision: generar EXACTAMENTE ${totalQuestions} preguntas (${slotsPerPhase} slots × ${proposalsPerSlot} propuestas).`,
            '',
            'Para CADA pregunta evalua si necesita imagen con image_score (0-10):',
            '- 9-10: sin imagen la pregunta pierde casi todo sentido (identificar angulo en figura, leer grafico, interpretar diagrama).',
            '- 6-8: la imagen ayuda mucho al contexto (mapa conceptual, esquema de proceso).',
            '- 3-5: la imagen seria decorativa o redundante (calculo puro, definiciones verbales).',
            '- 0-2: la imagen no aporta nada.',
            '',
            'image_role: "required_for_interpretation" si score >= 8, "supporting" si 5-7, "none" si < 5.',
            'image_prompt SOLO si image_score >= 5. Espanol, max 2 frases, elementos visuales concretos.',
            'image_prompt NO debe incluir texto, numeros escritos ni letras dentro de la imagen.',
            '',
            'No fuerces image_score alto si la pregunta no se beneficia realmente de imagen.',
            'Devuelve SOLO JSON valido.'
        ].join('\n'),
        user: [
            `Asignatura: ${subject} (${subjectDisplayName})`,
            `Sesion: ${session}`,
            `Fase: ${phase} (${levelName})`,
            `Tema base: ${topic}`,
            '',
            '[BASE PEDAGOGICA MORALEJA]',
            guidance,
            '',
            'Reglas:',
            '1. Cada item: slot, proposal_index, question, options (A,B,C,D), correct_answer, explanation, image_score, image_role, image_prompt.',
            '2. Exactamente una alternativa correcta.',
            '3. explanation justifica la correcta.',
            '4. No repitas enunciados entre propuestas del mismo slot.',
            '5. Estilo escolar chileno, 1° medio / PAES.',
            '',
            'Distribucion exacta:',
            slotRules,
            '',
            'JSON: { "items": [{ "slot":1, "proposal_index":1, "question":"...", "options":{"A":"..","B":"..","C":"..","D":".."}, "correct_answer":"A", "explanation":"...", "image_score":7, "image_role":"supporting", "image_prompt":"..." }] }'
        ].join('\n')
    };
};

const generatePhaseQuestions = async ({ subject, subjectConfig, session, phase, levelName }) => {
    const ref = resolveMoralejaSessionReference({ subject, session });
    const ctx = subjectConfig.resolveContext({ session, topic: ref?.focus || '', phase: levelName });
    const topic = ref?.focus || ctx.skill || ctx.chapterLabel || '';

    const prompts = buildPhasePrompt({
        subject, subjectDisplayName: subjectConfig.displayName,
        session, phase, levelName, topic,
        guidance: ctx.quizGuidance,
        slotsPerPhase: SLOTS_PER_PHASE,
        proposalsPerSlot: PROPOSALS_PER_SLOT
    });

    const completion = await textAI.chat.completions.create({
        model: AI_MODEL,
        messages: [
            { role: 'system', content: prompts.system },
            { role: 'user', content: prompts.user }
        ],
        response_format: { type: 'json_object' },
        temperature: subjectConfig.temperature
    });

    const parsed = JSON.parse(completion.choices[0].message.content || '{}');
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const accepted = new Set();
    const out = [];

    for (const item of items) {
        const slot = Number(item?.slot || 0);
        const pi = Number(item?.proposal_index || 0);
        if (slot < 1 || slot > SLOTS_PER_PHASE || pi < 1 || pi > PROPOSALS_PER_SLOT) continue;
        const sig = `${slot}|${pi}`;
        if (accepted.has(sig)) continue;

        const q = normalizeText(item?.question || '');
        const opts = {};
        for (const k of ['A', 'B', 'C', 'D']) opts[k] = normalizeText(item?.options?.[k] || '');
        const ca = normalizeText(item?.correct_answer || '').toUpperCase().slice(0, 1);
        const exp = normalizeText(item?.explanation || '');
        if (!q || Object.values(opts).filter(Boolean).length !== 4 || !['A', 'B', 'C', 'D'].includes(ca) || !exp) continue;

        accepted.add(sig);
        const score = Math.max(0, Math.min(10, Number(item?.image_score) || 0));
        const rawRole = String(item?.image_role || '').toLowerCase();
        const role = rawRole === 'required_for_interpretation' ? 'required_for_interpretation'
            : (rawRole === 'supporting' ? 'supporting' : 'none');

        out.push({
            subject, session, phase: Number(phase), slot, proposal_index: pi,
            level_name: levelName, topic, question: q, options: opts,
            correct_answer: ca, explanation: exp,
            image_score: score,
            image_role: role,
            image_prompt: score >= 5 ? normalizeText(item?.image_prompt || '') : ''
        });
    }
    return out;
};

const generateWithRetry = async (params, retries) => {
    let last;
    for (let i = 1; i <= retries + 1; i++) {
        try {
            if (i > 1) console.log(`  ↻ reintento ${i - 1}/${retries}`);
            return await generatePhaseQuestions(params);
        } catch (e) { last = e; console.error(`  ✗ intento ${i}: ${e.message}`); }
    }
    throw last;
};

// ─── Supabase operations ───────────────────────────────────────────

const insertQuestion = async (q, assetId = null) => {
    const question_id = generateId('QB');
    const { error } = await supabase.from('question_bank').insert({
        question_id, grade: '1medio', subject: q.subject,
        session: q.session, phase: q.phase, slot: q.slot,
        proposal_index: q.proposal_index, level_name: q.level_name,
        topic: q.topic, question: q.question, options: q.options,
        correct_answer: q.correct_answer, explanation: q.explanation,
        source_mode: 'pregenerated_v2', active: true,
        prompt_image_asset_id: assetId,
        question_visual_role: q.image_role === 'none' ? null : q.image_role
    });
    if (error) throw new Error(`insert: ${error.message}`);
    return question_id;
};

const updateQuestionImage = async (dbId, assetId, visualRole) => {
    const { error } = await supabase.from('question_bank')
        .update({ prompt_image_asset_id: assetId, question_visual_role: visualRole || 'supporting' })
        .eq('id', dbId);
    if (error) throw new Error(`updateImage: ${error.message}`);
};

const countExistingImagesInPhase = async (subject, session, phase) => {
    const { count, error } = await supabase.from('question_bank')
        .select('id', { count: 'exact', head: true })
        .eq('subject', subject).eq('session', session).eq('phase', phase)
        .eq('active', true).not('prompt_image_asset_id', 'is', null);
    if (error) return 0;
    return count || 0;
};

const fetchExistingKeys = async (subject) => {
    const keys = new Set();
    let from = 0;
    while (true) {
        const { data, error } = await supabase.from('question_bank')
            .select('subject, session, phase, slot, proposal_index')
            .eq('subject', subject).eq('active', true)
            .range(from, from + 999);
        if (error) throw new Error(`fetchExisting: ${error.message}`);
        if (!data?.length) break;
        for (const r of data) keys.add([r.subject, r.session, r.phase, r.slot, r.proposal_index].join('|'));
        if (data.length < 1000) break;
        from += 1000;
    }
    return keys;
};

const fetchQuestionsWithoutImage = async (subject, fromS, toS, phase) => {
    const rows = [];
    let from = 0;
    while (true) {
        let q = supabase.from('question_bank')
            .select('id, question_id, subject, session, phase, slot, proposal_index, topic, question, options, explanation')
            .eq('subject', subject).eq('active', true).is('prompt_image_asset_id', null)
            .gte('session', fromS).lte('session', toS);
        if (phase) q = q.eq('phase', Number(phase));
        q = q.order('session').order('phase').order('slot').range(from, from + 499);
        const { data, error } = await q;
        if (error) throw new Error(`fetchNoImg: ${error.message}`);
        if (!data?.length) break;
        rows.push(...data);
        if (data.length < 500) break;
        from += 500;
    }
    return rows;
};

// ─── Score existing questions for image (retrofit) ─────────────────

const scoreQuestionsForImage = async (subject, subjectDisplayName, questions) => {
    const formatted = questions.map((q) => ({
        id: q.question_id || q.id,
        question: q.question,
        options: q.options,
        topic: q.topic
    }));

    const completion = await textAI.chat.completions.create({
        model: AI_MODEL,
        messages: [
            {
                role: 'system',
                content: [
                    `Eres Matico, profesor chileno experto en crear imagenes pedagogicas utiles para ${subjectDisplayName}.`,
                    'Recibes preguntas YA EXISTENTES y decides cuales se benefician de imagen.',
                    'Para cada una: id, image_score (0-10), image_role, image_prompt.',
                    'Reglas:',
                    '- 9-10: imagen critica para resolver (geometria, graficos, diagramas).',
                    '- 6-8: imagen ayuda mucho pero no obligatoria.',
                    '- 3-5: decorativa.',
                    '- 0-2: no aporta.',
                    'image_role: required_for_interpretation (>=8), supporting (5-7), none (<5).',
                    'image_prompt: espanol, max 2 frases, SIN texto/numeros/letras en la imagen.',
                    'Devuelve JSON: { "scores": [{ "id":"...", "image_score":7, "image_role":"supporting", "image_prompt":"..." }] }'
                ].join('\n')
            },
            { role: 'user', content: JSON.stringify(formatted) }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
    });

    const parsed = JSON.parse(completion.choices[0].message.content || '{}');
    return Array.isArray(parsed.scores) ? parsed.scores : [];
};

// ─── Generate image for a question ─────────────────────────────────

const generateAndLinkImage = async ({ prompt, topic, subject, questionLabel, dryRun, imageSize, imageQuality }) => {
    if (dryRun) return null;
    const { buffer, mimeType } = await generateImage({ prompt, size: imageSize, quality: imageQuality });
    const saved = await saveImageToDisk(buffer, topic, subject);
    return createAssetInSupabase({
        title: `${topic || subject} ${questionLabel}`.slice(0, 180),
        subject, topicTags: topic || '', fileUrl: saved.publicUrl, mimeType,
        altText: prompt.slice(0, 180),
        caption: `Pregenerada ${questionLabel}`
    });
};

// ─── Main ──────────────────────────────────────────────────────────

const main = async () => {
    const args = parseArgs(process.argv.slice(2));
    const subject = (args.subject || 'MATEMATICA').toUpperCase().replace('LENGUAJE', 'COMPETENCIA_LECTORA');
    const subjectConfig = SUBJECT_CONFIG[subject];
    if (!subjectConfig) throw new Error(`Asignatura no soportada: ${subject}`);
    if (!AI_API_KEY) throw new Error('No hay API key para texto.');

    const fromSession = Math.max(1, Number(args.from || 1));
    const toSession = Math.max(fromSession, Number(args.to || 46));
    const maxSessions = Number(args.maxSessions || 0);
    const retries = Math.max(0, Number(args.retries || 2));
    const dryRun = Boolean(args['dry-run']);
    const retrofit = Boolean(args.retrofit);
    const skipImages = (args.imageProvider || '') === 'skip';
    const imageSize = args.imageSize || '1024x1024';
    const imageQuality = args.imageQuality || 'low';
    const imageCap = Math.max(1, Number(args.imageCap || 6));
    const minImageScore = Math.max(0, Number(args.minImageScore || 5));
    const phaseFilter = args.phase ? String(args.phase) : '';

    console.log(`\n╔══════════════════════════════════════════════╗`);
    console.log(`║  MATICO QuestionBank + Images v2 (Supabase)  ║`);
    console.log(`╚══════════════════════════════════════════════╝`);
    console.log(`Materia:      ${subject}`);
    console.log(`Sesiones:     ${fromSession}–${toSession}`);
    console.log(`Modo:         ${retrofit ? 'RETROFIT (imágenes a existentes)' : 'GENERATE (preguntas nuevas + imágenes)'}`);
    console.log(`Image cap:    ${imageCap} por fase (score >= ${minImageScore})`);
    console.log(`≈ imágenes:   máx ${(toSession - fromSession + 1) * (phaseFilter ? 1 : 3) * imageCap} (solo las que realmente necesiten)`);
    console.log(`Imágenes:     ${skipImages ? 'SKIP' : 'openai'} ${imageSize}`);
    console.log(`AI texto:     ${AI_PROVIDER} / ${AI_MODEL}`);
    console.log(`Dry-run:      ${dryRun}\n`);

    let totalInserted = 0;
    let totalImages = 0;
    let totalFailed = 0;
    let sessionsProcessed = 0;

    // ═══════════════════════════════════════════════════════════
    // RETROFIT MODE: score existing questions → generate images
    // ═══════════════════════════════════════════════════════════
    if (retrofit) {
        const phases = phaseFilter ? PHASES.filter((p) => p.phase === phaseFilter) : PHASES;

        for (let session = fromSession; session <= toSession; session++) {
            if (maxSessions > 0 && sessionsProcessed >= maxSessions) break;

            for (const pc of phases) {
                const label = `S${session} F${pc.phase}`;
                const existingImages = await countExistingImagesInPhase(subject, session, Number(pc.phase));
                const remaining = Math.max(0, imageCap - existingImages);

                if (remaining === 0) {
                    console.log(`${label} — ya tiene ${existingImages}/${imageCap} imágenes, skip`);
                    continue;
                }

                // Fetch questions without image in this phase
                const rows = await fetchQuestionsWithoutImage(subject, session, session, pc.phase);
                if (!rows.length) {
                    console.log(`${label} — sin preguntas sin imagen`);
                    continue;
                }

                // Score them
                console.log(`${label} — scoring ${rows.length} preguntas...`);
                let scores = [];
                try {
                    scores = await scoreQuestionsForImage(subject, subjectConfig.displayName, rows.slice(0, 30));
                } catch (e) {
                    console.error(`${label} ✗ scoring falló: ${e.message}`);
                    totalFailed++;
                    continue;
                }

                // Map scores back to rows
                const scoreMap = new Map(scores.map((s) => [String(s.id), s]));
                const candidates = rows
                    .map((row) => {
                        const s = scoreMap.get(row.question_id) || scoreMap.get(String(row.id));
                        if (!s || Number(s.image_score || 0) < minImageScore) return null;
                        return { ...row, image_score: Number(s.image_score), image_role: s.image_role, image_prompt: s.image_prompt || '' };
                    })
                    .filter(Boolean)
                    .sort((a, b) => b.image_score - a.image_score)
                    .slice(0, remaining);

                console.log(`${label} — ${candidates.length} candidatas (de ${scores.length} scored, cap ${remaining})`);

                for (const c of candidates) {
                    const qLabel = `${label} slot${c.slot}`;
                    if (skipImages || dryRun) {
                        console.log(`  ${qLabel} score=${c.image_score} ${dryRun ? '(dry)' : '(skip-img)'}`);
                        totalInserted++;
                        continue;
                    }
                    try {
                        const assetId = await generateAndLinkImage({
                            prompt: c.image_prompt || `Ilustracion educativa: ${c.question.slice(0, 120)}`,
                            topic: c.topic, subject, questionLabel: qLabel,
                            dryRun, imageSize, imageQuality
                        });
                        await updateQuestionImage(c.id, assetId, c.image_role || 'supporting');
                        totalImages++;
                        totalInserted++;
                        console.log(`  ${qLabel} ✓ score=${c.image_score} → ${assetId}`);
                    } catch (e) {
                        totalFailed++;
                        console.error(`  ${qLabel} ✗ ${e.message}`);
                    }
                    await sleep(500); // rate limit
                }
            }
            sessionsProcessed++;
        }
    }
    // ═══════════════════════════════════════════════════════════
    // GENERATE MODE: new questions + selective images
    // ═══════════════════════════════════════════════════════════
    else {
        const existing = await fetchExistingKeys(subject);
        console.log(`Preguntas existentes: ${existing.size}`);
        const phases = phaseFilter ? PHASES.filter((p) => p.phase === phaseFilter) : PHASES;

        for (let session = fromSession; session <= toSession; session++) {
            if (maxSessions > 0 && sessionsProcessed >= maxSessions) break;

            for (const pc of phases) {
                const label = `S${session} F${pc.phase}`;

                // Check if phase already complete
                const expectedCount = SLOTS_PER_PHASE * PROPOSALS_PER_SLOT;
                let existCount = 0;
                for (let s = 1; s <= SLOTS_PER_PHASE; s++) {
                    for (let p = 1; p <= PROPOSALS_PER_SLOT; p++) {
                        if (existing.has([subject, session, pc.phase, s, p].join('|'))) existCount++;
                    }
                }
                if (existCount >= expectedCount) {
                    console.log(`${label} — ya completa (${existCount}/${expectedCount}), skip`);
                    continue;
                }

                console.log(`${label} — generando ${expectedCount - existCount} preguntas faltantes...`);

                let questions = [];
                try {
                    questions = await generateWithRetry({
                        subject, subjectConfig, session,
                        phase: pc.phase, levelName: pc.levelName
                    }, retries);
                } catch (e) {
                    totalFailed += expectedCount;
                    console.error(`${label} ✗ generación falló: ${e.message}`);
                    continue;
                }

                // Filter already existing
                const newQs = questions.filter((q) => {
                    const key = [q.subject, q.session, q.phase, q.slot, q.proposal_index].join('|');
                    if (existing.has(key)) return false;
                    existing.add(key);
                    return true;
                });

                // Determine which questions get images (top N by image_score)
                const existingImgs = await countExistingImagesInPhase(subject, session, Number(pc.phase));
                const imgRemaining = Math.max(0, imageCap - existingImgs);

                const imgCandidates = new Set(
                    newQs
                        .filter((q) => q.image_score >= minImageScore && q.image_prompt)
                        .sort((a, b) => b.image_score - a.image_score)
                        .slice(0, imgRemaining)
                        .map((q) => `${q.slot}|${q.proposal_index}`)
                );

                console.log(`${label} → ${newQs.length} nuevas, ${imgCandidates.size} recibirán imagen`);

                for (const q of newQs) {
                    const qKey = `${q.slot}|${q.proposal_index}`;
                    const getsImage = imgCandidates.has(qKey) && !skipImages;
                    let assetId = null;

                    if (getsImage && !dryRun && q.image_prompt) {
                        try {
                            assetId = await generateAndLinkImage({
                                prompt: q.image_prompt, topic: q.topic, subject,
                                questionLabel: `${label} s${q.slot}p${q.proposal_index}`,
                                dryRun, imageSize, imageQuality
                            });
                            totalImages++;
                            console.log(`  s${q.slot}p${q.proposal_index} ✓ img score=${q.image_score}`);
                        } catch (imgErr) {
                            console.error(`  s${q.slot}p${q.proposal_index} ⚠ img falló: ${imgErr.message}`);
                        }
                        await sleep(500);
                    }

                    if (!dryRun) {
                        try {
                            await insertQuestion(q, assetId);
                            totalInserted++;
                        } catch (e) {
                            totalFailed++;
                            console.error(`  s${q.slot}p${q.proposal_index} ✗ insert: ${e.message}`);
                        }
                    } else {
                        totalInserted++;
                    }
                }
            }
            sessionsProcessed++;
            // Rate limit between sessions
            if (!dryRun) await sleep(2000);
        }
    }

    // ─── Summary ───────────────────────────────────────────────
    console.log(`\n${'═'.repeat(50)}`);
    console.log(JSON.stringify({
        mode: retrofit ? 'retrofit' : 'generate',
        subject, fromSession, toSession, sessionsProcessed,
        inserted: totalInserted, images: totalImages, failed: totalFailed,
        imageCap, minImageScore, dryRun
    }, null, 2));
    console.log(`${'═'.repeat(50)}\n`);
};

main().catch((e) => { console.error('[FATAL]', e.message); process.exitCode = 1; });
