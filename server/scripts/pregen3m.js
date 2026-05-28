/**
 * pregen3m.js — Pre-generador de teorías lúdicas y quizes para 3° medio
 *
 * PROVEEDORES:
 *   - Texto (teorías + preguntas quiz) → DeepSeek (deepseek-chat)
 *   - Imágenes (solo image_score >= 9)  → OpenAI (gpt-image-1)
 *
 * USO:
 *   node scripts/pregen3m.js --type theory --subject MATEMATICA
 *   node scripts/pregen3m.js --type quiz   --subject FISICA --from 1 --to 10
 *   node scripts/pregen3m.js --type all    --subject all
 *   node scripts/pregen3m.js --type theory --dry-run
 *
 * ARGS:
 *   --type     theory | quiz | all         (default: theory)
 *   --subject  MATEMATICA|LENGUAJE|FISICA|QUIMICA|BIOLOGIA|HISTORIA|all
 *   --from     sesión inicio               (default: 1)
 *   --to       sesión fin                  (default: 46)
 *   --delay    ms entre llamadas AI texto  (default: 1000)
 *   --img-score  score mínimo para imagen  (default: 9)
 *   --skip-images  no generar imágenes
 *   --dry-run  preview sin gastar tokens
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

import { resolveMoralejaContext } from '../moralejaCompetenciaLectora.js';
import { resolveMoralejaMatematicaContext } from '../moralejaMatematica.js';
import { resolveMoralejaFisicaContext } from '../moralejaFisica.js';
import { resolveMoralejaQuimicaContext } from '../moralejaQuimica.js';
import { resolveMoralejaBiologiaContext } from '../moralejaBiologia.js';
import { resolveMoralejaHistoriaContext } from '../moralejaHistoria.js';
import { resolveMoralejaSessionReference } from '../moralejaSessionCatalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ══════════════════════════════════════════════════════════════════════
// PROVEEDOR TEXTO: DeepSeek preferido, fallback a Kimi, fallback a OpenAI
// ══════════════════════════════════════════════════════════════════════
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
const KIMI_KEY = process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || '';
const OPENAI_TEXT_KEY = process.env.OPENAI_API_KEY || '';

let TEXT_PROVIDER, TEXT_KEY, TEXT_URL, DEEPSEEK_MODEL;
if (DEEPSEEK_KEY) {
    TEXT_PROVIDER = 'deepseek';
    TEXT_KEY = DEEPSEEK_KEY;
    TEXT_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
    DEEPSEEK_MODEL = process.env.DEEPSEEK_FAST_MODEL || 'deepseek-chat';
} else if (KIMI_KEY) {
    TEXT_PROVIDER = 'kimi';
    TEXT_KEY = KIMI_KEY;
    TEXT_URL = process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1';
    DEEPSEEK_MODEL = process.env.KIMI_FAST_MODEL || 'kimi-k2-turbo-preview';
} else if (OPENAI_TEXT_KEY) {
    TEXT_PROVIDER = 'openai';
    TEXT_KEY = OPENAI_TEXT_KEY;
    TEXT_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    DEEPSEEK_MODEL = process.env.OPENAI_FAST_MODEL || 'gpt-4.1-mini';
} else {
    throw new Error('[pregen3m] Falta DEEPSEEK_API_KEY, KIMI_API_KEY o OPENAI_API_KEY en .env');
}
const textAI = new OpenAI({ apiKey: TEXT_KEY, baseURL: TEXT_URL });

// ══════════════════════════════════════════════════════════════════════
// PROVEEDOR IMÁGENES: OpenAI gpt-image-1 (solo para score >= 9)
// ══════════════════════════════════════════════════════════════════════
const OPENAI_IMG_KEY = process.env.OPENAI_IMAGE_API_KEY || process.env.OPENAI_API_KEY || '';
const OPENAI_IMG_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const LOCAL_UPLOADS_DIR = process.env.LOCAL_UPLOADS_DIR || path.join(__dirname, '..', 'uploads');

// ══════════════════════════════════════════════════════════════════════
// SUPABASE
// ══════════════════════════════════════════════════════════════════════
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('[pregen3m] Falta SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ══════════════════════════════════════════════════════════════════════
// CONSTANTES
// ══════════════════════════════════════════════════════════════════════
const GRADE = '3medio';
const SESSIONS = 46;
const PHASES = [
    { phase: 1, levelName: 'BASICO' },
    { phase: 2, levelName: 'INTERMEDIO' },
    { phase: 3, levelName: 'AVANZADO' }
];
const SLOTS_PER_PHASE = 15;
const PROPOSALS_PER_SLOT = 3;
const SLOT_GROUP = 5;

// ══════════════════════════════════════════════════════════════════════
// MATERIAS 3° MEDIO
// ══════════════════════════════════════════════════════════════════════
const SUBJECTS = {
    MATEMATICA: {
        displayName: 'Matemática 3° Medio',
        temperature: 0.35,
        resolveContext: (a) => resolveMoralejaMatematicaContext({ ...a, grade: GRADE })
    },
    LENGUAJE: {
        displayName: 'Lengua y Literatura 3° Medio',
        temperature: 0.45,
        resolveContext: (a) => resolveMoralejaContext({ ...a, grade: GRADE })
    },
    FISICA: {
        displayName: 'Física 3° Medio (Diferenciado HC)',
        temperature: 0.4,
        resolveContext: (a) => resolveMoralejaFisicaContext({ ...a, grade: GRADE })
    },
    QUIMICA: {
        displayName: 'Química 3° Medio (Diferenciado HC)',
        temperature: 0.4,
        resolveContext: (a) => resolveMoralejaQuimicaContext({ ...a, grade: GRADE })
    },
    BIOLOGIA: {
        displayName: 'Biología Celular y Molecular 3° Medio',
        temperature: 0.4,
        resolveContext: (a) => resolveMoralejaBiologiaContext({ ...a, grade: GRADE })
    },
    HISTORIA: {
        displayName: 'Educación Ciudadana 3° Medio',
        temperature: 0.45,
        resolveContext: (a) => resolveMoralejaHistoriaContext({ ...a, grade: GRADE })
    }
};

// ══════════════════════════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════════════════════════
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (v = '') => String(v || '').replace(/\s+/g, ' ').trim();
const generateId = (prefix = 'QB') => `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;

const sanitizeFileName = (v = '') => String(v)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'archivo';

const parseArgs = (argv) => {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const t = argv[i];
        if (!t.startsWith('--')) continue;
        const key = t.slice(2);
        const next = argv[i + 1];
        if (!next || next.startsWith('--')) { args[key] = true; continue; }
        args[key] = next; i++;
    }
    return args;
};

const formatTime = (s) => s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;

const progressLine = (done, total, start) => {
    const pct = total ? Math.round((done / total) * 100) : 0;
    const eta = done > 0 ? ((Date.now() - start) / 1000 / done) * (total - done) : 0;
    return `[${String(done).padStart(String(total).length)}/${total}] ${pct}% ETA ${formatTime(eta)}`;
};

// ══════════════════════════════════════════════════════════════════════
// SUPABASE — LECTURA / ESCRITURA
// ══════════════════════════════════════════════════════════════════════
const getExistingTheories = async (subject) => {
    const { data, error } = await supabase
        .from('theory_ludica_bank')
        .select('session,phase')
        .eq('grade', GRADE).eq('subject', subject).eq('active', true);
    if (error) throw new Error(`getExistingTheories: ${error.message}`);
    return new Set((data || []).map((r) => `${r.session}|${r.phase}`));
};

const saveTheory = async ({ subject, session, phase, topic, theory }) => {
    const { error } = await supabase.from('theory_ludica_bank').insert({
        grade: GRADE, subject,
        session: Number(session), phase: Number(phase),
        topic, theory_markdown: theory,
        source: 'pregen3m_deepseek', active: true
    });
    if (error) throw new Error(`saveTheory: ${error.message}`);
};

const getExistingQuizKeys = async (subject) => {
    const { data, error } = await supabase
        .from('question_bank')
        .select('session,phase,slot,proposal_index')
        .eq('grade', GRADE).eq('subject', subject).eq('active', true);
    if (error) throw new Error(`getExistingQuizKeys: ${error.message}`);
    return new Set((data || []).map((r) => `${r.session}|${r.phase}|${r.slot}|${r.proposal_index}`));
};

const saveQuizItems = async (items) => {
    if (!items.length) return 0;
    const rows = items.map((item) => ({
        grade: GRADE,
        subject: item.subject,
        session: Number(item.session),
        phase: Number(item.phase),
        slot: Number(item.slot),
        proposal_index: Number(item.proposal_index),
        level_name: item.level_name,
        topic: item.topic,
        question: item.question,
        options: item.options,
        correct_answer: item.correct_answer,
        explanation: item.explanation,
        source_mode: 'pregen3m_deepseek',
        active: true
    }));
    const { data, error } = await supabase.from('question_bank').insert(rows).select('question_id,slot,proposal_index');
    if (error) throw new Error(`saveQuizItems: ${error.message}`);
    return data || [];
};

const createImageAsset = async ({ subject, topic, title, altText, caption, publicUrl, mimeType }) => {
    const asset_id = generateId('IMG');
    const { data, error } = await supabase.from('pedagogical_assets').insert({
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
    }).select('asset_id').single();
    if (error) throw new Error(`createImageAsset: ${error.message}`);
    return data.asset_id;
};

const linkImageToQuestion = async (questionId, assetId, visualRole) => {
    const { error } = await supabase.from('question_bank').update({
        prompt_image_asset_id: assetId,
        question_visual_role: visualRole || 'required_for_interpretation',
        updated_at: new Date().toISOString()
    }).eq('question_id', questionId);
    if (error) throw new Error(`linkImage: ${error.message}`);
};

// ══════════════════════════════════════════════════════════════════════
// IMÁGENES — OpenAI gpt-image-1
// ══════════════════════════════════════════════════════════════════════
const generateImage = async (prompt) => {
    if (!OPENAI_IMG_KEY) throw new Error('Falta OPENAI_IMAGE_API_KEY / OPENAI_API_KEY para imágenes');
    const client = new OpenAI({ apiKey: OPENAI_IMG_KEY });
    const styledPrompt = 'Dibujo simple en blanco y negro, estilo libro escolar, línea limpia, minimalista, fondo blanco. ' + prompt;
    const response = await client.images.generate({
        model: OPENAI_IMG_MODEL,
        prompt: styledPrompt,
        size: '1024x1024'
    });
    const first = response?.data?.[0];
    if (!first) throw new Error('OpenAI no devolvió imagen');
    if (first.b64_json) return { buffer: Buffer.from(first.b64_json, 'base64'), mimeType: 'image/png' };
    if (first.url) {
        const r = await fetch(first.url);
        if (!r.ok) throw new Error(`Fetch imagen falló: ${r.status}`);
        return { buffer: Buffer.from(await r.arrayBuffer()), mimeType: 'image/png' };
    }
    throw new Error('OpenAI no devolvió b64 ni URL');
};

const saveImageToDisk = async (buffer, fileName) => {
    const dir = path.join(LOCAL_UPLOADS_DIR, 'quiz-assets-3m');
    await fs.mkdir(dir, { recursive: true });
    const name = sanitizeFileName(path.parse(fileName).name);
    const finalName = `${name}_${Date.now()}.png`;
    await fs.writeFile(path.join(dir, finalName), buffer);
    return `/uploads/quiz-assets-3m/${finalName}`;
};

// ══════════════════════════════════════════════════════════════════════
// TEORÍAS — DeepSeek
// ══════════════════════════════════════════════════════════════════════
const buildTheorySystem = () =>
    `Eres Matico, mentor carismático experto en el currículum chileno de 3er Medio.
Responde SIEMPRE en Markdown con emojis, títulos (##), listas y ejemplos claros.
Tono cercano, motivador y lleno de energía. NUNCA respondas con JSON.`;

const buildTheoryUser = ({ subject, session, phase, levelName, topic, guidance }) => [
    `Tema: ${topic}`,
    `Asignatura: ${subject} | Sesión: ${session} | Fase: ${levelName}`,
    '',
    '[BASE PEDAGÓGICA]',
    guidance,
    '',
    'Genera una teoría lúdica completa:',
    '1. Concepto principal con analogía cotidiana',
    '2. Explicación paso a paso con ejemplo resuelto',
    '3. Errores frecuentes que cometen los estudiantes',
    '4. Mini tip PAES/SIMCE al final',
    '5. Pregunta reflexiva para motivar a seguir estudiando'
].join('\n');

const generateTheory = async ({ subject, subjectConfig, session, phase, levelName }) => {
    const ref = resolveMoralejaSessionReference({ subject, session, grade: GRADE });
    const ctx = subjectConfig.resolveContext({ session, topic: ref?.focus || '', phase: levelName, mode: 'theory' });
    const topic = ref?.focus || ctx.skill || ctx.chapterLabel || `${subject} sesión ${session}`;

    const comp = await textAI.chat.completions.create({
        model: DEEPSEEK_MODEL,
        temperature: subjectConfig.temperature,
        messages: [
            { role: 'system', content: buildTheorySystem() },
            { role: 'user', content: buildTheoryUser({ subject, session, phase, levelName, topic, guidance: ctx.theoryGuidance || '' }) }
        ]
    });
    return { theory: comp.choices[0].message.content || '', topic };
};

// ══════════════════════════════════════════════════════════════════════
// QUIZ — DeepSeek (con image_score) + imágenes OpenAI (score >= 9)
// ══════════════════════════════════════════════════════════════════════
const buildQuizSystem = ({ displayName }) => [
    `Eres Matico, profesor experto en ${displayName} del currículum chileno de 3er Medio.`,
    'Genera preguntas de opción múltiple de alta calidad pedagógica.',
    'Para CADA pregunta evalúa si se beneficia de imagen:',
    '  image_score 9-10: sin imagen pierde sentido (geometría, circuitos, gráficos, anatomía, mapas).',
    '  image_score 6-8: imagen ayuda mucho.',
    '  image_score 0-5: cálculo abstracto, definición verbal → NO necesita imagen.',
    'image_prompt SOLO si score >= 9. En español, máx 2 frases. SIN texto/números dentro de la imagen.',
    'Devuelve SOLO JSON válido.'
].join('\n');

const buildQuizUser = ({ subject, session, phase, levelName, slotGroup, topic, guidance }) => {
    const rules = slotGroup.map((s) => `- slot ${s}: 3 propuestas (proposal_index 1,2,3)`).join('\n');
    return [
        `Asignatura: ${subject} | Sesión: ${session} | Fase: ${phase} (${levelName})`,
        `Tema: ${topic}`,
        '',
        '[BASE PEDAGÓGICA]',
        guidance,
        '',
        `Genera preguntas para slots ${slotGroup.join(', ')}.`,
        'Cada slot: 3 propuestas equivalentes en dificultad, distintos enunciados y distractores.',
        '',
        'Reglas:',
        '1. question, options.A/B/C/D, correct_answer, explanation, slot, proposal_index → obligatorios.',
        '2. Una sola alternativa correcta. explanation justifica por qué.',
        '3. Estilo chileno 3er Medio PAES/SIMCE.',
        '4. image_score (0-10), image_role, image_prompt (si score >= 9).',
        '5. SOLO JSON válido.',
        '',
        rules,
        '',
        'Formato: { "items": [{ "slot":N, "proposal_index":N, "question":"...", "options":{"A":"...","B":"...","C":"...","D":"..."}, "correct_answer":"A", "explanation":"...", "image_score":N, "image_role":"none"|"supporting"|"required_for_interpretation", "image_prompt":"..." }] }'
    ].join('\n');
};

const sanitizeItems = ({ items, subject, session, phase, levelName, slotGroup, topic }) => {
    const allowed = new Set(slotGroup.map(Number));
    const sigs = new Set();
    return items.filter(Boolean).map((item) => {
        const slot = Number(item?.slot || 0);
        const pi = Number(item?.proposal_index || 0);
        const q = norm(item?.question || '');
        const opts = { A: norm(item?.options?.A || ''), B: norm(item?.options?.B || ''), C: norm(item?.options?.C || ''), D: norm(item?.options?.D || '') };
        const ans = norm(item?.correct_answer || '').toUpperCase().slice(0, 1);
        const exp = norm(item?.explanation || '');
        const score = Math.max(0, Math.min(10, Number(item?.image_score) || 0));

        if (!allowed.has(slot) || pi < 1 || pi > PROPOSALS_PER_SLOT) return null;
        if (!q || Object.values(opts).filter(Boolean).length !== 4) return null;
        if (!['A', 'B', 'C', 'D'].includes(ans) || !exp) return null;

        const sig = `${q.toLowerCase().slice(0, 80)}|${Object.values(opts).sort().join('|')}`;
        if (sigs.has(sig)) return null;
        sigs.add(sig);

        return {
            subject, session, phase, slot, proposal_index: pi,
            level_name: levelName, topic: norm(item?.topic || topic),
            question: q, options: opts, correct_answer: ans, explanation: exp,
            image_score: score,
            image_role: score >= 8 ? 'required_for_interpretation' : (score >= 5 ? 'supporting' : 'none'),
            image_prompt: norm(item?.image_prompt || '')
        };
    }).filter(Boolean);
};

const generateSlotGroup = async ({ subject, subjectConfig, session, phase, levelName, slotGroup }) => {
    const ref = resolveMoralejaSessionReference({ subject, session, grade: GRADE });
    const ctx = subjectConfig.resolveContext({ session, topic: ref?.focus || '', phase: levelName, mode: 'quiz' });
    const topic = ref?.focus || ctx.skill || ctx.chapterLabel || `${subject} sesión ${session}`;

    const comp = await textAI.chat.completions.create({
        model: DEEPSEEK_MODEL,
        temperature: subjectConfig.temperature,
        response_format: { type: 'json_object' },
        messages: [
            { role: 'system', content: buildQuizSystem({ displayName: subjectConfig.displayName }) },
            { role: 'user', content: buildQuizUser({ subject, session, phase, levelName, slotGroup, topic, guidance: ctx.quizGuidance || '' }) }
        ]
    });

    const parsed = JSON.parse(comp.choices[0].message.content || '{}');
    return sanitizeItems({ items: Array.isArray(parsed.items) ? parsed.items : [], subject, session, phase, levelName, slotGroup, topic });
};

// ══════════════════════════════════════════════════════════════════════
// GENERAR + GUARDAR IMÁGENES para preguntas con score >= minScore
// ══════════════════════════════════════════════════════════════════════
const processImagesForSavedItems = async ({ savedRows, rawItems, subject, session, phase, minScore, dryRun }) => {
    if (!savedRows.length || !OPENAI_IMG_KEY) return { imagesGenerated: 0 };

    // Mapear question_id por slot+proposal_index
    const idMap = new Map();
    for (const row of savedRows) {
        idMap.set(`${row.slot}|${row.proposal_index}`, row.question_id);
    }

    const candidates = rawItems.filter((item) => item.image_score >= minScore && item.image_prompt);
    if (!candidates.length) return { imagesGenerated: 0 };

    let imagesGenerated = 0;
    for (const item of candidates) {
        const questionId = idMap.get(`${item.slot}|${item.proposal_index}`);
        if (!questionId) continue;

        if (dryRun) {
            console.log(`      [IMG DRY] score=${item.image_score} slot${item.slot}p${item.proposal_index}: "${item.image_prompt.slice(0, 60)}..."`);
            continue;
        }

        try {
            const { buffer, mimeType } = await generateImage(item.image_prompt);
            const fileName = `${subject}_s${session}_f${phase}_slot${item.slot}_p${item.proposal_index}`;
            const publicUrl = await saveImageToDisk(buffer, fileName);
            const assetId = await createImageAsset({
                subject, topic: item.topic,
                title: `${subject} s${session} slot${item.slot}`,
                altText: item.image_prompt.slice(0, 150),
                caption: item.image_prompt.slice(0, 250),
                publicUrl, mimeType
            });
            await linkImageToQuestion(questionId, assetId, item.image_role);
            imagesGenerated++;
            console.log(`      🖼  imagen generada → slot${item.slot}p${item.proposal_index} (score ${item.image_score}) ✓`);
            await sleep(2000); // OpenAI rate limit
        } catch (err) {
            console.error(`      ✗ imagen slot${item.slot}p${item.proposal_index}: ${err.message}`);
        }
    }
    return { imagesGenerated };
};

// ══════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════
const main = async () => {
    const args = parseArgs(process.argv.slice(2));
    const type = String(args.type || 'theory').toLowerCase();
    const subjectArg = String(args.subject || 'all').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const fromSession = Math.max(1, Number(args.from || 1));
    const toSession = Math.min(SESSIONS, Math.max(fromSession, Number(args.to || SESSIONS)));
    const delayMs = Math.max(500, Number(args.delay || 1000));
    const minImageScore = Math.max(0, Math.min(10, Number(args['img-score'] || 9)));
    const skipImages = Boolean(args['skip-images']);
    const dryRun = Boolean(args['dry-run']);

    const subjectList = subjectArg === 'ALL'
        ? Object.keys(SUBJECTS)
        : subjectArg.split(',').map((s) => s.trim()).filter((s) => SUBJECTS[s]);

    if (!subjectList.length) {
        console.error(`[pregen3m] Materia inválida: "${args.subject}". Disponibles: ${Object.keys(SUBJECTS).join(', ')} o "all"`);
        process.exit(1);
    }

    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║  PRE-GENERADOR 3° MEDIO — Matico                     ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log(`  Tipo:           ${type}`);
    console.log(`  Materias:       ${subjectList.join(', ')}`);
    console.log(`  Sesiones:       ${fromSession}–${toSession}`);
    console.log(`  Texto:          ${TEXT_PROVIDER.toUpperCase()} (${DEEPSEEK_MODEL})`);
    console.log(`  Imágenes:       ${skipImages ? 'DESACTIVADO' : `OpenAI (${OPENAI_IMG_MODEL}) si score >= ${minImageScore}`}`);
    console.log(`  Delay texto:    ${delayMs}ms`);
    console.log(`  Dry-run:        ${dryRun ? 'SÍ' : 'NO'}\n`);

    let totalTheories = 0, totalQuestions = 0, totalImages = 0, totalErrors = 0, totalSkipped = 0;

    // ── TEORÍAS ─────────────────────────────────────────────────────
    if (type === 'theory' || type === 'all') {
        console.log('▶ TEORÍAS LÚDICAS\n');

        for (const subject of subjectList) {
            const cfg = SUBJECTS[subject];
            const existing = dryRun ? new Set() : await getExistingTheories(subject);

            const pending = [];
            for (let s = fromSession; s <= toSession; s++) {
                for (const p of PHASES) {
                    const key = `${s}|${p.phase}`;
                    if (existing.has(key)) { totalSkipped++; continue; }
                    pending.push({ session: s, ...p });
                }
            }

            if (!pending.length) { console.log(`  ${subject}: ✓ todas las teorías ya existen\n`); continue; }
            console.log(`  ${subject}: ${pending.length} teorías (${totalSkipped} ya existían)\n`);

            if (dryRun) {
                pending.slice(0, 3).forEach((p) => console.log(`    [DRY] s${p.session} fase${p.phase} (${p.levelName})`));
                if (pending.length > 3) console.log(`    [DRY] ... y ${pending.length - 3} más`);
                console.log(''); continue;
            }

            const start = Date.now();
            for (let i = 0; i < pending.length; i++) {
                const { session, phase, levelName } = pending[i];
                try {
                    const { theory, topic } = await generateTheory({ subject, subjectConfig: cfg, session, phase, levelName });
                    await saveTheory({ subject, session, phase, topic, theory });
                    totalTheories++;
                    console.log(`    ${progressLine(i + 1, pending.length, start)} ${subject} s${session} f${phase} ✓`);
                } catch (err) {
                    totalErrors++;
                    console.error(`    ✗ ${subject} s${session} f${phase}: ${err.message}`);
                }
                if (i < pending.length - 1) await sleep(delayMs);
            }
            console.log('');
        }
    }

    // ── QUIZ ────────────────────────────────────────────────────────
    if (type === 'quiz' || type === 'all') {
        console.log('▶ PREGUNTAS QUIZ\n');

        for (const subject of subjectList) {
            const cfg = SUBJECTS[subject];
            const existingKeys = dryRun ? new Set() : await getExistingQuizKeys(subject);

            const pendingGroups = [];
            for (let s = fromSession; s <= toSession; s++) {
                for (const p of PHASES) {
                    for (let slotStart = 1; slotStart <= SLOTS_PER_PHASE; slotStart += SLOT_GROUP) {
                        const slotGroup = [];
                        for (let slot = slotStart; slot < slotStart + SLOT_GROUP && slot <= SLOTS_PER_PHASE; slot++) {
                            const needs = [1, 2, 3].some((pi) => !existingKeys.has(`${s}|${p.phase}|${slot}|${pi}`));
                            if (needs) slotGroup.push(slot);
                            else totalSkipped += 3;
                        }
                        if (slotGroup.length) pendingGroups.push({ session: s, ...p, slotGroup });
                    }
                }
            }

            if (!pendingGroups.length) { console.log(`  ${subject}: ✓ todas las preguntas ya existen\n`); continue; }
            const estQ = pendingGroups.length * SLOT_GROUP * PROPOSALS_PER_SLOT;
            console.log(`  ${subject}: ${pendingGroups.length} grupos (~${estQ} preguntas)\n`);

            if (dryRun) {
                pendingGroups.slice(0, 2).forEach((g) => console.log(`    [DRY] s${g.session} f${g.phase} slots[${g.slotGroup.join(',')}]`));
                console.log(''); continue;
            }

            const start = Date.now();
            for (let i = 0; i < pendingGroups.length; i++) {
                const g = pendingGroups[i];
                let items = [];
                let savedRows = [];

                try {
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                            items = await generateSlotGroup({ subject, subjectConfig: cfg, ...g });
                            savedRows = await saveQuizItems(items);
                            totalQuestions += savedRows.length;
                            console.log(`    ${progressLine(i + 1, pendingGroups.length, start)} ${subject} s${g.session} f${g.phase} slots[${g.slotGroup.join(',')}] → ${savedRows.length} preguntas ✓`);
                            break;
                        } catch (err) {
                            if (attempt === 3) throw err;
                            console.warn(`    ↻ Reintento ${attempt} s${g.session} f${g.phase}: ${err.message}`);
                            await sleep(2500);
                        }
                    }
                } catch (err) {
                    totalErrors++;
                    console.error(`    ✗ ${subject} s${g.session} f${g.phase} slots[${g.slotGroup.join(',')}]: ${err.message}`);
                    continue;
                }

                // Imágenes para preguntas con score >= minImageScore
                if (!skipImages && savedRows.length && items.length) {
                    const imgResult = await processImagesForSavedItems({
                        savedRows, rawItems: items, subject,
                        session: g.session, phase: g.phase,
                        minScore: minImageScore, dryRun
                    });
                    totalImages += imgResult.imagesGenerated;
                }

                if (i < pendingGroups.length - 1) await sleep(delayMs);
            }
            console.log('');
        }
    }

    // ── RESUMEN ─────────────────────────────────────────────────────
    console.log('═══════════════════════════════════════════════════════');
    console.log('  RESUMEN FINAL');
    console.log(`  Teorías guardadas:    ${totalTheories}`);
    console.log(`  Preguntas guardadas:  ${totalQuestions}`);
    console.log(`  Imágenes generadas:   ${totalImages}`);
    console.log(`  Skipped (existían):   ${totalSkipped}`);
    console.log(`  Errores:              ${totalErrors}`);
    if (dryRun) console.log('  ⚠️  Dry-run: nada fue guardado');
    console.log('═══════════════════════════════════════════════════════\n');
};

main().catch((err) => {
    console.error('[pregen3m] Error fatal:', err.message);
    process.exit(1);
});
