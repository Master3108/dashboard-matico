import crypto from 'crypto';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { google } from 'googleapis';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveMoralejaContext } from '../moralejaCompetenciaLectora.js';
import { resolveMoralejaMatematicaContext } from '../moralejaMatematica.js';
import { resolveMoralejaSessionReference } from '../moralejaSessionCatalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '1l1GLMXh8_Uo_O7XJOY7ZJxh1TER2hxrXTOsc_EcByHo';
const QUESTION_BANK_SHEET = 'QuestionBank';
const QUESTION_BANK_BUILDS_SHEET = 'QuestionBankBuilds';
const DEFAULT_SUBJECT = 'MATEMATICA';
const DEFAULT_FROM = 1;
const DEFAULT_TO = 46;
const DEFAULT_SLOTS_PER_PHASE = 15;
const DEFAULT_PROPOSALS_PER_SLOT = 3;
const DEFAULT_SLOT_GROUP_SIZE = 5;
const DEFAULT_RETRIES = 2;
const AI_PROVIDER = (process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY) ? 'kimi' : 'deepseek';
const AI_API_KEY = process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
const AI_BASE_URL = AI_PROVIDER === 'kimi'
    ? (process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1')
    : 'https://api.deepseek.com/v1';
const AI_MODEL = AI_PROVIDER === 'kimi'
    ? (process.env.KIMI_FAST_MODEL || 'kimi-k2-turbo-preview')
    : 'deepseek-chat';

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
        resolveContext: ({ session, topic, phase }) => resolveMoralejaMatematicaContext({
            session,
            topic,
            phase,
            mode: 'quiz'
        })
    },
    LENGUAJE: {
        code: 'LEN',
        displayName: 'Lenguaje y Comunicacion',
        temperature: 0.45,
        resolveContext: ({ session, topic, phase }) => resolveMoralejaContext({
            session,
            topic,
            phase,
            mode: 'quiz'
        })
    }
};

const normalizePrivateKey = (value = '') => String(value)
    .trim()
    .replace(/^"(.*)"$/s, '$1')
    .replace(/^'(.*)'$/s, '$1')
    .replace(/\\r/g, '')
    .replace(/\\n/g, '\n');

const normalizeText = (value = '') => String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeOptions = (options = {}) => ['A', 'B', 'C', 'D'].reduce((acc, key) => {
    acc[key] = normalizeText(options?.[key] || '');
    return acc;
}, {});

const normalizeQuestionSignature = (question = '', options = {}) => {
    const clean = (value = '') => String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');

    return `${clean(question)} || ${Object.values(normalizeOptions(options)).map(clean).sort().join(' | ')}`;
};

const parseArgs = (argv = []) => {
    const args = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith('--')) continue;
        const key = token.slice(2);
        const next = argv[index + 1];
        if (!next || next.startsWith('--')) {
            args[key] = true;
            continue;
        }
        args[key] = next;
        index += 1;
    }
    return args;
};

const normalizeSubject = (value = DEFAULT_SUBJECT) => String(value || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const getSheetsClient = async () => {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY || '')
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    return google.sheets({ version: 'v4', auth });
};

const openai = new OpenAI({
    apiKey: AI_API_KEY,
    baseURL: AI_BASE_URL
});

const getQuestionBankRows = async (sheets) => {
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${QUESTION_BANK_SHEET}!A:S`
    }).catch((error) => {
        if (error?.code === 400) return { data: { values: [] } };
        throw error;
    });

    const rows = response.data.values || [];
    if (!rows.length) return [];

    const [headers, ...dataRows] = rows;
    return dataRows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ''])));
};

const appendRows = async (sheets, sheetTitle, rows) => {
    if (!rows.length) return;

    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetTitle}!A1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
            values: rows
        }
    });
};

const buildQuestionId = ({ subjectCode, session, phase, slot, proposalIndex }) => {
    return [
        'QB',
        subjectCode,
        String(session).padStart(2, '0'),
        String(phase),
        String(slot).padStart(2, '0'),
        String(proposalIndex)
    ].join('_');
};

const buildExistingKey = ({ subject, session, phase, slot, proposalIndex }) => {
    return [subject, session, phase, slot, proposalIndex].join('|');
};

const sanitizeGeneratedItems = ({ items = [], subject, session, phase, levelName, slotGroup, topic }) => {
    const allowedSlots = new Set(slotGroup.map(Number));
    const acceptedSignatures = new Set();
    const normalized = [];

    for (const item of items) {
        const slot = Number(item?.slot || 0);
        const proposalIndex = Number(item?.proposal_index || item?.proposalIndex || 0);
        const question = normalizeText(item?.question || '');
        const options = normalizeOptions(item?.options || {});
        const explanation = normalizeText(item?.explanation || '');
        const correctAnswer = normalizeText(item?.correct_answer || item?.correctAnswer || '').toUpperCase().slice(0, 1);
        const optionValues = Object.values(options).filter(Boolean);

        if (!allowedSlots.has(slot)) continue;
        if (proposalIndex < 1 || proposalIndex > DEFAULT_PROPOSALS_PER_SLOT) continue;
        if (!question || optionValues.length !== 4 || !['A', 'B', 'C', 'D'].includes(correctAnswer) || !explanation) continue;

        const signature = normalizeQuestionSignature(question, options);
        if (!signature || acceptedSignatures.has(signature)) continue;
        acceptedSignatures.add(signature);

        normalized.push({
            subject,
            session,
            phase,
            slot,
            proposalIndex,
            levelName,
            topic,
            question,
            options,
            correctAnswer,
            explanation
        });
    }

    return normalized;
};

const buildPrompt = ({ subject, session, phase, levelName, slotGroup, topic, guidance }) => {
    const slotRules = slotGroup
        .map((slot) => `- slot ${slot}: genera exactamente 3 propuestas distintas (proposal_index 1, 2, 3)`)
        .join('\n');

    return [
        `Asignatura: ${subject}`,
        `Sesion: ${session}`,
        `Fase: ${phase} (${levelName})`,
        `Tema base: ${topic}`,
        '',
        '[BASE PEDAGOGICA MORALEJA]',
        guidance,
        '',
        'Objetivo:',
        `Genera preguntas de alternativa para los slots ${slotGroup.join(', ')} de esta sesion y fase.`,
        `Cada slot debe tener exactamente ${DEFAULT_PROPOSALS_PER_SLOT} propuestas equivalentes en dificultad y habilidad, pero con enunciados y distractores distintos.`,
        '',
        'Reglas obligatorias:',
        '1. Cada item debe tener question, options.A, options.B, options.C, options.D, correct_answer, explanation, slot y proposal_index.',
        '2. Debe haber exactamente una alternativa correcta.',
        '3. La explanation debe justificar por que la correcta es correcta y por que el procedimiento funciona.',
        '4. No repitas el mismo enunciado ni cambies solo numeros de forma trivial entre propuestas del mismo slot.',
        '5. Mantén estilo escolar chileno, coherente con 1° medio y PAES.',
        '6. Devuelve SOLO JSON valido.',
        '7. No uses markdown.',
        '',
        'Distribucion exacta requerida:',
        slotRules,
        '',
        'Formato JSON exacto:',
        '{',
        '  "items": [',
        '    {',
        '      "slot": 1,',
        '      "proposal_index": 1,',
        '      "question": "texto",',
        '      "options": { "A": "texto", "B": "texto", "C": "texto", "D": "texto" },',
        '      "correct_answer": "A",',
        '      "explanation": "texto"',
        '    }',
        '  ]',
        '}'
    ].join('\n');
};

const getSystemMessage = ({ subjectDisplayName }) => {
    return [
        `Eres Matico, profesor experto en ${subjectDisplayName} del curriculum chileno de 1 medio.`,
        'Tu tarea es generar preguntas de opcion multiple de alta calidad pedagógica.',
        'Cada pregunta debe tener 4 alternativas y una correcta.',
        'La respuesta debe ser SOLO JSON valido.'
    ].join('\n');
};

const generateSlotGroup = async ({ subject, subjectConfig, session, phase, levelName, slotGroup }) => {
    const sessionReference = resolveMoralejaSessionReference({ subject, session });
    const subjectContext = subjectConfig.resolveContext({
        session,
        topic: sessionReference?.focus || '',
        phase: levelName
    });
    const topic = sessionReference?.focus || subjectContext.skill || subjectContext.chapterLabel;

    const completion = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
            { role: 'system', content: getSystemMessage({ subjectDisplayName: subjectConfig.displayName }) },
            {
                role: 'user',
                content: buildPrompt({
                    subject,
                    session,
                    phase,
                    levelName,
                    slotGroup,
                    topic,
                    guidance: subjectContext.quizGuidance
                })
            }
        ],
        response_format: { type: 'json_object' },
        temperature: subjectConfig.temperature
    });

    const parsed = JSON.parse(completion.choices[0].message.content || '{}');
    const items = Array.isArray(parsed.items) ? parsed.items : [];

    return sanitizeGeneratedItems({
        items,
        subject,
        session,
        phase,
        levelName,
        slotGroup,
        topic
    });
};

const generateSlotGroupWithRetry = async (group, retries = DEFAULT_RETRIES) => {
    let lastError = null;
    for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
        try {
            if (attempt > 1) {
                console.log(`[QuestionBank] Reintento ${attempt - 1}/${retries} para sesion ${group.session} fase ${group.phase} slots ${group.slotGroup.join(', ')}`);
            }
            return await generateSlotGroup(group);
        } catch (error) {
            lastError = error;
            console.error(`[QuestionBank] Fallo intento ${attempt} en sesion ${group.session} fase ${group.phase} slots ${group.slotGroup.join(', ')}: ${error.message}`);
        }
    }
    throw lastError;
};

const toSheetRow = (record) => ([
    record.questionId,
    record.subject,
    String(record.session),
    String(record.phase),
    String(record.slot),
    String(record.proposalIndex),
    record.levelName,
    record.topic,
    record.question,
    record.options.A,
    record.options.B,
    record.options.C,
    record.options.D,
    record.correctAnswer,
    record.explanation,
    'pregenerated_quiz_bank',
    record.createdAt,
    record.updatedAt,
    'TRUE'
]);

const createBuildLogRow = ({ buildId, subject, fromSession, toSession, totalExpected, totalInserted, status, notes = '' }) => ([
    new Date().toISOString(),
    buildId,
    subject,
    String(fromSession),
    String(toSession),
    String(PHASES.length),
    String(DEFAULT_SLOTS_PER_PHASE),
    String(DEFAULT_PROPOSALS_PER_SLOT),
    String(totalExpected),
    String(totalInserted),
    status,
    notes
]);

const main = async () => {
    const args = parseArgs(process.argv.slice(2));
    const subject = normalizeSubject(args.subject || DEFAULT_SUBJECT);
    const subjectConfig = SUBJECT_CONFIG[subject];
    const fromSession = Math.max(1, Number(args.from || DEFAULT_FROM));
    const toSession = Math.max(fromSession, Number(args.to || DEFAULT_TO));
    const slotGroupSize = Math.max(1, Math.min(DEFAULT_SLOTS_PER_PHASE, Number(args.slotGroupSize || DEFAULT_SLOT_GROUP_SIZE)));
    const maxGroups = Number(args.maxGroups || 0);
    const retries = Math.max(0, Number(args.retries || DEFAULT_RETRIES));
    const dryRun = Boolean(args['dry-run']);

    if (!AI_API_KEY) {
        throw new Error('No hay API key configurada para la IA.');
    }

    if (!subjectConfig) {
        throw new Error(`Asignatura no soportada: ${subject}. Usa MATEMATICA o LENGUAJE.`);
    }

    const sheets = await getSheetsClient();
    const buildId = `build_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const existingRows = await getQuestionBankRows(sheets);
    const existingKeys = new Set(existingRows.map((row) => buildExistingKey({
        subject: row.subject,
        session: row.session,
        phase: row.phase,
        slot: row.slot,
        proposalIndex: row.proposal_index
    })));

    const pendingGroups = [];
    for (let session = fromSession; session <= toSession; session += 1) {
        for (const phaseConfig of PHASES) {
            for (let slotStart = 1; slotStart <= DEFAULT_SLOTS_PER_PHASE; slotStart += slotGroupSize) {
                const slotGroup = [];
                for (let slot = slotStart; slot < slotStart + slotGroupSize && slot <= DEFAULT_SLOTS_PER_PHASE; slot += 1) {
                    const needsAtLeastOne = [1, 2, 3].some((proposalIndex) => {
                        const key = buildExistingKey({
                            subject,
                            session,
                            phase: phaseConfig.phase,
                            slot,
                            proposalIndex
                        });
                        return !existingKeys.has(key);
                    });
                    if (needsAtLeastOne) slotGroup.push(slot);
                }
                if (slotGroup.length) {
                    pendingGroups.push({
                        subject,
                        subjectConfig,
                        session,
                        ...phaseConfig,
                        slotGroup
                    });
                }
            }
        }
    }

    const totalExpected = (toSession - fromSession + 1) * PHASES.length * DEFAULT_SLOTS_PER_PHASE * DEFAULT_PROPOSALS_PER_SLOT;
    const limitedGroups = maxGroups > 0 ? pendingGroups.slice(0, maxGroups) : pendingGroups;

    console.log(`[QuestionBank] Build ${buildId}`);
    console.log(`[QuestionBank] Asignatura: ${subject}`);
    console.log(`[QuestionBank] Rango sesiones: ${fromSession}-${toSession}`);
    console.log(`[QuestionBank] Grupos pendientes: ${pendingGroups.length}`);
    console.log(`[QuestionBank] Ejecutando grupos: ${limitedGroups.length}`);
    console.log(`[QuestionBank] Modo: ${dryRun ? 'dry-run' : 'write'}`);
    console.log(`[QuestionBank] Slots por grupo: ${slotGroupSize}`);
    console.log(`[QuestionBank] Reintentos por grupo: ${retries}`);

    const rowsToAppend = [];
    let inserted = 0;
    const failedGroups = [];
    let flushedRows = 0;

    for (const group of limitedGroups) {
        console.log(`[QuestionBank] Generando sesion ${group.session} fase ${group.phase} slots ${group.slotGroup.join(', ')}`);
        let generated = [];
        try {
            generated = await generateSlotGroupWithRetry(group, retries);
        } catch (error) {
            failedGroups.push({
                session: group.session,
                phase: group.phase,
                slots: group.slotGroup.join(','),
                error: error.message
            });
            console.error(`[QuestionBank] Grupo omitido tras agotar reintentos: sesion ${group.session} fase ${group.phase} slots ${group.slotGroup.join(', ')}`);
            continue;
        }

        const groupRows = [];
        for (const item of generated) {
            const key = buildExistingKey({
                subject: item.subject,
                session: item.session,
                phase: item.phase,
                slot: item.slot,
                proposalIndex: item.proposalIndex
            });
            if (existingKeys.has(key)) continue;

            const now = new Date().toISOString();
            const record = {
                ...item,
                questionId: buildQuestionId({
                    ...item,
                    subjectCode: subjectConfig.code
                }),
                createdAt: now,
                updatedAt: now
            };
            existingKeys.add(key);
            const row = toSheetRow(record);
            rowsToAppend.push(row);
            groupRows.push(row);
            inserted += 1;
        }

        if (!dryRun && groupRows.length) {
            await appendRows(sheets, QUESTION_BANK_SHEET, groupRows);
            flushedRows += groupRows.length;
            console.log(`[QuestionBank] Guardadas ${groupRows.length} filas en sheet para sesion ${group.session} fase ${group.phase} slots ${group.slotGroup.join(', ')}`);
        }
    }

    const notesBase = dryRun
        ? `dry-run con ${limitedGroups.length} grupos`
        : `insertadas ${inserted} filas${flushedRows ? `; escritas incrementalmente ${flushedRows}` : ''}`;
    const notes = failedGroups.length
        ? `${notesBase}; grupos fallidos: ${failedGroups.map((group) => `S${group.session}-F${group.phase}-[${group.slots}]`).join(' | ')}`
        : notesBase;

    await appendRows(sheets, QUESTION_BANK_BUILDS_SHEET, [
        createBuildLogRow({
            buildId,
            subject,
            fromSession,
            toSession,
            totalExpected,
            totalInserted: inserted,
            status: dryRun ? 'DRY_RUN' : (failedGroups.length ? 'PARTIAL' : 'OK'),
            notes
        })
    ]);

    console.log(JSON.stringify({
        buildId,
        subject,
        fromSession,
        toSession,
        groupsProcessed: limitedGroups.length,
        failedGroups,
        rowsPrepared: rowsToAppend.length,
        inserted,
        dryRun
    }, null, 2));
};

main().catch((error) => {
    console.error('[QuestionBank] Error fatal:', error.message);
    process.exitCode = 1;
});
