/**
 * pregenerateWithImages.js
 * ────────────────────────
 * Genera preguntas con image_score + imágenes selectivas → Supabase directo.
 *
 * PROTOCOLO DE IMÁGENES:
 *   - La IA puntúa cada pregunta con image_score (0-10)
 *   - Solo las preguntas con image_score >= minImageScore son candidatas
 *   - Se genera imagen para las top N por fase (máximo imageCap, puede ser menos)
 *   - Si menos preguntas necesitan imagen, se generan menos (nunca forzado)
 *
 * Uso:
 *   node scripts/pregenerateWithImages.js --subject MATEMATICA --from 1 --to 5
 *   node scripts/pregenerateWithImages.js --subject FISICA --retrofit --from 1 --to 46
 *   node scripts/pregenerateWithImages.js --subject COMPETENCIA_LECTORA --retrofit
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
 *   --retrofit         Solo agregar imágenes a preguntas existentes sin imagen
 *   --dry-run          Solo muestra qué haría
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ─── Moraleja imports (RAG context) ───────────────────────────────
let resolveMoralejaContext, resolveMoralejaMatematicaContext, resolveMoralejaFisicaContext, resolveMoralejaSessionReference;
try { ({ resolveMoralejaContext } = await import('../moralejaCompetenciaLectora.js')); } catch { resolveMoralejaContext = () => ({}); }
try { ({ resolveMoralejaMatematicaContext } = await import('../moralejaMatematica.js')); } catch { resolveMoralejaMatematicaContext = () => ({}); }
try { ({ resolveMoralejaFisicaContext } = await import('../moralejaFisica.js')); } catch { resolveMoralejaFisicaContext = () => ({}); }
try { ({ resolveMoralejaSessionReference } = await import('../moralejaSessionCatalog.js')); } catch { resolveMoralejaSessionReference = () => null; }

// ─── Config ────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LOCAL_UPLOADS_DIR = process.env.LOCAL_UPLOADS_DIR || path.join(__dirname, '..', 'uploads');

if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── AI text provider (Kimi → OpenAI → DeepSeek) ──────────────────
const FORCED_AI_PROVIDER = String(process.env.AI_PROVIDER || '').trim().toLowerCase();
const AI_PROVIDER = FORCED_AI_PROVIDER || (
    (process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY) ? 'kimi'
        : (process.env.OPENAI_API_KEY ? 'openai' : 'deepseek')
);
const AI_API_KEY = AI_PROVIDER === 'kimi'
    ? (process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || '')
    : (AI_PROVIDER === 'openai'
        ? (process.env.OPENAI_API_KEY || '')
        : (process.env.DEEPSEEK_API_KEY || ''));
const AI_BASE_URL = AI_PROVIDER === 'kimi'
    ? (process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1')
    : (AI_PROVIDER === 'openai'
        ? (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1')
        : (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'));
const AI_MODEL = AI_PROVIDER === 'kimi'
    ? (process.env.KIMI_FAST_MODEL || 'kimi-k2-turbo-preview')
    : (AI_PROVIDER === 'openai'
        ? (process.env.OPENAI_FAST_MODEL || 'gpt-4.1-mini')
        : (process.env.DEEPSEEK_FAST_MODEL || 'deepseek-chat'));

if (!AI_API_KEY) {
    throw new Error(`Falta API key para AI_PROVIDER="${AI_PROVIDER}"`);
}

const textAI = new OpenAI({ apiKey: AI_API_KEY, baseURL: AI_BASE_URL });

// ─── Image provider (OpenAI gpt-image-1) ────────────────────────────
const OPENAI_IMAGE_API_KEY = process.env.OPENAI_IMAGE_API_KEY || process.env.OPENAI_API_KEY || '';
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

// ─── Constants ─────────────────────────────────────────────────────
const DEFAULT_SLOTS_PER_PHASE = 15;
const DEFAULT_PROPOSALS_PER_SLOT = 3;
const DEFAULT_SLOT_GROUP_SIZE = 5;
const PHASES = [
    { phase: '1', levelName: 'BASICO' },
    { phase: '2', levelName: 'INTERMEDIO' },
    { phase: '3', levelName: 'AVANZADO' }
];
const SUBJECT_CONFIG = {
    MATEMATICA: {
        code: 'MAT',
        displayName: 'Matematica',
        temperature: 0.35,
        resolveContext: ({ session, topic, phase }) => resolveMoralejaMatematicaContext({ session, topic, phase, mode: 'quiz' })
    },
    COMPETENCIA_LECTORA: {
        code: 'LEN',
        displayName: 'Lenguaje y Comunicacion',
        temperature: 0.45,
        resolveContext: ({ session, topic, phase }) => resolveMoralejaContext({ session, topic, phase, mode: 'quiz' })
    },
    FISICA: {
        code: 'FIS',
        displayName: 'Fisica',
        temperature: 0.4,
        resolveContext: ({ session, topic, phase }) => resolveMoralejaFisicaContext({ session, topic, phase, mode: 'quiz' })
    }
};

// ─── Helpers ───────────────────────────────────────────────────────
const sanitize = (v = '') => String(v).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'archivo';

const normalizeText = (v = '') => String(v || '').replace(/\s+/g, ' ').trim();

const parseArgs = (argv = []) => {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const t = argv[i];
        if (!t.startsWith('--')) continue;
        const key = t.slice(2);
        const next = argv[i + 1];
        if (!next || next.startsWith('--')) { args[key] = true; continue; }
        args[key] = next;
        i++;
    }
    return args;
};

const normalizeSubject = (v = 'MATEMATICA') => String(v || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const generateId = (prefix = 'QB') => `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const mimeExt = (mime = '') => ({ 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' })[mime] || '.png';

// ─── Supabase queries ──────────────────────────────────────────────
const countExistingQuestions = async (subject, session, phase) => {
    const { count, error } = await supabase
        .from('question_bank')
        .select('*', { count: 'exact', head: true })
        .eq('subject', subject)
        .eq('session', Number(session))
        .eq('phase', Number(phase))
        .eq('active', true);
    if (error) throw new Error(`countExisting: ${error.message}`);
    return count || 0;
};

const countExistingImages = async (subject, session, phase) => {
    const { count, error } = await supabase
        .from('question_bank')
        .select('*', { count: 'exact', head: true })
        .eq('subject', subject)
        .eq('session', Number(session))
        .eq('phase', Number(phase))
        .eq('active', true)
        .not('prompt_image_asset_id', 'is', null);
    if (error) throw new Error(`countImages: ${error.message}`);
    return count || 0;
};

const fetchQuestionsWithoutImage = async (subject, session, phase) => {
    const { data, error } = await supabase
        .from('question_bank')
        .select('question_id, subject, session, phase, slot, proposal_index, level_name, topic, question, options, correct_answer, explanation')
        .eq('subject', subject)
        .eq('session', Number(session))
        .eq('phase', Number(phase))
        .eq('active', true)
        .is('prompt_image_asset_id', null)
        .order('slot', { ascending: true })
        .limit(50);
    if (error) throw new Error(`fetchNoImage: ${error.message}`);
    return data || [];
};

// ─── Image generation (OpenAI) ─────────────────────────────────────
const generateImage = async (prompt, { size = '1024x1024', quality = 'low' } = {}) => {
    if (!OPENAI_IMAGE_API_KEY) throw new Error('No hay OPENAI_IMAGE_API_KEY para generar imágenes');
    const client = new OpenAI({ apiKey: OPENAI_IMAGE_API_KEY });
    const styledPrompt = /blanco y negro|black and white/i.test(prompt)
        ? prompt
        : 'Dibujo simple en blanco y negro, estilo libro escolar, linea limpia, minimalista, fondo blanco. ' + prompt;

    const imagePayload = { model: OPENAI_IMAGE_MODEL, prompt: styledPrompt, size };
    if (/^dall-e/i.test(OPENAI_IMAGE_MODEL)) imagePayload.response_format = 'b64_json';

    const response = await client.images.generate(imagePayload);
    const first = response?.data?.[0];
    if (!first) throw new Error('OpenAI no devolvió imagen');

    if (first.b64_json) return { buffer: Buffer.from(first.b64_json, 'base64'), mimeType: 'image/png' };
    if (first.url) {
        const r = await fetch(first.url);
        if (!r.ok) throw new Error(`Fetch imagen URL falló: ${r.status}`);
        return { buffer: Buffer.from(await r.arrayBuffer()), mimeType: 'image/png' };
    }
    throw new Error('OpenAI no devolvió b64 ni URL');
};

const saveImageToDisk = async (buffer, fileName, subfolder = 'quiz-assets') => {
    const parts = String(subfolder || 'quiz-assets').replace(/\\/g, '/').split('/').filter(Boolean);
    const targetDir = path.join(LOCAL_UPLOADS_DIR, ...parts);
    await fs.mkdir(targetDir, { recursive: true });
    const cleanName = sanitize(path.parse(fileName).name);
    const ext = path.extname(fileName) || '.png';
    let finalName = `${cleanName}${ext}`;
    let suffix = 1;
    while (true) {
        try { await fs.access(path.join(targetDir, finalName)); finalName = `${cleanName}_${Date.now()}_${suffix}${ext}`; suffix++; } catch { break; }
    }
    await fs.writeFile(path.join(targetDir, finalName), buffer);
    return { publicUrl: `/uploads/${parts.join('/')}/${finalName}`, fileName: finalName };
};

const createAssetInSupabase = async ({ subject, topic, title, altText, caption, publicUrl, mimeType }) => {
    const asset_id = generateId('IMG');
    const { data, error } = await supabase
        .from('pedagogical_assets')
        .insert({
            asset_id,
            title: (title || '').slice(0, 180),
            subject: subject || null,
            topic_tags: (topic || '').slice(0, 300),
            kind: 'question_illustration',
            storage_path: publicUrl,
            public_url: publicUrl,
            mime_type: mimeType || 'image/png',
            alt_text: (altText || '').slice(0, 180),
            caption: (caption || '').slice(0, 300),
            source_type: 'ai_generated',
            status: 'approved'
        })
        .select('asset_id')
        .single();
    if (error) throw new Error(`createAsset: ${error.message}`);
    return data.asset_id;
};

const linkImageToQuestion = async (questionId, assetId, visualRole) => {
    const { error } = await supabase
        .from('question_bank')
        .update({
            prompt_image_asset_id: assetId,
            question_visual_role: visualRole || 'supporting',
            updated_at: new Date().toISOString()
        })
        .eq('question_id', questionId);
    if (error) throw new Error(`linkImage: ${error.message}`);
};

// ─── AI: Score existing questions for image ────────────────────────
const scoreQuestionsForImage = async (subject, subjectDisplay, questions) => {
    if (!questions.length) return [];

    const systemPrompt = [
        'Eres Matico, profesor chileno experto en crear imagenes pedagogicas utiles.',
        'Recibes preguntas existentes y decides cuales se BENEFICIAN REALMENTE de una imagen.',
        'NO fuerces imagenes donde no aportan. Calculo numerico puro, definiciones verbales, etimologia → NO necesitan imagen.',
        'SI necesitan imagen: geometria, graficos, mapas, anatomia, circuitos, diagramas, figuras, esquemas.',
        'Para cada pregunta devuelve: question_id, image_score, image_role, image_prompt.',
        'Reglas de scoring:',
        '- image_score 9-10: sin imagen la pregunta pierde sentido (ej: identificar angulo en figura).',
        '- image_score 6-8: la imagen ayuda mucho al contexto.',
        '- image_score 3-5: decorativa o redundante → NO generar.',
        '- image_score 0-2: no aporta → NO generar.',
        'image_role: "required_for_interpretation" si score >= 8, "supporting" si 5-7, "none" si < 5.',
        'image_prompt SOLO si score >= 5. Espanol, max 2 frases concretas.',
        'image_prompt NO debe pedir texto, numeros ni letras escritos dentro de la imagen.',
        'Devuelve SOLO JSON: { "scores": [ { "question_id": "...", "image_score": N, "image_role": "...", "image_prompt": "..." } ] }'
    ].join(' ');

    const userPrompt = [
        `Asignatura: ${subject} (${subjectDisplay})`,
        'Preguntas:',
        ...questions.map((q, i) => [
            `[${i + 1}] question_id=${q.question_id}`,
            `topic=${q.topic || ''}`,
            `question=${String(q.question || '').slice(0, 500)}`,
            `options=${JSON.stringify(q.options || {})}`
        ].join(' | '))
    ].join('\n');

    const completion = await textAI.chat.completions.create({
        model: AI_MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.25,
        response_format: { type: 'json_object' }
    });

    let parsed;
    try { parsed = JSON.parse(completion.choices?.[0]?.message?.content || '{}'); } catch { parsed = {}; }
    return (Array.isArray(parsed.scores) ? parsed.scores : []).map(item => {
        const score = Math.max(0, Math.min(10, Number(item?.image_score) || 0));
        const rawRole = String(item?.image_role || '').trim().toLowerCase();
        return {
            question_id: String(item?.question_id || '').trim(),
            image_score: score,
            image_role: rawRole === 'required_for_interpretation' ? 'required_for_interpretation' : (rawRole === 'supporting' ? 'supporting' : 'none'),
            image_prompt: String(item?.image_prompt || '').trim()
        };
    });
};

// ─── AI: Generate questions with image scoring ─────────────────────
const generatePhaseQuestions = async ({ subject, subjectConfig, session, phase, levelName, count = 15 }) => {
    const sessionRef = resolveMoralejaSessionReference({ subject, session });
    const ctx = subjectConfig.resolveContext({ session, topic: sessionRef?.focus || '', phase: levelName });
    const topic = sessionRef?.focus || ctx?.skill || ctx?.chapterLabel || '';
    const guidance = ctx?.quizGuidance || '';

    const systemPrompt = [
        `Eres Matico, profesor experto en ${subjectConfig.displayName} del curriculum chileno de 1 medio.`,
        `Genera EXACTAMENTE ${count} preguntas de seleccion multiple (4 alternativas A/B/C/D) para esta sesion y fase.`,
        'Para CADA pregunta evalua si se beneficia de una imagen o diagrama.',
        'NO fuerces imagenes: calculo numerico abstracto, definiciones verbales → NO necesitan imagen.',
        'SI necesitan imagen: geometria, graficos, mapas, circuitos, diagramas, figuras.',
        'Devuelve SOLO JSON: { "items": [ {',
        '  "slot": N, "proposal_index": N,',
        '  "topic": "...", "question": "...",',
        '  "options": {"A":"...","B":"...","C":"...","D":"..."},',
        '  "correct_answer": "A|B|C|D", "explanation": "...",',
        '  "image_score": 0-10, "image_role": "required_for_interpretation"|"supporting"|"none",',
        '  "image_prompt": "..."',
        '} ] }',
        'Reglas scoring:',
        '- 9-10: sin imagen pierde sentido.',
        '- 6-8: imagen ayuda mucho.',
        '- 3-5: decorativa → score bajo.',
        '- 0-2: no aporta.',
        'image_prompt SOLO si score >= 5. Espanol, max 2 frases. NO texto/numeros dentro de imagen.',
        'Estilo: dibujo blanco y negro, linea limpia, minimalista, libro escolar.'
    ].join(' ');

    const slotRules = [];
    for (let s = 1; s <= DEFAULT_SLOTS_PER_PHASE; s++) {
        slotRules.push(`- slot ${s}: genera ${DEFAULT_PROPOSALS_PER_SLOT} propuestas (proposal_index 1,2,3)`);
    }

    const userPrompt = [
        `Asignatura: ${subject} (${subjectConfig.displayName})`,
        `Sesion: ${session}`,
        `Fase: ${phase} (${levelName})`,
        `Tema: ${topic}`,
        '',
        '[BASE PEDAGOGICA MORALEJA]',
        guidance,
        '',
        'Distribucion:',
        ...slotRules
    ].join('\n');

    const completion = await textAI.chat.completions.create({
        model: AI_MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: subjectConfig.temperature
    });

    let parsed;
    try { parsed = JSON.parse(completion.choices?.[0]?.message?.content || '{}'); } catch { parsed = {}; }
    const items = Array.isArray(parsed.items) ? parsed.items : [];

    return items.map(item => {
        const options = {
            A: String(item?.options?.A || '').trim(),
            B: String(item?.options?.B || '').trim(),
            C: String(item?.options?.C || '').trim(),
            D: String(item?.options?.D || '').trim()
        };
        if (!options.A || !options.B || !options.C || !options.D) return null;
        const question = normalizeText(item?.question || '');
        if (!question) return null;
        const ca = normalizeText(item?.correct_answer || '').toUpperCase().slice(0, 1);
        if (!['A', 'B', 'C', 'D'].includes(ca)) return null;
        const score = Math.max(0, Math.min(10, Number(item?.image_score) || 0));
        return {
            slot: Number(item?.slot || 0),
            proposal_index: Number(item?.proposal_index || 1),
            topic: normalizeText(item?.topic || topic),
            question,
            options,
            correct_answer: ca,
            explanation: normalizeText(item?.explanation || ''),
            image_score: score,
            image_role: score >= 8 ? 'required_for_interpretation' : (score >= 5 ? 'supporting' : 'none'),
            image_prompt: String(item?.image_prompt || '').trim()
        };
    }).filter(Boolean);
};

// ─── Generate image for a candidate question ───────────────────────
const generateImageForCandidate = async (candidate, { subject, session, phase, imageSize, imageQuality, dryRun }) => {
    const prompt = candidate.image_prompt || `Ilustracion educativa: ${candidate.question.slice(0, 120)}`;
    if (dryRun) {
        console.log(`    [dry] Generaría imagen para ${candidate.question_id || 'nuevo'}: ${prompt.slice(0, 80)}...`);
        return null;
    }

    console.log(`    Generando imagen para ${candidate.question_id || 'nuevo'}...`);
    const { buffer, mimeType } = await generateImage(prompt, { size: imageSize, quality: imageQuality });
    const fileName = `${sanitize(`${subject}_s${session}_p${phase}`.slice(0, 50))}_${Date.now()}${mimeExt(mimeType)}`;
    const { publicUrl } = await saveImageToDisk(buffer, fileName);

    const assetId = await createAssetInSupabase({
        subject,
        topic: candidate.topic || '',
        title: `${candidate.topic || subject} S${session}P${phase}`.slice(0, 180),
        altText: prompt.slice(0, 180),
        caption: `Pregunta: ${candidate.question.slice(0, 200)}`,
        publicUrl,
        mimeType
    });
    return assetId;
};

// ─── MAIN ──────────────────────────────────────────────────────────
const main = async () => {
    const args = parseArgs(process.argv.slice(2));
    const subject = normalizeSubject(args.subject || 'MATEMATICA');
    const subjectConfig = SUBJECT_CONFIG[subject];
    if (!subjectConfig) throw new Error(`Asignatura no soportada: ${subject}. Usa MATEMATICA, COMPETENCIA_LECTORA o FISICA.`);

    const fromSession = Math.max(1, Number(args.from || 1));
    const toSession = Math.max(fromSession, Number(args.to || 46));
    const phaseFilter = args.phase ? Number(args.phase) : null;
    const imageCap = Math.max(1, Number(args.imageCap || 6));
    const minImageScore = Math.max(0, Number(args.minImageScore || 5));
    const retries = Math.max(0, Number(args.retries || 2));
    const maxSessions = Number(args.maxSessions || 0);
    const imageProvider = String(args.imageProvider || 'openai').toLowerCase();
    const imageSize = args.imageSize || '1024x1024';
    const imageQuality = args.imageQuality || 'low';
    const isRetrofit = Boolean(args.retrofit);
    const dryRun = Boolean(args['dry-run']);

    const phases = phaseFilter ? PHASES.filter(p => Number(p.phase) === phaseFilter) : PHASES;

    console.log('═══════════════════════════════════════════════════');
    console.log(`  pregenerateWithImages — ${isRetrofit ? 'RETROFIT' : 'GENERATE'}`);
    console.log('═══════════════════════════════════════════════════');
    console.log(`Materia:      ${subject} (${subjectConfig.displayName})`);
    console.log(`Sesiones:     ${fromSession}-${toSession}`);
    console.log(`Fases:        ${phases.map(p => p.phase).join(', ')}`);
    console.log(`AI texto:     ${AI_PROVIDER} → ${AI_MODEL}`);
    console.log(`AI imágenes:  ${imageProvider === 'skip' ? 'SKIP' : `openai → ${OPENAI_IMAGE_MODEL}`}`);
    console.log(`Image cap:    máx ${imageCap}/fase (score >= ${minImageScore})`);
    console.log(`Modo:         ${dryRun ? 'DRY-RUN' : 'WRITE'}`);
    console.log('═══════════════════════════════════════════════════\n');

    let totalQuestions = 0;
    let totalImages = 0;
    let sessionsProcessed = 0;
    const errors = [];

    for (let session = fromSession; session <= toSession; session++) {
        if (maxSessions > 0 && sessionsProcessed >= maxSessions) break;

        for (const phaseConfig of phases) {
            const label = `S${session} P${phaseConfig.phase} (${phaseConfig.levelName})`;

            try {
                if (isRetrofit) {
                    // ── RETROFIT: score existing questions, generate images for top candidates ──
                    const existingImgs = await countExistingImages(subject, session, phaseConfig.phase);
                    const remaining = Math.max(0, imageCap - existingImgs);

                    if (remaining === 0) {
                        console.log(`${label} — ya tiene ${existingImgs} imágenes, skip`);
                        continue;
                    }

                    const rows = await fetchQuestionsWithoutImage(subject, session, phaseConfig.phase);
                    if (!rows.length) {
                        console.log(`${label} — sin preguntas sin imagen, skip`);
                        continue;
                    }

                    console.log(`${label} — ${rows.length} preguntas sin imagen, scoring...`);
                    const scores = await scoreQuestionsForImage(subject, subjectConfig.displayName, rows.slice(0, 30));

                    // Match scores to questions, filter by minImageScore, sort, cap
                    const candidates = scores
                        .filter(s => s.image_score >= minImageScore && s.image_prompt)
                        .sort((a, b) => b.image_score - a.image_score)
                        .slice(0, remaining);

                    if (!candidates.length) {
                        console.log(`${label} — ninguna pregunta necesita imagen (todas score < ${minImageScore})`);
                        continue;
                    }

                    console.log(`${label} — ${candidates.length} preguntas necesitan imagen (de ${rows.length} total)`);

                    if (imageProvider === 'skip') {
                        console.log(`${label} — imageProvider=skip, saltando generación`);
                        continue;
                    }

                    for (const c of candidates) {
                        const qRow = rows.find(r => r.question_id === c.question_id);
                        if (!qRow) continue;

                        try {
                            const assetId = await generateImageForCandidate(
                                { ...qRow, image_prompt: c.image_prompt, topic: qRow.topic },
                                { subject, session, phase: phaseConfig.phase, imageSize, imageQuality, dryRun }
                            );
                            if (assetId) {
                                await linkImageToQuestion(qRow.question_id, assetId, c.image_role);
                                totalImages++;
                                console.log(`    ✓ ${qRow.question_id} → ${assetId} (score ${c.image_score})`);
                            }
                        } catch (err) {
                            console.error(`    ✗ ${qRow.question_id}: ${err.message}`);
                            errors.push({ session, phase: phaseConfig.phase, questionId: qRow.question_id, error: err.message });
                        }
                        await sleep(1500); // rate limit
                    }

                } else {
                    // ── GENERATE: create new questions with scoring, then images ──
                    const existingCount = await countExistingQuestions(subject, session, phaseConfig.phase);
                    const target = DEFAULT_SLOTS_PER_PHASE * DEFAULT_PROPOSALS_PER_SLOT; // 45
                    if (existingCount >= target) {
                        console.log(`${label} — ya tiene ${existingCount}/${target} preguntas, skip`);
                        continue;
                    }

                    console.log(`${label} — generando preguntas...`);
                    let items = [];
                    for (let attempt = 1; attempt <= retries + 1; attempt++) {
                        try {
                            items = await generatePhaseQuestions({
                                subject, subjectConfig, session,
                                phase: phaseConfig.phase,
                                levelName: phaseConfig.levelName,
                                count: target
                            });
                            if (items.length > 0) break;
                        } catch (err) {
                            console.error(`    Intento ${attempt} falló: ${err.message}`);
                            if (attempt > retries) {
                                errors.push({ session, phase: phaseConfig.phase, error: err.message });
                            }
                        }
                    }

                    if (!items.length) {
                        console.log(`${label} — sin preguntas generadas, skip`);
                        continue;
                    }

                    // Insert questions to Supabase
                    let insertedPhase = 0;
                    for (const item of items) {
                        if (dryRun) { insertedPhase++; continue; }
                        try {
                            const question_id = generateId('QB');
                            const { error } = await supabase.from('question_bank').insert({
                                question_id,
                                grade: '1medio',
                                subject,
                                session: Number(session),
                                phase: Number(phaseConfig.phase),
                                slot: item.slot || null,
                                proposal_index: item.proposal_index || 1,
                                level_name: phaseConfig.levelName,
                                topic: item.topic,
                                question: item.question,
                                options: item.options,
                                correct_answer: item.correct_answer,
                                explanation: item.explanation,
                                source_mode: 'pregenerated_quiz_bank',
                                active: true
                            });
                            if (error) throw new Error(error.message);
                            item._question_id = question_id;
                            insertedPhase++;
                        } catch (err) {
                            console.error(`    Insert falló: ${err.message}`);
                        }
                    }
                    totalQuestions += insertedPhase;
                    console.log(`${label} — ${insertedPhase} preguntas insertadas`);

                    // Now generate images for top candidates
                    if (imageProvider !== 'skip') {
                        const existingImgs = await countExistingImages(subject, session, phaseConfig.phase);
                        const imgRemaining = Math.max(0, imageCap - existingImgs);
                        const imgCandidates = items
                            .filter(q => q.image_score >= minImageScore && q.image_prompt && q._question_id)
                            .sort((a, b) => b.image_score - a.image_score)
                            .slice(0, imgRemaining);

                        if (imgCandidates.length) {
                            console.log(`${label} — ${imgCandidates.length} preguntas necesitan imagen`);
                        }

                        for (const c of imgCandidates) {
                            try {
                                const assetId = await generateImageForCandidate(
                                    { ...c, question_id: c._question_id },
                                    { subject, session, phase: phaseConfig.phase, imageSize, imageQuality, dryRun }
                                );
                                if (assetId) {
                                    await linkImageToQuestion(c._question_id, assetId, c.image_role);
                                    totalImages++;
                                    console.log(`    ✓ ${c._question_id} → ${assetId} (score ${c.image_score})`);
                                }
                            } catch (err) {
                                console.error(`    ✗ imagen: ${err.message}`);
                                errors.push({ session, phase: phaseConfig.phase, error: err.message });
                            }
                            await sleep(1500);
                        }
                    }
                }
            } catch (err) {
                console.error(`${label} — ERROR: ${err.message}`);
                errors.push({ session, phase: phaseConfig.phase, error: err.message });
            }
        }

        sessionsProcessed++;
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  RESUMEN');
    console.log('═══════════════════════════════════════════════════');
    console.log(`Sesiones procesadas: ${sessionsProcessed}`);
    console.log(`Preguntas insertadas: ${totalQuestions}`);
    console.log(`Imágenes generadas: ${totalImages}`);
    console.log(`Errores: ${errors.length}`);
    if (errors.length) {
        errors.slice(0, 10).forEach(e => console.log(`  - S${e.session} P${e.phase}: ${e.error?.slice(0, 100)}`));
    }
    console.log('═══════════════════════════════════════════════════');
};

main().catch(err => {
    console.error('[FATAL]', err.message);
    process.exitCode = 1;
});
