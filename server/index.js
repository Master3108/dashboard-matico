import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import cron from 'node-cron';
import { Readable } from 'stream';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import multer from 'multer';
import sharp from 'sharp';
import jwt from 'jsonwebtoken';
import {
    generateToken, requireAuth, requireAdmin, requireOwnership,
    generalLimiter, loginLimiter, aiLimiter, uploadLimiter,
    sanitizeBody, validateFileUpload,
    getCorsConfig, securityHeaders,
    hashPassword, verifyPassword
} from './middleware/security.js';
import { supabase } from './db/supabaseClient.js';
import { deleteGeneratedQuestion, listGeneratedQuestions, recordGeneratedQuestions, sampleGeneratedQuestions } from './generatedQuestionBank.js';
import { recordAdaptiveEvent, getAdaptiveSnapshot, backfillAdaptiveProfileFromProgressRows } from './adaptiveProfileStore.js';
import { getCurriculumContext } from './curriculumCatalog.js';
import { resolveMoralejaContext } from './moralejaCompetenciaLectora.js';
import { resolveMoralejaMatematicaContext } from './moralejaMatematica.js';
import { resolveMoralejaBiologiaContext } from './moralejaBiologia.js';
import { resolveMoralejaQuimicaContext } from './moralejaQuimica.js';
import { resolveMoralejaFisicaContext } from './moralejaFisica.js';
import {
    appendRuntimeTheoryLudica,
    createRuntimePedagogicalAsset,
    createRuntimeQuestionBankQuestion,
    findRuntimeExamReminderById,
    findRuntimePedagogicalAssetById,
    findRuntimeTheoryLudicaByKey,
    getRuntimeUserByEmail,
    getRuntimeUserByToken,
    insertRuntimeAdaptiveSnapshot,
    insertRuntimeProgressLog,
    linkRuntimeQuestionBankAsset,
    linkRuntimeTheoryLudicaAsset,
    listRuntimeExamReminders,
    listRuntimePedagogicalAssets,
    listRuntimeQuestionBankImageCandidates,
    listRuntimeQuestionBankRowsForAdmin,
    listRuntimeTheoryLudicaRowsForAdmin,
    listRuntimeUsers,
    countRuntimeQuestionsWithImageInPhase,
    updateRuntimePedagogicalAsset,
    updateRuntimeExistingQuestionWithImage,
    updateRuntimeQuestionVisualRole,
    upsertRuntimeExamReminder,
    upsertRuntimeUser,
    createCalendarEvent,
    listCalendarEvents,
    updateCalendarEvent,
    deleteCalendarEvent,
    getUserProfile,
    getChildrenProfiles,
    createNotification,
    listUnreadNotifications,
    markNotificationRead,
    getChildProgressSummary,
    createStudySession,
    addStudyMilestone,
    endStudySession,
    getStudySessions,
    getActiveStudySession
} from './db/runtimeWrites.js';

dotenv.config();

const app = express();
app.use(cors(getCorsConfig()));
app.use(securityHeaders);
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(sanitizeBody);
app.use(generalLimiter);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_UPLOADS_DIR = path.join(__dirname, 'uploads');
const NOTEBOOK_UPLOADS_DIR = path.join(LOCAL_UPLOADS_DIR, 'cuadernos');
const PEDAGOGICAL_ASSETS_UPLOADS_DIR = path.join(LOCAL_UPLOADS_DIR, 'quiz-assets');
const DATA_DIR = path.join(__dirname, 'data');
const IMAGE_GENERATION_RUNTIME_CONFIG_FILE = path.join(DATA_DIR, 'image_generation_runtime_config.json');
const NOTEBOOK_SUBMISSIONS_FILE = path.join(DATA_DIR, 'notebook_submissions.json');
const NOTEBOOK_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;
const NOTEBOOK_QUIZ_THRESHOLD = 80;
const PRIORITY_STUDY_SUBJECTS = ['MATEMATICA', 'BIOLOGIA', 'FISICA', 'QUIMICA', 'HISTORIA', 'LENGUAJE', 'COMPETENCIA_LECTORA'];
const STUDY_STALE_DAYS = 7;
const SMART_CREATE_MAX_IMAGES = 10;

// Archivos subidos — solo accesibles con auth
app.use('/uploads', requireAuth, express.static(LOCAL_UPLOADS_DIR));

// Auth global para /api/* con excepciones públicas
const PUBLIC_API_PATHS = ['/api/health', '/api/capture/poll', '/api/capture/upload', '/api/capture/pending', '/api/capture/create'];
app.use('/api', (req, res, next) => {
    const fullPath = req.originalUrl.split('?')[0];
    if (PUBLIC_API_PATHS.some(p => fullPath.startsWith(p))) return next();
    requireAuth(req, res, next);
});

// Rate limiters específicos
app.use('/api/agent', aiLimiter);
app.use('/api/oracle', aiLimiter);
app.use('/api/capture/upload', uploadLimiter);
app.use('/api/pedagogical-assets/upload', uploadLimiter);
app.use('/api/notebook/submissions', uploadLimiter);

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'ok',
        service: 'matico-server',
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 3001;
const QUIZ_BATCH_SIZE = 3;
const QUIZ_PHASE_QUESTIONS = 15;
const QUIZ_TOTAL_QUESTIONS = 45;
const QUIZ_BATCHES_PER_PHASE = QUIZ_PHASE_QUESTIONS / QUIZ_BATCH_SIZE;
const QUESTION_BANK_SHEET = 'QuestionBank';
const THEORY_LUDICA_SHEET = 'TheoryLudicaBank';
const PEDAGOGICAL_IMAGE_SHEET = 'PedagogicalImageBank';
const QUESTION_BANK_HEADERS = [
    'question_id',
    'subject',
    'session',
    'phase',
    'slot',
    'proposal_index',
    'levelName',
    'topic',
    'question',
    'option_a',
    'option_b',
    'option_c',
    'option_d',
    'correct_answer',
    'explanation',
    'sourceMode',
    'created_at',
    'updated_at',
    'active',
    'prompt_image_asset_id',
    'prompt_image_url',
    'prompt_image_alt',
    'prompt_image_caption',
    'question_visual_role'
];
const THEORY_LUDICA_HEADERS = [
    'timestamp',
    'subject',
    'session',
    'phase',
    'topic',
    'theory_markdown',
    'source',
    'active',
    'support_image_asset_id',
    'support_image_url',
    'support_image_alt',
    'support_image_caption'
];
const PEDAGOGICAL_IMAGE_HEADERS = [
    'asset_id',
    'title',
    'subject',
    'topic_tags',
    'kind',
    'file_name',
    'file_url',
    'mime_type',
    'alt_text',
    'caption',
    'source_type',
    'status',
    'created_at',
    'updated_at'
];
const EXAM_REMINDER_SHEET = 'ExamReminderBank';
const EXAM_REMINDER_HEADERS = [
    'timestamp',
    'event_id',
    'user_id',
    'student_name',
    'student_email',
    'guardian_email',
    'subject',
    'exam_date',
    'title',
    'source',
    'confidence',
    'status',
    'sent_d7',
    'sent_d2',
    'sent_d1',
    'last_sent_at',
    'notes'
];
const ORACLE_NOTEBOOK_DRAFT_TTL_MS = 30 * 60 * 1000;
const oracleNotebookDrafts = new Map();
const PEDAGOGICAL_ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const PEDAGOGICAL_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: PEDAGOGICAL_MAX_FILE_SIZE_BYTES }
});

// ConfiguraciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n DeepSeek
const FORCED_AI_PROVIDER = String(process.env.AI_PROVIDER || '').trim().toLowerCase();
const AI_PROVIDER = FORCED_AI_PROVIDER || (
    process.env.DEEPSEEK_API_KEY ? 'deepseek'
        : (process.env.OPENAI_API_KEY ? 'openai' : ((process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY) ? 'kimi' : 'deepseek'))
);
const AI_API_KEY = AI_PROVIDER === 'kimi'
    ? (process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || process.env.OPENAI_API_KEY)
    : (AI_PROVIDER === 'openai'
        ? (process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY)
        : (process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY));
const AI_BASE_URL = AI_PROVIDER === 'kimi'
    ? (process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1')
    : (AI_PROVIDER === 'openai'
        ? (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1')
        : 'https://api.deepseek.com/v1');
const AI_MODELS = {
    fast: AI_PROVIDER === 'kimi'
        ? (process.env.KIMI_FAST_MODEL || 'kimi-k2-turbo-preview')
        : (AI_PROVIDER === 'openai' ? (process.env.OPENAI_FAST_MODEL || 'gpt-4.1-mini') : 'deepseek-chat'),
    thinking: AI_PROVIDER === 'kimi'
        ? (process.env.KIMI_THINKING_MODEL || 'kimi-k2-thinking-preview')
        : (AI_PROVIDER === 'openai' ? (process.env.OPENAI_THINKING_MODEL || 'gpt-4.1') : 'deepseek-chat')
};
const KIMI_API_KEY = process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || '';
const KIMI_BASE_URL = process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1';
const NOTEBOOK_VISION_MODEL = process.env.KIMI_VISION_MODEL || process.env.KIMI_FAST_MODEL || 'kimi-k2.5';
const OPENAI_VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini';
const OPENAI_DIRECT_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_IMAGE_API_KEY = process.env.OPENAI_IMAGE_API_KEY || OPENAI_DIRECT_API_KEY || AI_API_KEY || '';
const OPENAI_IMAGE_BASE_URL = process.env.OPENAI_IMAGE_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const GEMINI_IMAGE_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-preview-image-generation';
const GEMINI_IMAGE_PROXY_TOKEN = process.env.GEMINI_IMAGE_PROXY_TOKEN || '';

const normalizeImageGeneratorProvider = (value = '') => {
    const normalized = String(value || '').trim().toLowerCase();
    if (['openai', 'nano_banana'].includes(normalized)) return normalized;
    return '';
};

const parseCsvList = (value = '') => String(value || '')
    .split(',')
    .map((item) => normalizeImageGeneratorProvider(item))
    .filter(Boolean);

const PEDAGOGICAL_IMAGE_PROVIDER_DEFAULT = normalizeImageGeneratorProvider(process.env.PEDAGOGICAL_IMAGE_PROVIDER || 'openai') || 'openai';
const PEDAGOGICAL_IMAGE_PROVIDER_ALLOWLIST = (() => {
    const fromEnv = parseCsvList(process.env.PEDAGOGICAL_IMAGE_PROVIDER_ALLOWLIST || '');
    const fallback = ['openai', 'nano_banana'];
    const base = fromEnv.length > 0 ? fromEnv : fallback;
    if (!base.includes(PEDAGOGICAL_IMAGE_PROVIDER_DEFAULT)) {
        base.unshift(PEDAGOGICAL_IMAGE_PROVIDER_DEFAULT);
    }
    return Array.from(new Set(base));
})();

const NANO_BANANA_API_URL = String(process.env.NANO_BANANA_API_URL || '').trim();
const NANO_BANANA_API_KEY = String(process.env.NANO_BANANA_API_KEY || '').trim();
const NANO_BANANA_MODEL = String(process.env.NANO_BANANA_MODEL || '').trim();
const NANO_BANANA_AUTH_HEADER = String(process.env.NANO_BANANA_AUTH_HEADER || 'Authorization').trim();
const NANO_BANANA_AUTH_PREFIX = String(process.env.NANO_BANANA_AUTH_PREFIX || 'Bearer').trim();
const NANO_BANANA_PROMPT_FIELD = String(process.env.NANO_BANANA_PROMPT_FIELD || 'prompt').trim();
const NANO_BANANA_MODEL_FIELD = String(process.env.NANO_BANANA_MODEL_FIELD || 'model').trim();
const NANO_BANANA_SIZE_FIELD = String(process.env.NANO_BANANA_SIZE_FIELD || 'size').trim();
const NANO_BANANA_B64_PATH = String(process.env.NANO_BANANA_RESPONSE_B64_PATH || 'data.0.b64_json').trim();
const NANO_BANANA_URL_PATH = String(process.env.NANO_BANANA_RESPONSE_URL_PATH || 'data.0.url').trim();
const NANO_BANANA_MIME_PATH = String(process.env.NANO_BANANA_RESPONSE_MIME_PATH || 'data.0.mime_type').trim();

const openai = new OpenAI({
    apiKey: AI_API_KEY,
    baseURL: AI_BASE_URL
});

const kimiVisionClient = KIMI_API_KEY
    ? new OpenAI({
        apiKey: KIMI_API_KEY,
        baseURL: KIMI_BASE_URL
    })
    : null;

const openaiVisionClient = OPENAI_DIRECT_API_KEY
    ? new OpenAI({
        apiKey: OPENAI_DIRECT_API_KEY
    })
    : null;
const agentTextClient = openaiVisionClient || openai;
const AGENT_CONVERSATION_MODEL = String(
    process.env.AGENT_CONVERSATION_MODEL ||
    process.env.OPENAI_AGENT_MODEL ||
    (OPENAI_DIRECT_API_KEY ? 'gpt-5-mini' : AI_MODELS.fast)
).trim();
const AGENT_MAX_TOKENS = Number(process.env.AGENT_MAX_TOKENS || 500);
const AGENT_MAX_TOOL_ITERATIONS = Number(process.env.AGENT_MAX_TOOL_ITERATIONS || 4);
const AGENT_HISTORY_MESSAGES = Number(process.env.AGENT_HISTORY_MESSAGES || 8);
const AGENT_TTS_MODEL = String(process.env.AGENT_TTS_MODEL || 'gpt-4o-mini-tts').trim();
const AGENT_STT_MODEL = String(process.env.AGENT_STT_MODEL || 'gpt-4o-mini-transcribe').trim();
const AGENT_TTS_TIMEOUT_MS = Number(process.env.AGENT_TTS_TIMEOUT_MS || 12000);

let imageGenerationRuntimeConfigCache = null;

// ConfiguraciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n Google Sheets
const SPREADSHEET_ID = '1l1GLMXh8_Uo_O7XJOY7ZJxh1TER2hxrXTOsc_EcByHo';

const normalizePrivateKey = (value = '') => {
    return value
        .trim()
        .replace(/^"(.*)"$/s, '$1')
        .replace(/^'(.*)'$/s, '$1')
        .replace(/\\r/g, '')
        .replace(/\\n/g, '\n');
};

const getGoogleCredentials = () => {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY || '');

    if (!clientEmail || !privateKey) {
        throw new Error('Google credentials are incomplete');
    }

    return {
        client_email: clientEmail,
        private_key: privateKey,
    };
};

const getSheetsClient = async () => {
    const auth = new google.auth.GoogleAuth({
        credentials: getGoogleCredentials(),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth });
};

const normalizePedagogicalImageKind = (value = '') => {
    const normalized = normalizeSheetText(value).toLowerCase();
    if (['diagram', 'graph', 'cell', 'wave', 'chart', 'figure', 'other'].includes(normalized)) {
        return normalized;
    }
    return 'other';
};

const normalizePedagogicalImageStatus = (value = '') => {
    const normalized = normalizeSheetText(value).toLowerCase();
    if (['draft', 'approved', 'archived'].includes(normalized)) return normalized;
    return 'draft';
};

const normalizeQuestionVisualRole = (value = '') => {
    const normalized = normalizeSheetText(value).toLowerCase();
    if (['required_for_interpretation', 'supporting'].includes(normalized)) return normalized;
    return 'supporting';
};

const buildAbsolutePublicUrl = (publicUrl = '') => {
    const normalized = String(publicUrl || '').trim();
    if (!normalized) return '';
    if (/^https?:\/\//i.test(normalized)) return normalized;
    const appUrl = String(process.env.PUBLIC_APP_URL || process.env.APP_URL || '').trim().replace(/\/$/, '');
    if (!appUrl) return normalized;
    return `${appUrl}${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
};

const normalizeSheetText = (value = '') => String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizeSheetBool = (value = '') => {
    const normalized = normalizeSheetText(value).toUpperCase();
    return ['TRUE', 'VERDADERO', '1', 'SI', 'YES'].includes(normalized);
};

const normalizeQuestionBankLevel = (value = '') => {
    const normalized = normalizeSheetText(value).toUpperCase();
    if (!normalized) return '';
    if (normalized === 'BASICO') return 'BASICO';
    if (normalized === 'INTERMEDIO') return 'INTERMEDIO';
    if (normalized === 'AVANZADO') return 'INTERMEDIO';
    if (normalized === 'CRITICO') return 'AVANZADO';
    return normalized;
};

const resolveQuestionBankPhase = (value = '') => {
    const normalized = normalizeSheetText(value).toUpperCase();
    if (!normalized) return 0;
    if (normalized === 'BASICO' || normalized === '1') return 1;
    if (normalized === 'INTERMEDIO' || normalized === 'AVANZADO' || normalized === '2') return 2;
    if (normalized === 'CRITICO' || normalized === '3') return 3;
    return Number(normalized) || 0;
};

const getQuestionBankRows = async (sheets) => {
    await ensureSheetHeaders(sheets, QUESTION_BANK_SHEET, QUESTION_BANK_HEADERS);
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${QUESTION_BANK_SHEET}!A:X`,
    }).catch((error) => {
        if (error?.code === 400) return { data: { values: [] } };
        throw error;
    });

    const rows = response.data.values || [];
    if (!rows.length) return [];

    const [headers, ...dataRows] = rows;
    return dataRows.map((row, index) => ({
        rowNumber: index + 2,
        ...Object.fromEntries(headers.map((header, headerIndex) => [header, row[headerIndex] || '']))
    }));
};

const getPedagogicalImageRows = async (sheets) => {
    await ensureSheetHeaders(sheets, PEDAGOGICAL_IMAGE_SHEET, PEDAGOGICAL_IMAGE_HEADERS);
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PEDAGOGICAL_IMAGE_SHEET}!A:N`,
    }).catch((error) => {
        if (error?.code === 400) return { data: { values: [] } };
        throw error;
    });

    const rows = response.data.values || [];
    if (!rows.length) return [];

    const [headers, ...dataRows] = rows;
    return dataRows.map((row, index) => ({
        rowNumber: index + 2,
        ...Object.fromEntries(headers.map((header, headerIndex) => [header, row[headerIndex] || '']))
    }));
};

const buildPedagogicalAssetId = async (sheets, subject = '') => {
    const rows = await getPedagogicalImageRows(sheets);
    const normalizedSubject = normalizeSheetText(subject).toUpperCase() || 'GEN';
    const code = normalizedSubject.slice(0, 3).padEnd(3, 'X');
    const nextNumber = rows.length + 1;
    return `IMG_${code}_${String(nextNumber).padStart(4, '0')}`;
};

const listPedagogicalImageAssets = async (sheets, filters = {}) => {
    const rows = await listRuntimePedagogicalAssets(filters);
    return rows.map((row) => ({
        ...row,
        status: normalizePedagogicalImageStatus(row.status),
        absolute_file_url: buildAbsolutePublicUrl(row.file_url)
    }));
};

const findPedagogicalImageAssetById = async (sheets, assetId = '', { approvedOnly = false } = {}) => {
    const found = await findRuntimePedagogicalAssetById(assetId, { approvedOnly });
    if (!found) return null;
    return {
        ...found,
        status: normalizePedagogicalImageStatus(found.status),
        absolute_file_url: buildAbsolutePublicUrl(found.file_url)
    };
};

const updatePedagogicalImageAssetRow = async (sheets, assetId = '', patch = {}) => {
    const next = await updateRuntimePedagogicalAsset(assetId, patch);

    return {
        ...next,
        absolute_file_url: buildAbsolutePublicUrl(next.file_url)
    };
};

const createPedagogicalImageAsset = async (sheets, {
    title = '',
    subject = '',
    topicTags = '',
    kind = 'other',
    fileName = '',
    fileUrl = '',
    mimeType = '',
    altText = '',
    caption = '',
    sourceType = 'admin_upload',
    status = 'draft'
} = {}) => {
    const created = await createRuntimePedagogicalAsset({
        title,
        subject,
        topicTags,
        kind: normalizePedagogicalImageKind(kind),
        fileName,
        fileUrl,
        mimeType,
        altText,
        caption,
        sourceType,
        status: normalizePedagogicalImageStatus(status)
    });

    return {
        ...created,
        absolute_file_url: buildAbsolutePublicUrl(created.file_url)
    };
};

const buildQuestionBankQuestionId = async (sheets, subject = '') => {
    const rows = await getQuestionBankRows(sheets);
    const normalizedSubject = normalizeSheetText(subject).toUpperCase() || 'GENERAL';
    const codeMap = {
        MATEMATICA: 'MAT',
        BIOLOGIA: 'BIO',
        FISICA: 'FIS',
        QUIMICA: 'QUI',
        LENGUAJE: 'LEN',
        HISTORIA: 'HIS'
    };
    const subjectCode = codeMap[normalizedSubject] || normalizedSubject.slice(0, 3).padEnd(3, 'X');
    const yearSuffix = String(new Date().getFullYear()).slice(-2);
    const prefix = `QB_${subjectCode}_${yearSuffix}_IMG_`;
    const nextNumber = rows
        .map((row) => String(row.question_id || '').trim())
        .filter((id) => id.startsWith(prefix))
        .map((id) => Number(id.slice(prefix.length)) || 0)
        .reduce((max, value) => Math.max(max, value), 0) + 1;
    return `${prefix}${String(nextNumber).padStart(4, '0')}`;
};

const appendQuestionBankQuestion = async (sheets, {
    subject = '',
    session = '',
    phase = '',
    slot = '',
    proposalIndex = 1,
    levelName = '',
    topic = '',
    question = '',
    options = {},
    correctAnswer = 'A',
    explanation = '',
    sourceMode = 'image_ai_admin',
    promptImage = null,
    questionVisualRole = 'required_for_interpretation'
} = {}) => {
    const phaseNumber = Number(phase || resolveQuestionBankPhase(levelName || '')) || resolveQuestionBankPhase(levelName || '');
    return createRuntimeQuestionBankQuestion({
        subject,
        session,
        phase: phaseNumber || phase,
        slot,
        proposalIndex,
        levelName,
        topic,
        question,
        options,
        correctAnswer,
        explanation,
        sourceMode,
        promptImage,
        questionVisualRole: normalizeQuestionVisualRole(questionVisualRole || 'required_for_interpretation')
    });
};

const createQuestionBankRowFromPayload = async (sheets, payload = {}, {
    fallback = {},
    sourceMode = 'manual_admin',
    requireApprovedAsset = false
} = {}) => {
    const assetId = String(payload.asset_id || fallback.asset_id || '').trim();
    let asset = null;

    if (assetId) {
        asset = await findPedagogicalImageAssetById(sheets, assetId, { approvedOnly: requireApprovedAsset });
        if (!asset) {
            throw new Error(requireApprovedAsset
                ? 'El asset no existe o no está aprobado'
                : 'El asset indicado no existe');
        }
    }

    return appendQuestionBankQuestion(sheets, {
        subject: payload.subject || fallback.subject || asset?.subject || '',
        session: payload.session || fallback.session || '',
        phase: payload.phase || fallback.phase || '',
        slot: payload.slot || fallback.slot || '',
        proposalIndex: payload.proposal_index || payload.proposalIndex || fallback.proposalIndex || 1,
        levelName: payload.levelName || fallback.levelName || 'BASICO',
        topic: payload.topic || fallback.topic || asset?.topic_tags || asset?.title || '',
        question: payload.question || fallback.question || '',
        options: {
            A: payload.option_a || payload.options?.A || fallback.options?.A || '',
            B: payload.option_b || payload.options?.B || fallback.options?.B || '',
            C: payload.option_c || payload.options?.C || fallback.options?.C || '',
            D: payload.option_d || payload.options?.D || fallback.options?.D || ''
        },
        correctAnswer: payload.correct_answer || fallback.correct_answer || 'A',
        explanation: payload.explanation || fallback.explanation || '',
        sourceMode,
        promptImage: asset,
        questionVisualRole: payload.question_visual_role || fallback.question_visual_role || 'required_for_interpretation'
    });
};

const updateSheetRowByHeaders = async (sheets, sheetTitle, headers, rowNumber, patch = {}) => {
    const orderedValues = headers.map((header) => String(patch?.[header] ?? '').trim());
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetTitle}!A${rowNumber}:${columnLabel(headers.length)}${rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: { values: [orderedValues] }
    });
};

const parseJsonObjectResponse = (rawText = '', fallbackLabel = 'JSON') => {
    const cleaned = String(rawText || '')
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
    try {
        return JSON.parse(cleaned);
    } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) throw new Error(`No se pudo interpretar ${fallbackLabel}`);
        return JSON.parse(match[0]);
    }
};

const safeJsonParse = (value = '', fallback = {}) => {
    try {
        const parsed = JSON.parse(String(value || '').trim());
        return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch {
        return fallback;
    }
};

const maskSecret = (value = '') => {
    const secret = String(value || '').trim();
    if (!secret) return '';
    if (secret.length <= 8) return `${secret.slice(0, 1)}***${secret.slice(-1)}`;
    return `${secret.slice(0, 4)}***${secret.slice(-4)}`;
};

const normalizeOpenAiImageRuntimeConfig = (input = {}) => ({
    base_url: String(input.base_url || '').trim(),
    api_key: String(input.api_key || '').trim(),
    model: String(input.model || '').trim()
});

const normalizeNanoBananaImageRuntimeConfig = (input = {}) => ({
    api_url: String(input.api_url || '').trim(),
    api_key: String(input.api_key || '').trim(),
    model: String(input.model || '').trim(),
    auth_header: String(input.auth_header || '').trim(),
    auth_prefix: String(input.auth_prefix || '').trim(),
    prompt_field: String(input.prompt_field || '').trim(),
    model_field: String(input.model_field || '').trim(),
    size_field: String(input.size_field || '').trim(),
    response_b64_path: String(input.response_b64_path || '').trim(),
    response_url_path: String(input.response_url_path || '').trim(),
    response_mime_path: String(input.response_mime_path || '').trim(),
    extra_json: String(input.extra_json || '').trim()
});

const buildDefaultImageGenerationRuntimeConfig = () => ({
    default_provider: PEDAGOGICAL_IMAGE_PROVIDER_DEFAULT,
    providers: {
        openai: normalizeOpenAiImageRuntimeConfig({
            base_url: OPENAI_IMAGE_BASE_URL,
            api_key: '',
            model: OPENAI_IMAGE_MODEL
        }),
        nano_banana: normalizeNanoBananaImageRuntimeConfig({
            api_url: NANO_BANANA_API_URL,
            api_key: '',
            model: NANO_BANANA_MODEL,
            auth_header: NANO_BANANA_AUTH_HEADER,
            auth_prefix: NANO_BANANA_AUTH_PREFIX,
            prompt_field: NANO_BANANA_PROMPT_FIELD,
            model_field: NANO_BANANA_MODEL_FIELD,
            size_field: NANO_BANANA_SIZE_FIELD,
            response_b64_path: NANO_BANANA_B64_PATH,
            response_url_path: NANO_BANANA_URL_PATH,
            response_mime_path: NANO_BANANA_MIME_PATH,
            extra_json: process.env.NANO_BANANA_EXTRA_JSON || ''
        })
    }
});

const mergeImageGenerationRuntimeConfig = (stored = {}) => {
    const defaults = buildDefaultImageGenerationRuntimeConfig();
    return {
        default_provider: normalizeImageGeneratorProvider(stored?.default_provider || defaults.default_provider) || defaults.default_provider,
        providers: {
            openai: {
                ...defaults.providers.openai,
                ...normalizeOpenAiImageRuntimeConfig(stored?.providers?.openai || {})
            },
            nano_banana: {
                ...defaults.providers.nano_banana,
                ...normalizeNanoBananaImageRuntimeConfig(stored?.providers?.nano_banana || {})
            }
        }
    };
};

const readImageGenerationRuntimeConfig = async () => {
    if (imageGenerationRuntimeConfigCache) return imageGenerationRuntimeConfigCache;
    const defaults = buildDefaultImageGenerationRuntimeConfig();
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const raw = await fs.readFile(IMAGE_GENERATION_RUNTIME_CONFIG_FILE, 'utf-8');
        const parsed = safeJsonParse(raw, {});
        imageGenerationRuntimeConfigCache = mergeImageGenerationRuntimeConfig(parsed);
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            console.error('[IMAGE_RUNTIME_CONFIG] Error leyendo config runtime:', error.message);
        }
        imageGenerationRuntimeConfigCache = defaults;
    }
    return imageGenerationRuntimeConfigCache;
};

const writeImageGenerationRuntimeConfig = async (nextConfig = null) => {
    const merged = mergeImageGenerationRuntimeConfig(nextConfig || {});
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(IMAGE_GENERATION_RUNTIME_CONFIG_FILE, `${JSON.stringify(merged, null, 2)}\n`, 'utf-8');
    imageGenerationRuntimeConfigCache = merged;
    return merged;
};

const updateImageGenerationRuntimeConfig = async ({ defaultProvider = '', provider = '', patch = {} } = {}) => {
    const current = await readImageGenerationRuntimeConfig();
    const next = {
        ...current,
        providers: {
            openai: { ...current.providers.openai },
            nano_banana: { ...current.providers.nano_banana }
        }
    };

    const normalizedDefaultProvider = normalizeImageGeneratorProvider(defaultProvider);
    if (normalizedDefaultProvider && PEDAGOGICAL_IMAGE_PROVIDER_ALLOWLIST.includes(normalizedDefaultProvider)) {
        next.default_provider = normalizedDefaultProvider;
    }

    const normalizedProvider = normalizeImageGeneratorProvider(provider);
    if (normalizedProvider === 'openai') {
        const normalizedPatch = normalizeOpenAiImageRuntimeConfig(patch);
        if (normalizedPatch.base_url) next.providers.openai.base_url = normalizedPatch.base_url;
        if (normalizedPatch.model) next.providers.openai.model = normalizedPatch.model;
        if (Object.prototype.hasOwnProperty.call(patch, 'api_key')) {
            const apiKeyValue = String(patch.api_key || '').trim();
            if (apiKeyValue) next.providers.openai.api_key = apiKeyValue;
        }
    }
    if (normalizedProvider === 'nano_banana') {
        const normalizedPatch = normalizeNanoBananaImageRuntimeConfig(patch);
        const stringFields = [
            'api_url',
            'model',
            'auth_header',
            'auth_prefix',
            'prompt_field',
            'model_field',
            'size_field',
            'response_b64_path',
            'response_url_path',
            'response_mime_path',
            'extra_json'
        ];
        for (const field of stringFields) {
            if (normalizedPatch[field]) next.providers.nano_banana[field] = normalizedPatch[field];
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'api_key')) {
            const apiKeyValue = String(patch.api_key || '').trim();
            if (apiKeyValue) next.providers.nano_banana.api_key = apiKeyValue;
        }
    }

    return writeImageGenerationRuntimeConfig(next);
};

const resolveEffectiveImageProviderSettings = async () => {
    const runtime = await readImageGenerationRuntimeConfig();
    return {
        default_provider: runtime.default_provider || PEDAGOGICAL_IMAGE_PROVIDER_DEFAULT,
        openai: {
            base_url: runtime.providers.openai.base_url || OPENAI_IMAGE_BASE_URL,
            api_key: runtime.providers.openai.api_key || OPENAI_IMAGE_API_KEY || '',
            model: runtime.providers.openai.model || OPENAI_IMAGE_MODEL
        },
        nano_banana: {
            api_url: runtime.providers.nano_banana.api_url || NANO_BANANA_API_URL,
            api_key: runtime.providers.nano_banana.api_key || NANO_BANANA_API_KEY || '',
            model: runtime.providers.nano_banana.model || NANO_BANANA_MODEL,
            auth_header: runtime.providers.nano_banana.auth_header || NANO_BANANA_AUTH_HEADER,
            auth_prefix: runtime.providers.nano_banana.auth_prefix || NANO_BANANA_AUTH_PREFIX,
            prompt_field: runtime.providers.nano_banana.prompt_field || NANO_BANANA_PROMPT_FIELD,
            model_field: runtime.providers.nano_banana.model_field || NANO_BANANA_MODEL_FIELD,
            size_field: runtime.providers.nano_banana.size_field || NANO_BANANA_SIZE_FIELD,
            response_b64_path: runtime.providers.nano_banana.response_b64_path || NANO_BANANA_B64_PATH,
            response_url_path: runtime.providers.nano_banana.response_url_path || NANO_BANANA_URL_PATH,
            response_mime_path: runtime.providers.nano_banana.response_mime_path || NANO_BANANA_MIME_PATH,
            extra_json: runtime.providers.nano_banana.extra_json || process.env.NANO_BANANA_EXTRA_JSON || ''
        },
        runtime
    };
};

const readPathFromObject = (target, pathText = '') => {
    const path = String(pathText || '').trim();
    if (!path) return undefined;
    return path
        .split('.')
        .filter(Boolean)
        .reduce((acc, key) => {
            if (acc == null) return undefined;
            if (/^\d+$/.test(key)) {
                return Array.isArray(acc) ? acc[Number(key)] : undefined;
            }
            return acc[key];
        }, target);
};

const mimeTypeToExtension = (mimeType = '') => {
    const normalized = String(mimeType || '').trim().toLowerCase();
    if (normalized === 'image/png') return '.png';
    if (normalized === 'image/webp') return '.webp';
    if (normalized === 'image/jpeg' || normalized === 'image/jpg') return '.jpg';
    return '.png';
};

const fetchImageBufferFromUrl = async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`No se pudo descargar la imagen generada (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const mimeType = response.headers.get('content-type') || 'image/png';
    return {
        buffer: Buffer.from(arrayBuffer),
        mimeType
    };
};

const extractGeminiInlineImagePart = (payload = null) => {
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
    for (const candidate of candidates) {
        const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
        for (const part of parts) {
            const inline = part?.inlineData || part?.inline_data || null;
            if (!inline) continue;
            const base64Data = String(inline?.data || '').trim();
            const mimeType = String(inline?.mimeType || inline?.mime_type || 'image/png').trim() || 'image/png';
            if (base64Data) {
                return { base64Data, mimeType };
            }
        }
    }
    return null;
};

const isImageGeneratorProviderConfigured = (provider = '', effectiveSettings = null) => {
    if (provider === 'openai') {
        const openaiSettings = effectiveSettings?.openai;
        if (openaiSettings) return Boolean(openaiSettings.api_key);
        return Boolean(OPENAI_IMAGE_API_KEY);
    }
    if (provider === 'nano_banana') {
        const externalSettings = effectiveSettings?.nano_banana;
        if (externalSettings) return Boolean(externalSettings.api_url && externalSettings.api_key);
        return Boolean(NANO_BANANA_API_URL && NANO_BANANA_API_KEY);
    }
    return false;
};

const getImageGenerationProviders = async () => {
    const effectiveSettings = await resolveEffectiveImageProviderSettings();
    const labels = {
        openai: 'OpenAI Images',
        nano_banana: 'Nano Banana (API externa)'
    };
    return PEDAGOGICAL_IMAGE_PROVIDER_ALLOWLIST.map((provider) => ({
        provider,
        label: labels[provider] || provider,
        configured: isImageGeneratorProviderConfigured(provider, effectiveSettings)
    }));
};

const resolveImageGeneratorProvider = async (requestedProvider = '') => {
    const effectiveSettings = await resolveEffectiveImageProviderSettings();
    const defaultProvider = normalizeImageGeneratorProvider(effectiveSettings.default_provider || PEDAGOGICAL_IMAGE_PROVIDER_DEFAULT) || PEDAGOGICAL_IMAGE_PROVIDER_DEFAULT;
    const requested = normalizeImageGeneratorProvider(requestedProvider);
    if (requested && PEDAGOGICAL_IMAGE_PROVIDER_ALLOWLIST.includes(requested) && isImageGeneratorProviderConfigured(requested, effectiveSettings)) {
        return requested;
    }
    if (isImageGeneratorProviderConfigured(defaultProvider, effectiveSettings)) {
        return defaultProvider;
    }
    const fallback = PEDAGOGICAL_IMAGE_PROVIDER_ALLOWLIST.find((provider) => isImageGeneratorProviderConfigured(provider, effectiveSettings));
    if (!fallback) {
        throw new Error('No hay proveedor de generación de imágenes configurado');
    }
    return fallback;
};

const getImageGenerationConfig = async () => {
    const effectiveSettings = await resolveEffectiveImageProviderSettings();
    const providers = await getImageGenerationProviders();
    let defaultProvider = '';
    try {
        defaultProvider = await resolveImageGeneratorProvider('');
    } catch {
        defaultProvider = providers.find((item) => item.configured)?.provider || '';
    }
    const runtime = effectiveSettings.runtime || buildDefaultImageGenerationRuntimeConfig();
    return {
        providers,
        default_provider: defaultProvider,
        runtime: {
            default_provider: runtime.default_provider || defaultProvider,
            providers: {
                openai: {
                    base_url: runtime.providers?.openai?.base_url || '',
                    model: runtime.providers?.openai?.model || '',
                    has_api_key: Boolean(runtime.providers?.openai?.api_key || OPENAI_IMAGE_API_KEY),
                    api_key_hint: maskSecret(runtime.providers?.openai?.api_key || OPENAI_IMAGE_API_KEY || '')
                },
                nano_banana: {
                    api_url: runtime.providers?.nano_banana?.api_url || '',
                    model: runtime.providers?.nano_banana?.model || '',
                    auth_header: runtime.providers?.nano_banana?.auth_header || '',
                    auth_prefix: runtime.providers?.nano_banana?.auth_prefix || '',
                    prompt_field: runtime.providers?.nano_banana?.prompt_field || '',
                    model_field: runtime.providers?.nano_banana?.model_field || '',
                    size_field: runtime.providers?.nano_banana?.size_field || '',
                    response_b64_path: runtime.providers?.nano_banana?.response_b64_path || '',
                    response_url_path: runtime.providers?.nano_banana?.response_url_path || '',
                    response_mime_path: runtime.providers?.nano_banana?.response_mime_path || '',
                    extra_json: runtime.providers?.nano_banana?.extra_json || '',
                    has_api_key: Boolean(runtime.providers?.nano_banana?.api_key || NANO_BANANA_API_KEY),
                    api_key_hint: maskSecret(runtime.providers?.nano_banana?.api_key || NANO_BANANA_API_KEY || '')
                }
            }
        }
    };
};

const generateImageWithOpenAI = async ({
    prompt,
    size = '1024x1024',
    quality = 'low',
    settings = null
} = {}) => {
    const apiKey = settings?.api_key || OPENAI_IMAGE_API_KEY;
    const baseUrl = settings?.base_url || OPENAI_IMAGE_BASE_URL;
    const model = settings?.model || OPENAI_IMAGE_MODEL;
    if (!apiKey) {
        throw new Error('Falta OPENAI_IMAGE_API_KEY para usar OpenAI Images');
    }
    const client = new OpenAI({
        apiKey,
        baseURL: baseUrl
    });

    // gpt-image-1 NO acepta response_format (siempre devuelve b64_json por default).
    // dall-e-3 / dall-e-2 SI lo aceptan. Solo lo enviamos para modelos DALL-E.
    const imagePayload = {
        model,
        prompt,
        size
    };
    if (/^dall-e/i.test(String(model || ''))) {
        imagePayload.response_format = 'b64_json';
    }
    const response = await client.images.generate(imagePayload);

    const first = response?.data?.[0] || null;
    if (!first) {
        throw new Error('OpenAI no devolvió datos de imagen');
    }

    if (first.b64_json) {
        return {
            buffer: Buffer.from(first.b64_json, 'base64'),
            mimeType: 'image/png',
            provider: 'openai',
            model,
            revisedPrompt: first.revised_prompt || ''
        };
    }

    if (first.url) {
        const downloaded = await fetchImageBufferFromUrl(first.url);
        return {
            ...downloaded,
            provider: 'openai',
            model,
            revisedPrompt: first.revised_prompt || ''
        };
    }

    throw new Error('OpenAI no devolvió b64_json ni URL de imagen');
};

const generateImageWithNanoBanana = async ({
    prompt,
    size = '1024x1024',
    settings = null
} = {}) => {
    const apiUrl = settings?.api_url || NANO_BANANA_API_URL;
    const apiKey = settings?.api_key || NANO_BANANA_API_KEY;
    const model = settings?.model || NANO_BANANA_MODEL;
    const authHeader = settings?.auth_header || NANO_BANANA_AUTH_HEADER;
    const authPrefix = settings?.auth_prefix || NANO_BANANA_AUTH_PREFIX;
    const promptField = settings?.prompt_field || NANO_BANANA_PROMPT_FIELD;
    const modelField = settings?.model_field || NANO_BANANA_MODEL_FIELD;
    const sizeField = settings?.size_field || NANO_BANANA_SIZE_FIELD;
    const responseB64Path = settings?.response_b64_path || NANO_BANANA_B64_PATH;
    const responseUrlPath = settings?.response_url_path || NANO_BANANA_URL_PATH;
    const responseMimePath = settings?.response_mime_path || NANO_BANANA_MIME_PATH;
    const extraJson = settings?.extra_json || process.env.NANO_BANANA_EXTRA_JSON || '';

    if (!apiUrl || !apiKey) {
        throw new Error('Falta configuración NANO_BANANA_API_URL/NANO_BANANA_API_KEY');
    }

    const body = {
        [promptField]: prompt
    };
    if (modelField && model) body[modelField] = model;
    if (sizeField && size) body[sizeField] = size;

    const extra = safeJsonParse(extraJson, {});
    if (extra && typeof extra === 'object') {
        Object.assign(body, extra);
    }

    const headers = {
        'Content-Type': 'application/json'
    };
    const authValue = authPrefix
        ? `${authPrefix} ${apiKey}`.trim()
        : apiKey;
    if (authHeader) headers[authHeader] = authValue;

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Nano Banana respondió ${response.status}: ${text.slice(0, 240)}`);
    }

    const payload = await response.json();
    const b64Value = readPathFromObject(payload, responseB64Path);
    const urlValue = readPathFromObject(payload, responseUrlPath);
    const mimeType = String(readPathFromObject(payload, responseMimePath) || 'image/png').trim().toLowerCase() || 'image/png';

    if (typeof b64Value === 'string' && b64Value.trim()) {
        return {
            buffer: Buffer.from(b64Value, 'base64'),
            mimeType,
            provider: 'nano_banana',
            model: model || '',
            revisedPrompt: String(readPathFromObject(payload, 'data.0.revised_prompt') || '')
        };
    }

    if (typeof urlValue === 'string' && urlValue.trim()) {
        const downloaded = await fetchImageBufferFromUrl(urlValue);
        return {
            ...downloaded,
            provider: 'nano_banana',
            model: model || '',
            revisedPrompt: ''
        };
    }

    throw new Error('Nano Banana no devolvió imagen en b64 ni URL. Revisa NANO_BANANA_RESPONSE_*_PATH');
};

const generatePedagogicalImage = async ({
    provider = '',
    prompt = '',
    size = '1024x1024',
    quality = 'low'
} = {}) => {
    const effectiveSettings = await resolveEffectiveImageProviderSettings();
    const finalProvider = await resolveImageGeneratorProvider(provider);
    const styledPrompt = /blanco y negro|black and white/i.test(prompt)
        ? prompt
        : 'Dibujo simple en blanco y negro, estilo libro escolar, linea limpia, minimalista, fondo blanco. ' + prompt;
    if (finalProvider === 'openai') {
        return generateImageWithOpenAI({ prompt: styledPrompt, size, quality, settings: effectiveSettings.openai });
    }
    if (finalProvider === 'nano_banana') {
        return generateImageWithNanoBanana({ prompt: styledPrompt, size, settings: effectiveSettings.nano_banana });
    }
    throw new Error('Proveedor de imágenes no soportado');
};

// Genera pregunta + imagen desde asignatura/sesion/fase/nivel.
// El tema tambien lo propone la IA (o admin lo sugiere via topicHint).
const generateQuestionWithImageFromTopic = async (sheets, {
    subject = 'MATEMATICA',
    session = '',
    phase = '',
    levelName = 'BASICO',
    topicHint = '',
    provider = '',
    quality = 'low',
    size = '1024x1024'
} = {}) => {
    const normalizedSubject = normalizeSheetText(subject).toUpperCase() || 'MATEMATICA';
    const normalizedLevel = normalizeQuestionBankLevel(levelName) || 'BASICO';
    const curriculumContext = await getCurriculumContext('1medio', normalizedSubject).catch(() => ({}));

    const systemPrompt = [
        'Eres Matico, profesor chileno experto en crear preguntas pedagogicas para estudiantes de ensenanza media.',
        'Dado un contexto (asignatura, sesion, fase, nivel) PROPONES un tema especifico apropiado y creas UNA pregunta de seleccion multiple con 4 alternativas.',
        'Devuelve SOLO JSON valido con estas claves: topic, question, options, correct_answer, explanation, image_prompt, question_visual_role.',
        'options debe ser un objeto con claves A, B, C, D.',
        'correct_answer debe ser una sola letra (A|B|C|D).',
        'image_prompt debe estar en espanol, maximo 2 frases, describir elementos visuales concretos para ilustrar la pregunta.',
        'image_prompt NO debe incluir texto, numeros escritos ni letras dentro de la imagen.',
        'question_visual_role puede ser required_for_interpretation o supporting.'
    ].join(' ');

    const userPrompt = [
        'Asignatura: ' + normalizedSubject + (curriculumContext && curriculumContext.subject_label ? ' (' + curriculumContext.subject_label + ')' : '') + '.',
        'Grado: ' + ((curriculumContext && curriculumContext.grade_label) || '1 medio') + '.',
        'Sesion: ' + (session || '(libre)') + '.',
        'Fase: ' + (phase || '(libre)') + '.',
        'Nivel de dificultad: ' + normalizedLevel + '.',
        topicHint
            ? 'Pista del admin sobre el tema: "' + topicHint + '". Si la pista es clara, usala. Si es vaga, propon un tema mas especifico dentro de ese ambito.'
            : 'El admin NO indico tema - propon uno apropiado para la asignatura, nivel y sesion.',
        'Pregunta en espanol, una sola respuesta correcta clara, alternativas plausibles pero distintas.'
    ].join('\n');

    const completion = await openai.chat.completions.create({
        model: AI_MODELS.fast,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.75,
        response_format: { type: 'json_object' }
    });
    const parsed = parseJsonObjectResponse(
        completion.choices?.[0]?.message?.content || '',
        'propuesta pregunta+imagen'
    );

    const proposedTopic = String(parsed.topic || topicHint || 'Tema general').trim();
    const questionText = String(parsed.question || '').trim();
    if (!questionText) throw new Error('La IA no propuso un enunciado valido');
    const options = {
        A: String(parsed.options?.A || '').trim(),
        B: String(parsed.options?.B || '').trim(),
        C: String(parsed.options?.C || '').trim(),
        D: String(parsed.options?.D || '').trim()
    };
    if (!options.A || !options.B || !options.C || !options.D) {
        throw new Error('La IA no genero las 4 alternativas completas');
    }
    const correctAnswer = String(parsed.correct_answer || 'A').trim().toUpperCase().slice(0, 1) || 'A';
    const explanation = String(parsed.explanation || '').trim();
    const imagePrompt = String(parsed.image_prompt || ('Ilustracion educativa de ' + proposedTopic)).trim();
    const visualRole = normalizeQuestionVisualRole(parsed.question_visual_role || 'supporting');

    const generated = await generatePedagogicalImage({
        provider,
        prompt: imagePrompt,
        size,
        quality
    });

    const extension = mimeTypeToExtension(generated.mimeType || '');
    const safeTitle = sanitizeFileSegment((proposedTopic || 'ia_question').slice(0, 60)).toLowerCase();
    const saved = await saveBufferToLocalFile(
        generated.buffer,
        safeTitle + '_' + Date.now() + extension,
        'quiz-assets'
    );
    const asset = await createPedagogicalImageAsset(sheets, {
        title: (proposedTopic + ' (IA)').slice(0, 180),
        subject: normalizedSubject,
        topicTags: proposedTopic,
        kind: 'diagram',
        fileName: saved.fileName,
        fileUrl: saved.publicUrl,
        mimeType: generated.mimeType || 'image/png',
        altText: imagePrompt.slice(0, 180),
        caption: 'Auto-generada para pregunta de ' + normalizedSubject + ' - ' + normalizedLevel,
        sourceType: 'ai_generate_' + (generated.provider || 'openai'),
        status: 'draft'
    });

    return {
        proposed_topic: proposedTopic,
        image_prompt: imagePrompt,
        subject: normalizedSubject,
        session: Number(session || 0) || 0,
        phase: Number(phase || 0) || 0,
        levelName: normalizedLevel,
        question: questionText,
        options,
        correct_answer: correctAnswer,
        explanation,
        question_visual_role: visualRole,
        asset,
        generation: {
            provider: generated.provider || provider || '',
            model: generated.model || '',
            text_model: AI_MODELS.fast
        }
    };
};

// Cuenta cuantas preguntas activas en QuestionBank tienen imagen asociada
// para una combinacion (subject, session, phase). Usado para enforcar el
// tope de imagenes por fase.
const countQuestionsWithImageInPhase = async (sheets, { subject = '', session = '', phase = '' } = {}) => {
    return countRuntimeQuestionsWithImageInPhase({ subject, session, phase });
};

// Genera un batch de preguntas para una fase y le pide a la IA que indique
// para CADA pregunta su image_score (0-10) y image_role. El consumidor
// decide despues cuales reciben imagen real (respetando el cap por fase).
const generatePhaseBatchWithImageScoring = async (sheets, {
    subject = 'MATEMATICA',
    session = '',
    phase = '',
    levelName = 'BASICO',
    count = 15
} = {}) => {
    const normalizedSubject = normalizeSheetText(subject).toUpperCase() || 'MATEMATICA';
    const normalizedLevel = normalizeQuestionBankLevel(levelName) || 'BASICO';
    const targetCount = Math.max(3, Math.min(20, Number(count) || 15));
    const curriculumContext = await getCurriculumContext('1medio', normalizedSubject).catch(() => ({}));

    const systemPrompt = [
        'Eres Matico, profesor chileno experto en el curriculum nacional.',
        'Generas preguntas pedagogicas de seleccion multiple (4 alternativas) para una fase concreta de una sesion.',
        'Tu mision en esta llamada: generar EXACTAMENTE ' + targetCount + ' preguntas variadas dentro de la asignatura/sesion/fase.',
        'Para CADA pregunta debes ademas evaluar si se beneficia de una imagen o diagrama acompanante.',
        'No todas las preguntas necesitan imagen: calculo numerico abstracto, definiciones puramente verbales, etimologia, etc., normalmente NO requieren imagen.',
        'Si requieren imagen: geometria, graficos cartesianos, mapas, anatomia, circuitos, lineas de tiempo, esquemas de procesos, diagramas moleculares, etc.',
        'Devuelve SOLO JSON valido con esta forma exacta:',
        '{ "questions": [ {',
        '  "topic": "...",',
        '  "question": "...",',
        '  "options": {"A":"...","B":"...","C":"...","D":"..."},',
        '  "correct_answer": "A|B|C|D",',
        '  "explanation": "...",',
        '  "image_score": 0-10,',
        '  "image_role": "required_for_interpretation" | "supporting" | "none",',
        '  "image_prompt": "..."',
        '} ] }',
        'Reglas de scoring:',
        '- image_score 9-10 = sin imagen la pregunta pierde casi todo sentido (ej: identificar el angulo en una figura).',
        '- image_score 6-8  = la imagen ayuda mucho a interpretar el contexto.',
        '- image_score 3-5  = la imagen es decorativa o redundante.',
        '- image_score 0-2  = la imagen no aporta nada.',
        'image_role debe ser "required_for_interpretation" cuando image_score >= 8, "supporting" cuando 5-7, "none" cuando < 5.',
        'image_prompt SOLO obligatorio si image_score >= 5. Debe estar en espanol, maximo 2 frases concretas.',
        'image_prompt NO debe incluir texto, numeros escritos ni letras dentro de la imagen (esas se renderizan despues si hace falta).',
        'Estilo de imagen referencia: dibujo en blanco y negro, linea limpia, minimalista, libro escolar.'
    ].join(' ');

    const userPrompt = [
        'Asignatura: ' + normalizedSubject + (curriculumContext && curriculumContext.subject_label ? ' (' + curriculumContext.subject_label + ')' : '') + '.',
        'Grado: ' + ((curriculumContext && curriculumContext.grade_label) || '1 medio') + '.',
        'Sesion: ' + (session || '(libre)') + '.',
        'Fase: ' + (phase || '(libre)') + '.',
        'Nivel de dificultad: ' + normalizedLevel + '.',
        'Genera ' + targetCount + ' preguntas variadas. Asegurate de incluir al menos 3 preguntas con image_score >= 6 si la asignatura lo permite, y el resto con image_score adecuado a su naturaleza.',
        'No fuerces image_score alto si la pregunta no se beneficia realmente de la imagen.'
    ].join('\n');

    const completion = await openai.chat.completions.create({
        model: AI_MODELS.fast,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
    });
    const parsed = parseJsonObjectResponse(
        completion.choices?.[0]?.message?.content || '',
        'batch fase con scoring'
    );

    const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
    const normalizedQuestions = rawQuestions
        .map((raw) => {
            const options = {
                A: String(raw?.options?.A || '').trim(),
                B: String(raw?.options?.B || '').trim(),
                C: String(raw?.options?.C || '').trim(),
                D: String(raw?.options?.D || '').trim()
            };
            if (!options.A || !options.B || !options.C || !options.D) return null;
            const questionText = String(raw?.question || '').trim();
            if (!questionText) return null;
            const score = Math.max(0, Math.min(10, Number(raw?.image_score) || 0));
            const rawRole = String(raw?.image_role || '').trim().toLowerCase();
            const role = (rawRole === 'required_for_interpretation' || rawRole === 'supporting')
                ? rawRole
                : 'none';
            return {
                topic: String(raw?.topic || '').trim(),
                question: questionText,
                options,
                correct_answer: String(raw?.correct_answer || 'A').trim().toUpperCase().slice(0, 1) || 'A',
                explanation: String(raw?.explanation || '').trim(),
                image_score: score,
                image_role: role,
                image_prompt: String(raw?.image_prompt || '').trim()
            };
        })
        .filter(Boolean);

    return {
        subject: normalizedSubject,
        session: Number(session || 0) || 0,
        phase: Number(phase || 0) || 0,
        levelName: normalizedLevel,
        target_count: targetCount,
        questions: normalizedQuestions,
        text_model: AI_MODELS.fast
    };
};

const scoreExistingQuestionsForImage = async ({ subject = '', questions = [] } = {}) => {
    if (!Array.isArray(questions) || questions.length === 0) return [];

    const systemPrompt = [
        'Eres Matico, profesor chileno experto en crear imagenes pedagogicas utiles.',
        'Recibes preguntas YA EXISTENTES del QuestionBank y debes decidir cuales se benefician de una imagen.',
        'Para cada pregunta devuelve: question_id, image_score, image_role, image_prompt.',
        'Reglas:',
        '- image_score 9-10: la imagen es critica para interpretar o resolver.',
        '- image_score 6-8: la imagen ayuda mucho, pero no es estrictamente obligatoria.',
        '- image_score 3-5: la imagen seria decorativa o redundante.',
        '- image_score 0-2: la imagen no aporta.',
        'image_role debe ser required_for_interpretation si image_score >= 8, supporting si 5-7, none si < 5.',
        'image_prompt debe estar en espanol, maximo 2 frases, con elementos visuales concretos.',
        'image_prompt NO debe pedir texto, numeros ni letras escritos dentro de la imagen.',
        'Devuelve SOLO JSON valido: { "scores": [ { "question_id": "...", "image_score": 0-10, "image_role": "...", "image_prompt": "..." } ] }',
        'Incluye todas las preguntas recibidas.'
    ].join(' ');

    const userPrompt = [
        'Asignatura: ' + String(subject || '').trim().toUpperCase(),
        'Preguntas:',
        ...questions.map((q, index) => [
            '[' + (index + 1) + ']',
            'question_id=' + q.question_id,
            'topic=' + (q.topic || ''),
            'question=' + String(q.question || '').slice(0, 500),
            'options=' + JSON.stringify(q.options || {
                A: q.option_a,
                B: q.option_b,
                C: q.option_c,
                D: q.option_d
            })
        ].join(' | '))
    ].join('\n');

    const completion = await openai.chat.completions.create({
        model: AI_MODELS.fast,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.25,
        response_format: { type: 'json_object' }
    });

    const parsed = parseJsonObjectResponse(completion.choices?.[0]?.message?.content || '', 'scoring preguntas existentes');
    return (Array.isArray(parsed.scores) ? parsed.scores : []).map((item) => {
        const score = Math.max(0, Math.min(10, Number(item?.image_score) || 0));
        const rawRole = String(item?.image_role || '').trim().toLowerCase();
        return {
            question_id: String(item?.question_id || '').trim(),
            image_score: score,
            image_role: rawRole === 'required_for_interpretation'
                ? 'required_for_interpretation'
                : (rawRole === 'supporting' ? 'supporting' : 'none'),
            image_prompt: String(item?.image_prompt || '').trim()
        };
    });
};

const rewriteExistingQuestionForImage = async ({ subject = '', candidate = null, imagePrompt = '', imageRole = 'supporting' } = {}) => {
    if (!candidate?.question_id) throw new Error('Falta pregunta candidata');

    const systemPrompt = [
        'Eres Matico, profesor chileno experto en evaluacion.',
        'Vas a tomar una pregunta existente y adaptarla para que dialogue de verdad con una imagen pedagogica.',
        'La pregunta debe seguir siendo de seleccion multiple con opciones A/B/C/D.',
        'Si image_role es required_for_interpretation, la pregunta debe requerir interpretar la imagen para responder.',
        'Si image_role es supporting, la imagen debe apoyar el razonamiento, no ser solo decorativa.',
        'No menciones que la imagen fue generada por IA.',
        'No dependas de texto escrito dentro de la imagen.',
        'Devuelve SOLO JSON valido con: topic, question, options, correct_answer, explanation, image_prompt, question_visual_role.',
        'options debe tener A, B, C, D. correct_answer debe ser A, B, C o D.'
    ].join(' ');

    const userPrompt = [
        'Asignatura: ' + String(subject || candidate.subject || '').trim().toUpperCase(),
        'Rol visual objetivo: ' + imageRole,
        'Prompt de imagen propuesto: ' + imagePrompt,
        'Pregunta original:',
        JSON.stringify({
            question_id: candidate.question_id,
            topic: candidate.topic,
            question: candidate.question,
            options: candidate.options || {
                A: candidate.option_a,
                B: candidate.option_b,
                C: candidate.option_c,
                D: candidate.option_d
            },
            correct_answer: candidate.correct_answer,
            explanation: candidate.explanation
        }, null, 2)
    ].join('\n');

    const completion = await openai.chat.completions.create({
        model: AI_MODELS.fast,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.35,
        response_format: { type: 'json_object' }
    });

    const parsed = parseJsonObjectResponse(completion.choices?.[0]?.message?.content || '', 'rewrite pregunta existente con imagen');
    const options = {
        A: String(parsed.options?.A || '').trim(),
        B: String(parsed.options?.B || '').trim(),
        C: String(parsed.options?.C || '').trim(),
        D: String(parsed.options?.D || '').trim()
    };
    if (!parsed.question || !options.A || !options.B || !options.C || !options.D) {
        throw new Error('La IA no devolvio una pregunta reescrita valida');
    }

    return {
        topic: String(parsed.topic || candidate.topic || '').trim(),
        question: String(parsed.question || '').trim(),
        options,
        correct_answer: String(parsed.correct_answer || candidate.correct_answer || 'A').trim().toUpperCase().slice(0, 1) || 'A',
        explanation: String(parsed.explanation || candidate.explanation || '').trim(),
        image_prompt: String(parsed.image_prompt || imagePrompt || '').trim(),
        question_visual_role: normalizeQuestionVisualRole(parsed.question_visual_role || imageRole || 'supporting')
    };
};


const readPedagogicalAssetImageAsDataUrl = async (asset = null) => {
    if (!asset?.file_url || !asset?.mime_type) {
        throw new Error('El asset no tiene archivo de imagen válido');
    }
    const relativeUrl = String(asset.file_url || '').trim();
    const normalizedPath = relativeUrl.replace(/^\/+/, '').replace(/\//g, path.sep);
    const absolutePath = path.join(__dirname, normalizedPath);
    const buffer = await fs.readFile(absolutePath);
    return `data:${asset.mime_type};base64,${buffer.toString('base64')}`;
};

const runVisionJsonTaskForPedagogicalAsset = async ({
    asset,
    systemPrompt,
    userPrompt,
    temperature = 0.2
}) => {
    const dataUrl = await readPedagogicalAssetImageAsDataUrl(asset);
    const content = [
        { type: 'text', text: userPrompt },
        { type: 'image_url', image_url: { url: dataUrl } }
    ];

    if (openaiVisionClient) {
        const response = await openaiVisionClient.chat.completions.create({
            model: OPENAI_VISION_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content }
            ],
            response_format: { type: 'json_object' },
            temperature
        });
        return parseJsonObjectResponse(response.choices?.[0]?.message?.content || '', 'respuesta JSON de visión');
    }

    if (kimiVisionClient) {
        const response = await kimiVisionClient.chat.completions.create({
            model: NOTEBOOK_VISION_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content }
            ],
            response_format: { type: 'json_object' },
            temperature
        });
        return parseJsonObjectResponse(response.choices?.[0]?.message?.content || '', 'respuesta JSON de visión');
    }

    throw new Error('No hay proveedor de visión disponible para analizar imágenes');
};

const buildQuestionBankAssociationSuggestions = async (sheets, asset, {
    search = '',
    limit = 8
} = {}) => {
    const rows = await getQuestionBankRows(sheets);
    const subjectFilter = normalizeSheetText(asset?.subject).toUpperCase();
    const normalizedSearch = normalizeSheetText(search)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const tokenize = (value = '') => normalizeSheetText(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z0-9]+/)
        .filter(Boolean);

    const assetTokens = new Set([
        ...tokenize(asset?.title),
        ...tokenize(asset?.topic_tags),
        ...tokenize(asset?.alt_text),
        ...tokenize(asset?.caption),
        ...tokenize(search)
    ]);

    return rows
        .filter((row) => normalizeSheetBool(row.active === '' ? 'TRUE' : row.active))
        .filter((row) => !subjectFilter || normalizeSheetText(row.subject).toUpperCase() === subjectFilter)
        .map((row) => {
            const haystack = [
                row.topic,
                row.question,
                row.explanation
            ].map((item) => normalizeSheetText(item).toLowerCase()).join(' ');
            const rowTokens = tokenize(haystack);
            let score = 0;
            for (const token of assetTokens) {
                if (!token) continue;
                if (haystack.includes(token)) score += 4;
                if (rowTokens.includes(token)) score += 2;
            }
            if (normalizedSearch && haystack.includes(normalizedSearch)) score += 8;
            if (String(row.prompt_image_asset_id || '').trim()) score -= 3;
            return {
                rowNumber: row.rowNumber,
                question_id: row.question_id,
                subject: row.subject,
                session: row.session,
                phase: row.phase,
                topic: row.topic,
                question: row.question,
                prompt_image_asset_id: row.prompt_image_asset_id || '',
                prompt_image_url: row.prompt_image_url || '',
                prompt_image_alt: row.prompt_image_alt || '',
                prompt_image_caption: row.prompt_image_caption || '',
                question_visual_role: normalizeQuestionVisualRole(row.question_visual_role || ''),
                suggestion_score: score
            };
        })
        .filter((row) => row.suggestion_score > 0)
        .sort((a, b) => b.suggestion_score - a.suggestion_score)
        .slice(0, Math.max(1, Number(limit || 8) || 8));
};

const buildTheoryLudicaAssociationSuggestions = async (sheets, asset, {
    subject = '',
    session = '',
    phase = '',
    search = '',
    limit = 8
} = {}) => {
    const rows = await getTheoryLudicaRows(sheets);
    const subjectFilter = normalizeSheetText(subject || asset?.subject).toUpperCase();
    const sessionFilter = Number(session || 0) || 0;
    const phaseFilter = Number(phase || 0) || 0;

    const normalizeForSearch = (value = '') => normalizeSheetText(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const tokenize = (value = '') => normalizeForSearch(value)
        .split(/[^a-z0-9]+/)
        .filter(Boolean);

    const assetTokens = new Set([
        ...tokenize(asset?.title),
        ...tokenize(asset?.topic_tags),
        ...tokenize(asset?.alt_text),
        ...tokenize(asset?.caption),
        ...tokenize(search)
    ]);
    const normalizedSearch = normalizeForSearch(search);

    return rows
        .filter((row) => normalizeSheetBool(row.active === '' ? 'TRUE' : row.active))
        .filter((row) => !subjectFilter || normalizeTheorySubject(row.subject) === subjectFilter)
        .filter((row) => !sessionFilter || normalizeTheorySession(row.session) === sessionFilter)
        .filter((row) => !phaseFilter || normalizeTheoryPhase(row.phase) === phaseFilter)
        .map((row) => {
            const topicText = normalizeForSearch(row.topic || '');
            const theoryText = normalizeForSearch(row.theory_markdown || '');
            const haystack = `${topicText} ${theoryText}`;
            const rowTokens = tokenize(haystack);
            let score = 0;
            for (const token of assetTokens) {
                if (!token) continue;
                if (topicText.includes(token)) score += 6;
                if (haystack.includes(token)) score += 3;
                if (rowTokens.includes(token)) score += 1;
            }
            if (normalizedSearch && haystack.includes(normalizedSearch)) score += 8;
            if (String(row.support_image_asset_id || '').trim()) score -= 2;
            return {
                rowNumber: row.rowNumber,
                timestamp: row.timestamp,
                subject: row.subject,
                session: row.session,
                phase: row.phase,
                topic: row.topic,
                support_image_asset_id: row.support_image_asset_id || '',
                support_image_url: row.support_image_url || '',
                support_image_alt: row.support_image_alt || '',
                support_image_caption: row.support_image_caption || '',
                suggestion_score: score
            };
        })
        .filter((row) => row.suggestion_score > 0)
        .sort((a, b) => b.suggestion_score - a.suggestion_score)
        .slice(0, Math.max(1, Number(limit || 8) || 8));
};

const generateQuestionDraftFromPedagogicalAsset = async (sheets, asset, overrides = {}) => {
    const normalizedSubject = normalizeSheetText(overrides.subject || asset?.subject).toUpperCase() || 'MATEMATICA';
    const systemPrompt = [
        'Eres un generador experto de preguntas pedagógicas para estudiantes chilenos.',
        'Analiza la imagen y crea UNA sola pregunta de selección múltiple con 4 alternativas.',
        'La pregunta debe ser clara, resoluble, con solo una respuesta correcta y útil para quiz escolar.',
        'Devuelve SOLO JSON válido con estas claves:',
        'subject, topic, levelName, session, phase, slot, question, options, correct_answer, explanation, question_visual_role, image_analysis, tags',
        'options debe ser un objeto con claves A, B, C y D.',
        'question_visual_role debe ser required_for_interpretation o supporting.'
    ].join(' ');
    const userPrompt = [
        `Asignatura preferida: ${normalizedSubject}.`,
        `Título del asset: ${asset?.title || 'Sin título'}.`,
        `Tags del asset: ${asset?.topic_tags || 'Sin tags'}.`,
        `Alt text: ${asset?.alt_text || 'Sin alt text'}.`,
        `Caption: ${asset?.caption || 'Sin caption'}.`,
        `Sesión sugerida: ${overrides.session || ''}.`,
        `Fase sugerida: ${overrides.phase || ''}.`,
        `Nivel sugerido: ${overrides.levelName || 'BASICO'}.`,
        'La pregunta debe apoyarse en la imagen y estar escrita en español.',
        'Si no puedes inferir sesión o fase, usa 0 en session y 1 en phase.'
    ].join('\n');

    const draft = await runVisionJsonTaskForPedagogicalAsset({
        asset,
        systemPrompt,
        userPrompt,
        temperature: 0.3
    });

    return {
        subject: normalizeSheetText(draft.subject || normalizedSubject).toUpperCase() || normalizedSubject,
        topic: String(draft.topic || asset?.topic_tags || asset?.title || '').trim(),
        levelName: normalizeQuestionBankLevel(draft.levelName || overrides.levelName || 'BASICO') || 'BASICO',
        session: Number(draft.session || overrides.session || 0) || 0,
        phase: Number(draft.phase || overrides.phase || resolveQuestionBankPhase(draft.levelName || overrides.levelName || 'BASICO')) || 1,
        slot: Number(draft.slot || overrides.slot || 0) || 0,
        question: String(draft.question || '').trim(),
        options: {
            A: String(draft.options?.A || '').trim(),
            B: String(draft.options?.B || '').trim(),
            C: String(draft.options?.C || '').trim(),
            D: String(draft.options?.D || '').trim()
        },
        correct_answer: String(draft.correct_answer || 'A').trim().toUpperCase().slice(0, 1) || 'A',
        explanation: String(draft.explanation || '').trim(),
        question_visual_role: normalizeQuestionVisualRole(draft.question_visual_role || 'required_for_interpretation'),
        image_analysis: String(draft.image_analysis || '').trim(),
        tags: Array.isArray(draft.tags) ? draft.tags.map((item) => String(item || '').trim()).filter(Boolean) : []
    };
};

const sampleQuestionBankQuestions = async (sheets, {
    subject = '',
    session = 0,
    levelName = '',
    batchIndex = 0,
    requestedCount = QUIZ_BATCH_SIZE,
    excludeSignatures = []
} = {}) => {
    const normalizedSubject = normalizeSheetText(subject).toUpperCase();
    const normalizedLevel = normalizeQuestionBankLevel(levelName);
    const expectedPhase = resolveQuestionBankPhase(levelName);
    const sessionNumber = Number(session || 0) || 0;
    const startSlot = (Math.max(0, Number(batchIndex) || 0) * requestedCount) + 1;
    const endSlot = startSlot + requestedCount - 1;
    const desiredSlots = Array.from({ length: requestedCount }, (_, index) => startSlot + index);
    const excluded = new Set((excludeSignatures || []).map((item) => String(item || '').trim()).filter(Boolean));
    const rows = await listRuntimeQuestionBankRowsForAdmin({
        subject: normalizedSubject,
        session: sessionNumber,
        phase: expectedPhase,
        limit: 300
    });

    const candidatesBySlot = new Map();
    for (const row of rows) {
        const rowSubject = normalizeSheetText(row.subject).toUpperCase();
        const rowSession = Number(row.session || 0) || 0;
        const rowPhase = Number(row.phase || 0) || 0;
        const rowLevel = normalizeQuestionBankLevel(row.levelName || '');
        const rowSlot = Number(row.slot || 0) || 0;
        const rowActive = row.active === '' ? true : normalizeSheetBool(row.active);

        if (!rowActive) continue;
        if (!rowSubject || rowSubject !== normalizedSubject) continue;
        if (sessionNumber && rowSession !== sessionNumber) continue;
        if (expectedPhase && rowPhase !== expectedPhase) continue;
        if (normalizedLevel && rowLevel && rowLevel !== normalizedLevel) continue;
        if (rowSlot < startSlot || rowSlot > endSlot) continue;

        const options = {
            A: String(row.option_a || '').trim(),
            B: String(row.option_b || '').trim(),
            C: String(row.option_c || '').trim(),
            D: String(row.option_d || '').trim(),
        };
        const signature = normalizeQuestionSignature(String(row.question || '').trim(), options);
        if (!signature || excluded.has(signature)) continue;

        if (!candidatesBySlot.has(rowSlot)) {
            candidatesBySlot.set(rowSlot, []);
        }

        candidatesBySlot.get(rowSlot).push({
            question: String(row.question || '').trim(),
            options,
            correct_answer: String(row.correct_answer || 'A').trim().toUpperCase().slice(0, 1) || 'A',
            explanation: String(row.explanation || 'Explicacion no disponible.').trim(),
            source_session: rowSession,
            source_topic: String(row.topic || '').trim(),
            source_mode: 'question_bank',
            source_action: 'question_bank',
            levelName: row.levelName || normalizedLevel,
            batch_index: Math.max(0, Number(batchIndex) || 0),
            slot: rowSlot,
            proposal_index: Number(row.proposal_index || 0) || 0,
            prompt_image_asset_id: String(row.prompt_image_asset_id || '').trim(),
            prompt_image_url: String(row.prompt_image_url || '').trim(),
            prompt_image_alt: String(row.prompt_image_alt || '').trim(),
            prompt_image_caption: String(row.prompt_image_caption || '').trim(),
            question_visual_role: normalizeQuestionVisualRole(row.question_visual_role || ''),
            signature,
        });
    }

    const selected = [];
    for (const slot of desiredSlots) {
        const slotCandidates = candidatesBySlot.get(slot) || [];
        if (!slotCandidates.length) continue;
        const choice = slotCandidates[Math.floor(Math.random() * slotCandidates.length)];
        excluded.add(choice.signature);
        selected.push(choice);
    }

    return selected;
};

const listQuestionBankRowsForAdmin = async (sheets, {
    subject = '',
    session = '',
    search = '',
    limit = 60
} = {}) => {
    return listRuntimeQuestionBankRowsForAdmin({ subject, session, search, limit });
};

const sanitizeFileSegment = (value = '') => {
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80) || 'archivo';
};

const saveBase64ToLocalFile = async (base64File, fileName, subfolder = 'general') => {
    const normalizedSubfolder = String(subfolder || 'general')
        .replace(/\\/g, '/')
        .split('/')
        .filter(Boolean);
    const publicSubfolder = normalizedSubfolder.join('/');
    const targetDir = path.join(LOCAL_UPLOADS_DIR, ...normalizedSubfolder);
    await fs.mkdir(targetDir, { recursive: true });

    const cleanName = sanitizeFileSegment(path.parse(fileName).name);
    const extension = path.extname(fileName) || '.bin';
    let finalName = `${cleanName}${extension}`;
    let suffix = 1;

    while (true) {
        try {
            await fs.access(path.join(targetDir, finalName));
            finalName = `${cleanName}_${Date.now()}_${suffix}${extension}`;
            suffix += 1;
        } catch {
            break;
        }
    }

    const absolutePath = path.join(targetDir, finalName);
    await fs.writeFile(absolutePath, Buffer.from(base64File, 'base64'));

    return {
        absolutePath,
        publicUrl: `/uploads/${publicSubfolder}/${finalName}`,
        fileName: finalName
    };
};

const saveBufferToLocalFile = async (buffer, fileName, subfolder = 'general') => {
    const normalizedSubfolder = String(subfolder || 'general')
        .replace(/\\/g, '/')
        .split('/')
        .filter(Boolean);
    const publicSubfolder = normalizedSubfolder.join('/');
    const targetDir = path.join(LOCAL_UPLOADS_DIR, ...normalizedSubfolder);
    await fs.mkdir(targetDir, { recursive: true });

    const cleanName = sanitizeFileSegment(path.parse(fileName).name);
    const extension = path.extname(fileName) || '.bin';
    let finalName = `${cleanName}${extension}`;
    let suffix = 1;

    while (true) {
        try {
            await fs.access(path.join(targetDir, finalName));
            finalName = `${cleanName}_${Date.now()}_${suffix}${extension}`;
            suffix += 1;
        } catch {
            break;
        }
    }

    const absolutePath = path.join(targetDir, finalName);
    await fs.writeFile(absolutePath, buffer);

    return {
        absolutePath,
        publicUrl: `/uploads/${publicSubfolder}/${finalName}`,
        fileName: finalName
    };
};

const ensureJsonFile = async (filePath, defaultValue) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    try {
        await fs.access(filePath);
    } catch {
        await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
    }
};

const readJsonFile = async (filePath, defaultValue) => {
    await ensureJsonFile(filePath, defaultValue);

    try {
        const raw = await fs.readFile(filePath, 'utf-8');
        return raw.trim() ? JSON.parse(raw) : defaultValue;
    } catch (error) {
        console.error(`[JSON] Error leyendo ${path.basename(filePath)}:`, error.message);
        return defaultValue;
    }
};

const writeJsonFile = async (filePath, value) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
};

const readNotebookSubmissions = async () => readJsonFile(NOTEBOOK_SUBMISSIONS_FILE, {});

const writeNotebookSubmissions = async (submissions) => {
    await writeJsonFile(NOTEBOOK_SUBMISSIONS_FILE, submissions);
};

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

const NOTEBOOK_STOPWORDS = new Set([
    'a', 'al', 'algo', 'ante', 'como', 'con', 'contra', 'cual', 'cuando', 'de', 'del', 'desde',
    'donde', 'el', 'ella', 'ellas', 'ellos', 'en', 'entre', 'era', 'eramos', 'es', 'esa', 'ese',
    'eso', 'esta', 'estaba', 'estamos', 'este', 'esto', 'estos', 'fue', 'ha', 'hace', 'hacia',
    'han', 'hasta', 'hay', 'la', 'las', 'le', 'les', 'lo', 'los', 'mas', 'me', 'mi', 'mis',
    'muy', 'no', 'nos', 'nosotros', 'o', 'para', 'pero', 'por', 'porque', 'que', 'se', 'segun',
    'ser', 'si', 'sin', 'sobre', 'son', 'su', 'sus', 'tambien', 'te', 'tiene', 'todo', 'tu',
    'tus', 'un', 'una', 'uno', 'unos', 'y', 'ya'
]);

const normalizeNotebookText = (value = '') => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenizeNotebookText = (value = '', { minLength = 3, skipStopwords = true } = {}) => {
    const normalized = normalizeNotebookText(value);
    if (!normalized) return [];
    return normalized
        .split(' ')
        .map((token) => token.trim())
        .filter(Boolean)
        .filter((token) => token.length >= minLength)
        .filter((token) => !skipStopwords || !NOTEBOOK_STOPWORDS.has(token));
};

const uniqueTokens = (tokens = []) => Array.from(new Set(tokens.filter(Boolean)));

const computeNotebookStrictScore = ({
    isHandwritten = false,
    aiScore = 0,
    ocrText = '',
    theoryText = '',
    pageCount = 1,
    detectedConcepts = [],
    missingConcepts = []
} = {}) => {
    const safePageCount = Math.max(1, Number(pageCount) || 1);
    const safeAiScore = clampNumber(Number(aiScore) || 0, 0, 100);
    if (!isHandwritten) {
        return {
            finalScore: 0,
            strictScore: 0,
            aiScore: safeAiScore,
            ocrWordCount: 0,
            theoryCoverage: 0,
            expectedWordsByPages: safePageCount * 75
        };
    }

    const ocrTokens = tokenizeNotebookText(ocrText, { minLength: 2, skipStopwords: false });
    const ocrWordCount = ocrTokens.length;
    const ocrSignalTokens = uniqueTokens(tokenizeNotebookText(ocrText, { minLength: 4, skipStopwords: true }));
    const theorySignalTokens = uniqueTokens(tokenizeNotebookText(theoryText, { minLength: 4, skipStopwords: true }))
        .slice(0, 140);

    const theoryTokenSet = new Set(theorySignalTokens);
    const overlapCount = ocrSignalTokens.reduce((count, token) => (theoryTokenSet.has(token) ? count + 1 : count), 0);
    const theoryCoverage = theorySignalTokens.length
        ? clampNumber(overlapCount / theorySignalTokens.length, 0, 1)
        : 0;

    const expectedWordsByPages = safePageCount * 75;
    const lengthScore = clampNumber(ocrWordCount / expectedWordsByPages, 0, 1);

    const detectedCount = Array.isArray(detectedConcepts) ? detectedConcepts.length : 0;
    const missingCount = Array.isArray(missingConcepts) ? missingConcepts.length : 0;
    const conceptScore = (detectedCount + missingCount) > 0
        ? clampNumber(detectedCount / (detectedCount + missingCount), 0, 1)
        : 0.5;

    // CASO ESPECIAL: Si el estudiante copió TODO el texto de la teoría (cobertura >= 95%),
    // el puntaje debe ser 100% aunque haya agregado palabras adicionales con sus propias palabras.
    // Esto evita penalizar la comprensión demostrada con explicaciones extendidas.
    if (theoryCoverage >= 0.95) {
        const finalScore = safeAiScore > 0 ? clampNumber(safeAiScore, 0, 100) : 95;
        return {
            finalScore,
            strictScore: 100,
            aiScore: safeAiScore,
            ocrWordCount,
            theoryCoverage: Number(theoryCoverage.toFixed(3)),
            expectedWordsByPages
        };
    }

    let strictScore = Math.round((theoryCoverage * 0.55 + lengthScore * 0.25 + conceptScore * 0.20) * 100);

    if (ocrWordCount < 25) strictScore = Math.min(strictScore, 40);
    if (safePageCount === 1 && ocrWordCount < 40) strictScore = Math.min(strictScore, 60);
    if (theoryCoverage < 0.2) strictScore = Math.min(strictScore, 65);

    // Promedio ponderado en vez de min. Si la IA devuelve 0 (fallo parsing), usar strictScore solo.
    let finalScore;
    if (safeAiScore <= 0 && strictScore > 0) {
        // IA falló o devolvió 0 → confiar en strictScore
        finalScore = strictScore;
    } else if (safeAiScore > 0 && strictScore > 0) {
        // Ambos disponibles → promedio ponderado (IA 40%, estricto 60%)
        finalScore = Math.round(safeAiScore * 0.4 + strictScore * 0.6);
    } else {
        finalScore = Math.max(safeAiScore, strictScore);
    }
    finalScore = clampNumber(finalScore, 0, 100);

    return {
        finalScore,
        strictScore: clampNumber(strictScore, 0, 100),
        aiScore: safeAiScore,
        ocrWordCount,
        theoryCoverage: Number(theoryCoverage.toFixed(3)),
        expectedWordsByPages
    };
};

const resolveNotebookTier = (score = 0, isHandwritten = false) => {
    if (!isHandwritten || score < NOTEBOOK_QUIZ_THRESHOLD) return 'insuficiente';
    if (score >= 85) return 'oro';
    return 'plata';
};

const buildNotebookDefaultFeedback = ({ isHandwritten, interpretationScore, topic = '' }) => {
    if (!isHandwritten) {
        return 'Profe Matico no pudo validar escritura a mano en el documento. Escribe en tu cuaderno y toma una foto centrada, con buena luz.';
    }

    if (interpretationScore >= NOTEBOOK_QUIZ_THRESHOLD) {
        return `Profe Matico detectÃ³ una comprensiÃ³n suficiente de ${topic || 'la sesiÃ³n'} y el quiz ya estÃ¡ listo para continuar.`;
    }

    if (interpretationScore >= 50) {
        return 'Vas bien, pero todavÃ­a faltan ideas clave o mayor claridad en tus palabras. Corrige el cuaderno y vuelve a enviarlo para desbloquear el quiz.';
    }

    return 'El resumen todavÃ­a no refleja la idea central de la sesiÃ³n. Reescribe con tus palabras, corrige tus errores y toma una nueva foto mÃ¡s clara.';
};

const buildNotebookDefaultSuggestion = ({ isHandwritten, interpretationScore }) => {
    if (!isHandwritten) {
        return 'Evita pantallazos o texto impreso. Usa lÃ¡piz o lÃ¡pices de color y enfoca solo la hoja.';
    }

    if (interpretationScore >= NOTEBOOK_QUIZ_THRESHOLD) {
        return 'Sigue al quiz inmediato y usa la retroalimentaciÃ³n para sostener el aprendizaje.';
    }

    if (interpretationScore >= 50) {
        return 'Agrega dos ideas principales que faltaron, explica con tus palabras y vuelve a escanear.';
    }

    return 'Parte desde cero con 3 ideas clave, una explicaciÃ³n simple y, si puedes, flechas o esquemas.';
};

const normalizeNotebookAnalysisResult = (rawResult = {}, {
    topic = '',
    expectedTheory = '',
    pageCount = 1
} = {}) => {
    const isHandwritten = Boolean(rawResult.is_handwritten ?? rawResult.es_manuscrito);
    const aiInterpretationScore = clampNumber(
        Number(rawResult.interpretation_score ?? rawResult.nivel_comprension ?? 0) || 0,
        0,
        100
    );
    const detectedConcepts = Array.isArray(rawResult.detected_concepts)
        ? rawResult.detected_concepts
        : (Array.isArray(rawResult.conceptos_detectados) ? rawResult.conceptos_detectados : []);
    const missingConcepts = Array.isArray(rawResult.missing_concepts)
        ? rawResult.missing_concepts
        : (Array.isArray(rawResult.conceptos_faltantes) ? rawResult.conceptos_faltantes : []);
    const ocrText = String(rawResult.ocr_text ?? rawResult.transcripcion_ocr ?? '').trim();
    const scoreMetrics = computeNotebookStrictScore({
        isHandwritten,
        aiScore: aiInterpretationScore,
        ocrText,
        theoryText: expectedTheory,
        pageCount,
        detectedConcepts,
        missingConcepts
    });
    const interpretationScore = scoreMetrics.finalScore;
    const originalReasoning = String(rawResult.reasoning_summary ?? rawResult.analisis_escritura ?? '').trim();
    const strictReasoning = `Control estricto: AI=${scoreMetrics.aiScore}, estricto=${scoreMetrics.strictScore}, OCR=${scoreMetrics.ocrWordCount} palabras, cobertura teoria=${Math.round(scoreMetrics.theoryCoverage * 100)}%, paginas=${Math.max(1, Number(pageCount) || 1)}.`;
    const reasoningSummary = originalReasoning
        ? `${originalReasoning} ${strictReasoning}`.trim()
        : strictReasoning;
    const quizReady = isHandwritten && interpretationScore >= NOTEBOOK_QUIZ_THRESHOLD;
    const tier = resolveNotebookTier(interpretationScore, isHandwritten);
    const xpReward = tier === 'oro' ? 50 : (tier === 'plata' ? 30 : 0);

    return {
        is_handwritten: isHandwritten,
        ocr_text: ocrText,
        detected_concepts: detectedConcepts.map((item) => String(item || '').trim()).filter(Boolean),
        missing_concepts: missingConcepts.map((item) => String(item || '').trim()).filter(Boolean),
        interpretation_score: interpretationScore,
        feedback: String(rawResult.feedback || '').trim() || buildNotebookDefaultFeedback({ isHandwritten, interpretationScore, topic }),
        suggestion: String(rawResult.suggestion || '').trim() || buildNotebookDefaultSuggestion({ isHandwritten, interpretationScore }),
        reasoning_summary: reasoningSummary,
        score_breakdown: scoreMetrics,
        quiz_ready: quizReady,
        tier,
        xp_reward: xpReward
    };
};

const upsertNotebookSubmission = async (submissionId, nextValue) => {
    const submissions = await readNotebookSubmissions();
    submissions[submissionId] = nextValue;
    await writeNotebookSubmissions(submissions);
    return submissions[submissionId];
};

const updateNotebookSubmission = async (submissionId, updater) => {
    const submissions = await readNotebookSubmissions();
    const current = submissions[submissionId];
    if (!current) return null;

    const updated = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
    submissions[submissionId] = {
        ...updated,
        updated_at: new Date().toISOString()
    };
    await writeNotebookSubmissions(submissions);
    return submissions[submissionId];
};

const resolveNotebookPublicUrl = (submission = {}) => {
    const userFolder = sanitizeFileSegment(submission.user_id || submission.email || 'anon');
    const fileName = submission.file_name || `${submission.id}.pdf`;
    return `/uploads/cuadernos/${userFolder}/${fileName}`;
};

const deleteNotebookSubmissionFile = async (submission = {}) => {
    const targetPath = submission.pdf_path;
    if (!targetPath) return false;

    try {
        await fs.unlink(targetPath);
        return true;
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            console.error('[NOTEBOOK] Error eliminando PDF:', error.message);
        }
        return false;
    }
};

const expireNotebookSubmissionIfNeeded = async (submission = {}) => {
    if (!submission?.id || !submission.expires_at) return submission;
    if (submission.status === 'expired') return submission;

    const expiresAt = new Date(submission.expires_at).getTime();
    if (!expiresAt || expiresAt > Date.now()) {
        return submission;
    }

    await deleteNotebookSubmissionFile(submission);
    return updateNotebookSubmission(submission.id, (current) => ({
        ...current,
        status: 'expired',
        public_url: '',
        image_expired: true,
        error: null
    }));
};

const cleanupExpiredNotebookSubmissions = async () => {
    const submissions = await readNotebookSubmissions();
    let expiredCount = 0;
    let changed = false;

    for (const [submissionId, submission] of Object.entries(submissions)) {
        if (!submission?.expires_at || submission.status === 'expired') continue;
        const expiresAt = new Date(submission.expires_at).getTime();
        if (!expiresAt || expiresAt > Date.now()) continue;

        await deleteNotebookSubmissionFile(submission);
        submissions[submissionId] = {
            ...submission,
            status: 'expired',
            public_url: '',
            image_expired: true,
            updated_at: new Date().toISOString(),
            error: null
        };
        expiredCount += 1;
        changed = true;
    }

    if (changed) {
        await writeNotebookSubmissions(submissions);
    }

    return expiredCount;
};

const getLatestNotebookSubmissionForSession = async ({ userId = '', subject = '', session = '' } = {}) => {
    const submissions = await readNotebookSubmissions();
    const normalizedUserId = String(userId || '').trim();
    const normalizedSubject = String(subject || '').trim().toUpperCase();
    const normalizedSession = String(session || '').trim();

    return Object.values(submissions)
        .filter((submission) => {
            if (!submission || submission.status !== 'completed' || !submission.analysis_result) return false;
            if (normalizedUserId && String(submission.user_id || '').trim() !== normalizedUserId) return false;
            if (normalizedSubject && String(submission.subject || '').trim().toUpperCase() !== normalizedSubject) return false;
            if (normalizedSession && String(submission.session_id || '').trim() !== normalizedSession) return false;
            return true;
        })
        .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())[0] || null;
};

const getAdminEmails = () => {
    return [
        'joseantonio.olguinr@gmail.com',
        (process.env.GMAIL_USER || '').toLowerCase()
    ].filter(Boolean);
};

const isAdminEmail = (email = '') => {
    return getAdminEmails().includes(String(email).toLowerCase());
};

const listNotebookFiles = async () => {
    const submissions = await readNotebookSubmissions();
    const files = await Promise.all(Object.values(submissions).map(async (submission) => {
        const activeSubmission = await expireNotebookSubmissionIfNeeded(submission);
        if (!activeSubmission || activeSubmission.status === 'expired') return null;

        try {
            const stats = await fs.stat(activeSubmission.pdf_path);
            return {
                submissionId: activeSubmission.id,
                fileName: activeSubmission.file_name,
                absolutePath: activeSubmission.pdf_path,
                publicUrl: activeSubmission.public_url || resolveNotebookPublicUrl(activeSubmission),
                sizeBytes: stats.size,
                sizeLabel: `${(stats.size / 1024).toFixed(1)} KB`,
                updatedAt: activeSubmission.updated_at || stats.mtime.toISOString(),
                updatedAtLabel: new Date(activeSubmission.updated_at || stats.mtime).toLocaleString('es-CL'),
                ownerEmail: activeSubmission.email || '',
                userId: activeSubmission.user_id || '',
                status: activeSubmission.status || 'completed'
            };
        } catch (error) {
            if (error?.code !== 'ENOENT') {
                console.error('[NOTEBOOK] Error leyendo archivo del listado:', error.message);
            }
            return null;
        }
    }));

    return files
        .filter(Boolean)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
};

const deleteNotebookFile = async (fileName) => {
    const safeName = path.basename(fileName);
    const submissions = await readNotebookSubmissions();
    const match = Object.values(submissions).find((submission) => submission?.file_name === safeName);

    if (match) {
        await deleteNotebookSubmissionFile(match);
        delete submissions[match.id];
        await writeNotebookSubmissions(submissions);
        return match.pdf_path;
    }

    const absolutePath = path.join(NOTEBOOK_UPLOADS_DIR, safeName);
    await fs.unlink(absolutePath);
    return absolutePath;
};

const parseNotebookAnalysisResponse = (rawText = '') => {
    const cleaned = String(rawText || '')
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

    try {
        return JSON.parse(cleaned);
    } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
            return JSON.parse(match[0]);
        }
        throw new Error('No se pudo interpretar el JSON del analisis');
    }
};

const analyzeNotebookSubmission = async (submission, {
    previewImageBase64,
    previewImagesBase64 = [],
    imageMimeType = 'image/jpeg',
    readingContent = '',
    grade = '1medio'
} = {}) => {
    const normalizedImages = (Array.isArray(previewImagesBase64) ? previewImagesBase64 : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean);
    if (!normalizedImages.length && previewImageBase64) {
        normalizedImages.push(String(previewImageBase64).trim());
    }
    let resolvedTheoryForComparison = String(readingContent || '');
    try {
        const lookup = resolveTheoryLookup({
            subject: submission.subject,
            session: submission.session_id,
            phase: submission.phase,
            topic: submission.topic
        });

        if (lookup.subject && lookup.session && lookup.phase) {
            const sheets = await getSheetsClient();
            const storedTheory = await findTheoryLudicaByKey(sheets, { ...lookup, grade });
            if (storedTheory?.theory_markdown) {
                resolvedTheoryForComparison = String(storedTheory.theory_markdown || '').trim();
            }
        }
    } catch (error) {
        console.error('[NOTEBOOK] Error obteniendo teoria ludica desde Sheet:', error.message);
    }

    const readingExcerpt = String(resolvedTheoryForComparison || readingContent || '').substring(0, 4000);
    const isCorrectionFlow = /correcci[oÃ³]n|error/i.test(String(submission.topic || ''));
    const prompt = `Eres Profe Matico, tutor pedagÃ³gico para estudiantes de ${grade} en Chile.

Analiza un cuaderno manuscrito enviado por un alumno.

CONTEXTO
- Asignatura: ${submission.subject || 'MATEMATICA'}
- Sesion: ${submission.session_id || '0'}
- Tema: ${submission.topic || 'Sesion de estudio'}
- Cantidad de paginas: ${submission.page_count || normalizedImages.length || 1}
- Flujo de correccion de error: ${isCorrectionFlow ? 'si' : 'no'}
- Teoria o explicacion esperada:
${readingExcerpt || 'Sin contenido adicional'}

OBJETIVO
- Lee la hoja manuscrita.
- Verifica si es escritura a mano real.
- Haz OCR solo del texto principal legible.
- Compara contra la teoria.
- Evalua comprension, ideas principales, uso de palabras propias, errores conceptuales, omisiones relevantes y, si aplica, evidencia de correccion de falencias.
${isCorrectionFlow ? `
CRITERIOS ESPECIALES PARA CORRECCION DE ERROR:
- El alumno fallo una pregunta del quiz y debe demostrar que ENTIENDE por que la respuesta correcta es correcta.
- NO basta con copiar la pregunta y la letra correcta. Debe explicar el RAZONAMIENTO o CALCULO.
- Si es matematica o fisica, debe mostrar el procedimiento paso a paso (ej: v=340, f=170, lambda=v/f=340/170=2m).
- Si es lenguaje u otra materia, debe explicar con sus propias palabras por que esa alternativa es la correcta.
- Si solo copio la pregunta y la respuesta sin explicar el porqué, interpretation_score debe ser menor a ${NOTEBOOK_QUIZ_THRESHOLD}.
- Si explico el razonamiento/calculo correctamente con sus palabras, interpretation_score debe ser ${NOTEBOOK_QUIZ_THRESHOLD} o mas.
` : ''}
REGLAS
- interpretation_score debe ser un entero de 0 a 100.
- Si no es manuscrito, marca is_handwritten=false.
- Si la comprension es suficiente para comenzar quiz, debe quedar en ${NOTEBOOK_QUIZ_THRESHOLD} o mas.
- detected_concepts y missing_concepts deben ser listas cortas.
- feedback debe ser claro, motivador y accionable en 2 o 3 oraciones.
- suggestion debe ser una sola accion concreta.
- reasoning_summary debe resumir por que tomaste la decision.

RESPONDE SOLO JSON VALIDO CON ESTA FORMA:
{
  "is_handwritten": true,
  "ocr_text": "",
  "detected_concepts": ["concepto"],
  "missing_concepts": ["concepto"],
  "interpretation_score": 0,
  "feedback": "",
  "suggestion": "",
  "reasoning_summary": ""
}`;

    let rawText = '';

    if (process.env.NVIDIA_API_KEY) {
        const nvidiaResponse = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'moonshotai/kimi-k2.5',
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        ...normalizedImages.map((imageBase64) => ({
                            type: 'image_url',
                            image_url: { url: `data:${imageMimeType};base64,${imageBase64}` }
                        }))
                    ]
                }],
                max_tokens: 1600,
                temperature: 0.2
            })
        });

        if (!nvidiaResponse.ok) {
            const errText = await nvidiaResponse.text();
            throw new Error(`NVIDIA API error: ${nvidiaResponse.status} - ${errText.substring(0, 160)}`);
        }

        const responseJson = await nvidiaResponse.json();
        rawText = responseJson.choices?.[0]?.message?.content || '';
    } else if (openaiVisionClient) {
        const openaiResponse = await openaiVisionClient.chat.completions.create({
            model: OPENAI_VISION_MODEL,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    ...normalizedImages.map((imageBase64) => ({
                        type: 'image_url',
                        image_url: { url: `data:${imageMimeType};base64,${imageBase64}` }
                    }))
                ]
            }],
            max_tokens: 1600,
            temperature: 0.2
        });
        rawText = openaiResponse.choices?.[0]?.message?.content || '';
    } else if (kimiVisionClient) {
        const kimiResponse = await kimiVisionClient.chat.completions.create({
            model: NOTEBOOK_VISION_MODEL,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    ...normalizedImages.map((imageBase64) => ({
                        type: 'image_url',
                        image_url: { url: `data:${imageMimeType};base64,${imageBase64}` }
                    }))
                ]
            }],
            max_tokens: 1600,
            temperature: 0.2
        });
        rawText = kimiResponse.choices?.[0]?.message?.content || '';
    } else {
        throw new Error('No hay proveedor visual configurado. Configura OPENAI_API_KEY o KIMI_API_KEY para analizar el cuaderno.');
    }

    const parsed = parseNotebookAnalysisResponse(rawText);
    const normalized = normalizeNotebookAnalysisResult(parsed, {
        topic: submission.topic,
        expectedTheory: resolvedTheoryForComparison || readingContent || '',
        pageCount: submission.page_count || normalizedImages.length || 1
    });

    await updateNotebookSubmission(submission.id, (current) => ({
        ...current,
        status: 'completed',
        error: null,
        analysis_result: normalized,
        public_url: current.public_url || resolveNotebookPublicUrl(current)
    }));
    await recordNotebookOcr(submission, normalized);

    // Save quiz correction record if this is a correction flow
    if (isCorrectionFlow && submission.user_id) {
        try {
            const corrScore = Number(normalized.interpretation_score || 0);
            const { error: corrErr } = await supabase.from('quiz_corrections').insert({
                student_id: submission.user_id,
                subject: normalizeSubjectCode(submission.subject || ''),
                session_id: submission.session_id || null,
                question_text: String(readingContent || '').substring(0, 2000),
                wrong_answer: null,
                correct_answer: null,
                explanation_expected: String(readingContent || '').substring(0, 4000),
                ocr_text: String(normalized.ocr_text || '').substring(0, 4000),
                correction_score: corrScore,
                passed: corrScore >= NOTEBOOK_QUIZ_THRESHOLD,
                notebook_submission_id: submission.id || null
            });
            if (corrErr) console.warn('[QUIZ_CORRECTION] Insert error:', corrErr.message);
            else console.log(`[QUIZ_CORRECTION] Saved: student=${submission.user_id} score=${corrScore} passed=${corrScore >= NOTEBOOK_QUIZ_THRESHOLD}`);
        } catch (corrError) {
            console.warn('[QUIZ_CORRECTION] Error saving correction:', corrError.message);
        }
    }

    if (normalized.xp_reward > 0 && submission.user_id) {
        try {
            const sheets = await getSheetsClient();
            await logToSheet(
                sheets,
                submission.user_id,
                submission.subject || '',
                submission.session_id || '',
                'cuaderno_completed',
                '',
                '',
                normalized.tier,
                '',
                normalized.xp_reward,
                grade,
                submission.topic || '',
                '',
                'cuaderno'
            );
        } catch (error) {
            console.error('[NOTEBOOK] Error registrando XP en Sheet:', error.message);
        }
    }

    return normalized;
};

const createNotebookSubmission = async ({
    user_id,
    email,
    subject,
    session_id,
    phase,
    topic,
    reading_content,
    pdf_base64,
    pdf_file_name,
    evidences,
    preview_image_base64,
    preview_images_base64,
    image_mime_type,
    scan_id,
    page_count,
    grade
} = {}) => {
    if (!pdf_base64) {
        throw new Error('Falta pdf_base64');
    }

    const normalizedEvidenceItems = normalizeEvidencePayload({
        evidences,
        images_base64: preview_images_base64,
        image_base64: preview_image_base64,
        image_mime_type
    }).slice(0, MAX_EVIDENCE_ITEMS);
    const normalizedImages = normalizedEvidenceItems.map((item) => String(item.image_base64 || '').trim()).filter(Boolean);
    if (!normalizedImages.length && preview_image_base64) {
        normalizedImages.push(String(preview_image_base64).trim());
    }

    if (!normalizedImages.length) {
        throw new Error('Falta preview_image_base64 o preview_images_base64');
    }

    const submissionId = sanitizeFileSegment(scan_id || `notebook_${randomUUID()}`);
    const userFolder = sanitizeFileSegment(user_id || email || 'anon');
    const storedFile = await saveBase64ToLocalFile(
        pdf_base64,
        `${submissionId}.pdf`,
        `cuadernos/${userFolder}`
    );

    const nowIso = new Date().toISOString();
    const submission = {
        id: submissionId,
        scan_id: scan_id || submissionId,
        user_id: user_id || '',
        email: email || '',
        subject: subject || '',
        session_id: String(session_id || ''),
        phase: String(phase || ''),
        topic: topic || '',
        page_count: Number(page_count || normalizedImages.length || 1) || 1,
        original_file_name: pdf_file_name || `${submissionId}.pdf`,
        file_name: storedFile.fileName,
        pdf_path: storedFile.absolutePath,
        public_url: storedFile.publicUrl,
        status: 'processing',
        analysis_result: null,
        error: null,
        created_at: nowIso,
        updated_at: nowIso,
        expires_at: new Date(Date.now() + NOTEBOOK_RETENTION_MS).toISOString()
    };

    await upsertNotebookSubmission(submissionId, submission);

    (async () => {
        try {
            await analyzeNotebookSubmission(submission, {
                previewImageBase64: preview_image_base64,
                previewImagesBase64: normalizedImages,
                imageMimeType: normalizedEvidenceItems[0]?.image_mime_type || image_mime_type || 'image/jpeg',
                readingContent: reading_content || '',
                grade: grade || '1medio'
            });
        } catch (error) {
            console.error('[NOTEBOOK] Error analizando submission:', error.message);
            await updateNotebookSubmission(submissionId, (current) => ({
                ...current,
                status: 'failed',
                error: error.message || 'No se pudo analizar el cuaderno',
                analysis_result: current.analysis_result || null,
                public_url: current.public_url || resolveNotebookPublicUrl(current)
            }));
        }
    })();

    return submission;
};

app.post('/api/notebook/submissions', async (req, res) => {
    try {
        const submission = await createNotebookSubmission(req.body || {});
        return res.json({
            success: true,
            submission_id: submission.id,
            status: submission.status,
            file_path: submission.pdf_path,
            file_url: submission.public_url,
            file_name: submission.file_name,
            expires_at: submission.expires_at
        });
    } catch (error) {
        console.error('[NOTEBOOK] Error creando submission:', error.message);
        return res.status(500).json({ success: false, error: error.message || 'No se pudo crear la entrega del cuaderno' });
    }
});

app.get('/api/notebook/submissions/:id', async (req, res) => {
    try {
        const submissions = await readNotebookSubmissions();
        const submission = submissions[req.params.id];

        if (!submission) {
            return res.status(404).json({ success: false, error: 'Submission no encontrada' });
        }

        const refreshed = await expireNotebookSubmissionIfNeeded(submission) || submission;
        return res.json({
            success: true,
            submission: refreshed,
            status: refreshed.status,
            analysis_result: refreshed.analysis_result || null
        });
    } catch (error) {
        console.error('[NOTEBOOK] Error consultando submission:', error.message);
        return res.status(500).json({ success: false, error: error.message || 'No se pudo consultar la entrega' });
    }
});

app.post('/api/pedagogical-assets/upload', (req, res) => {
    upload.single('image')(req, res, async (error) => {
        try {
            if (error) {
                const message = error.code === 'LIMIT_FILE_SIZE'
                    ? `La imagen supera el máximo de ${(PEDAGOGICAL_MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0)} MB`
                    : (error.message || 'No se pudo subir la imagen');
                return res.status(400).json({ success: false, error: message });
            }

            if (!isAdminEmail(req.user?.email || req.body?.email || '')) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }

            const file = req.file;
            if (!file) {
                return res.status(400).json({ success: false, error: 'Debes adjuntar una imagen' });
            }

            if (!PEDAGOGICAL_ALLOWED_MIME_TYPES.has(String(file.mimetype || '').toLowerCase())) {
                return res.status(400).json({ success: false, error: 'Formato no permitido. Usa PNG, JPG, JPEG o WEBP.' });
            }

            const title = String(req.body?.title || '').trim();
            const subject = String(req.body?.subject || '').trim().toUpperCase();
            const topicTags = String(req.body?.topic_tags || '').trim();
            const kind = normalizePedagogicalImageKind(req.body?.kind || 'other');
            const altText = String(req.body?.alt_text || '').trim();
            const caption = String(req.body?.caption || '').trim();
            const status = normalizePedagogicalImageStatus(req.body?.status || 'draft');

            if (!title) {
                return res.status(400).json({ success: false, error: 'Debes indicar un título para la imagen' });
            }
            if (!subject) {
                return res.status(400).json({ success: false, error: 'Debes indicar la asignatura' });
            }
            if (!altText) {
                return res.status(400).json({ success: false, error: 'Debes indicar un texto alternativo' });
            }

            const safeTitle = sanitizeFileSegment(title).toLowerCase();
            const extension = path.extname(file.originalname || '').toLowerCase()
                || (file.mimetype === 'image/png' ? '.png' : (file.mimetype === 'image/webp' ? '.webp' : '.jpg'));
            const saved = await saveBufferToLocalFile(file.buffer, `${safeTitle}${extension}`, 'quiz-assets');
            const sheets = await getSheetsClient();
            const created = await createPedagogicalImageAsset(sheets, {
                title,
                subject,
                topicTags,
                kind,
                fileName: saved.fileName,
                fileUrl: saved.publicUrl,
                mimeType: file.mimetype,
                altText,
                caption,
                sourceType: 'admin_upload',
                status
            });

            return res.json({ success: true, item: created });
        } catch (err) {
            console.error('[PEDAGOGICAL_ASSET] Error subiendo imagen:', err.message);
            return res.status(500).json({ success: false, error: err.message || 'No se pudo subir la imagen pedagógica' });
        }
    });
});

app.post('/api/gemini-image-proxy', async (req, res) => {
    try {
        if (GEMINI_IMAGE_PROXY_TOKEN) {
            const authHeader = String(req.headers.authorization || '').trim();
            const expected = `Bearer ${GEMINI_IMAGE_PROXY_TOKEN}`;
            if (authHeader !== expected) {
                return res.status(401).json({ success: false, error: 'Token inválido para Gemini proxy' });
            }
        }

        const prompt = String(req.body?.prompt || '').trim();
        const model = String(req.body?.model || GEMINI_IMAGE_MODEL).trim();
        const size = String(req.body?.size || '1024x1024').trim();
        const apiKey = GEMINI_IMAGE_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ success: false, error: 'Falta GEMINI_API_KEY/GOOGLE_API_KEY en el servidor' });
        }
        if (!prompt) {
            return res.status(400).json({ success: false, error: 'Debes enviar prompt' });
        }

        const formattedPrompt = `${prompt}\n\nFormato solicitado: ${size}.`;
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: formattedPrompt }]
                    }
                ],
                generationConfig: {
                    responseModalities: ['TEXT', 'IMAGE']
                }
            })
        });

        const rawText = await geminiResponse.text();
        const payload = safeJsonParse(rawText, {});
        if (!geminiResponse.ok) {
            return res.status(geminiResponse.status).json({
                success: false,
                error: String(payload?.error?.message || rawText || `Gemini error ${geminiResponse.status}`).slice(0, 600)
            });
        }

        const inlineImage = extractGeminiInlineImagePart(payload);
        if (!inlineImage) {
            return res.status(502).json({
                success: false,
                error: 'Gemini no devolvió imagen inlineData. Revisa el modelo.',
                debug: { has_candidates: Array.isArray(payload?.candidates), model }
            });
        }

        return res.json({
            success: true,
            provider: 'gemini_proxy',
            model,
            data: [
                {
                    b64_json: inlineImage.base64Data,
                    mime_type: inlineImage.mimeType
                }
            ]
        });
    } catch (error) {
        console.error('[GEMINI_PROXY] Error:', error.message);
        return res.status(500).json({ success: false, error: error.message || 'No se pudo generar imagen con Gemini proxy' });
    }
});

app.post('/api/save-notebook', async (req, res) => {
    try {
        const {
            pdf_base64,
            file_name,
            subject,
            session_id,
            user_id,
            scan_id
        } = req.body || {};

        if (!pdf_base64) {
            return res.status(400).json({ success: false, error: 'Falta pdf_base64' });
        }

        const safeScanId = scan_id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const userFolder = sanitizeFileSegment(user_id || req.body?.email || 'anon');
        const storedFile = await saveBase64ToLocalFile(
            pdf_base64,
            `${sanitizeFileSegment(file_name || safeScanId)}.pdf`,
            `cuadernos/${userFolder}`
        );

        return res.json({
            success: true,
            file_path: storedFile.absolutePath,
            file_url: storedFile.publicUrl,
            file_name: storedFile.fileName
        });
    } catch (error) {
        console.error('[LOCAL_STORAGE] Error en /api/save-notebook:', error.message);
        return res.status(500).json({ success: false, error: error.message || 'No se pudo guardar el PDF' });
    }
});

app.post('/api/exams/intake', async (req, res) => {
    try {
        const {
            user_id = '',
            email = '',
            source_type = 'screenshot'
        } = req.body || {};

        if (!user_id) {
            return res.status(400).json({ success: false, error: 'Falta user_id' });
        }

        const evidences = normalizeEvidencePayload(req.body || {});
        if (!evidences.length) {
            return res.status(400).json({ success: false, error: 'Falta image_base64 para analizar la prueba' });
        }

        const sheets = await getSheetsClient();
        const userData = await getUserFromSheet(sheets, user_id).catch(() => null);
        const preview = await analyzeExamEvidence({
            evidences
        });

        const eventId = `EXAM_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const record = {
            timestamp: new Date().toISOString(),
            event_id: eventId,
            user_id: String(user_id || '').trim(),
            student_name: userData?.nombre || 'Estudiante',
            student_email: email || userData?.email || '',
            guardian_email: userData?.correo_apoderado || '',
            subject: preview.subject || '',
            exam_date: preview.exam_date || '',
            title: preview.title || '',
            source: String(source_type || 'screenshot').trim(),
            confidence: String(preview.confidence || 0),
            status: preview.needs_confirmation ? 'draft_pending_confirmation' : 'confirmed_scheduled',
            sent_d7: 'FALSE',
            sent_d2: 'FALSE',
            sent_d1: 'FALSE',
            last_sent_at: '',
            notes: preview.notes || ''
        };

        await appendExamReminderRow(sheets, record);

        return res.json({
            success: true,
            event_id: eventId,
            needs_confirmation: preview.needs_confirmation,
            confidence: preview.confidence,
            evidence_count_used: evidences.length,
            event_preview: {
                exam_date: preview.exam_date,
                subject: preview.subject,
                title: preview.title,
                school: preview.school || '',
                notes: preview.notes || '',
                guardian_email: record.guardian_email || ''
            }
        });
    } catch (error) {
        console.error('[EXAM_INTAKE] Error:', error.message);
        return res.status(500).json({ success: false, error: error.message || 'No se pudo registrar la prueba' });
    }
});

app.post('/api/exams/confirm', async (req, res) => {
    try {
        const {
            event_id = '',
            confirm = false,
            confirmed_data = {}
        } = req.body || {};

        if (!event_id) {
            return res.status(400).json({ success: false, error: 'Falta event_id' });
        }

        if (!confirm) {
            return res.status(400).json({ success: false, error: 'Debes confirmar el evento' });
        }

        const sheets = await getSheetsClient();
        const found = await findExamReminderById(sheets, event_id);
        if (!found) {
            return res.status(404).json({ success: false, error: 'Evento no encontrado' });
        }

        const nextSubject = normalizeSheetText(confirmed_data?.subject || found.subject).toUpperCase();
        const nextDate = normalizeExamDate(confirmed_data?.exam_date || found.exam_date);
        const nextTitle = String(confirmed_data?.title || found.title || '').trim();

        const updated = await updateExamReminderRow(sheets, found.rowNumber, {
            subject: nextSubject,
            exam_date: nextDate,
            title: nextTitle,
            status: 'confirmed_scheduled',
            notes: String(confirmed_data?.notes || found.notes || '')
        });

        return res.json({
            success: true,
            status: updated?.status || 'confirmed_scheduled',
            event: updated || null
        });
    } catch (error) {
        console.error('[EXAM_CONFIRM] Error:', error.message);
        return res.status(500).json({ success: false, error: error.message || 'No se pudo confirmar el evento' });
    }
});

app.get('/api/exams/list', async (req, res) => {
    try {
        const userId = String(req.query?.user_id || '').trim();
        const sheets = await getSheetsClient();
        const rows = await getExamReminderRows(sheets);
        const filtered = userId
            ? rows.filter((row) => String(row.user_id || '').trim() === userId)
            : rows;

        return res.json({
            success: true,
            events: filtered
                .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
                .map((row) => ({
                    event_id: row.event_id,
                    subject: row.subject,
                    exam_date: row.exam_date,
                    title: row.title,
                    confidence: Number(row.confidence || 0) || 0,
                    status: row.status,
                    sent_d7: parseSheetBool(row.sent_d7),
                    sent_d2: parseSheetBool(row.sent_d2),
                    sent_d1: parseSheetBool(row.sent_d1),
                    guardian_email: row.guardian_email,
                    timestamp: row.timestamp
                }))
        });
    } catch (error) {
        console.error('[EXAM_LIST] Error:', error.message);
        return res.status(500).json({ success: false, error: error.message || 'No se pudo listar eventos' });
    }
});

app.post('/api/oracle/exam-from-notebook/intake', async (req, res) => {
    try {
        cleanupOracleNotebookDrafts();
        const {
            user_id = '',
            email = '',
            subject_hint = 'MATEMATICA',
            session_hint = 1,
            question_count = 15
        } = req.body || {};

        if (!user_id) {
            return res.status(400).json({ success: false, error: 'Falta user_id' });
        }
        const evidences = normalizeEvidencePayload(req.body || {});
        if (!evidences.length) {
            return res.status(400).json({ success: false, error: 'Falta image_base64' });
        }

        const preview = await analyzeNotebookForOracle({
            evidences,
            subjectHint: subject_hint,
            sessionHint: session_hint
        });

        // Guardar fotos del cuaderno como pedagogical_assets para vincular a preguntas
        const savedNotebookAssets = [];
        try {
            const sheets = await getSheetsClient();
            for (let i = 0; i < evidences.length; i++) {
                const ev = evidences[i];
                const raw = String(ev.image_base64 || '').replace(/^data:image\/\w+;base64,/, '');
                if (!raw) continue;
                const buffer = Buffer.from(raw, 'base64');
                const mimeType = ev.image_mime_type || 'image/png';
                const ext = mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg';
                const safeName = sanitizeFileSegment((preview.topic || subject_hint || 'notebook').slice(0, 40)).toLowerCase();
                const fileName = `notebook_${safeName}_p${i + 1}_${Date.now()}${ext}`;
                const saved = await saveBufferToLocalFile(buffer, fileName, 'quiz-assets');
                const asset = await createPedagogicalImageAsset(sheets, {
                    title: `Cuaderno ${preview.topic || subject_hint} p${i + 1}`.slice(0, 180),
                    subject: normalizeSheetText(preview.subject || subject_hint).toUpperCase(),
                    topicTags: preview.topic || '',
                    kind: 'photo',
                    fileName: saved.fileName,
                    fileUrl: saved.publicUrl,
                    mimeType,
                    altText: `Foto cuaderno pagina ${i + 1}`,
                    caption: '',
                    sourceType: 'notebook_capture',
                    status: 'approved'
                });
                savedNotebookAssets.push(asset);
            }
        } catch (assetErr) {
            console.warn('[ORACLE_NOTEBOOK_INTAKE] No se pudieron guardar assets:', assetErr.message);
        }

        const draftId = `ORACLE_NOTEBOOK_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        oracleNotebookDrafts.set(draftId, {
            createdAt: Date.now(),
            user_id: String(user_id || '').trim(),
            email: String(email || '').trim(),
            question_count: Math.max(5, Math.min(45, Number(question_count || 15) || 15)),
            preview,
            notebook_assets: savedNotebookAssets
        });

        return res.json({
            success: true,
            draft_id: draftId,
            confidence: preview.confidence,
            evidence_count_used: evidences.length,
            needs_confirmation: true,
            detected_topics: [preview.topic, ...preview.subtopics].filter(Boolean).slice(0, 8),
            event_preview: {
                subject: preview.subject,
                topic: preview.topic,
                subtopics: preview.subtopics,
                keywords: preview.keywords,
                grade: preview.grade,
                session_base: preview.session_base
            }
        });
    } catch (error) {
        console.error('[ORACLE_NOTEBOOK_INTAKE] Error:', error.message);
        return res.status(500).json({ success: false, error: error.message || 'No se pudo analizar el cuaderno' });
    }
});

// Primera tanda rapida: 3 preguntas INTRODUCTORIO + practice_guide + metadatos.
// El frontend despues llama /generate-batch para las tandas siguientes (de 5) hasta completar.
app.post('/api/oracle/exam-from-notebook/generate', async (req, res) => {
    try {
        cleanupOracleNotebookDrafts();
        const {
            draft_id = '',
            user_id = '',
            question_count = 15,
            confirmed_data = {}
        } = req.body || {};

        if (!draft_id) {
            return res.status(400).json({ success: false, error: 'Falta draft_id' });
        }

        const draft = oracleNotebookDrafts.get(String(draft_id || '').trim());
        if (!draft) {
            return res.status(404).json({ success: false, error: 'Draft no encontrado o expirado' });
        }
        if (user_id && draft.user_id && String(user_id).trim() !== String(draft.user_id).trim()) {
            return res.status(403).json({ success: false, error: 'El draft no pertenece a este usuario' });
        }

        const sourcePreview = draft.preview || {};
        const subject = normalizeSheetText(confirmed_data?.subject || sourcePreview.subject || 'MATEMATICA').toUpperCase() || 'MATEMATICA';
        const topic = String(confirmed_data?.topic || sourcePreview.topic || '').trim();
        const subtopics = normalizeStringList(confirmed_data?.subtopics || sourcePreview.subtopics || [], 12);
        const keywords = normalizeStringList(confirmed_data?.keywords || sourcePreview.keywords || [], 15);
        const grade = String(confirmed_data?.grade || sourcePreview.grade || '1medio').trim() || '1medio';
        const sessionBase = Math.max(1, Number(confirmed_data?.session_base || sourcePreview.session_base || 1) || 1);
        const questionCount = Math.max(5, Math.min(45, Number(question_count || draft.question_count || 15) || 15));
        const notebookExcerpt = String(sourcePreview.notebook_excerpt || '').trim();

        if (!topic) {
            return res.status(400).json({ success: false, error: 'Debes confirmar el tema principal antes de generar' });
        }

        const webQueries = [topic, ...subtopics.slice(0, 2), `${subject} ${topic}`];
        const webContext = await fetchWikipediaEducationalContext(webQueries);

        // Tandas: primera rapida (3), resto de 5. Con 15 preguntas: 3 + 5 + 5 + 2 => 4 tandas (o 3 + 5 + 5 + 5 si piden 18+).
        const firstBatchSize = Math.min(3, questionCount);
        const remaining = Math.max(0, questionCount - firstBatchSize);
        const batchSize = 5;
        const remainingBatches = Math.ceil(remaining / batchSize);
        const totalBatches = 1 + remainingBatches;

        // Genera la primera tanda y la practice_guide en paralelo para responder rapido.
        const [firstQuestions, practiceGuide] = await Promise.all([
            generateOracleExamFromNotebook({
                subject,
                topic,
                subtopics,
                keywords,
                grade,
                questionCount,
                notebookExcerpt,
                sessionBase,
                webContext,
                batchIndex: 0,
                batchSize: firstBatchSize,
                totalBatches,
                previousSignatures: []
            }),
            generateOraclePracticeGuide({
                subject,
                topic,
                subtopics,
                questionCount,
                grade
            })
        ]);

        // Persiste contexto en el draft para que /generate-batch no tenga que recalcular ni re-fetchear wikipedia.
        draft.generation_context = {
            subject,
            topic,
            subtopics,
            keywords,
            grade,
            questionCount,
            notebookExcerpt,
            sessionBase,
            webContext,
            totalBatches,
            batchSize,
            firstBatchSize,
            practice_guide: practiceGuide,
            created_at: Date.now()
        };

        const sourceMixSet = new Set(firstQuestions.map((item) => item.source_type).filter(Boolean));
        if (webContext.length > 0) sourceMixSet.add('web');
        sourceMixSet.add('notebook');
        sourceMixSet.add('ai');
        const sourceMix = Array.from(sourceMixSet);

        // Enriquecer preguntas con imagenes del cuaderno (round-robin)
        const notebookAssets = draft.notebook_assets || [];
        const enrichedQuestions = firstQuestions.map((q, idx) => {
            if (notebookAssets.length === 0) return q;
            const asset = notebookAssets[idx % notebookAssets.length];
            if (!asset) return q;
            return {
                ...q,
                prompt_image_asset_id: asset.asset_id || '',
                prompt_image_url: asset.file_url || asset.public_url || '',
                prompt_image_alt: asset.alt_text || asset.altText || '',
                prompt_image_caption: `Foto de cuaderno: ${topic}`.slice(0, 120),
                question_visual_role: 'supporting'
            };
        });

        return res.json({
            success: true,
            subject,
            topic,
            session_base: sessionBase,
            question_count: questionCount,
            batch_index: 0,
            total_batches: totalBatches,
            has_more: questionCount > firstQuestions.length,
            confidence: sourcePreview.confidence || 0,
            evidence_count_used: Number(sourcePreview.evidence_count_used || 1) || 1,
            detected_topics: [topic, ...subtopics].filter(Boolean).slice(0, 8),
            questions: enrichedQuestions,
            practice_guide: practiceGuide,
            source_mix: sourceMix,
            notebook_assets: notebookAssets.map(a => ({ asset_id: a.asset_id, url: a.file_url || a.public_url }))
        });
    } catch (error) {
        console.error('[ORACLE_NOTEBOOK_GENERATE] Error:', error.message);
        return res.status(500).json({ success: false, error: error.message || 'No se pudo generar la prueba del cuaderno' });
    }
});

// Tandas siguientes: el frontend envia draft_id + batch_index + previous_signatures y se genera UNA tanda de 5 preguntas
// con dificultad progresiva (cada tanda sube un tier en ORACLE_DIFFICULTY_TIERS).
app.post('/api/oracle/exam-from-notebook/generate-batch', async (req, res) => {
    try {
        cleanupOracleNotebookDrafts();
        const {
            draft_id = '',
            user_id = '',
            batch_index = 1,
            previous_signatures = []
        } = req.body || {};

        if (!draft_id) {
            return res.status(400).json({ success: false, error: 'Falta draft_id' });
        }

        const draft = oracleNotebookDrafts.get(String(draft_id || '').trim());
        if (!draft) {
            return res.status(404).json({ success: false, error: 'Draft no encontrado o expirado' });
        }
        if (user_id && draft.user_id && String(user_id).trim() !== String(draft.user_id).trim()) {
            return res.status(403).json({ success: false, error: 'El draft no pertenece a este usuario' });
        }

        const ctx = draft.generation_context;
        if (!ctx) {
            return res.status(409).json({ success: false, error: 'Debes llamar primero a /generate para inicializar el contexto' });
        }

        const batchIndex = Math.max(1, Math.min(20, Number(batch_index) || 1));
        if (batchIndex >= ctx.totalBatches) {
            return res.json({ success: true, questions: [], batch_index: batchIndex, has_more: false, total_batches: ctx.totalBatches });
        }

        // Cuantas preguntas faltan tras esta tanda?
        const alreadyGenerated = Math.min(
            ctx.questionCount,
            ctx.firstBatchSize + (batchIndex - 1) * ctx.batchSize
        );
        const stillMissing = Math.max(0, ctx.questionCount - alreadyGenerated);
        const thisBatchSize = Math.min(ctx.batchSize, stillMissing);

        if (thisBatchSize <= 0) {
            return res.json({ success: true, questions: [], batch_index: batchIndex, has_more: false, total_batches: ctx.totalBatches });
        }

        const prevSigs = Array.isArray(previous_signatures) ? previous_signatures.filter(Boolean).slice(-60) : [];

        const questions = await generateOracleExamFromNotebook({
            subject: ctx.subject,
            topic: ctx.topic,
            subtopics: ctx.subtopics,
            keywords: ctx.keywords,
            grade: ctx.grade,
            questionCount: ctx.questionCount,
            notebookExcerpt: ctx.notebookExcerpt,
            sessionBase: ctx.sessionBase,
            webContext: ctx.webContext,
            batchIndex,
            batchSize: thisBatchSize,
            totalBatches: ctx.totalBatches,
            previousSignatures: prevSigs
        });

        const producedCount = questions.length;
        const newTotal = alreadyGenerated + producedCount;
        const hasMore = newTotal < ctx.questionCount && batchIndex + 1 < ctx.totalBatches;

        // Enriquecer con imágenes del cuaderno (round-robin con offset por batch)
        const notebookAssets = draft.notebook_assets || [];
        const enrichedBatchQuestions = questions.map((q, idx) => {
            if (notebookAssets.length === 0) return q;
            const assetIdx = (alreadyGenerated + idx) % notebookAssets.length;
            const asset = notebookAssets[assetIdx];
            if (!asset) return q;
            return {
                ...q,
                prompt_image_asset_id: asset.asset_id || '',
                prompt_image_url: asset.file_url || asset.public_url || '',
                prompt_image_alt: asset.alt_text || asset.altText || '',
                prompt_image_caption: `Foto de cuaderno: ${ctx.topic}`.slice(0, 120),
                question_visual_role: 'supporting'
            };
        });

        return res.json({
            success: true,
            batch_index: batchIndex,
            total_batches: ctx.totalBatches,
            has_more: hasMore,
            questions: enrichedBatchQuestions,
            total_generated: newTotal,
            total_expected: ctx.questionCount
        });
    } catch (error) {
        console.error('[ORACLE_NOTEBOOK_GENERATE_BATCH] Error:', error.message);
        return res.status(500).json({ success: false, error: error.message || 'No se pudo generar la tanda' });
    }
});

// =====================================================================
// POST /api/oracle/upload-question-image
// Sube una imagen (desde fotos del cuaderno u otra fuente) y la asocia
// como pedagogical_asset. Puede vincularla a una pregunta existente.
// =====================================================================
app.post('/api/oracle/upload-question-image', upload.single('image'), async (req, res) => {
    try {
        const { subject = '', session = '', topic = '', question_id = '', visual_role = 'supporting' } = req.body || {};
        const file = req.file;

        if (!file) {
            // Try base64 fallback from body
            const base64 = req.body?.image_base64 || req.body?.base64;
            if (!base64) {
                return res.status(400).json({ success: false, error: 'Falta imagen (field "image" o "image_base64")' });
            }
            const buffer = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const mimeType = (base64.match(/^data:(image\/\w+);/) || [])[1] || 'image/png';
            if (!PEDAGOGICAL_ALLOWED_MIME_TYPES.has(mimeType)) {
                return res.status(400).json({ success: false, error: `Tipo MIME no permitido: ${mimeType}` });
            }
            const ext = mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg';
            const safeTopic = sanitizeFileSegment((topic || subject || 'question_image').slice(0, 60)).toLowerCase();
            const fileName = `${safeTopic}_${Date.now()}${ext}`;
            const saved = await saveBufferToLocalFile(buffer, fileName, 'quiz-assets');

            const sheets = await getSheetsClient();
            const asset = await createPedagogicalImageAsset(sheets, {
                title: (topic || 'Imagen pregunta').slice(0, 180),
                subject: normalizeSheetText(subject).toUpperCase(),
                topicTags: topic || '',
                kind: 'photo',
                fileName: saved.fileName,
                fileUrl: saved.publicUrl,
                mimeType,
                altText: (topic || 'Imagen de pregunta').slice(0, 180),
                caption: '',
                sourceType: 'notebook_upload',
                status: 'approved'
            });

            // Link to question if question_id provided
            if (question_id) {
                await linkQuestionBankAsset(sheets, { questionId: question_id, assetId: asset.asset_id });
                if (visual_role) {
                    await updateQuestionVisualRole(sheets, { questionId: question_id, visualRole: visual_role });
                }
            }

            return res.json({
                success: true,
                asset,
                linked_question_id: question_id || null
            });
        }

        // Multer file upload path
        if (!PEDAGOGICAL_ALLOWED_MIME_TYPES.has(file.mimetype)) {
            return res.status(400).json({ success: false, error: `Tipo MIME no permitido: ${file.mimetype}` });
        }

        const ext = file.mimetype === 'image/png' ? '.png' : file.mimetype === 'image/webp' ? '.webp' : '.jpg';
        const safeTopic = sanitizeFileSegment((topic || subject || 'question_image').slice(0, 60)).toLowerCase();
        const fileName = `${safeTopic}_${Date.now()}${ext}`;
        const saved = await saveBufferToLocalFile(file.buffer, fileName, 'quiz-assets');

        const sheets = await getSheetsClient();
        const asset = await createPedagogicalImageAsset(sheets, {
            title: (topic || 'Imagen pregunta').slice(0, 180),
            subject: normalizeSheetText(subject).toUpperCase(),
            topicTags: topic || '',
            kind: 'photo',
            fileName: saved.fileName,
            fileUrl: saved.publicUrl,
            mimeType: file.mimetype,
            altText: (topic || 'Imagen de pregunta').slice(0, 180),
            caption: '',
            sourceType: 'notebook_upload',
            status: 'approved'
        });

        if (question_id) {
            await linkQuestionBankAsset(sheets, { questionId: question_id, assetId: asset.asset_id });
            if (visual_role) {
                await updateQuestionVisualRole(sheets, { questionId: question_id, visualRole: visual_role });
            }
        }

        return res.json({
            success: true,
            asset,
            linked_question_id: question_id || null
        });
    } catch (error) {
        console.error('[ORACLE_UPLOAD_QUESTION_IMAGE] Error:', error.message);
        return res.status(500).json({ success: false, error: error.message || 'No se pudo subir la imagen' });
    }
});

// --- HELPER: Subir imagen a Google Drive ---
const uploadToDrive = async (base64File, fileName, folderId, mimeType = 'image/jpeg') => {
    try {
        const auth = new google.auth.GoogleAuth({
            credentials: getGoogleCredentials(),
            scopes: ['https://www.googleapis.com/auth/drive'],
        });
        const drive = google.drive({ version: 'v3', auth });

        const buffer = Buffer.from(base64File, 'base64');
        const media = {
            mimeType,
            body: Readable.from(buffer),
        };

        const fileMetadata = {
            name: fileName,
            parents: [folderId],
        };

        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id',
        });

        return response.data.id;
    } catch (err) {
        console.error(`[DRIVE] Error uploadToDrive:`, err.message);
        throw err;
    }
};

// --- ConfiguraciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n Nodemailer (Gmail) ---
const EMAIL_CONFIG = {
    user: (process.env.GMAIL_USER || '').trim(),
    appPassword: (process.env.GMAIL_APP_PASSWORD || '').trim()
};

const isEmailEnabled = () => Boolean(EMAIL_CONFIG.user && EMAIL_CONFIG.appPassword);

const getEmailStatus = () => {
    const missing = [];

    if (!EMAIL_CONFIG.user) missing.push('GMAIL_USER');
    if (!EMAIL_CONFIG.appPassword) missing.push('GMAIL_APP_PASSWORD');

    return {
        enabled: missing.length === 0,
        missing
    };
};

const transporter = isEmailEnabled()
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: EMAIL_CONFIG.user,
            pass: EMAIL_CONFIG.appPassword,
        },
    })
    : null;

// --- HELPER: Obtener datos del usuario desde la hoja Usuarios ---
const getUserFromSheet = async (sheets, user_id) => {
    const row = await getRuntimeUserByToken(user_id);
    if (!row) return null;
    return {
        token: row.token,
        email: row.mail || '',
        nombre: row.nombre || 'Estudiante',
        celular: row.celular || '',
        region: row.region || '',
        comuna: row.comuna || '',
        correo_apoderado: row.correo_apoderado || '',
    };
};

// --- HELPER: Obtener TODOS los usuarios ---
const getAllUsersFromSheet = async (sheets) => {
    const rows = await listRuntimeUsers();
    return rows.map(row => ({
        token: row.token || '',
        email: row.mail || '',
        nombre: row.nombre || 'Estudiante',
        correo_apoderado: row.correo_apoderado || '',
    }));
};

// --- HELPER: Enviar correo ---
const sendEmail = async (to, subject, htmlBody) => {
    if (!to || !process.env.GMAIL_USER) {
        console.log(`[EMAIL] ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â No se enviÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³: destinatario=${to}, gmail_user=${process.env.GMAIL_USER}`);
        return;
    }
    try {
        await transporter.sendMail({
            from: `"Matico ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¶" <${process.env.GMAIL_USER}>`,
            to: to,
            subject: subject,
            html: htmlBody,
        });
        console.log(`[EMAIL] ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ Enviado a ${to}: "${subject}"`);
    } catch (err) {
        console.error(`[EMAIL] ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ Error enviando a ${to}:`, err.message);
    }
};

// --- HELPER: Guardar evento en progress_log ---
const sendEmailSafe = async (to, subject, htmlBody) => {
    if (!to) {
        console.log('[EMAIL] No se envio: falta destinatario');
        return;
    }

    if (!isEmailEnabled() || !transporter) {
        const status = getEmailStatus();
        console.log(`[EMAIL] Deshabilitado, faltan variables: ${status.missing.join(', ')}`);
        return;
    }

    try {
        await transporter.sendMail({
            from: `"Matico" <${EMAIL_CONFIG.user}>`,
            to,
            subject,
            html: htmlBody,
        });
        console.log(`[EMAIL] Enviado a ${to}: "${subject}"`);
    } catch (err) {
        console.error(`[EMAIL] Error enviando a ${to}:`, err.message);
    }
};

const normalizeSubjectCode = (value = '') => {
    const raw = String(value || '').trim().toUpperCase();
    const normalized = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalized.includes('MAT')) return 'MATEMATICA';
    if (normalized.includes('BIO')) return 'BIOLOGIA';
    if (normalized.includes('FIS')) return 'FISICA';
    if (normalized.includes('QUI')) return 'QUIMICA';
    if (normalized.includes('HIST')) return 'HISTORIA';
    if (normalized.includes('LENG') || normalized.includes('LECT')) return 'LENGUAJE';
    return raw || 'GENERAL';
};

const dateOnlyInSantiago = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Santiago',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date).reduce((acc, part) => {
        acc[part.type] = part.value;
        return acc;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
};

const addDaysToDateOnly = (dateStr, days) => {
    const d = new Date(`${dateStr}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};

const getProfileByAnyId = async (userId = '') => {
    if (!userId) return null;
    const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    if (data) return data;

    const { data: legacy } = await supabase
        .from('users')
        .select('*')
        .eq('token', userId)
        .maybeSingle();
    if (!legacy) return null;
    return {
        user_id: legacy.token,
        email: legacy.mail,
        display_name: legacy.nombre,
        guardian_email: legacy.correo_apoderado,
        parent_user_id: null,
        fcm_token: null
    };
};

const resolveParentProfileForStudent = async (studentProfile = {}) => {
    if (studentProfile?.parent_user_id) {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', studentProfile.parent_user_id)
            .maybeSingle();
        if (data) return data;
    }

    const guardianEmail = String(studentProfile?.guardian_email || studentProfile?.correo_apoderado || '').trim();
    if (!guardianEmail) return null;
    const { data } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', guardianEmail)
        .maybeSingle();
    return data || { user_id: '', email: guardianEmail, display_name: 'Apoderado', fcm_token: null };
};

const createSmartNotification = async ({
    user_id,
    event_id = null,
    type = 'info',
    title,
    body = '',
    scheduled_at = new Date().toISOString(),
    priority = 'normal',
    payload = {},
    sent_push = false,
    sent_email = false,
    sent_at = null
} = {}) => {
    if (!user_id || !title) return null;
    const row = {
        user_id,
        event_id,
        type,
        title,
        body,
        scheduled_at,
        priority,
        payload,
        sent_push,
        sent_email,
        sent_at
    };
    const { data, error } = await supabase.from('notifications').insert(row).select().maybeSingle();
    if (error) {
        await createNotification({ user_id, event_id, type, title, body, scheduled_at });
        return null;
    }
    return data;
};

const sendPushNotification = async ({ token, title, body, payload = {} } = {}) => {
    const serverKey = process.env.FCM_SERVER_KEY || process.env.FIREBASE_SERVER_KEY;
    if (!token || !serverKey) {
        return { ok: false, reason: !token ? 'missing_token' : 'missing_fcm_server_key' };
    }
    try {
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
                Authorization: `key=${serverKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: token,
                priority: 'high',
                notification: { title, body, sound: 'default' },
                data: Object.fromEntries(Object.entries(payload || {}).map(([key, value]) => [key, String(value ?? '')]))
            })
        });
        if (!response.ok) return { ok: false, reason: `fcm_${response.status}` };
        return { ok: true };
    } catch (error) {
        return { ok: false, reason: error.message || 'push_failed' };
    }
};

const recordStudyAlert = async ({
    student_user_id,
    parent_user_id = '',
    subject = '',
    alert_type,
    title,
    body = '',
    severity = 'info',
    event_id = null,
    report_id = null,
    payload = {}
} = {}) => {
    try {
        const { data, error } = await supabase.from('study_alerts').insert({
            student_user_id,
            parent_user_id: parent_user_id || null,
            subject: subject || null,
            alert_type,
            title,
            body,
            severity,
            event_id,
            report_id,
            payload
        }).select().maybeSingle();
        if (error) throw error;
        return data;
    } catch (error) {
        console.warn('[STUDY_ALERT] omitido:', error.message);
        return null;
    }
};

const recordNotebookOcr = async (submission = {}, analysis = {}) => {
    try {
        const { error } = await supabase.from('notebook_ocr_records').upsert({
            submission_id: submission.id,
            user_id: submission.user_id || null,
            user_email: submission.email || submission.user_email || null,
            subject: normalizeSubjectCode(submission.subject || analysis.subject || ''),
            session_id: submission.session_id || null,
            phase: submission.phase || null,
            topic: submission.topic || '',
            ocr_text: analysis.ocr_text || '',
            detected_concepts: analysis.detected_concepts || [],
            missing_concepts: analysis.missing_concepts || [],
            interpretation_score: Number(analysis.interpretation_score || 0),
            quiz_ready: Boolean(analysis.quiz_ready),
            tier: analysis.tier || '',
            feedback: analysis.feedback || '',
            suggestion: analysis.suggestion || '',
            page_count: Number(submission.page_count || 1) || 1,
            image_available_until: submission.expires_at || null,
            public_url: submission.public_url || '',
            metadata: {
                status: submission.status,
                scan_id: submission.scan_id,
                file_name: submission.file_name,
                xp_reward: analysis.xp_reward || 0
            }
        }, { onConflict: 'submission_id' });
        if (error) throw error;
    } catch (error) {
        console.warn('[NOTEBOOK_OCR] No se pudo persistir OCR:', error.message);
    }
};

const buildDailyReportHtml = (report = {}) => {
    const rows = (report.subjects || []).map(item => `
        <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.subject)}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(String(item.study_minutes || 0))} min</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(String(item.quiz_correct || 0))}/${escapeHtml(String(item.quiz_total || 0))}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(String(item.notebook_score || 0))}%</td>
        </tr>
    `).join('');
    return `
        <div style="font-family:Segoe UI,Arial,sans-serif;max-width:680px;margin:0 auto;color:#1f2937;">
            <h1 style="color:#4f46e5;">Reporte diario Matico</h1>
            <p><strong>${escapeHtml(report.student_name || 'Matias')}</strong> ${report.studied_today ? 'estudio hoy.' : 'no registra estudio hoy.'}</p>
            <p>${escapeHtml(report.summary_text || '')}</p>
            <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                <thead><tr style="background:#f8fafc;"><th style="text-align:left;padding:8px;">Materia</th><th style="text-align:left;padding:8px;">Estudio</th><th style="text-align:left;padding:8px;">Quiz</th><th style="text-align:left;padding:8px;">Cuaderno</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="4" style="padding:12px;">Sin actividad registrada.</td></tr>'}</tbody>
            </table>
            <p style="margin-top:16px;color:#64748b;">Imagenes de cuaderno disponibles por 3 dias; el OCR queda guardado para consulta.</p>
        </div>
    `;
};

const buildDailyReportForStudent = async ({ student_user_id, report_date = dateOnlyInSantiago(), send = false } = {}) => {
    if (!student_user_id) throw new Error('Falta student_user_id');
    const studentProfile = await getProfileByAnyId(student_user_id);
    const parentProfile = await resolveParentProfileForStudent(studentProfile || {});
    const nextDate = addDaysToDateOnly(report_date, 1);
    const fromIso = `${report_date}T00:00:00-04:00`;
    const toIso = `${nextDate}T00:00:00-04:00`;

    const [studyRes, progressRes, calendarRes, ocrRes] = await Promise.all([
        supabase.from('study_sessions').select('*').eq('student_user_id', student_user_id).gte('start_time', fromIso).lt('start_time', toIso),
        supabase.from('progress_log').select('*').eq('user_id', student_user_id).gte('created_at', fromIso).lt('created_at', toIso),
        supabase.from('calendar_events').select('*').eq('student_user_id', student_user_id).eq('event_date', report_date),
        supabase.from('notebook_ocr_records').select('*').eq('user_id', student_user_id).gte('created_at', fromIso).lt('created_at', toIso)
    ]);

    const studyRows = studyRes.data || [];
    const progressRows = progressRes.data || [];
    const calendarRows = calendarRes.data || [];
    const ocrRows = ocrRes.data || [];
    const subjectMap = new Map();
    const ensureSubject = (subject) => {
        const key = normalizeSubjectCode(subject || 'GENERAL');
        if (!subjectMap.has(key)) {
            subjectMap.set(key, {
                subject: key,
                study_minutes: 0,
                quiz_total: 0,
                quiz_correct: 0,
                quiz_wrong: 0,
                notebook_score: 0,
                notebook_pages: 0,
                notebook_ocr: '',
                events: []
            });
        }
        return subjectMap.get(key);
    };

    studyRows.forEach(row => {
        const item = ensureSubject(row.subject);
        item.study_minutes += Number(row.total_minutes || 0);
    });
    progressRows.forEach(row => {
        const item = ensureSubject(row.subject);
        const total = Number(row.total_questions || 0);
        const correct = Number(row.correct_answers || 0);
        item.quiz_total += total;
        item.quiz_correct += correct;
        item.quiz_wrong += Number(row.wrong_answers || Math.max(0, total - correct));
    });
    calendarRows.forEach(row => {
        ensureSubject(row.subject).events.push(row.title || row.event_type || 'Evento');
    });
    ocrRows.forEach(row => {
        const item = ensureSubject(row.subject);
        item.notebook_score = Math.max(item.notebook_score, Number(row.interpretation_score || 0));
        item.notebook_pages += Number(row.page_count || 0);
        if (!item.notebook_ocr && row.ocr_text) item.notebook_ocr = String(row.ocr_text).slice(0, 600);
    });

    const subjects = [...subjectMap.values()].sort((a, b) => a.subject.localeCompare(b.subject));
    const totalMinutes = studyRows.reduce((sum, row) => sum + (Number(row.total_minutes) || 0), 0);
    const totalQuestions = subjects.reduce((sum, row) => sum + row.quiz_total, 0);
    const totalCorrect = subjects.reduce((sum, row) => sum + row.quiz_correct, 0);
    const studiedToday = totalMinutes > 0 || progressRows.length > 0 || ocrRows.length > 0;
    const staleAlerts = [];
    const sinceIso = `${addDaysToDateOnly(report_date, -STUDY_STALE_DAYS)}T00:00:00-04:00`;

    // Helper: build subject variants for case/accent-insensitive matching
    const subjectVariants = (s) => {
        const base = s.toUpperCase();
        const withAccent = base.replace('FISICA', 'FÍSICA').replace('MATEMATICA', 'MATEMÁTICA')
            .replace('QUIMICA', 'QUÍMICA').replace('BIOLOGIA', 'BIOLOGÍA');
        const lower = base.toLowerCase();
        const titled = lower.charAt(0).toUpperCase() + lower.slice(1);
        return [...new Set([base, withAccent, lower, titled])];
    };

    const staleDetails = {};
    for (const subject of PRIORITY_STUDY_SUBJECTS) {
        const variants = subjectVariants(subject);
        const orFilter = variants.map(v => `subject.eq.${v}`).join(',');
        const [recentStudy, recentProgress, recentOcr] = await Promise.all([
            supabase.from('study_sessions').select('session_id,start_time,subject').eq('student_user_id', student_user_id).or(orFilter).order('start_time', { ascending: false }).limit(1),
            supabase.from('progress_log').select('id,created_at,subject').eq('user_id', student_user_id).or(orFilter).order('created_at', { ascending: false }).limit(1),
            supabase.from('notebook_ocr_records').select('id,created_at,subject').eq('user_id', student_user_id).or(orFilter).order('created_at', { ascending: false }).limit(1)
        ]);
        // Find the most recent activity date across all 3 tables
        const dates = [
            recentStudy.data?.[0]?.start_time,
            recentProgress.data?.[0]?.created_at,
            recentOcr.data?.[0]?.created_at
        ].filter(Boolean).map(d => new Date(d)).sort((a, b) => b - a);
        const lastDate = dates[0] || null;
        const isStale = !lastDate || lastDate < new Date(sinceIso);
        const daysAgo = lastDate ? Math.floor((Date.now() - lastDate.getTime()) / 86400000) : null;

        staleDetails[subject] = {
            has_activity: !!lastDate,
            last_activity: lastDate ? lastDate.toISOString() : null,
            days_ago: daysAgo,
            is_stale: isStale,
            found_in: [
                recentStudy.data?.length ? 'study_sessions' : null,
                recentProgress.data?.length ? 'progress_log' : null,
                recentOcr.data?.length ? 'notebook_ocr' : null
            ].filter(Boolean)
        };
        if (isStale) {
            staleAlerts.push(subject);
        }
    }

    const summaryText = studiedToday
        ? `Hoy registro ${totalMinutes} minutos de estudio y ${totalCorrect}/${totalQuestions || 0} respuestas correctas.`
        : 'Hoy no hay evidencia de estudio, quiz ni cuaderno revisado.';
    const payload = {
        report_date,
        student_user_id,
        student_name: studentProfile?.display_name || studentProfile?.nombre || 'Matias',
        parent_user_id: parentProfile?.user_id || '',
        parent_email: parentProfile?.email || studentProfile?.guardian_email || '',
        studied_today: studiedToday,
        total_minutes: totalMinutes,
        quiz_total: totalQuestions,
        quiz_correct: totalCorrect,
        quiz_wrong: Math.max(0, totalQuestions - totalCorrect),
        notebook_count: ocrRows.length,
        subjects,
        stale_subjects: staleAlerts,
        stale_details: staleDetails,
        summary_text: summaryText,
        generated_at: new Date().toISOString()
    };

    let reportId = null;
    try {
        const { data, error } = await supabase.from('daily_reports').upsert({
            student_user_id,
            parent_user_id: payload.parent_user_id || null,
            report_date,
            payload,
            studied_today: studiedToday,
            total_minutes: totalMinutes,
            quiz_total: totalQuestions,
            quiz_correct: totalCorrect,
            quiz_wrong: payload.quiz_wrong,
            notebook_count: ocrRows.length,
            status: send ? 'sending' : 'generated'
        }, { onConflict: 'student_user_id,report_date' }).select().maybeSingle();
        if (!error && data?.report_id) reportId = data.report_id;
    } catch (error) {
        console.warn('[DAILY_REPORT] No se pudo guardar reporte:', error.message);
    }

    if (send && !studiedToday) {
        await recordStudyAlert({
            student_user_id,
            parent_user_id: payload.parent_user_id,
            alert_type: 'no_study_today',
            title: 'Matias no registra estudio hoy',
            body: summaryText,
            severity: 'high',
            report_id: reportId,
            payload
        });
    }
    if (send) {
        for (const subject of staleAlerts) {
            await recordStudyAlert({
                student_user_id,
                parent_user_id: payload.parent_user_id,
                subject,
                alert_type: 'stale_subject',
                title: `${subject}: sin estudio reciente`,
                body: `No hay actividad de ${subject} en los ultimos ${STUDY_STALE_DAYS} dias.`,
                severity: 'medium',
                report_id: reportId,
                payload: { report_date, subject }
            });
        }
    }

    if (send && payload.parent_user_id) {
        const title = `Reporte Matico ${report_date}`;
        const body = studiedToday
            ? `${payload.student_name}: ${totalMinutes} min, ${totalCorrect}/${totalQuestions || 0} correctas.`
            : `${payload.student_name} no registra estudio hoy.`;
        const pushResult = await sendPushNotification({
            token: parentProfile?.fcm_token,
            title,
            body,
            payload: { type: 'daily_report', report_id: reportId || '', report_date }
        });
        let sentEmail = false;
        if (!pushResult.ok && payload.parent_email) {
            await sendEmailSafe(payload.parent_email, title, buildDailyReportHtml(payload));
            sentEmail = true;
        }
        await createSmartNotification({
            user_id: payload.parent_user_id,
            type: 'daily_report',
            title,
            body,
            priority: studiedToday ? 'normal' : 'high',
            payload: { ...payload, push_result: pushResult.reason || 'ok' },
            sent_push: pushResult.ok,
            sent_email: sentEmail,
            sent_at: new Date().toISOString()
        });
        if (reportId) {
            await supabase.from('daily_reports').update({
                status: pushResult.ok ? 'sent_push' : (sentEmail ? 'sent_email' : 'notified'),
                sent_push: pushResult.ok,
                sent_email: sentEmail,
                sent_at: new Date().toISOString()
            }).eq('report_id', reportId);
        }
    }

    return { ...payload, report_id: reportId };
};

const logToSheet = async (
    sheets,
    user_id,
    subject,
    session,
    event_type,
    phase,
    subLevel,
    levelName,
    score,
    xp,
    grade = '',
    topic = '',
    totalQuestions = '',
    sourceMode = '',
    batchIndex = '',
    batchSize = '',
    correctAnswers = '',
    wrongAnswers = '',
    wrongQuestionDetails = '',
    weakness = '',
    improvementPlan = ''
) => {
    try {
        const timestamp = new Date().toISOString();
        await insertRuntimeProgressLog({
            user_id,
            subject,
            session,
            event_type,
            phase,
            subLevel,
            levelName,
            score,
            xp,
            grade,
            topic,
            totalQuestions,
            sourceMode,
            batchIndex,
            batchSize,
            correctAnswers,
            wrongAnswers,
            wrongQuestionDetails,
            weakness,
            improvementPlan
        });

        console.log('[SUPABASE_PROGRESS_OK]', JSON.stringify({ timestamp, event_type, user_id, subject, phase, xp }));
    } catch (err) {
        console.error('[SUPABASE_PROGRESS_FAIL]', err.message);
    }
};

const PROGRESS_LOG_HEADERS = [
    'timestamp',
    'user_id',
    'subject',
    'session',
    'event_type',
    'phase',
    'subLevel',
    'levelName',
    'score',
    'xp',
    'grade',
    'topic',
    'totalQuestions',
    'sourceMode',
    'batchIndex',
    'batchSize',
    'correctAnswers',
    'wrongAnswers',
    'wrongQuestionDetails',
    'weakness',
    'improvementPlan'
];

const appendProgressToSheetOrThrow = async (sheets, {
    user_id = '',
    subject = '',
    session = '',
    event_type = '',
    phase = '',
    subLevel = '',
    levelName = '',
    score = '',
    xp = '',
    grade = '',
    topic = '',
    totalQuestions = '',
    sourceMode = '',
    batchIndex = '',
    batchSize = '',
    correctAnswers = '',
    wrongAnswers = '',
    wrongQuestionDetails = '',
    weakness = '',
    improvementPlan = ''
}) => {
    const timestamp = new Date().toISOString();
    try {
        await insertRuntimeProgressLog({
            user_id,
            subject,
            session,
            event_type,
            phase,
            subLevel,
            levelName,
            score,
            xp,
            grade,
            topic,
            totalQuestions,
            sourceMode,
            batchIndex,
            batchSize,
            correctAnswers,
            wrongAnswers,
            wrongQuestionDetails,
            weakness,
            improvementPlan
        });
        console.log('[SUPABASE_PROGRESS_APPEND_OK]', JSON.stringify({
            timestamp,
            user_id,
            subject,
            session,
            event_type,
            phase,
            subLevel,
            levelName,
            score: score || '0',
            xp: xp || '0',
            grade,
            topic,
            totalQuestions,
            sourceMode,
            batchIndex,
            batchSize,
            correctAnswers,
            wrongAnswers,
            wrongQuestionDetails,
            weakness,
            improvementPlan
        }));
    } catch (err) {
        console.error('[SUPABASE_PROGRESS_APPEND_FAIL]', JSON.stringify({
            timestamp,
            user_id,
            subject,
            session,
            event_type,
            phase,
            subLevel,
            levelName,
            score: score || '0',
            xp: xp || '0',
            grade,
            topic,
            totalQuestions,
            sourceMode,
            batchIndex,
            batchSize,
            correctAnswers,
            wrongAnswers,
            wrongQuestionDetails,
            weakness,
            improvementPlan,
            error: err.message
        }));
        throw err;
    }
};
const ADAPTIVE_PROFILE_SHEET = 'adaptive_profile_log';

const columnLabel = (index) => {
    let n = Number(index) || 0;
    let label = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        label = String.fromCharCode(65 + rem) + label;
        n = Math.floor((n - 1) / 26);
    }
    return label || 'A';
};

const ensureSheetTabExists = async (sheets, title, headers = []) => {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const exists = (meta.data.sheets || []).some((sheet) => sheet.properties?.title === title);
    if (exists) return;

    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title } } }] }
    });

    if (headers.length > 0) {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: title + '!A1:' + columnLabel(headers.length) + '1',
            valueInputOption: 'RAW',
            requestBody: { values: [headers] }
        });
    }
};

const ensureSheetHeaders = async (sheets, title, headers = []) => {
    if (!headers.length) return;

    await ensureSheetTabExists(sheets, title, headers);

    const headerRange = `${title}!A1:${columnLabel(headers.length)}1`;
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: headerRange
    });
    const existingHeaders = response.data.values?.[0] || [];
    const needsUpdate = headers.some((header, index) => String(existingHeaders[index] || '').trim() !== header);
    if (!needsUpdate) return;

    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: headerRange,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] }
    });
};

const ensureTheorySheetFormatting = async (sheets) => {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const theorySheet = (meta.data.sheets || []).find((sheet) => sheet.properties?.title === THEORY_LUDICA_SHEET);
    const theorySheetId = theorySheet?.properties?.sheetId;
    if (theorySheetId === undefined || theorySheetId === null) return;

    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
            requests: [
                {
                    repeatCell: {
                        range: {
                            sheetId: theorySheetId,
                            startRowIndex: 1,
                            startColumnIndex: 5,
                            endColumnIndex: 6
                        },
                        cell: {
                            userEnteredFormat: {
                                wrapStrategy: 'CLIP',
                                verticalAlignment: 'TOP'
                            }
                        },
                        fields: 'userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment'
                    }
                },
                {
                    updateDimensionProperties: {
                        range: {
                            sheetId: theorySheetId,
                            dimension: 'ROWS',
                            startIndex: 1
                        },
                        properties: {
                            pixelSize: 21
                        },
                        fields: 'pixelSize'
                    }
                }
            ]
        }
    });
};

const normalizeTheorySubject = (value = '') => normalizeSheetText(value).toUpperCase();

const normalizeTheorySession = (value = '') => {
    const numeric = Number(value || 0);
    if (Number.isFinite(numeric) && numeric > 0) return String(Math.floor(numeric));
    return String(value || '').trim();
};

const extractPhaseFromTopic = (topic = '') => {
    const match = String(topic || '').match(/\[FASE ACTUAL:\s*([^\]]+)\]/i);
    return match?.[1]?.trim() || '';
};

const normalizeTheoryPhase = (value = '') => {
    const resolved = resolveQuestionBankPhase(value);
    if (resolved > 0) return String(resolved);

    const numeric = Number(value || 0);
    if (Number.isFinite(numeric) && numeric > 0) return String(Math.floor(numeric));

    return normalizeSheetText(value).toUpperCase();
};

const resolveTheoryLookup = ({
    subject = '',
    session = '',
    phase = '',
    topic = ''
} = {}) => {
    const normalizedSubject = normalizeTheorySubject(subject);
    const normalizedSession = normalizeTheorySession(session);
    const phaseCandidate = phase || extractPhaseFromTopic(topic);
    const normalizedPhase = normalizeTheoryPhase(phaseCandidate);

    return {
        subject: normalizedSubject,
        session: normalizedSession,
        phase: normalizedPhase
    };
};

const getTheoryLudicaRows = async (sheets) => {
    await ensureSheetHeaders(sheets, THEORY_LUDICA_SHEET, THEORY_LUDICA_HEADERS);
    await ensureTheorySheetFormatting(sheets);
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${THEORY_LUDICA_SHEET}!A:L`
    }).catch((error) => {
        if (error?.code === 400) return { data: { values: [] } };
        throw error;
    });

    const rows = response.data.values || [];
    if (!rows.length) return [];

    const [headers, ...dataRows] = rows;
    return dataRows.map((row, index) => ({
        rowNumber: index + 2,
        ...Object.fromEntries(headers.map((header, headerIndex) => [header, row[headerIndex] || '']))
    }));
};

const findTheoryLudicaByKey = async (sheets, { subject = '', session = '', phase = '', grade = '1medio' } = {}) => {
    const key = resolveTheoryLookup({ subject, session, phase });
    if (!key.subject || !key.session || !key.phase) return null;
    return findRuntimeTheoryLudicaByKey({ ...key, grade });
};

const listTheoryLudicaRowsForAdmin = async (sheets, {
    subject = '',
    session = '',
    phase = '',
    search = '',
    limit = 40
} = {}) => {
    return listRuntimeTheoryLudicaRowsForAdmin({ subject, session, phase, search, limit });
};

const appendTheoryLudicaToSheet = async (sheets, {
    subject = '',
    session = '',
    phase = '',
    topic = '',
    theoryMarkdown = '',
    source = 'ai_generated',
    supportImage = null,
    grade = '1medio'
} = {}) => {
    const key = resolveTheoryLookup({ subject, session, phase, topic });
    if (!key.subject || !key.session || !key.phase || !String(theoryMarkdown || '').trim()) return null;

    return appendRuntimeTheoryLudica({
        subject: key.subject,
        session: key.session,
        phase: key.phase,
        topic,
        theoryMarkdown,
        source,
        supportImage,
        grade
    });
};

const linkQuestionBankAsset = async (sheets, { questionId = '', assetId = '' } = {}) => {
    return linkRuntimeQuestionBankAsset({ questionId, assetId });
};

const updateQuestionVisualRole = async (sheets, { questionId = '', visualRole = '' } = {}) => {
    return updateRuntimeQuestionVisualRole({
        questionId,
        visualRole: normalizeQuestionVisualRole(visualRole || 'supporting')
    });
};

const linkTheoryLudicaAsset = async (sheets, { rowNumber = 0, assetId = '' } = {}) => {
    return linkRuntimeTheoryLudicaAsset({ rowNumber, assetId });
};

const parseExamAnalysisResponse = (rawText = '') => {
    const cleaned = String(rawText || '')
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

    try {
        return JSON.parse(cleaned);
    } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('No se pudo interpretar el JSON del analisis de prueba');
        return JSON.parse(match[0]);
    }
};

const normalizeExamDate = (value = '') => {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

    const clMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (clMatch) {
        const day = String(clMatch[1]).padStart(2, '0');
        const month = String(clMatch[2]).padStart(2, '0');
        return `${clMatch[3]}-${month}-${day}`;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
};

const boolToSheet = (value) => (value ? 'TRUE' : 'FALSE');

const parseSheetBool = (value = '') => normalizeSheetBool(value);

const getExamReminderRows = async (sheets) => {
    return listRuntimeExamReminders();
};

const appendExamReminderRow = async (sheets, record = {}) => {
    await upsertRuntimeExamReminder(record);
};

const updateExamReminderRow = async (sheets, rowNumber, patch = {}) => {
    const rows = await getExamReminderRows(sheets);
    const current = rows.find((row) => String(row.rowNumber) === String(rowNumber) || String(row.event_id) === String(rowNumber));
    if (!current) return null;

    const next = { ...current, ...patch };
    await upsertRuntimeExamReminder(next);
    return { ...next, rowNumber };
};

const findExamReminderById = async (sheets, eventId = '') => {
    return findRuntimeExamReminderById(eventId);
};

const daysUntilExam = (examDate = '', now = new Date()) => {
    const normalized = normalizeExamDate(examDate);
    if (!normalized) return null;

    const today = new Date(now);
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const [y, m, d] = normalized.split('-').map((item) => Number(item));
    const examUtc = Date.UTC(y, (m || 1) - 1, d || 1);
    return Math.floor((examUtc - todayUtc) / (24 * 60 * 60 * 1000));
};

const normalizeExamEventPreview = (parsed = {}) => {
    const confidenceRaw = Number(parsed?.confidence ?? parsed?.score_confianza ?? 0) || 0;
    const confidence = Math.max(0, Math.min(100, Math.round(confidenceRaw)));
    const examDate = normalizeExamDate(parsed?.exam_date || parsed?.fecha_prueba || '');
    const subject = normalizeSheetText(parsed?.subject || parsed?.materia || '').toUpperCase();
    const title = String(parsed?.title || parsed?.nombre_prueba || parsed?.descripcion || '').trim();
    const school = String(parsed?.school || parsed?.colegio || '').trim();
    const notes = String(parsed?.notes || parsed?.observaciones || '').trim();

    return {
        exam_date: examDate,
        subject,
        title,
        school,
        notes,
        confidence,
        needs_confirmation: confidence < 70 || !examDate || !subject
    };
};

const generateExamReminderPlanAndPractice = async ({
    studentName = 'Estudiante',
    subject = '',
    title = '',
    examDate = '',
    daysLeft = 0
} = {}) => {
    const fallback = `## Plan de estudio rapido\n- Revisa el temario principal de ${subject || 'la prueba'} en 20-30 minutos.\n- Haz 1 resumen con definiciones clave y 3 ejemplos.\n- Practica 3 ejercicios similares y corrige errores.\n\n## Mini practica\n1. Explica con tus palabras un concepto central de ${subject || 'la materia'}.\n2. Resuelve un ejercicio representativo y justifica cada paso.\n3. Identifica un error comun y como evitarlo.`;

    try {
        const completion = await openai.chat.completions.create({
            model: AI_MODELS.fast,
            messages: [
                {
                    role: 'system',
                    content: 'Eres tutor academico chileno para apoderados. Devuelve markdown breve con secciones "Plan de estudio rapido" y "Mini practica".'
                },
                {
                    role: 'user',
                    content: `Alumno: ${studentName}\nMateria: ${subject}\nEvaluacion: ${title}\nFecha prueba: ${examDate}\nDias restantes: ${daysLeft}\n\nGenera plan accionable y mini practica (max 3 preguntas).`
                }
            ],
            temperature: 0.4
        });

        return String(completion.choices?.[0]?.message?.content || '').trim() || fallback;
    } catch (error) {
        console.error('[EXAM_REMINDER] Error generando plan IA:', error.message);
        return fallback;
    }
};

const buildExamReminderEmailHtml = ({
    studentName = 'Estudiante',
    subject = '',
    title = '',
    examDate = '',
    daysLeft = 0,
    planMarkdown = ''
} = {}) => {
    const safePlan = escapeHtml(String(planMarkdown || '')).replace(/\n/g, '<br>');
    return `
        <div style="font-family: Arial, sans-serif; background:#f8fafc; padding:24px; color:#0f172a;">
            <h2 style="margin:0 0 12px 0;">Recordatorio de prueba</h2>
            <p style="margin:0 0 8px 0;"><strong>Alumno:</strong> ${escapeHtml(studentName)}</p>
            <p style="margin:0 0 8px 0;"><strong>Materia:</strong> ${escapeHtml(subject || 'No indicada')}</p>
            <p style="margin:0 0 8px 0;"><strong>Prueba:</strong> ${escapeHtml(title || 'Evaluacion')}</p>
            <p style="margin:0 0 16px 0;"><strong>Fecha:</strong> ${escapeHtml(examDate || '-')} (${escapeHtml(String(daysLeft))} dias)</p>
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:14px; line-height:1.6;">
                ${safePlan}
            </div>
        </div>
    `;
};

const MAX_EVIDENCE_ITEMS = 10;

const normalizeEvidencePayload = ({
    evidences = [],
    images_base64 = [],
    images_mime_types = [],
    image_base64 = '',
    image_mime_type = 'image/png',
    source_type = 'screenshot'
} = {}) => {
    const normalized = [];

    const pushEvidence = (imageBase64 = '', imageMimeType = 'image/png', itemSource = source_type, pageNumber = null) => {
        const trimmed = String(imageBase64 || '').trim();
        if (!trimmed) return;
        normalized.push({
            image_base64: trimmed,
            image_mime_type: String(imageMimeType || 'image/png').trim() || 'image/png',
            source_type: String(itemSource || source_type || 'screenshot').trim() || 'screenshot',
            page_number: Number(pageNumber || normalized.length + 1) || (normalized.length + 1)
        });
    };

    if (Array.isArray(evidences)) {
        evidences.forEach((item, index) => {
            if (!item || typeof item !== 'object') return;
            pushEvidence(
                item.image_base64 || item.imageBase64 || '',
                item.image_mime_type || item.imageMimeType || item.mime_type || image_mime_type,
                item.source_type || item.sourceType || source_type,
                item.page_number || item.pageNumber || (index + 1)
            );
        });
    }

    if (!normalized.length && Array.isArray(images_base64)) {
        images_base64.forEach((img, index) => {
            pushEvidence(
                img,
                images_mime_types?.[index] || image_mime_type,
                source_type,
                index + 1
            );
        });
    }

    if (!normalized.length && image_base64) {
        pushEvidence(image_base64, image_mime_type, source_type, 1);
    }

    return normalized.slice(0, MAX_EVIDENCE_ITEMS);
};

const analyzeExamEvidence = async ({
    evidences = []
} = {}) => {
    const normalized = normalizeEvidencePayload({ evidences }).slice(0, MAX_EVIDENCE_ITEMS);
    if (!normalized.length) throw new Error('No se recibio imagen para analizar');

    const prompt = `Analiza una captura/foto de calendario o app escolar y extrae datos de una evaluacion.

Responde SOLO en JSON valido:
{
  "exam_date": "YYYY-MM-DD",
  "subject": "MATERIA",
  "title": "nombre de la prueba",
  "school": "opcional",
  "notes": "contexto breve",
  "confidence": 0
}

Reglas:
- exam_date en formato ISO YYYY-MM-DD.
- confidence entero 0-100.
- Si no encuentras un dato, usa string vacio y baja confidence.`;

    let rawText = '';

    if (process.env.NVIDIA_API_KEY) {
        const nvidiaResponse = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'moonshotai/kimi-k2.5',
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        ...normalized.map((item) => ({
                            type: 'image_url',
                            image_url: { url: `data:${item.image_mime_type};base64,${item.image_base64}` }
                        }))
                    ]
                }],
                max_tokens: 1200,
                temperature: 0.1
            })
        });

        if (!nvidiaResponse.ok) {
            const errText = await nvidiaResponse.text();
            throw new Error(`NVIDIA API error: ${nvidiaResponse.status} - ${errText.substring(0, 160)}`);
        }

        const responseJson = await nvidiaResponse.json();
        rawText = responseJson.choices?.[0]?.message?.content || '';
    } else if (openaiVisionClient) {
        const openaiResponse = await openaiVisionClient.chat.completions.create({
            model: OPENAI_VISION_MODEL,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    ...normalized.map((item) => ({
                        type: 'image_url',
                        image_url: { url: `data:${item.image_mime_type};base64,${item.image_base64}` }
                    }))
                ]
            }],
            max_tokens: 1200,
            temperature: 0.1
        });
        rawText = openaiResponse.choices?.[0]?.message?.content || '';
    } else if (kimiVisionClient) {
        const kimiResponse = await kimiVisionClient.chat.completions.create({
            model: NOTEBOOK_VISION_MODEL,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    ...normalized.map((item) => ({
                        type: 'image_url',
                        image_url: { url: `data:${item.image_mime_type};base64,${item.image_base64}` }
                    }))
                ]
            }],
            max_tokens: 1200,
            temperature: 0.1
        });
        rawText = kimiResponse.choices?.[0]?.message?.content || '';
    } else {
        throw new Error('No hay proveedor visual configurado para analizar pruebas.');
    }

    const parsed = parseExamAnalysisResponse(rawText);
    return normalizeExamEventPreview(parsed);
};

const cleanupOracleNotebookDrafts = () => {
    const now = Date.now();
    for (const [draftId, draft] of oracleNotebookDrafts.entries()) {
        if (!draft?.createdAt || (now - draft.createdAt) > ORACLE_NOTEBOOK_DRAFT_TTL_MS) {
            oracleNotebookDrafts.delete(draftId);
        }
    }
};

const normalizeStringList = (items = [], maxItems = 10) => {
    return (Array.isArray(items) ? items : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, maxItems);
};

const normalizeOracleNotebookPreview = (parsed = {}, fallbackSubject = 'MATEMATICA', fallbackSession = 1) => {
    const confidenceRaw = Number(parsed?.confidence ?? parsed?.score_confianza ?? 0) || 0;
    const confidence = Math.max(0, Math.min(100, Math.round(confidenceRaw)));
    const subject = normalizeSheetText(parsed?.subject || parsed?.materia || fallbackSubject).toUpperCase() || 'MATEMATICA';
    const topic = String(parsed?.topic || parsed?.tema || parsed?.title || '').trim();
    const subtopics = normalizeStringList(parsed?.subtopics || parsed?.subtemas || [], 12);
    const keywords = normalizeStringList(parsed?.keywords || parsed?.palabras_clave || [], 15);
    const grade = String(parsed?.grade || parsed?.nivel || '1medio').trim() || '1medio';
    const sessionBase = Math.max(1, Number(parsed?.session_base || fallbackSession || 1) || 1);
    const notebookExcerpt = String(parsed?.notebook_excerpt || parsed?.extracto || '').trim();

    return {
        subject,
        topic,
        subtopics,
        keywords,
        grade,
        session_base: sessionBase,
        confidence,
        notebook_excerpt: notebookExcerpt,
        needs_confirmation: true
    };
};

const analyzeNotebookForOracle = async ({
    evidences = [],
    subjectHint = 'MATEMATICA',
    sessionHint = 1
} = {}) => {
    const normalized = normalizeEvidencePayload({ evidences }).slice(0, MAX_EVIDENCE_ITEMS);
    if (!normalized.length) throw new Error('No se recibio imagen para analizar');

    const prompt = `Analiza una foto/screenshot de un cuaderno escolar y extrae el contenido para crear una prueba.

Responde SOLO en JSON valido:
{
  "subject": "MATERIA",
  "topic": "tema principal",
  "subtopics": ["subtema 1", "subtema 2"],
  "keywords": ["palabra 1", "palabra 2"],
  "grade": "1medio",
  "session_base": 1,
  "notebook_excerpt": "extracto breve de lo que se ve",
  "confidence": 0
}

Reglas:
- subject en mayusculas.
- confidence entero 0-100.
- session_base numero >= 1.
- Si falta informacion, usa arreglos vacios o string vacio y baja confidence.
- Contexto sugerido: Materia ${subjectHint || 'MATEMATICA'}, Sesion ${sessionHint || 1}.`;

    let rawText = '';

    if (process.env.NVIDIA_API_KEY) {
        const nvidiaResponse = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'moonshotai/kimi-k2.5',
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        ...normalized.map((item) => ({
                            type: 'image_url',
                            image_url: { url: `data:${item.image_mime_type};base64,${item.image_base64}` }
                        }))
                    ]
                }],
                max_tokens: 1400,
                temperature: 0.1
            })
        });

        if (!nvidiaResponse.ok) {
            const errText = await nvidiaResponse.text();
            throw new Error(`NVIDIA API error: ${nvidiaResponse.status} - ${errText.substring(0, 160)}`);
        }

        const responseJson = await nvidiaResponse.json();
        rawText = responseJson.choices?.[0]?.message?.content || '';
    } else if (openaiVisionClient) {
        const openaiResponse = await openaiVisionClient.chat.completions.create({
            model: OPENAI_VISION_MODEL,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    ...normalized.map((item) => ({
                        type: 'image_url',
                        image_url: { url: `data:${item.image_mime_type};base64,${item.image_base64}` }
                    }))
                ]
            }],
            max_tokens: 1400,
            temperature: 0.1
        });
        rawText = openaiResponse.choices?.[0]?.message?.content || '';
    } else if (kimiVisionClient) {
        const kimiResponse = await kimiVisionClient.chat.completions.create({
            model: NOTEBOOK_VISION_MODEL,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    ...normalized.map((item) => ({
                        type: 'image_url',
                        image_url: { url: `data:${item.image_mime_type};base64,${item.image_base64}` }
                    }))
                ]
            }],
            max_tokens: 1400,
            temperature: 0.1
        });
        rawText = kimiResponse.choices?.[0]?.message?.content || '';
    } else {
        throw new Error('No hay proveedor visual configurado para analizar el cuaderno.');
    }

    const parsed = parseExamAnalysisResponse(rawText);
    const normalizedPreview = normalizeOracleNotebookPreview(parsed, subjectHint, sessionHint);
    normalizedPreview.evidence_count_used = normalized.length;
    return normalizedPreview;
};

const fetchWithTimeout = async (url, timeoutMs = 7000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
};

const fetchWikipediaEducationalContext = async (queries = []) => {
    const cleanedQueries = normalizeStringList(queries, 4);
    const snippets = [];

    for (const query of cleanedQueries) {
        try {
            const searchUrl = `https://es.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(query)}&limit=1`;
            const searchResponse = await fetchWithTimeout(searchUrl, 6500);
            if (!searchResponse.ok) continue;
            const searchJson = await searchResponse.json();
            const firstPage = searchJson?.pages?.[0];
            if (!firstPage?.key) continue;

            const summaryUrl = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstPage.key)}`;
            const summaryResponse = await fetchWithTimeout(summaryUrl, 6500);
            if (!summaryResponse.ok) continue;
            const summaryJson = await summaryResponse.json();
            const extract = String(summaryJson?.extract || '').trim();
            if (!extract) continue;

            snippets.push({
                title: String(summaryJson?.title || query),
                source_ref: String(summaryJson?.content_urls?.desktop?.page || ''),
                text: extract
            });
        } catch (error) {
            console.warn('[ORACLE_NOTEBOOK] Web context warn:', error.message);
        }
    }

    return snippets.slice(0, 3);
};

const normalizeOptionsObject = (options = {}) => {
    if (Array.isArray(options)) {
        const letters = ['A', 'B', 'C', 'D'];
        return options.slice(0, 4).reduce((acc, option, index) => {
            acc[letters[index]] = String(option || '').trim();
            return acc;
        }, {});
    }

    return ['A', 'B', 'C', 'D'].reduce((acc, letter) => {
        if (options?.[letter] !== undefined) acc[letter] = String(options[letter] || '').trim();
        return acc;
    }, {});
};

const inferCorrectLetter = (rawValue = '', options = {}) => {
    const raw = String(rawValue || '').trim();
    const explicit = raw.match(/\b([ABCD])\b/i);
    if (explicit?.[1] && options[explicit[1].toUpperCase()]) return explicit[1].toUpperCase();
    const matches = Object.entries(options).find(([, option]) => String(option || '').trim() === raw);
    if (matches?.[0]) return matches[0];
    return '';
};

const sanitizeOracleQuestions = (items = [], fallbackSession = 1, fallbackTopic = '') => {
    return (Array.isArray(items) ? items : [])
        .map((item) => {
            const options = normalizeOptionsObject(item?.options || {});
            const inferred = inferCorrectLetter(item?.correct_answer || '', options);
            const correct = inferred || String(item?.correct_answer || 'A').trim().toUpperCase().slice(0, 1);
            const sourceType = ['notebook', 'web', 'ai'].includes(String(item?.source_type || '').trim().toLowerCase())
                ? String(item?.source_type || '').trim().toLowerCase()
                : 'ai';

            return {
                question: String(item?.question || '').trim(),
                options,
                correct_answer: ['A', 'B', 'C', 'D'].includes(correct) ? correct : 'A',
                explanation: String(item?.explanation || '').trim(),
                source_type: sourceType,
                source_ref: String(item?.source_ref || '').trim(),
                source_session: Math.max(1, Number(item?.source_session || fallbackSession || 1) || 1),
                source_topic: String(item?.source_topic || fallbackTopic || '').trim()
            };
        })
        .filter((item) => item.question && Object.keys(item.options).length >= 2);
};

// Mapa de dificultad progresiva: el indice del batch define el tier.
// Cada tier sube la exigencia cognitiva (Bloom: recordar -> comprender -> aplicar -> analizar -> evaluar).
const ORACLE_DIFFICULTY_TIERS = [
    {
        label: 'INTRODUCTORIO',
        bloom: 'comprender/aplicar',
        description: 'Reconocer definiciones, identificar ejemplos simples, aplicar una regla directa. Evita trivialidades (si es 2+2, NO sirve).'
    },
    {
        label: 'INTERMEDIO',
        bloom: 'aplicar',
        description: 'Resolver en 2-3 pasos, comparar casos, usar formulas o reglas combinadas. El alumno debe calcular/razonar, no solo recordar.'
    },
    {
        label: 'DESAFIANTE',
        bloom: 'analizar',
        description: 'Problemas con distractores realistas, casos borde, elegir la mejor de varias opciones correctas, interpretar contexto.'
    },
    {
        label: 'AVANZADO',
        bloom: 'analizar/evaluar',
        description: 'Encadenar 3-4 pasos, justificar por descarte, reconocer errores tipicos. Mezcla conceptos del tema con subtemas.'
    },
    {
        label: 'EXPERTO',
        bloom: 'evaluar/crear',
        description: 'Problemas tipo PAES/PSU: enunciado largo, datos parcialmente relevantes, aplicacion en contexto real. Solo para estudiantes que ya dominan el tema.'
    }
];

const pickDifficultyTier = (batchIndex = 0) => {
    const idx = Math.max(0, Math.min(ORACLE_DIFFICULTY_TIERS.length - 1, Number(batchIndex) || 0));
    return ORACLE_DIFFICULTY_TIERS[idx];
};

const buildOracleNotebookQuestionPrompt = ({
    subject = 'MATEMATICA',
    topic = '',
    subtopics = [],
    keywords = [],
    grade = '1medio',
    questionCount = 15,
    notebookExcerpt = '',
    webContext = [],
    batchIndex = 0,
    batchSize = 0,
    totalBatches = 1,
    previousSignatures = []
} = {}) => {
    const webBlock = (webContext || [])
        .map((item, index) => `${index + 1}. ${item.title}\nResumen: ${item.text}\nFuente: ${item.source_ref || 'sin URL'}`)
        .join('\n\n');

    const tier = pickDifficultyTier(batchIndex);
    const askCount = Math.max(1, Number(batchSize || questionCount) || 3);
    const alreadyAsked = Array.isArray(previousSignatures) ? previousSignatures.filter(Boolean).slice(0, 40) : [];
    const alreadyAskedBlock = alreadyAsked.length
        ? alreadyAsked.map((sig, i) => `${i + 1}. ${String(sig).slice(0, 140)}`).join('\n')
        : 'Ninguna aun. Es la primera tanda.';

    const batchContext = totalBatches > 1
        ? `Esta es la TANDA ${batchIndex + 1} de ${totalBatches}. Genera exactamente ${askCount} preguntas NUEVAS (no repitas las anteriores).`
        : `Genera ${askCount} preguntas.`;

    return `Eres Matico, profesor chileno experto en disenar evaluaciones variadas y creativas.
Debes generar una prueba para estudiante de ${grade} basada en cuaderno escolar + apoyo web,
COMPLEMENTANDO el contenido porque el alumno puede no haber copiado toda la materia.

MATERIA: ${subject}
TEMA PRINCIPAL: ${topic}
SUBTEMAS: ${(subtopics || []).join(', ') || 'No especificados'}
PALABRAS CLAVE: ${(keywords || []).join(', ') || 'No especificadas'}
NIVEL DE DIFICULTAD DE ESTA TANDA: ${tier.label} (Bloom: ${tier.bloom})
INSTRUCCION DE DIFICULTAD: ${tier.description}

${batchContext}

EXTRACTO CUADERNO (puede estar incompleto):
${notebookExcerpt || 'Sin extracto visible'}

CONTEXTO WEB EDUCATIVO:
${webBlock || 'No disponible (usa cuaderno + tu conocimiento del curriculum chileno)'}

PREGUNTAS YA CREADAS (NO las repitas ni las reformules):
${alreadyAskedBlock}

REGLAS DE CREATIVIDAD Y NO-REPETICION (obligatorias):
1. Cada pregunta debe cubrir un subtema o angulo DISTINTO. Varia el tipo: definicion, calculo, aplicacion, comparacion, analisis de caso, interpretacion.
2. PROHIBIDO reformular una pregunta ya hecha cambiando solo numeros o nombres. Si ya se pregunto por "pendiente de una recta", en esta tanda cubre otro concepto (interseccion, paralelismo, ecuacion general, etc.).
3. COMPLEMENTA lo que el cuaderno no trae: si el cuaderno solo muestra 2 subtemas, sugiere preguntas sobre 2-3 subtemas vecinos del mismo curso (${grade}), pero dentro del tema principal "${topic}".
4. Cada pregunta debe tener 4 opciones plausibles. Ninguna opcion debe ser trivialmente absurda. Los distractores deben basarse en errores reales que cometen los alumnos.
5. Respeta el nivel de dificultad ${tier.label}: no bajes a nivel facilito, no subas a nivel universitario.
6. Escribe enunciados claros y con contexto cuando ayude (ej: "Ana compra 3 kilos de..."), no solo formulas sueltas.
7. La opcion correcta debe variar entre A, B, C y D a lo largo del conjunto (no siempre A).

Devuelve SOLO JSON valido con exactamente ${askCount} preguntas:
{
  "questions": [
    {
      "question": "enunciado claro y contextualizado",
      "options": { "A":"", "B":"", "C":"", "D":"" },
      "correct_answer": "A|B|C|D",
      "explanation": "explicacion breve de por que es correcta",
      "source_type": "notebook|web|ai",
      "source_ref": "url si usaste web, si no vacio",
      "source_session": 1,
      "source_topic": "subtema especifico que cubre esta pregunta"
    }
  ]
}

- No inventes URLs. Si no hay contexto web, deja source_ref vacio y source_type="notebook" o "ai".
- Responde UNICAMENTE el JSON, sin markdown ni texto extra.`;
};

const generateOraclePracticeGuide = async ({
    subject = '',
    topic = '',
    subtopics = [],
    questionCount = 15,
    grade = '1medio'
} = {}) => {
    const fallback = `## Practica guiada\n1. Resume el tema "${topic || subject}" en 5 lineas.\n2. Escribe 3 conceptos clave y un ejemplo por cada uno.\n3. Resuelve 3 ejercicios tipo prueba y revisa tus errores.\n\n## Cierre rapido\n- Repite los subtemas: ${(subtopics || []).slice(0, 4).join(', ') || 'tema principal'}.\n- Tiempo sugerido: 30-40 minutos para ${questionCount} preguntas (${grade}).`;

    try {
        const completion = await openai.chat.completions.create({
            model: AI_MODELS.fast,
            messages: [
                {
                    role: 'system',
                    content: 'Eres tutor academico chileno. Responde solo markdown breve con secciones "Practica guiada" y "Errores comunes".'
                },
                {
                    role: 'user',
                    content: `Materia: ${subject}\nTema: ${topic}\nSubtemas: ${(subtopics || []).join(', ')}\nNivel: ${grade}\nPreguntas: ${questionCount}\n\nGenera una practica guiada breve para preparar esta prueba.`
                }
            ],
            temperature: 0.4
        });

        return String(completion.choices?.[0]?.message?.content || '').trim() || fallback;
    } catch (error) {
        console.error('[ORACLE_NOTEBOOK] Error practica guiada:', error.message);
        return fallback;
    }
};

const generateOracleExamFromNotebook = async ({
    subject = 'MATEMATICA',
    topic = '',
    subtopics = [],
    keywords = [],
    grade = '1medio',
    questionCount = 15,
    notebookExcerpt = '',
    sessionBase = 1,
    webContext = [],
    batchIndex = 0,
    batchSize = 0,
    totalBatches = 1,
    previousSignatures = []
} = {}) => {
    const effectiveBatchSize = Math.max(1, Number(batchSize || questionCount) || 3);
    const prompt = buildOracleNotebookQuestionPrompt({
        subject,
        topic,
        subtopics,
        keywords,
        grade,
        questionCount,
        notebookExcerpt,
        webContext,
        batchIndex,
        batchSize: effectiveBatchSize,
        totalBatches,
        previousSignatures
    });

    // Temperatura sube por tanda para mas creatividad/variedad en las tandas finales.
    const temperature = Math.min(0.95, 0.5 + Math.max(0, Number(batchIndex) || 0) * 0.1);

    const completion = await openai.chat.completions.create({
        model: AI_MODELS.fast,
        messages: [
            {
                role: 'system',
                content: 'Eres Matico, creador de evaluaciones escolares creativas y variadas. Responde unicamente JSON valido. Nunca repitas ni reformules preguntas ya creadas.'
            },
            { role: 'user', content: prompt }
        ],
        temperature
    });

    const raw = String(completion.choices?.[0]?.message?.content || '').trim();
    const parsed = parseExamAnalysisResponse(raw);
    const rawQuestions = sanitizeOracleQuestions(parsed?.questions || [], sessionBase, topic);
    if (!rawQuestions.length) throw new Error('La IA no devolvio preguntas validas desde el cuaderno');

    // Deduplica contra previousSignatures y contra si mismas
    const seen = new Set(Array.isArray(previousSignatures) ? previousSignatures.filter(Boolean) : []);
    const deduped = [];
    for (const q of rawQuestions) {
        const sig = normalizeQuestionSignature(q.question, q.options);
        if (!sig || seen.has(sig)) continue;
        seen.add(sig);
        deduped.push(q);
    }

    const finalList = deduped.length ? deduped : rawQuestions;
    return finalList.slice(0, effectiveBatchSize);
};

const autoAppendMissingSessionCompleted = async (sheets, rows = [], userId = '', subject = '', grade = '1medio') => {
    const normalizedSubject = String(subject || '').trim().toUpperCase();
    if (!userId || !normalizedSubject) return [];

    const subjectRows = (rows || []).filter((row) => row[1] === userId && String(row[2] || '').trim().toUpperCase() === normalizedSubject);
    const completedSessions = new Set(
        subjectRows
            .filter((row) => row[4] === 'session_completed')
            .map((row) => parseInt(row[3]) || 0)
            .filter(Boolean)
    );

    const phaseMap = new Map();
    subjectRows
        .filter((row) => row[4] === 'phase_completed')
        .forEach((row) => {
            const sessionNum = parseInt(row[3]) || 0;
            const phase = parseInt(row[5]) || 0;
            if (!sessionNum || !phase) return;
            if (!phaseMap.has(sessionNum)) {
                phaseMap.set(sessionNum, new Set());
            }
            phaseMap.get(sessionNum).add(phase);
        });

    const appendedSessions = [];
    for (const [sessionNum, phases] of phaseMap.entries()) {
        if (completedSessions.has(sessionNum)) continue;
        if (!(phases.has(1) && phases.has(2) && phases.has(3))) continue;

        await appendProgressToSheetOrThrow(sheets, {
            user_id: userId,
            subject: normalizedSubject,
            session: sessionNum,
            event_type: 'session_completed',
            xp: 300,
            grade,
            sourceMode: 'autofix_phases'
        });

        completedSessions.add(sessionNum);
        appendedSessions.push(sessionNum);
    }

    if (appendedSessions.length > 0) {
        console.log('[SESSION_AUTOFIX_OK]', JSON.stringify({ user_id: userId, subject: normalizedSubject, sessions: appendedSessions }));
    }

    return appendedSessions;
};
const appendAdaptiveSnapshotToSheetOrThrow = async (sheets, {
    user_id = '',
    grade = '',
    subject = '',
    session = '',
    topic = '',
    event_type = '',
    mastery = '',
    totalAttempts = '',
    totalCorrect = '',
    totalQuestions = '',
    nextAction = '',
    weakSessions = [],
    strongSessions = [],
    sourceMode = ''
}) => {
    const timestamp = new Date().toISOString();

    try {
        await insertRuntimeAdaptiveSnapshot({
            user_id,
            grade,
            subject,
            session,
            topic,
            event_type,
            mastery,
            totalAttempts,
            totalCorrect,
            totalQuestions,
            nextAction,
            weakSessions,
            strongSessions,
            sourceMode
        });
        console.log("[SUPABASE_ADAPTIVE_APPEND_OK]", JSON.stringify({
            timestamp,
            user_id,
            grade,
            subject,
            session,
            topic,
            event_type,
            mastery,
            totalAttempts,
            totalCorrect,
            totalQuestions,
            sourceMode
        }));
    } catch (err) {
        console.error("[SUPABASE_ADAPTIVE_APPEND_FAIL]", JSON.stringify({
            timestamp,
            user_id,
            grade,
            subject,
            session,
            topic,
            event_type,
            mastery,
            totalAttempts,
            totalCorrect,
            totalQuestions,
            sourceMode,
            error: err.message
        }));
        throw err;
    }
};

const parseStructuredField = (value, fallback = []) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return fallback;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
};

const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeWrongAnswerDetails = (wrongAnswers = [], wrongQuestionDetails = []) => {
    const normalizedFromAnswers = Array.isArray(wrongAnswers)
        ? wrongAnswers.map((item, index) => ({
            index: index + 1,
            question: item?.question || '',
            user_answer: item?.user_answer || item?.selected_option || '',
            correct_answer: item?.correct_answer || item?.correct_option || '',
            source_session: item?.source_session ?? item?.session ?? '',
            source_topic: item?.source_topic || item?.topic || ''
        }))
        : [];

    if (normalizedFromAnswers.length > 0) return normalizedFromAnswers;

    return parseStructuredField(wrongQuestionDetails, []).map((item, index) => ({
        index: item?.index || index + 1,
        question: item?.question || '',
        user_answer: item?.user_answer || item?.selected_option || '',
        correct_answer: item?.correct_answer || item?.correct_option || '',
        source_session: item?.source_session ?? item?.session ?? '',
        source_topic: item?.source_topic || item?.topic || ''
    }));
};

// --- HELPER: Generar HTML bonito para correos ---
const buildSessionReportHTML = (nombre, subject, session, topic, stats, wrongAnswers = [], aiAnalysis = '', reportSummary = {}) => {
    const successRate = Math.round((stats.correct / 45) * 100);
    const emoji = successRate >= 80 ? 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ' : (successRate >= 60 ? 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¹Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â' : 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âª');
    const color = successRate >= 80 ? '#22c55e' : (successRate >= 60 ? '#eab308' : '#ef4444');
    const wrongCount = wrongAnswers.length;
    const weakness = reportSummary.weakness || '';
    const improvementPlan = reportSummary.improvementPlan || '';

    // Helper: Convertir LaTeX a texto legible para emails
    const cleanLatex = (text) => {
        if (!text) return '';
        return text
            .replace(/\$([^$]+)\$/g, '$1')           // Quitar delimitadores $...$
            .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')  // \frac{a}{b} ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ a/b
            .replace(/\\left\(/g, '(')                // \left( ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ (
            .replace(/\\right\)/g, ')')               // \right) ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ )
            .replace(/\\left\[/g, '[')
            .replace(/\\right\]/g, ']')
            .replace(/\\times/g, 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â')                 // \times ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â
            .replace(/\\div/g, 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·')                   // \div ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·
            .replace(/\\cdot/g, 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·')                  // \cdot ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·
            .replace(/\\pm/g, 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±')                    // \pm ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±
            .replace(/\\sqrt\{([^}]+)\}/g, 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡($1)')   // \sqrt{x} ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡(x)
            .replace(/\^(\{[^}]+\})/g, (_, exp) => {  // ^{2} ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â²
                const superscripts = { '0': 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°', '1': 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹', '2': 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â²', '3': 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³', '4': 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â´', '5': 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âµ', '6': 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¶', '7': 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·', '8': 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸', '9': 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹', 'n': 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¿' };
                const inner = exp.replace(/[{}]/g, '');
                return inner.split('').map(c => superscripts[c] || `^${c}`).join('');
            })
            .replace(/\^(\d)/g, (_, d) => {           // ^2 ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â²
                const sup = { '0': 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°', '1': 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹', '2': 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â²', '3': 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³', '4': 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â´', '5': 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âµ', '6': 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¶', '7': 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·', '8': 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸', '9': 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹' };
                return sup[d] || `^${d}`;
            })
            .replace(/_(\{[^}]+\})/g, (_, sub) => sub.replace(/[{}]/g, ''))  // _{n} ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ n
            .replace(/_(\d)/g, '$1')                   // _1 ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ 1
            .replace(/\\text\{([^}]+)\}/g, '$1')       // \text{...} ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ ...
            .replace(/\\\\/g, '')                      // Backslashes sueltos
            .replace(/\s+/g, ' ')                      // Espacios mÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºltiples
            .trim();
    };

    // Generar tabla de errores
    let errorsHTML = '';
    if (wrongCount > 0) {
        const errorRows = wrongAnswers.map((w, i) => {
            const cleanQ = cleanLatex(w.question || '');
            const shortQ = cleanQ.substring(0, 80) + (cleanQ.length > 80 ? '...' : '');
            return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px; font-size: 13px; color: #475569; vertical-align: top; word-break: break-word;">${i + 1}. ${escapeHtml(shortQ)}</td>
                <td style="padding: 10px; text-align: center; color: #ef4444; font-weight: bold;">${escapeHtml(w.user_answer)}</td>
                <td style="padding: 10px; text-align: center; color: #22c55e; font-weight: bold;">${escapeHtml(w.correct_answer)}</td>
            </tr>`;
        }).join('');

        errorsHTML = `
            <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #fecaca; margin: 16px 0;">
                <h3 style="margin-top: 0; color: #dc2626;">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ Preguntas Incorrectas (${wrongCount})</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #fef2f2;">
                            <th style="padding: 8px; text-align: left;">Pregunta</th>
                            <th style="padding: 8px; text-align: center;">Tu Resp.</th>
                            <th style="padding: 8px; text-align: center;">Correcta</th>
                        </tr>
                    </thead>
                    <tbody>${errorRows}</tbody>
                </table>
                ${wrongCount > 10 ? `<p style="color: #94a3b8; font-size: 12px; margin-top: 8px;">... y ${wrongCount - 10} mÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡s</p>` : ''}
            </div>`;
    }

    // SecciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n de anÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lisis IA
    let analysisHTML = '';
    if (aiAnalysis) {
        analysisHTML = `
            <div style="background: linear-gradient(135deg, #eff6ff, #f0fdf4); border-radius: 12px; padding: 20px; border: 2px solid #6366f1; margin: 16px 0;">
                <h3 style="margin-top: 0; color: #4f46e5;">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â  AnÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lisis Inteligente de Matico</h3>
                <div style="color: #334155; font-size: 14px; line-height: 1.7;">
                    ${aiAnalysis}
                </div>
            </div>`;
    }

    const pedagogicalSummaryHTML = (weakness || improvementPlan) ? `
            <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #dbeafe; margin: 16px 0;">
                <h3 style="margin-top: 0; color: #1d4ed8;">Foco pedagogico</h3>
                <p style="margin: 8px 0; color: #334155;"><strong>Debilidad detectada:</strong> ${escapeHtml(weakness || 'Sin focos criticos detectados en esta sesion.')}</p>
                <p style="margin: 8px 0; color: #334155;"><strong>Que mejorar:</strong> ${escapeHtml(improvementPlan || `Mantener practica constante en lotes de ${QUIZ_BATCH_SIZE} preguntas.`)}</p>
            </div>` : '';

    return `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¶ Reporte Matico</h1>
            <p style="margin: 8px 0 0; opacity: 0.9;">SesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n de Estudio Completada</p>
        </div>
        <div style="padding: 30px;">
            <h2 style="color: #1e293b;">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡Hola! AquÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ estÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ el reporte de <strong>${nombre}</strong></h2>
            <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; margin: 16px 0;">
                <p><strong>ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ Asignatura:</strong> ${subject}</p>
                <p><strong>ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ SesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n ${session}:</strong> ${topic}</p>
                <p><strong>ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ Fecha:</strong> ${new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div style="text-align: center; margin: 24px 0;">
                <div style="display: inline-block; background: ${color}; color: white; border-radius: 50%; width: 100px; height: 100px; line-height: 100px; font-size: 32px; font-weight: bold;">
                    ${successRate}%
                </div>
                <p style="font-size: 20px; margin-top: 12px;">${emoji} ${stats.correct} de 45 correctas</p>
            </div>
            <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0;">
                <h3 style="margin-top: 0;">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â  Desglose por Nivel</h3>
                <p>ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ <strong>BÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡sico (15 preguntas):</strong> Completado</p>
                <p>ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ <strong>Avanzado (15 preguntas):</strong> Completado</p>
                <p>ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â´ <strong>CrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­tico (15 preguntas):</strong> Completado</p>
            </div>
            ${pedagogicalSummaryHTML}
            ${errorsHTML}
            ${analysisHTML}
            <p style="color: #64748b; font-size: 13px; text-align: center; margin-top: 24px;">
                Este correo fue enviado automÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ticamente por Matico ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¶
            </p>
        </div>
    </div>`;
};

const buildDailyReminderHTML = (nombre, session, topic, subject) => {
    return `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #f59e0b, #f97316); padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡Buenos DÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­as!</h1>
            <p style="margin: 8px 0 0; opacity: 0.9;">Tu sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n de hoy te espera</p>
        </div>
        <div style="padding: 30px;">
            <h2 style="color: #1e293b;">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡Hola <strong>${nombre}</strong>! ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¹Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹</h2>
            <p style="color: #475569; font-size: 16px;">Hoy es un gran dÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a para aprender. Tu sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n de estudio ya estÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ lista:</p>
            <div style="background: white; border-radius: 12px; padding: 24px; border: 2px solid #6366f1; margin: 20px 0; text-align: center;">
                <p style="font-size: 14px; color: #6366f1; font-weight: bold; margin: 0;">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ ${subject}</p>
                <h3 style="font-size: 22px; color: #1e293b; margin: 8px 0;">SesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n ${session}: ${topic}</h3>
                <p style="color: #64748b;">45 preguntas en 3 niveles: BÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡sico ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ Avanzado ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ CrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­tico</p>
            </div>
            <p style="color: #475569;">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡Recuerda que cada sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n completada te acerca mÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡s a tu meta! ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â </p>
            <p style="color: #64748b; font-size: 13px; text-align: center; margin-top: 24px;">
                Matico ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¶ ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Tu compaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±ero de estudio
            </p>
        </div>
    </div>`;
};

const buildSessionReportHTMLClean = (nombre, subject, session, topic, stats, wrongAnswers = [], aiAnalysis = '', reportSummary = {}) => {
    const successRate = Math.round((stats.correct / 45) * 100);
    const emoji = successRate >= 80 ? '[Excelente]' : (successRate >= 60 ? '[Bien]' : '[Atencion]');
    const color = successRate >= 80 ? '#22c55e' : (successRate >= 60 ? '#eab308' : '#ef4444');
    const wrongCount = wrongAnswers.length;
    const weakness = reportSummary.weakness || '';
    const improvementPlan = reportSummary.improvementPlan || '';
    const notebookSummary = reportSummary.notebookSummary || null;

    const cleanLatex = (text) => {
        if (!text) return '';
        return String(text)
            .replace(/\$([^$]+)\$/g, '$1')
            .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
            .replace(/\\left\(/g, '(')
            .replace(/\\right\)/g, ')')
            .replace(/\\left\[/g, '[')
            .replace(/\\right\]/g, ']')
            .replace(/\\times/g, 'x')
            .replace(/\\div/g, '/')
            .replace(/\\cdot/g, '*')
            .replace(/\\pm/g, '+/-')
            .replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)')
            .replace(/\^(\{[^}]+\})/g, (_, exp) => `^${exp.replace(/[{}]/g, '')}`)
            .replace(/\^(\d)/g, '^$1')
            .replace(/_(\{[^}]+\})/g, (_, sub) => sub.replace(/[{}]/g, ''))
            .replace(/_(\d)/g, '$1')
            .replace(/\\text\{([^}]+)\}/g, '$1')
            .replace(/\\\\/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    };

    let errorsHTML = '';
    if (wrongCount > 0) {
        const errorRows = wrongAnswers.map((w, i) => {
            const cleanQ = cleanLatex(w.question || '');
            const shortQ = cleanQ.substring(0, 80) + (cleanQ.length > 80 ? '...' : '');
            return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px; font-size: 13px; color: #475569; vertical-align: top; word-break: break-word;">${i + 1}. ${escapeHtml(shortQ)}</td>
                <td style="padding: 10px; text-align: center; color: #ef4444; font-weight: bold;">${escapeHtml(w.user_answer)}</td>
                <td style="padding: 10px; text-align: center; color: #22c55e; font-weight: bold;">${escapeHtml(w.correct_answer)}</td>
            </tr>`;
        }).join('');

        errorsHTML = `
            <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #fecaca; margin: 16px 0;">
                <h3 style="margin-top: 0; color: #dc2626;">Preguntas incorrectas (${wrongCount})</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #fef2f2;">
                            <th style="padding: 8px; text-align: left;">Pregunta</th>
                            <th style="padding: 8px; text-align: center;">Tu resp.</th>
                            <th style="padding: 8px; text-align: center;">Correcta</th>
                        </tr>
                    </thead>
                    <tbody>${errorRows}</tbody>
                </table>
                ${wrongCount > 10 ? `<p style="color: #94a3b8; font-size: 12px; margin-top: 8px;">... y ${wrongCount - 10} mas</p>` : ''}
            </div>`;
    }

    let analysisHTML = '';
    if (aiAnalysis) {
        analysisHTML = `
            <div style="background: linear-gradient(135deg, #eff6ff, #f0fdf4); border-radius: 12px; padding: 20px; border: 2px solid #6366f1; margin: 16px 0;">
                <h3 style="margin-top: 0; color: #4f46e5;">Analisis inteligente de Matico</h3>
                <div style="color: #334155; font-size: 14px; line-height: 1.7;">
                    ${aiAnalysis}
                </div>
            </div>`;
    }

    const pedagogicalSummaryHTML = (weakness || improvementPlan) ? `
            <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #dbeafe; margin: 16px 0;">
                <h3 style="margin-top: 0; color: #1d4ed8;">Foco pedagogico</h3>
                <p style="margin: 8px 0; color: #334155;"><strong>Debilidad detectada:</strong> ${escapeHtml(weakness || 'Sin focos criticos detectados en esta sesion.')}</p>
                <p style="margin: 8px 0; color: #334155;"><strong>Que mejorar:</strong> ${escapeHtml(improvementPlan || `Mantener practica constante en lotes de ${QUIZ_BATCH_SIZE} preguntas.`)}</p>
            </div>` : '';

    const notebookHTML = notebookSummary ? `
            <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #fde68a; margin: 16px 0;">
                <h3 style="margin-top: 0; color: #b45309;">Revision de cuaderno con Profe Matico</h3>
                <p style="margin: 8px 0; color: #334155;"><strong>Resultado:</strong> ${notebookSummary.quizReady ? 'Paso directo al quiz' : 'Necesita reforzar antes del quiz'}</p>
                <p style="margin: 8px 0; color: #334155;"><strong>Interpretacion:</strong> ${escapeHtml(String(notebookSummary.interpretationScore || 0))}%</p>
                <p style="margin: 8px 0; color: #334155;"><strong>Paginas revisadas:</strong> ${escapeHtml(String(notebookSummary.pageCount || 1))}</p>
                <p style="margin: 8px 0; color: #334155;"><strong>Retroalimentacion:</strong> ${escapeHtml(notebookSummary.feedback || 'Sin retroalimentacion registrada.')}</p>
                <p style="margin: 8px 0; color: #334155;"><strong>Siguiente paso:</strong> ${escapeHtml(notebookSummary.suggestion || 'Continuar con la siguiente actividad.')}</p>
                ${notebookSummary.detectedConcepts?.length ? `<p style="margin: 8px 0; color: #334155;"><strong>Conceptos detectados:</strong> ${escapeHtml(notebookSummary.detectedConcepts.join(', '))}</p>` : ''}
                ${notebookSummary.missingConcepts?.length ? `<p style="margin: 8px 0; color: #334155;"><strong>Conceptos faltantes:</strong> ${escapeHtml(notebookSummary.missingConcepts.join(', '))}</p>` : ''}
            </div>` : '';

    return `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">Reporte Matico</h1>
            <p style="margin: 8px 0 0; opacity: 0.9;">Sesion de estudio completada</p>
        </div>
        <div style="padding: 30px;">
            <h2 style="color: #1e293b;">Hola. Aqui esta el reporte de <strong>${nombre}</strong></h2>
            <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; margin: 16px 0;">
                <p><strong>Asignatura:</strong> ${subject}</p>
                <p><strong>Sesion ${session}:</strong> ${topic}</p>
                <p><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div style="text-align: center; margin: 24px 0;">
                <div style="display: inline-block; background: ${color}; color: white; border-radius: 50%; width: 100px; height: 100px; line-height: 100px; font-size: 32px; font-weight: bold;">
                    ${successRate}%
                </div>
                <p style="font-size: 20px; margin-top: 12px;">${emoji} ${stats.correct} de 45 correctas</p>
            </div>
            <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0;">
                <h3 style="margin-top: 0;">Desglose por nivel</h3>
                <p><strong>Basico (15 preguntas):</strong> Completado</p>
                <p><strong>Avanzado (15 preguntas):</strong> Completado</p>
                <p><strong>Critico (15 preguntas):</strong> Completado</p>
            </div>
            ${pedagogicalSummaryHTML}
            ${notebookHTML}
            ${errorsHTML}
            ${analysisHTML}
            <p style="color: #64748b; font-size: 13px; text-align: center; margin-top: 24px;">
                Este correo fue enviado automaticamente por Matico
            </p>
        </div>
    </div>`;
};

const buildDailyReminderHTMLClean = (nombre, session, topic, subject) => {
    return `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #f59e0b, #f97316); padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">Buenos dÃ­as</h1>
            <p style="margin: 8px 0 0; opacity: 0.9;">Tu sesiÃ³n de hoy te espera</p>
        </div>
        <div style="padding: 30px;">
            <h2 style="color: #1e293b;">Hola <strong>${nombre}</strong></h2>
            <p style="color: #475569; font-size: 16px;">Hoy es un gran dÃ­a para aprender. Tu sesiÃ³n de estudio ya estÃ¡ lista:</p>
            <div style="background: white; border-radius: 12px; padding: 24px; border: 2px solid #6366f1; margin: 20px 0; text-align: center;">
                <p style="font-size: 14px; color: #6366f1; font-weight: bold; margin: 0;">${subject}</p>
                <h3 style="font-size: 22px; color: #1e293b; margin: 8px 0;">SesiÃ³n ${session}: ${topic}</h3>
                <p style="color: #64748b;">45 preguntas en 3 niveles: BÃ¡sico, Avanzado y CrÃ­tico</p>
            </div>
            <p style="color: #475569;">Recuerda que cada sesiÃ³n completada te acerca mÃ¡s a tu meta.</p>
            <p style="color: #64748b; font-size: 13px; text-align: center; margin-top: 24px;">
                Matico - Tu compaÃ±ero de estudio
            </p>
        </div>
    </div>`;
};
const getQuizPromptConfig = (subject, tema, options = {}) => {
    const { includeSourceMetadata = false, extraInstructions = '' } = options;
    const sourceFields = includeSourceMetadata ? `,
      "source_session": 12,
      "source_topic": "Tema de origen"` : '';
    const sourceRules = includeSourceMetadata ? `
5. Cada pregunta DEBE indicar en "source_session" la sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n exacta de origen.
6. Cada pregunta DEBE indicar en "source_topic" el tema exacto de origen.` : '';

    let systemMsg = '';
    let aiTemperature = 0.2;

    if (subject.includes('LENGUAJE') || subject.includes('LECTURA')) {
        aiTemperature = 0.5;
        systemMsg = `Eres Matico, profesor experto en Lenguaje y ComunicaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n del currÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­culum chileno.
El estudiante aprenderÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡: ${tema}.

PROTOCOLO OBLIGATORIO PARA CADA PREGUNTA:
1. Las preguntas deben evaluar comprensiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n lectora avanzada, pensamiento crÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­tico e inferencia.
2. Escribe una explicaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n clara del porquÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© esa es la opciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n correcta en "explanation".
3. CREA 4 opciones, asegurÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ndote que UNA coincide con tu explicaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n.
4. Al final, escribe la Letra correcta (A, B, C, D) en "correct_answer".${sourceRules}

ESTRUCTURA JSON EXACTA QUE DEBES USAR:
{
  "questions": [
    {
      "question": "texto de la pregunta de lectura o texto corto mÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡s la pregunta...",
      "explanation": "Explica aquÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ por quÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© la opciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n correcta es la adecuada basados en inferencia o pistas textuales.",
      "options": {
        "A": "texto",
        "B": "texto",
        "C": "texto",
        "D": "texto"
      },
      "correct_answer": "LETRA EXACTA DE TU EXPLICACION"${sourceFields}
    }
  ]
}

Genera SOLO JSON vÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lido sin markdown.`;
    } else if (subject.includes('HISTORIA')) {
        aiTemperature = 0.4;
        systemMsg = `Eres Matico, historiador y profesor experto en Historia y GeografÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a.
Tema a evaluar: ${tema}.

PROTOCOLO OBLIGATORIO PARA CADA PREGUNTA:
1. Las preguntas deben evaluar anÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lisis histÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³rico, comprensiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n de contextos y causas/consecuencias, no solo fechas memorizadas.
2. Escribe una breve explicaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n histÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³rica en "explanation" PRIMERO.
3. CREA 4 opciones.
4. Al final, escribe la Letra correcta en "correct_answer".${sourceRules}

ESTRUCTURA JSON EXACTA QUE DEBES USAR:
{
  "questions": [
    {
      "question": "contexto histÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³rico y la pregunta...",
      "explanation": "EXPLICA AQUI EL Contexto Y POR QUE LAS OTRAS SON INCORRECTAS",
      "options": {
        "A": "valor",
        "B": "valor",
        "C": "valor",
        "D": "valor"
      },
      "correct_answer": "LETRA EXACTA"${sourceFields}
    }
  ]
}

Genera SOLO JSON vÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lido sin markdown.`;
    } else {
        aiTemperature = 0.2;
        systemMsg = `Eres Matico, mentor acadÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©mico experto.
Tema: ${tema}.

PROTOCOLO OBLIGATORIO PARA CADA PREGUNTA:
1. DEBES hacer el desarrollo o razonamiento en "explanation" PRIMERO.
2. CREA 4 opciones, asegurÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ndote que UNA coincide con tu razonamiento.
3. Al final, escribe la Letra correcta en "correct_answer".${sourceRules}

ESTRUCTURA JSON EXACTA QUE DEBES USAR:
{
  "questions": [
    {
      "question": "texto de la pregunta...",
      "explanation": "ESCRIBE AQUI TODO TU DESARROLLO PASO A PASO PRIMERO.",
      "options": {
        "A": "valor",
        "B": "valor",
        "C": "valor",
        "D": "valor"
      },
      "correct_answer": "LETRA EXACTA"${sourceFields}
    }
  ]
}

Genera SOLO JSON vÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lido sin markdown.`;
    }

    return { systemMsg, aiTemperature };
};

const isReadingSubject = (subject = '') => {
    const normalized = String(subject || '').toUpperCase();
    return normalized.includes('LENGUAJE') || normalized.includes('LECTURA');
};

const isMathSubject = (subject = '') => {
    const normalized = String(subject || '').toUpperCase();
    return normalized.includes('MATEMATICA') || normalized.includes('MATEMÃƒÆ’Ã†â€™Ãƒâ€šÃ‚ÂTICA');
};

const isBiologySubject = (subject = '') => {
    const normalized = String(subject || '').toUpperCase();
    return normalized.includes('BIOLOGIA') || normalized.includes('BIOLOGÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂA');
};

const isChemistrySubject = (subject = '') => {
    const normalized = String(subject || '')
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    return normalized.includes('QUIMICA');
};

const isPhysicsSubject = (subject = '') => {
    const normalized = String(subject || '')
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    return normalized.includes('FISICA');
};

const buildTheoryUserPrompt = ({ topic = '', subject = '', session = 0, phase = '', grade = '1medio' } = {}) => {
    const segments = [`Tema solicitado: ${topic || 'Sin tema especificado'}`];
    const normalizedSubject = String(subject || '').toUpperCase();

    if (normalizedSubject) segments.push(`Asignatura: ${normalizedSubject}`);
    if (phase) segments.push(`Fase actual: ${phase}`);

    if (isReadingSubject(normalizedSubject)) {
        const moralejaContext = resolveMoralejaContext({
            topic,
            session,
            phase,
            mode: 'theory',
            grade
        });
        segments.push(`[BASE MORALEJA]\n${moralejaContext.theoryGuidance}`);
        segments.push('Cierra con una mini estrategia aplicable y un ejemplo breve de como resolver una pregunta tipo PAES.');
    } else if (isMathSubject(normalizedSubject)) {
        const moralejaMathContext = resolveMoralejaMatematicaContext({
            topic,
            session,
            phase,
            mode: 'theory',
            grade
        });
        segments.push(`[BASE MORALEJA MATEMATICA]\n${moralejaMathContext.theoryGuidance}`);
        segments.push('Cierra con un mini tip de procedimiento y un ejemplo breve estilo DEMRE/PAES.');
    } else if (isBiologySubject(normalizedSubject)) {
        const moralejaBiologiaContext = resolveMoralejaBiologiaContext({
            topic,
            session,
            phase,
            mode: 'theory',
            grade
        });
        segments.push(`[BASE MORALEJA BIOLOGIA]\n${moralejaBiologiaContext.theoryGuidance}`);
        segments.push('Cierra con una mini clave de analisis biologico y un ejemplo breve tipo DEMRE/PAES.');
    } else if (isChemistrySubject(normalizedSubject)) {
        const moralejaQuimicaContext = resolveMoralejaQuimicaContext({
            topic,
            session,
            phase,
            mode: 'theory',
            grade
        });
        segments.push(`[BASE MORALEJA QUIMICA]\n${moralejaQuimicaContext.theoryGuidance}`);
        segments.push('Cierra con una mini clave de resolucion quimica y un ejemplo breve tipo DEMRE/PAES.');
    } else if (isPhysicsSubject(normalizedSubject)) {
        const moralejaFisicaContext = resolveMoralejaFisicaContext({
            topic,
            session,
            phase,
            mode: 'theory',
            grade
        });
        segments.push(`[BASE MORALEJA FISICA]\n${moralejaFisicaContext.theoryGuidance}`);
        segments.push('Cierra con una mini clave de razonamiento fisico y un ejemplo breve tipo DEMRE/PAES.');
    }

    return segments.filter(Boolean).join('\n\n');
};

const buildReadingPromptContext = ({ topic = '', subject = '', session = 0, phase = '', batchIndex = 0, totalBatches = QUIZ_BATCHES_PER_PHASE, requestedCount = QUIZ_BATCH_SIZE, grade = '1medio' }) => {
    const moralejaContext = resolveMoralejaContext({
        topic,
        session,
        phase,
        mode: 'quiz',
        grade
    });

    return {
        moralejaContext,
        promptText: [
            `Tema: ${topic}`,
            `Asignatura: ${subject}`,
            `Fase: ${phase || 'BASICO'}`,
            `Sesion: ${session || 'sin sesion'}`,
            `Lote: ${batchIndex + 1}/${totalBatches}`,
            `Genera EXACTAMENTE ${requestedCount} preguntas.`,
            `[BASE MORALEJA]\n${moralejaContext.quizGuidance}`,
            'Devuelve SOLO JSON valido con la clave "questions".',
            'No devuelvas menos preguntas.',
            'No repitas preguntas.'
        ].join('\n')
    };
};

const buildMathPromptContext = ({ topic = '', subject = '', session = 0, phase = '', batchIndex = 0, totalBatches = QUIZ_BATCHES_PER_PHASE, requestedCount = QUIZ_BATCH_SIZE, grade = '1medio' }) => {
    const moralejaMathContext = resolveMoralejaMatematicaContext({
        topic,
        session,
        phase,
        mode: 'quiz',
        grade
    });

    return {
        moralejaMathContext,
        promptText: [
            `Tema: ${topic}`,
            `Asignatura: ${subject}`,
            `Fase: ${phase || 'BASICO'}`,
            `Sesion: ${session || 'sin sesion'}`,
            `Lote: ${batchIndex + 1}/${totalBatches}`,
            `Genera EXACTAMENTE ${requestedCount} preguntas.`,
            `[BASE MORALEJA MATEMATICA]\n${moralejaMathContext.quizGuidance}`,
            'Cada pregunta debe poder resolverse con procedimiento claro y consistente con el contenido escolar.',
            'Devuelve SOLO JSON valido con la clave "questions".',
            'No devuelvas menos preguntas.',
            'No repitas preguntas.'
        ].join('\n')
    };
};

const buildBiologyPromptContext = ({ topic = '', subject = '', session = 0, phase = '', batchIndex = 0, totalBatches = QUIZ_BATCHES_PER_PHASE, requestedCount = QUIZ_BATCH_SIZE, grade = '1medio' }) => {
    const moralejaBiologiaContext = resolveMoralejaBiologiaContext({
        topic,
        session,
        phase,
        mode: 'quiz',
        grade
    });

    return {
        moralejaBiologiaContext,
        promptText: [
            `Tema: ${topic}`,
            `Asignatura: ${subject}`,
            `Fase: ${phase || 'BASICO'}`,
            `Sesion: ${session || 'sin sesion'}`,
            `Lote: ${batchIndex + 1}/${totalBatches}`,
            `Genera EXACTAMENTE ${requestedCount} preguntas.`,
            `[BASE MORALEJA BIOLOGIA]\n${moralejaBiologiaContext.quizGuidance}`,
            'Favorece preguntas con analisis de relaciones biologicas, interpretacion de evidencias o lectura de tablas y graficos cuando aporte valor.',
            'Devuelve SOLO JSON valido con la clave "questions".',
            'No devuelvas menos preguntas.',
            'No repitas preguntas.'
        ].join('\n')
    };
};

const buildChemistryPromptContext = ({ topic = '', subject = '', session = 0, phase = '', batchIndex = 0, totalBatches = QUIZ_BATCHES_PER_PHASE, requestedCount = QUIZ_BATCH_SIZE, grade = '1medio' }) => {
    const moralejaQuimicaContext = resolveMoralejaQuimicaContext({
        topic,
        session,
        phase,
        mode: 'quiz',
        grade
    });

    return {
        moralejaQuimicaContext,
        promptText: [
            `Tema: ${topic}`,
            `Asignatura: ${subject}`,
            `Fase: ${phase || 'BASICO'}`,
            `Sesion: ${session || 'sin sesion'}`,
            `Lote: ${batchIndex + 1}/${totalBatches}`,
            `Genera EXACTAMENTE ${requestedCount} preguntas.`,
            `[BASE MORALEJA QUIMICA]\n${moralejaQuimicaContext.quizGuidance}`,
            'Favorece preguntas con balance correcto, relaciones cuantitativas claras y vocabulario escolar chileno consistente con PAES.',
            'Devuelve SOLO JSON valido con la clave "questions".',
            'No devuelvas menos preguntas.',
            'No repitas preguntas.'
        ].join('\n')
    };
};

const buildPhysicsPromptContext = ({ topic = '', subject = '', session = 0, phase = '', batchIndex = 0, totalBatches = QUIZ_BATCHES_PER_PHASE, requestedCount = QUIZ_BATCH_SIZE, grade = '1medio' }) => {
    const moralejaFisicaContext = resolveMoralejaFisicaContext({
        topic,
        session,
        phase,
        mode: 'quiz',
        grade
    });

    return {
        moralejaFisicaContext,
        promptText: [
            `Tema: ${topic}`,
            `Asignatura: ${subject}`,
            `Fase: ${phase || 'BASICO'}`,
            `Sesion: ${session || 'sin sesion'}`,
            `Lote: ${batchIndex + 1}/${totalBatches}`,
            `Genera EXACTAMENTE ${requestedCount} preguntas.`,
            `[BASE MORALEJA FISICA]\n${moralejaFisicaContext.quizGuidance}`,
            'Favorece preguntas con interpretacion fisica clara, uso correcto de magnitudes y distractores plausibles.',
            'Devuelve SOLO JSON valido con la clave "questions".',
            'No devuelvas menos preguntas.',
            'No repitas preguntas.'
        ].join('\n')
    };
};

const buildPrepExamAssignments = (sessionDetails = [], totalQuestions = 45) => {
    const normalized = sessionDetails
        .filter(item => item && item.session)
        .map(item => ({
            session: Number(item.session),
            topic: item.topic || `SesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n ${item.session}`
        }))
        .sort((a, b) => a.session - b.session);

    if (!normalized.length) return [];

    const assignments = [];
    for (let i = 0; i < totalQuestions; i++) {
        assignments.push(normalized[i % normalized.length]);
    }
    return assignments;
};

const normalizeQuestionSignature = (questionText = '', options = {}) => {
    const clean = (value = '') => String(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\\frac/g, 'frac')
        .replace(/\\sqrt/g, 'sqrt')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');

    const optionText = Object.values(options || {})
        .map(clean)
        .sort()
        .join(' | ');

    return `${clean(questionText)} || ${optionText}`;
};

const dedupePrepExamQuestions = (questions = []) => {
    const seen = new Set();
    const unique = [];

    for (const question of questions) {
        const signature = normalizeQuestionSignature(question.question, question.options);
        if (!signature || seen.has(signature)) continue;
        seen.add(signature);
        unique.push(question);
    }

    return { unique, seen };
};

const createRequestTimingTrace = (flowName, meta = {}) => {
    const startedAt = Date.now();
    let lastAt = startedAt;
    const steps = [];
    const requestId = `${flowName}-${startedAt}`;

    const mark = (step, extra = {}) => {
        const now = Date.now();
        const entry = {
            step,
            delta_ms: now - lastAt,
            elapsed_ms: now - startedAt,
            ...extra
        };

        steps.push(entry);
        lastAt = now;
        console.log(`[TIMING][${requestId}] ${step}: +${entry.delta_ms}ms (${entry.elapsed_ms}ms total)`);
        return entry;
    };

    const finish = (extra = {}) => {
        const finishedAt = Date.now();
        return {
            request_id: requestId,
            flow: flowName,
            started_at: new Date(startedAt).toISOString(),
            finished_at: new Date(finishedAt).toISOString(),
            total_ms: finishedAt - startedAt,
            steps,
            ...meta,
            ...extra
        };
    };

    return { mark, finish, requestId };
};

// ========================================================================
// ENDPOINTS
// ========================================================================

// Middleware condicional: loginLimiter SOLO en login/register para no bloquear acciones normales.
const conditionalLoginLimiter = (req, res, next) => {
    const action = (req.body && (req.body.action || req.body.accion)) || '';
    if (action === 'login' || action === 'register') {
        return loginLimiter(req, res, next);
    }
    return next();
};

app.post('/webhook/MATICO', conditionalLoginLimiter, async (req, res) => {
    const body = req.body;
    const currentAction = body.action || body.accion || '';
    const user_id = body.user_id;
    const data = body.data || {};
    // Grado del estudiante para todo el handler (default 1° medio retrocompatible)
    const requestGrade = String(body.grade || body.nivel || data.grade || data.nivel || '1medio').trim() || '1medio';

    console.log(`[MATICO] Accion: "${currentAction}" | Topic: ${body.tema || body.topic || '(sin tema)'} | Grade: ${requestGrade}`);

    // Auth: login/register son públicos, el resto requiere JWT
    const publicActions = ['login', 'register'];
    if (!publicActions.includes(currentAction)) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'Token requerido' });
        }
        try {
            req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'CAMBIA-ESTE-SECRET-EN-PRODUCCION');
        } catch (err) {
            return res.status(401).json({ success: false, error: 'Token inválido o expirado' });
        }
    }

    try {
        const sheets = await getSheetsClient();

        // 1. LOGIN / REGISTER
        if (currentAction === 'login' || currentAction === 'register') {
            const { email, password, name, phone, region, commune, correo_apoderado, grade } = body;
            const normalizedRegisterGrade = String(grade || '').trim().toLowerCase() === '2medio' ? '2medio' : '1medio';

            const user = await getRuntimeUserByEmail(email);

            if (currentAction === 'login') {
                const passOk = user ? await verifyPassword(password, user.pass || '') : false;
                if (user && passOk) {
                    const jwt = generateToken(user);
                    return res.json({
                        success: true,
                        user_id: user.token,
                        name: user.nombre || 'Estudiante',
                        role: user.role || 'estudiante',
                        parent_user_id: user.parent_user_id || null,
                        email: user.email || email,
                        grade: user.current_grade || '1medio',
                        current_grade: user.current_grade || '1medio',
                        jwt
                    });
                }
                return res.status(401).json({ success: false, message: "Credenciales invalidas" });
            }

            if (currentAction === 'register') {
                if (user) return res.status(400).json({ success: false, message: "El usuario ya existe" });
                const newToken = `TK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                const hashedPass = await hashPassword(password);
                await upsertRuntimeUser({
                    token: newToken,
                    pass: hashedPass,
                    mail: email,
                    nombre: name || 'Estudiante',
                    celular: phone || '',
                    region: region || '',
                    comuna: commune || '',
                    correo_apoderado: correo_apoderado || '',
                    current_grade: normalizedRegisterGrade
                });
                const newUser = { token: newToken, email, role: 'estudiante', nombre: name || 'Estudiante' };
                const jwt = generateToken(newUser);
                return res.json({
                    success: true,
                    user_id: newToken,
                    name: name || 'Estudiante',
                    grade: normalizedRegisterGrade,
                    current_grade: normalizedRegisterGrade,
                    jwt
                });
            }
        }

        // 2A. GENERAR TEORÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂA LÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡DICA
        if (currentAction === 'start_route' || currentAction.toLowerCase().includes('teoria') || currentAction.toLowerCase().includes('teor')) {
            const tema = body.tema || body.topic || 'Matematica General';
            const theorySubject = body.subject || body.sujeto || body.materia || data?.subject || '';
            const theorySession = body.session || data?.session || 0;
            const theoryPhase = body.phase || body.level || body.nivel || data?.level || extractPhaseFromTopic(tema);
            const theoryLookup = resolveTheoryLookup({
                subject: theorySubject,
                session: theorySession,
                phase: theoryPhase,
                topic: tema
            });

            if (theoryLookup.subject && theoryLookup.session && theoryLookup.phase) {
                try {
                    const storedTheory = await findTheoryLudicaByKey(sheets, { ...theoryLookup, grade: requestGrade });
                    if (storedTheory?.theory_markdown) {
                        return res.json({
                            output: storedTheory.theory_markdown,
                            theory_source: 'sheet',
                            grade: storedTheory.grade || requestGrade,
                            subject: theoryLookup.subject,
                            session: theoryLookup.session,
                            phase: theoryLookup.phase,
                            support_image_asset_id: String(storedTheory.support_image_asset_id || '').trim(),
                            support_image_url: String(storedTheory.support_image_url || '').trim(),
                            support_image_alt: String(storedTheory.support_image_alt || '').trim(),
                            support_image_caption: String(storedTheory.support_image_caption || '').trim()
                        });
                    }
                } catch (error) {
                    console.error('[THEORY] Error leyendo TheoryLudicaBank:', error.message);
                }
            }

            const gradeLabel = requestGrade === '2medio' ? '2do Medio' : '1ro Medio';
            const systemMsg = `Eres Matico, un mentor carismatico y experto en el curriculum chileno de ${gradeLabel}.
Responde SIEMPRE en Markdown legible y amigable para un estudiante joven.
Usa emojis frecuentemente para hacer la lectura divertida y motivadora.
Estructura tu respuesta con titulos (##), subtitulos (###), listas, **negritas** y ejemplos claros.
NUNCA respondas con JSON crudo. Solo texto enriquecido en Markdown.
Tu tono es cercano, motivador y lleno de energia, como un tutor favorito.`;

            const comp = await openai.chat.completions.create({
                model: AI_MODELS.fast,
                messages: [{
                    role: 'system',
                    content: systemMsg
                }, {
                    role: 'user',
                    content: buildTheoryUserPrompt({
                        topic: tema,
                        subject: theorySubject,
                        session: theorySession,
                        phase: theoryPhase,
                        grade: requestGrade
                    })
                }]
            });
            const generatedTheory = comp.choices[0].message.content;

            if (theoryLookup.subject && theoryLookup.session && theoryLookup.phase && generatedTheory) {
                try {
                    await appendTheoryLudicaToSheet(sheets, {
                        subject: theoryLookup.subject,
                        session: theoryLookup.session,
                        phase: theoryLookup.phase,
                        topic: tema,
                        theoryMarkdown: generatedTheory,
                        source: 'ai_generated',
                        grade: requestGrade
                    });
                } catch (error) {
                    console.error('[THEORY] Error guardando TheoryLudicaBank:', error.message);
                }
            }

            return res.json({
                output: generatedTheory,
                theory_source: 'ai_generated',
                subject: theoryLookup.subject || normalizeTheorySubject(theorySubject),
                session: theoryLookup.session || normalizeTheorySession(theorySession),
                phase: theoryLookup.phase || normalizeTheoryPhase(theoryPhase),
                support_image_asset_id: '',
                support_image_url: '',
                support_image_alt: '',
                support_image_caption: ''
            });
        }

        // 2B. GENERAR PRUEBA PREPARATORIA (45 preguntas en lotes de 5)
        if (currentAction === 'generate_prep_exam') {
            const subject = (body.subject || body.sujeto || 'MATEMATICA').toUpperCase();
            const sessions = Array.isArray(body.sessions) ? body.sessions.map(Number).filter(Boolean) : [];
            const topics = Array.isArray(body.topics) ? body.topics : [];
            const requestedCount = Number(body.question_count) || 45;
            const questionCount = Math.max(5, Math.min(45, requestedCount));
            const sessionDetails = sessions.map((session, index) => ({
                session,
                topic: topics[index] || `SesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n ${session}`
            }));

            if (!sessionDetails.length) {
                return res.status(400).json({ success: false, error: 'Debes enviar al menos una sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n para la prueba preparatoria' });
            }

            const assignmentPlan = buildPrepExamAssignments(sessionDetails, questionCount);
            const totalBatches = Math.ceil(assignmentPlan.length / 5);
            const baseTopic = `Prueba preparatoria acumulativa de ${subject} sobre estas sesiones:\n${sessionDetails.map(item => `- SesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n ${item.session}: ${item.topic}`).join('\n')}`;
            const { systemMsg, aiTemperature } = getQuizPromptConfig(subject, baseTopic, { includeSourceMetadata: true });

            const fetchPrepBatch = async (batchIndex, avoidSignatures = []) => {
                const batchAssignments = assignmentPlan.slice(batchIndex * 5, batchIndex * 5 + 5);
                const batchInstructions = batchAssignments.map((item, index) => `${index + 1}. SesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n ${item.session} | Tema: ${item.topic}`).join('\n');
                const batchPrompt = `${baseTopic}

[MODO PRUEBA PREPARATORIA DIAGNÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œSTICA]
- Genera EXACTAMENTE ${batchAssignments.length} preguntas.
- Esta es la tanda ${batchIndex + 1} de ${totalBatches}.
- Debes seguir ESTA distribuciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n exacta, una pregunta por lÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­nea:
${batchInstructions}
- Si una sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n se repite, crea preguntas distintas entre sÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­.
- NO repitas preguntas ya usadas ni reformules la misma idea con cambios menores.
- Evita duplicados exactos y tambiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©n preguntas casi iguales.
- Si te muestro ejemplos previos o patrones similares, crea una variante nueva.
- Preguntas previas a evitar: ${avoidSignatures.length > 0 ? avoidSignatures.slice(0, 10).join(' || ') : 'Ninguna'}
- "source_session" y "source_topic" deben coincidir EXACTAMENTE con cada lÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­nea asignada.
- MantÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©n alternativas A/B/C/D y explicaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºtil para correcciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n.
- Responde SOLO con JSON vÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lido.`;

                const comp = await openai.chat.completions.create({
                    model: AI_MODELS.fast,
                    messages: [
                        { role: 'system', content: systemMsg },
                        { role: 'user', content: batchPrompt }
                    ],
                    response_format: { type: 'json_object' },
                    temperature: aiTemperature
                });

                const parsed = JSON.parse(comp.choices[0].message.content);
                const questions = Array.isArray(parsed.questions) ? parsed.questions : [];

                return questions.map((question, index) => {
                    const assigned = batchAssignments[index] || batchAssignments[0];
                    return {
                        question: question.question,
                        options: question.options || {},
                        correct_answer: (question.correct_answer || 'A').toUpperCase(),
                        explanation: question.explanation || 'ExplicaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n no disponible.',
                        source_session: Number(question.source_session) || assigned.session,
                        source_topic: question.source_topic || assigned.topic
                    };
                }).filter(question => question.question);
            };

            const batchResults = [];
            let seenSignatures = [];

            for (let index = 0; index < totalBatches; index++) {
                const batchQuestions = await fetchPrepBatch(index, seenSignatures);
                const filteredBatch = [];

                for (const question of batchQuestions) {
                    const signature = normalizeQuestionSignature(question.question, question.options);
                    if (!signature || seenSignatures.includes(signature)) continue;
                    seenSignatures.push(signature);
                    filteredBatch.push(question);
                }

                batchResults.push(filteredBatch);
            }

            let questions = batchResults.flat().slice(0, questionCount);

            if (questions.length < questionCount) {
                console.log(`[PREP_EXAM] Detectados ${questionCount - questions.length} huecos tras deduplicar. Generando relleno...`);
                let refillIndex = 0;
                while (questions.length < questionCount && refillIndex < 4) {
                    const refillQuestions = await fetchPrepBatch(refillIndex, seenSignatures);
                    for (const question of refillQuestions) {
                        const signature = normalizeQuestionSignature(question.question, question.options);
                        if (!signature || seenSignatures.includes(signature)) continue;
                        seenSignatures.push(signature);
                        questions.push(question);
                        if (questions.length >= questionCount) break;
                    }
                    refillIndex += 1;
                }
            }

            if (questions.length < questionCount) {
                throw new Error(`No se lograron generar las ${questionCount} preguntas de la prueba preparatoria`);
            }

            await recordGeneratedQuestions(questions, {
                subject,
                source_action: 'generate_prep_exam',
                source_mode: 'prep_exam',
                grade: body.grade || '1medio',
                source_topic: sessionDetails.map(item => item.topic).join(' | '),
                metadata: {
                    sessions,
                    question_count: questionCount,
                    total_batches: totalBatches
                }
            }).catch((err) => console.error('[QUESTION_BANK] Error guardando prueba preparatoria completa:', err.message));

            return res.json({
                success: true,
                mode: 'diagnostic_review',
                subject,
                sessions,
                question_count: questionCount,
                questions
            });
        }

        if (currentAction === 'generate_prep_exam_batch') {
            const subject = (body.subject || body.sujeto || 'MATEMATICA').toUpperCase();
            const sessions = Array.isArray(body.sessions) ? body.sessions.map(Number).filter(Boolean) : [];
            const topics = Array.isArray(body.topics) ? body.topics : [];
            const batchIndex = Math.max(0, Number(body.batch_index) || 0);
            const batchSize = Math.max(1, Math.min(5, Number(body.batch_size) || 5));
            const totalBatches = Math.max(1, Number(body.total_batches) || 9);
            const timingTrace = createRequestTimingTrace('generate_prep_exam_batch', {
                subject,
                batch_index: batchIndex,
                batch_size: batchSize,
                total_batches: totalBatches
            });

            const sessionDetails = sessions.map((session, index) => ({
                session,
                topic: topics[index] || `SesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n ${session}`
            }));

            if (!sessionDetails.length) {
                return res.status(400).json({ success: false, error: 'Debes enviar al menos una sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n para la prueba preparatoria' });
            }

            const assignmentPlan = buildPrepExamAssignments(sessionDetails, totalBatches * batchSize);
            const batchAssignments = assignmentPlan.slice(batchIndex * batchSize, batchIndex * batchSize + batchSize);
            const baseTopic = `Prueba preparatoria acumulativa de ${subject} sobre estas sesiones:\n${sessionDetails.map(item => `- SesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n ${item.session}: ${item.topic}`).join('\n')}`;
            const { systemMsg, aiTemperature } = getQuizPromptConfig(subject, baseTopic, { includeSourceMetadata: true });
            const batchInstructions = batchAssignments.map((item, index) => `${index + 1}. SesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n ${item.session} | Tema: ${item.topic}`).join('\n');
            const batchPrompt = `${baseTopic}\n\n[MODO PRUEBA PREPARATORIA DIAGNÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“STICA]\n- Genera EXACTAMENTE ${batchAssignments.length} preguntas.\n- Esta es la tanda ${batchIndex + 1} de ${totalBatches}.\n- Debes seguir ESTA distribuciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n exacta, una pregunta por lÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­nea:\n${batchInstructions}\n- Si una sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n se repite, crea preguntas distintas entre sÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­.\n- NO repitas preguntas ya usadas ni reformules la misma idea con cambios menores.\n- Evita duplicados exactos y tambiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©n preguntas casi iguales.\n- \"source_session\" y \"source_topic\" deben coincidir EXACTAMENTE con cada lÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­nea asignada.\n- MantÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©n alternativas A/B/C/D y explicaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºtil para correcciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n.\n- Responde SOLO con JSON vÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lido.`;

            timingTrace.mark('prompt_ready', {
                session_count: sessionDetails.length,
                assigned_questions: batchAssignments.length
            });

            const comp = await openai.chat.completions.create({
                model: AI_MODELS.fast,
                messages: [
                    { role: 'system', content: systemMsg },
                    { role: 'user', content: batchPrompt }
                ],
                response_format: { type: 'json_object' },
                temperature: aiTemperature
            });
            timingTrace.mark('openai_completed', {
                model: AI_MODELS.fast
            });

            const parsed = JSON.parse(comp.choices[0].message.content);
            const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
            timingTrace.mark('response_parsed', {
                raw_questions: questions.length
            });

            const normalizedQuestions = questions.map((question, index) => {
                const assigned = batchAssignments[index] || batchAssignments[0];
                return {
                    question: question.question,
                    options: question.options || {},
                    correct_answer: (question.correct_answer || 'A').toUpperCase(),
                    explanation: question.explanation || 'ExplicaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n no disponible.',
                    source_session: Number(question.source_session) || assigned.session,
                    source_topic: question.source_topic || assigned.topic
                };
            }).filter(question => question.question);
            timingTrace.mark('questions_normalized', {
                question_count: normalizedQuestions.length
            });

            await recordGeneratedQuestions(normalizedQuestions, {
                subject,
                source_action: 'generate_prep_exam_batch',
                source_mode: 'prep_exam',
                grade: body.grade || '1medio',
                source_topic: sessionDetails.map(item => item.topic).join(' | '),
                metadata: {
                    batch_index: batchIndex,
                    batch_size: batchSize,
                    total_batches: totalBatches,
                    sessions
                }
            }).then(() => {
                timingTrace.mark('question_bank_saved', {
                    saved_count: normalizedQuestions.length
                });
            }).catch((err) => {
                console.error('[QUESTION_BANK] Error guardando batch de prueba preparatoria:', err.message);
                timingTrace.mark('question_bank_save_failed', {
                    error: err.message
                });
            });

            return res.json({
                success: true,
                mode: 'diagnostic_review',
                subject,
                sessions,
                batch_index: batchIndex,
                batch_size: batchSize,
                total_batches: totalBatches,
                questions: normalizedQuestions,
                timings: timingTrace.finish({
                    question_count: normalizedQuestions.length
                })
            });
        }
        // 2B. GENERAR QUIZ (5 preguntas por lote) ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â MULTIASIGNATURA
        if (currentAction.toLowerCase().includes('quiz') || currentAction.toLowerCase().includes('generar') || currentAction === 'generate_quiz') {
            const tema = body.tema || body.topic || 'Conocimiento General';
            const subject = (body.subject || body.sujeto || body.materia || data?.subject || 'MATEMATICA').toUpperCase();
            const requestedCount = Math.max(1, Math.min(QUIZ_BATCH_SIZE, Number(body.batch_size) || QUIZ_BATCH_SIZE));
            const sourceSession = Number(body.session || data.session || 0) || 0;
            const levelName = String(body.phase || body.level || body.nivel || data.level || '').trim().toUpperCase();
            const batchIndex = Math.max(0, Number(body.batch_index ?? body.batchIndex ?? 0) || 0);
            const totalBatches = Math.max(1, Number(body.total_batches) || QUIZ_BATCHES_PER_PHASE);
            const excludeSignatures = Array.isArray(body.exclude_signatures) ? body.exclude_signatures : [];
            const timingTrace = createRequestTimingTrace('generate_quiz', {
                subject,
                requested_count: requestedCount,
                source_session: sourceSession,
                level: levelName,
                batch_index: batchIndex
            });

            let systemMsg = "";
            let verifyPrompt = "";
            let aiTemperature = 0.2; // Por defecto baja para matemÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ticas

            if (subject.includes('LENGUAJE') || subject.includes('LECTURA')) {
                // PROMPT PARA LENGUAJE / COMPRENSIÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œN LECTORA
                aiTemperature = 0.5; // Un poco mÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡s creativo para redactar textos
                systemMsg = `Eres Matico, profesor experto en Lenguaje y ComunicaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n del currÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­culum chileno.
El estudiante aprenderÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡: ${tema}.

PROTOCOLO OBLIGATORIO PARA CADA PREGUNTA:
1. Las preguntas deben evaluar comprensiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n lectora avanzada, pensamiento crÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­tico e inferencia.
2. Escribe una explicaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n clara del porquÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© esa es la opciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n correcta en "explanation".
3. CREA 4 opciones, asegurÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ndote que UNA coincide con tu explicaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n.
4. Al final, escribe la Letra correcta (A, B, C, D) en "correct_answer".

ESTRUCTURA JSON EXACTA QUE DEBES USAR:
{
  "questions": [
    {
      "question": "texto de la pregunta de lectura o texto corto mÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡s la pregunta...",
      "explanation": "Explica aquÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ por quÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© la opciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n correcta es la adecuada basados en inferencia o pistas textuales.",
      "options": {
        "A": "texto",
        "B": "texto",
        "C": "texto",
        "D": "texto"
      },
      "correct_answer": "LETRA EXACTA DE TU EXPLICACION"
    }
  ]
}

Genera SOLO JSON vÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lido sin markdown.`;
                verifyPrompt = '';

            } else if (subject.includes('HISTORIA')) {
                // PROMPT PARA HISTORIA
                aiTemperature = 0.4;
                systemMsg = `Eres Matico, historiador y profesor experto en Historia y GeografÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­a.
Tema a evaluar: ${tema}.

PROTOCOLO OBLIGATORIO PARA CADA PREGUNTA:
1. Las preguntas deben evaluar anÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lisis histÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³rico, comprensiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n de contextos y causas/consecuencias, no solo fechas memorizadas.
2. Escribe una breve explicaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n histÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³rica en "explanation" PRIMERO.
3. CREA 4 opciones.
4. Al final, escribe la Letra correcta en "correct_answer".

ESTRUCTURA JSON EXACTA QUE DEBES USAR:
{
  "questions": [
    {
      "question": "contexto histÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³rico y la pregunta...",
      "explanation": "EXPLICA AQUI EL Contexto Y POR QUE LAS OTRAS SON INCORRECTAS",
      "options": {
        "A": "valor",
        "B": "valor",
        "C": "valor",
        "D": "valor"
      },
      "correct_answer": "LETRA EXACTA"
    }
  ]
}

Genera SOLO JSON vÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lido sin markdown.`;
                verifyPrompt = '';

            } else if (subject.includes('BIOLOGIA') || subject.includes('QUIMICA') || subject.includes('FISICA')) {
                aiTemperature = 0.3;
                systemMsg = `Eres Matico, profesor experto en ciencias del curriculum chileno de 1 medio.
Tema a evaluar: ${tema}.

PROTOCOLO OBLIGATORIO PARA CADA PREGUNTA:
1. Las preguntas deben evaluar comprension cientifica, razonamiento, vocabulario disciplinar y aplicacion conceptual.
2. Usa distractores plausibles y evita convertirlas en ejercicios matematicos puros si la asignatura no lo requiere.
3. CREA 4 opciones con texto real.
4. Al final, escribe la letra correcta en "correct_answer".

ESTRUCTURA JSON EXACTA QUE DEBES USAR:
{
  "questions": [
    {
      "question": "texto de la pregunta...",
      "explanation": "explicacion breve y clara",
      "options": {
        "A": "texto",
        "B": "texto",
        "C": "texto",
        "D": "texto"
      },
      "correct_answer": "LETRA EXACTA"
    }
  ]
}

Genera SOLO JSON valido sin markdown.`;
                verifyPrompt = '';

            } else {
                // PROMPT POR DEFECTO: MATEMÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂTICAS (Protocolo anti-errores original)
                aiTemperature = 0.2;
                systemMsg = `Eres Matico, mentor matemÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡tico experto.
Tema: ${tema}.

PROTOCOLO OBLIGATORIO PARA CADA PREGUNTA:
1. DEBES hacer el cÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lculo matemÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡tico en "explanation" PRIMERO.
2. CREA 4 opciones, asegurÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ndote que UNA coincide con tu cÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lculo.
3. Al final, escribe la Letra correcta en "correct_answer".

ESTRUCTURA JSON EXACTA QUE DEBES USAR:
{
  "questions": [
    {
      "question": "texto de la pregunta...",
      "explanation": "ESCRIBE AQUI TODO TU DESARROLLO PASO A PASO PRIMERO.",
      "options": {
        "A": "valor",
        "B": "valor",
        "C": "valor",
        "D": "valor"
      },
      "correct_answer": "LETRA EXACTA"
    }
  ]
}

Genera SOLO JSON vÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lido sin markdown.`;
                verifyPrompt = `Resuelve el problema matemÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡tico paso a paso. LUEGO, di cuÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡l letra (A, B, C o D) tiene la respuesta correcta.
Estructura JSON:
{"my_calculation": "tu desarrollo paso a paso aquÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ primero", "correct_letter": "LETRA FINAL"}`;
            }

            const readingPromptBundle = isReadingSubject(subject)
                ? buildReadingPromptContext({
                    topic: tema,
                    subject,
                    session: sourceSession,
                    phase: levelName,
                    batchIndex,
                    totalBatches,
                    requestedCount,
                    grade: requestGrade
                })
                : null;
            const mathPromptBundle = isMathSubject(subject)
                ? buildMathPromptContext({
                    topic: tema,
                    subject,
                    session: sourceSession,
                    phase: levelName,
                    batchIndex,
                    totalBatches,
                    requestedCount,
                    grade: requestGrade
                })
                : null;
            const biologyPromptBundle = isBiologySubject(subject)
                ? buildBiologyPromptContext({
                    topic: tema,
                    subject,
                    session: sourceSession,
                    phase: levelName,
                    batchIndex,
                    totalBatches,
                    requestedCount,
                    grade: requestGrade
                })
                : null;
            const chemistryPromptBundle = isChemistrySubject(subject)
                ? buildChemistryPromptContext({
                    topic: tema,
                    subject,
                    session: sourceSession,
                    phase: levelName,
                    batchIndex,
                    totalBatches,
                    requestedCount,
                    grade: requestGrade
                })
                : null;

            const seenSignatures = new Set(
                excludeSignatures
                    .map((item) => String(item || '').trim())
                    .filter(Boolean)
            );

            const useSpreadsheetQuestionBank = isMathSubject(subject) || isPhysicsSubject(subject) || isReadingSubject(subject);
            const bankSeed = useSpreadsheetQuestionBank
                ? await sampleQuestionBankQuestions(sheets, {
                    subject,
                    session: sourceSession,
                    levelName,
                    batchIndex,
                    requestedCount,
                    excludeSignatures: Array.from(seenSignatures)
                }).catch((err) => {
                    console.error('[QUESTION_BANK] Error leyendo QuestionBank:', err.message);
                    return [];
                })
                : await sampleGeneratedQuestions({
                    subject,
                    source_mode: 'quiz',
                    source_session: sourceSession,
                    source_topic: tema,
                    levelName,
                    batch_index: batchIndex,
                    limit: requestedCount,
                    exclude_signatures: Array.from(seenSignatures)
                }).catch((err) => {
                    console.error('[QUESTION_BANK] Error leyendo banco IA:', err.message);
                    return [];
                });
            timingTrace.mark('question_bank_seed_loaded', {
                seed_count: Array.isArray(bankSeed) ? bankSeed.length : 0,
                excluded_count: seenSignatures.size,
                source: useSpreadsheetQuestionBank ? 'supabase_question_bank' : 'local_json'
            });

            const normalizeOptionsObject = (options = {}) => {
                if (Array.isArray(options)) {
                    const letters = ['A', 'B', 'C', 'D'];
                    return options.slice(0, 4).reduce((acc, option, index) => {
                        acc[letters[index]] = String(option || '').trim();
                        return acc;
                    }, {});
                }
                return ['A', 'B', 'C', 'D'].reduce((acc, letter) => {
                    if (options?.[letter] !== undefined) {
                        acc[letter] = String(options[letter] || '').trim();
                    }
                    return acc;
                }, {});
            };

            const normalizeAnswerText = (value = '') => String(value || '')
                .replace(/<br\s*\/?>/gi, ' ')
                .replace(/&nbsp;/gi, ' ')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\$+/g, '')
                .toLowerCase()
                .replace(/\s+/g, '')
                .trim();

            const inferCorrectAnswerFromExplanation = (question = {}) => {
                const options = question.options || {};
                const explanation = String(question.explanation || '');
                const normalizedExplanation = normalizeAnswerText(explanation);
                if (!normalizedExplanation) return null;

                const explicitLetter = explanation.match(/(?:opcion|respuesta)\s+correcta\s+es\s+([A-D])/i);
                if (explicitLetter?.[1] && options[explicitLetter[1].toUpperCase()]) {
                    return explicitLetter[1].toUpperCase();
                }

                const matches = Object.entries(options)
                    .map(([key, value]) => ({ key, normalized: normalizeAnswerText(value) }))
                    .filter((item) => item.normalized && normalizedExplanation.includes(item.normalized));

                return matches.length === 1 ? matches[0].key : null;
            };

            const sanitizeQuestions = (items = []) => items.map((item) => {
                const normalizedQuestion = {
                    question: String(item.question || '').trim(),
                    options: normalizeOptionsObject(item.options || {}),
                    correct_answer: String(item.correct_answer || 'A').trim().toUpperCase().slice(0, 1) || 'A',
                    explanation: String(item.explanation || 'Explicacion no disponible.').trim(),
                    source_session: Number(item.source_session || sourceSession || 0) || 0,
                    source_topic: String(item.source_topic || tema).trim(),
                    source_mode: String(item.source_mode || '').trim(),
                    source_action: String(item.source_action || '').trim(),
                    slot: Number(item.slot || 0) || 0,
                    proposal_index: Number(item.proposal_index || 0) || 0,
                    prompt_image_asset_id: String(item.prompt_image_asset_id || '').trim(),
                    prompt_image_url: String(item.prompt_image_url || '').trim(),
                    prompt_image_alt: String(item.prompt_image_alt || '').trim(),
                    prompt_image_caption: String(item.prompt_image_caption || '').trim(),
                    question_visual_role: normalizeQuestionVisualRole(item.question_visual_role || '')
                };

                const inferredCorrectAnswer = inferCorrectAnswerFromExplanation(normalizedQuestion);
                if (inferredCorrectAnswer) {
                    normalizedQuestion.correct_answer = inferredCorrectAnswer;
                }

                return normalizedQuestion;
            }).filter((item) => {
                const optionValues = Object.values(item.options || {}).map((value) => String(value || '').trim());
                const placeholderCount = optionValues.filter((value) => ['A', 'B', 'C', 'D', 'AA', 'BB', 'CC', 'DD'].includes(value.toUpperCase())).length;
                return item.question && optionValues.length === 4 && placeholderCount < 3;
            });

            const dedupeQuestions = (items = []) => {
                const accepted = [];
                for (const item of items) {
                    const signature = normalizeQuestionSignature(item.question, item.options);
                    if (!signature || seenSignatures.has(signature)) continue;
                    seenSignatures.add(signature);
                    accepted.push(item);
                }
                return accepted;
            };

            const seededQuestions = dedupeQuestions(sanitizeQuestions(bankSeed));

            if (seededQuestions.length >= requestedCount) {
                const servedFromBank = seededQuestions
                    .slice(0, requestedCount)
                    .map((question, index) => ({
                        ...question,
                        source_session: Number(question.source_session || sourceSession || 0) || 0,
                        source_topic: String(question.source_topic || tema).trim(),
                        levelName: levelName || question.levelName || '',
                        batch_index: batchIndex,
                        question_index: index + 1,
                        source_mode: question.source_mode || (useSpreadsheetQuestionBank ? 'question_bank' : 'quiz'),
                        source_action: question.source_action || (useSpreadsheetQuestionBank ? 'supabase_question_bank' : 'generate_quiz')
                    }));

                timingTrace.mark('served_from_bank', {
                    question_count: servedFromBank.length
                });

                return res.json({
                    questions: servedFromBank,
                    timings: timingTrace.finish({
                        question_count: servedFromBank.length,
                        source: 'bank'
                    })
                });
            }

            const missingCount = Math.max(0, requestedCount - seededQuestions.length);
            const aiRequestedCount = missingCount || requestedCount;
            const readingPromptForGeneration = isReadingSubject(subject)
                ? buildReadingPromptContext({
                    topic: tema,
                    subject,
                    session: sourceSession,
                    phase: levelName,
                    batchIndex,
                    totalBatches,
                    requestedCount: aiRequestedCount,
                    grade: requestGrade
                })
                : null;
            const mathPromptForGeneration = isMathSubject(subject)
                ? buildMathPromptContext({
                    topic: tema,
                    subject,
                    session: sourceSession,
                    phase: levelName,
                    batchIndex,
                    totalBatches,
                    requestedCount: aiRequestedCount,
                    grade: requestGrade
                })
                : null;
            const biologyPromptForGeneration = isBiologySubject(subject)
                ? buildBiologyPromptContext({
                    topic: tema,
                    subject,
                    session: sourceSession,
                    phase: levelName,
                    batchIndex,
                    totalBatches,
                    requestedCount: aiRequestedCount,
                    grade: requestGrade
                })
                : null;
            const chemistryPromptForGeneration = isChemistrySubject(subject)
                ? buildChemistryPromptContext({
                    topic: tema,
                    subject,
                    session: sourceSession,
                    phase: levelName,
                    batchIndex,
                    totalBatches,
                    requestedCount: aiRequestedCount,
                    grade: requestGrade
                })
                : null;

            const promptContext = readingPromptForGeneration?.promptText
                || mathPromptForGeneration?.promptText
                || biologyPromptForGeneration?.promptText
                || chemistryPromptForGeneration?.promptText
                || [
                    `Tema: ${tema}`,
                    `Asignatura: ${subject}`,
                    `Fase: ${levelName || 'BASICO'}`,
                    `Sesion: ${sourceSession || 'sin sesion'}`,
                    `Lote: ${batchIndex + 1}/${totalBatches}`,
                    `Genera EXACTAMENTE ${aiRequestedCount} preguntas.`,
                    'Devuelve SOLO JSON valido con la clave "questions".',
                    'No devuelvas menos preguntas.',
                    'No repitas preguntas.'
                ].join('\n');

            const comp = await openai.chat.completions.create({
                model: AI_MODELS.fast,
                messages: [{ role: "system", content: systemMsg }, { role: "user", content: promptContext }],
                response_format: { type: "json_object" },
                temperature: aiTemperature
            });
            timingTrace.mark('openai_completed', {
                model: AI_MODELS.fast
            });

            const content = comp.choices[0].message.content;
            let questions = [];
            try {
                const parsed = JSON.parse(content);
                questions = parsed.questions || [];
            } catch {
                timingTrace.mark('response_parse_fallback');
                return res.json({
                    output: content,
                    timings: timingTrace.finish({
                        parse_fallback: true
                    })
                });
            }
            timingTrace.mark('response_parsed', {
                raw_questions: Array.isArray(questions) ? questions.length : 0
            });

            const freshQuestions = dedupeQuestions(sanitizeQuestions(questions));
            questions = [...seededQuestions, ...freshQuestions]
                .slice(0, requestedCount)
                .map((question, index) => ({
                    ...question,
                    source_session: Number(question.source_session || sourceSession || 0) || 0,
                    source_topic: String(question.source_topic || tema).trim(),
                    levelName: levelName || question.levelName || '',
                    batch_index: batchIndex,
                    question_index: index + 1
                }));
            timingTrace.mark('questions_sanitized', {
                seeded_count: seededQuestions.length,
                fresh_count: freshQuestions.length,
                question_count: questions.length
            });

            // PASO 2: VERIFICACIÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œN INDEPENDIENTE ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Segunda IA revisa cada pregunta
            if (false && questions.length > 0 && verifyPrompt && subject.includes('MATEMAT')) {
                console.log(`[VERIFY] ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Verificando ${questions.length} preguntas de ${subject}...`);
                let corrected = 0;

                for (let idx = 0; idx < questions.length; idx++) {
                    const q = questions[idx];
                    try {
                        const optionsText = Object.entries(q.options || {})
                            .map(([k, v]) => `${k}: ${v}`).join('\n');

                        // Delay de 500ms para evitar Rate Limits de NVIDIA / OpenAI al paralelizar 3 batches de 5 preguntas
                        if (idx > 0) await new Promise(r => setTimeout(r, 500));

                        const verifyComp = await openai.chat.completions.create({
                            model: AI_MODELS.thinking,
                            messages: [
                                { role: "system", content: verifyPrompt },
                                { role: "user", content: `Problema: ${q.question}\n\nOpciones:\n${optionsText}\n\nRevisa y dime la letra correcta.` }
                            ],
                            response_format: { type: "json_object" },
                            temperature: 0
                        });

                        const verifyResult = JSON.parse(verifyComp.choices[0].message.content);
                        const verifiedLetter = verifyResult.correct_letter?.toUpperCase();

                        if (verifiedLetter && verifiedLetter !== q.correct_answer) {
                            console.log(`[VERIFY] ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Q${idx + 1} CORREGIDA: "${q.question.substring(0, 50)}..." | AI dijo: ${q.correct_answer} ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ Verificador: ${verifiedLetter}`);
                            q.correct_answer = verifiedLetter;
                            corrected++;
                        }
                    } catch (err) {
                        console.log(`[VERIFY] Error en Q${idx + 1}:`, err.message);
                    }
                }
                console.log(`[VERIFY] ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ VerificaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n completa. Corregidas: ${corrected}/${questions.length}`);
            }

            await recordGeneratedQuestions(questions, {
                subject,
                source_action: 'generate_quiz',
                source_mode: 'quiz',
                grade: body.grade || '1medio',
                source_topic: tema,
                source_session: body.session || data.session || '',
                levelName,
                batch_index: batchIndex,
                metadata: {
                    currentAction,
                    level: levelName || body.level || body.nivel || data.level || '',
                    topic: tema,
                    user_id: user_id || '',
                    batch_index: batchIndex,
                    ...(readingPromptBundle?.moralejaContext?.bankMetadata || {}),
                    ...(mathPromptBundle?.moralejaMathContext?.bankMetadata || {}),
                    ...(biologyPromptBundle?.moralejaBiologiaContext?.bankMetadata || {}),
                    ...(chemistryPromptBundle?.moralejaQuimicaContext?.bankMetadata || {})
                }
            }).then(() => {
                timingTrace.mark('question_bank_saved', {
                    saved_count: questions.length
                });
            }).catch((err) => {
                console.error('[QUESTION_BANK] Error guardando quiz generado:', err.message);
                timingTrace.mark('question_bank_save_failed', {
                    error: err.message
                });
            });

            return res.json({
                questions,
                timings: timingTrace.finish({
                    question_count: questions.length
                })
            });
        }

        // 3. RESPONDER DUDAS / REMEDIAL / PROFUNDIZAR
        if (['answer_doubts', 'deepen_knowledge', 'generate_remedial_lesson', 'remedial_explanation',
            'Responder Duda', 'Profundizar y Desafiar', 'Explicar y Simplificar'].includes(currentAction)) {
            const tema = body.tema || body.topic || body.pregunta_usuario || 'ExplÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­came mÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡s';
            const systemMsg = "Eres Matico, mentor experto y carismÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡tico del currÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­culum chileno de 1ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â° Medio. Usa emojis y analogÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­as.";
            const comp = await openai.chat.completions.create({
                model: AI_MODELS.fast,
                messages: [{ role: "system", content: systemMsg }, { role: "user", content: tema }]
            });
            return res.json({ output: comp.choices[0].message.content });
        }

        if (currentAction === 'generate_prep_exam_review') {
            const subject = (body.subject || 'MATEMATICA').toUpperCase();
            const weakSessions = Array.isArray(body.weak_sessions) ? body.weak_sessions : [];
            const sessionDetails = Array.isArray(body.session_details) ? body.session_details : [];
            const wrongAnswers = Array.isArray(body.wrong_answers) ? body.wrong_answers : [];

            const weakContext = sessionDetails
                .filter(item => weakSessions.includes(item.session))
                .map(item => `SesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n ${item.session}: ${item.topic}\nContexto: ${(item.readingContent || '').substring(0, 1200) || 'Sin lectura asociada.'}`)
                .join('\n\n');

            const wrongContext = wrongAnswers
                .map((item, index) => `${index + 1}. SesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n ${item.session} | ${item.topic}\nPregunta fallada: ${item.question}`)
                .join('\n');

            const comp = await openai.chat.completions.create({
                model: AI_MODELS.fast,
                messages: [
                    {
                        role: 'system',
                        content: 'Eres Matico, tutor acadÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©mico de 1ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â° medio. Redacta un repaso guiado breve, concreto y accionable para un apoderado y un estudiante. Usa Markdown simple con tÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­tulos y listas. Debe incluir quÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© repasar, en quÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© orden y cÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³mo practicar.'
                    },
                    {
                        role: 'user',
                        content: `ASIGNATURA: ${subject}
SESIONES DÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°BILES: ${weakSessions.join(', ') || 'Sin sesiones marcadas'}

CONTEXTO DE SESIONES:
${weakContext || 'Sin contexto adicional.'}

ERRORES DETECTADOS:
${wrongContext || 'Sin errores especÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ficos.'}

Entrega:
1. Un resumen corto del problema.
2. Un plan de repaso por sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n.
3. 3 recomendaciones prÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡cticas para preparar la prueba real.`
                    }
                ]
            });

            return res.json({ success: true, output: comp.choices[0].message.content });
        }

        // 4. GUARDAR PROGRESO
        if (currentAction === 'save_progress' || currentAction === 'save') {
            const eventType = data.type || 'progress_update';
            const grade = data.grade || body.grade || '1medio';
            const totalQuestions = data.total_questions || data.total || data.question_count || (eventType === 'prep_exam_completed' ? 45 : (eventType === 'phase_completed' ? 15 : ''));
            const topic = data.topic || data.session_topic || data.source_topic || body.topic || '';
            console.log('[SAVE_PROGRESS_IN]', JSON.stringify({
                currentAction,
                user_id: user_id || '',
                eventType,
                data
            }));
            await appendProgressToSheetOrThrow(sheets, {
                user_id,
                subject: data.subject || '',
                session: data.session || '',
                event_type: eventType,
                phase: data.phase || '',
                subLevel: data.subLevel || '',
                levelName: data.levelName || '',
                score: data.score || '',
                xp: data.xp_reward || '',
                grade,
                topic,
                totalQuestions,
                sourceMode: data.source_mode || data.mode || '',
                batchIndex: data.batch_index || data.batchIndex || '',
                batchSize: data.batch_size || data.batchSize || '',
                correctAnswers: data.correct_answers || '',
                wrongAnswers: data.wrong_answers || '',
                wrongQuestionDetails: data.wrong_question_details || '',
                weakness: data.weakness || '',
                improvementPlan: data.improvement_plan || ''
            });
            
            if ((data.subject || '') && (data.session || '') && (eventType === 'phase_completed' || eventType === 'session_completed')) {
                const progressRowsResponse = await sheets.spreadsheets.values.get({
                    spreadsheetId: SPREADSHEET_ID,
                    range: 'progress_log!A:U',
                });
                const progressRows = progressRowsResponse.data.values || [];
                await autoAppendMissingSessionCompleted(sheets, progressRows, user_id, data.subject || '', grade)
                    .catch((err) => console.error('[SESSION_AUTOFIX] Error autocorrigiendo sesiones:', err.message));
            }
            const adaptiveResult = await recordAdaptiveEvent({
                user_id,
                grade,
                subject: data.subject || '',
                session: data.session || '',
                topic,
                event_type: eventType,
                phase: data.phase || '',
                levelName: data.levelName || '',
                score: data.score || '',
                total: totalQuestions,
                xp: data.xp_reward || '',
                metadata: data
            }).catch((err) => {
                console.error('[ADAPTIVE_PROFILE] Error actualizando perfil:', err.message);
                return null;
            });

            if (adaptiveResult?.summary) {
                await appendAdaptiveSnapshotToSheetOrThrow(sheets, {
                    user_id,
                    grade,
                    subject: data.subject || '',
                    session: data.session || '',
                    topic,
                    event_type: eventType,
                    mastery: adaptiveResult.summary.mastery || 0,
                    totalAttempts: adaptiveResult.summary.totalAttempts || 0,
                    totalCorrect: adaptiveResult.summary.totalCorrect || 0,
                    totalQuestions: adaptiveResult.summary.totalQuestions || totalQuestions || 0,
                    nextAction: adaptiveResult.summary.nextAction || '',
                    weakSessions: adaptiveResult.summary.weakSessions || [],
                    strongSessions: adaptiveResult.summary.strongSessions || [],
                    sourceMode: data.source_mode || data.mode || ''
                }).catch((err) => console.error('[ADAPTIVE_SHEET] Error guardando resumen:', err.message));
            }
            console.log('[SAVE_PROGRESS_OK]', JSON.stringify({
                user_id: user_id || '',
                eventType,
                subject: data.subject || '',
                session: data.session || '',
                phase: data.phase || '',
                subLevel: data.subLevel || '',
                levelName: data.levelName || '',
                score: data.score || '',
                xp_reward: data.xp_reward || ''
            }));
            return res.json({ success: true, message: 'Evento ' + eventType + ' registrado' });
        }

        // 5. GET PROFILE
        if (currentAction === 'get_profile') {
            const grade = body.grade || '1medio';
            const subject = body.subject || '';
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID, range: 'progress_log!A:U',
            });
            const rows = response.data.values || [];
            const userRows = rows.filter(row => row[1] === user_id);
            let totalXP = 0, sessionsCompleted = 0;
            userRows.forEach(row => {
                totalXP += parseInt(row[9]) || 0;
                if (row[4] === 'session_completed') sessionsCompleted++;
            });
            const userData = await getUserFromSheet(sheets, user_id);
            await backfillAdaptiveProfileFromProgressRows({
                user_id,
                grade,
                subject,
                rows: userRows
            }).catch((err) => console.error('[ADAPTIVE_PROFILE] Error reconstruyendo desde Sheet:', err.message));
            const adaptive = await getAdaptiveSnapshot({ user_id, grade, subject });
            const curriculum_context = await getCurriculumContext(grade, subject);
            return res.json({
                xp: totalXP, puntos: totalXP, streak: 0, racha: 0,
                level: Math.floor(totalXP / 100) + 1, nivel: Math.floor(totalXP / 100) + 1,
                username: userData?.nombre || 'Estudiante', nombre: userData?.nombre || 'Estudiante',
                sessions_completed: sessionsCompleted,
                grade,
                subject,
                adaptive,
                curriculum_context
            });
        }

        // 6. ENVIAR REPORTE DE SESI        // 6. ENVIAR REPORTE DE SESIÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œN (email al alumno + apoderado CON ANÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂLISIS IA)
        if (currentAction === 'send_session_report' || currentAction === 'notify_parent') {
            const userData = await getUserFromSheet(sheets, user_id);
            if (userData) {
                const stats = body.stats || { correct: 0, total: 45 };
                const subject = body.subject || 'Materia';
                const session = body.session || '?';
                const topic = body.topic || body.tema || '';
                const wrongAnswers = normalizeWrongAnswerDetails(body.wrong_answers || [], body.wrong_question_details || []);
                const weakness = body.weakness || '';
                const improvementPlan = body.improvement_plan || '';
                const notebookSubmission = await getLatestNotebookSubmissionForSession({
                    userId: user_id,
                    subject,
                    session
                });

                // GENERAR ANÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂLISIS IA DE LOS ERRORES
                let aiAnalysis = '';
                if (wrongAnswers.length > 0) {
                    try {
                        const errorSummary = wrongAnswers.slice(0, 15).map((w, i) =>
                            `${i + 1}. Pregunta: "${w.question}" | RespondiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³: ${w.user_answer} | Correcta: ${w.correct_answer}`
                        ).join('\n');

                        const analysisComp = await openai.chat.completions.create({
                            model: AI_MODELS.fast,
                            messages: [
                                {
                                    role: "system", content: `Eres un tutor experto en educaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n chilena de 1ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â° Medio. Analiza los errores del estudiante y genera un reporte breve EN HTML (usando <p>, <ul>, <li>, <strong>). NO uses markdown. El reporte debe:
1. Identificar PATRONES en los errores (ej: "confunde fracciones con decimales")
2. SeÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â±alar las ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂREAS DÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°BILES especÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ficas
3. Dar 3 SUGERENCIAS CONCRETAS para mejorar
4. Un mensaje MOTIVADOR al final
SÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© conciso (mÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ximo 200 palabras). Usa lenguaje cercano.` },
                                { role: "user", content: `Estudiante: ${userData.nombre}\nAsignatura: ${subject}\nTema: ${topic}\nResultado: ${stats.correct}/45\nDebilidad resumida: ${weakness || 'No especificada'}\nPlan de mejora: ${improvementPlan || 'No especificado'}\n\nPREGUNTAS INCORRECTAS:\n${errorSummary}` }
                            ]
                        });
                        aiAnalysis = analysisComp.choices[0].message.content;
                        console.log('[AI] ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ AnÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lisis de errores generado');
                    } catch (err) {
                        console.error('[AI] Error generando anÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lisis:', err.message);
                    }
                }

                const html = buildSessionReportHTMLClean(userData.nombre, subject, session, topic, stats, wrongAnswers, aiAnalysis, {
                    weakness,
                    improvementPlan,
                    notebookSummary: notebookSubmission ? {
                        pageCount: notebookSubmission.page_count || 1,
                        interpretationScore: notebookSubmission.analysis_result?.interpretation_score || 0,
                        quizReady: Boolean(notebookSubmission.analysis_result?.quiz_ready),
                        feedback: notebookSubmission.analysis_result?.feedback || '',
                        suggestion: notebookSubmission.analysis_result?.suggestion || '',
                        detectedConcepts: notebookSubmission.analysis_result?.detected_concepts || [],
                        missingConcepts: notebookSubmission.analysis_result?.missing_concepts || []
                    } : null
                });
                const emailSubject = `Reporte Matico: ${userData.nombre} completo ${subject} - Sesion ${session}`;

                // Enviar al alumno
                if (userData.email) {
                    await sendEmailSafe(userData.email, emailSubject, html);
                }
                // Enviar al apoderado
                if (userData.correo_apoderado) {
                    await sendEmailSafe(userData.correo_apoderado, `Recordatorio familiar - ${emailSubject}`, html);
                }
            }
            return res.json({ success: true, message: "Reportes enviados con anÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lisis IA" });
        }

        // 7. GET PROGRESS (Leer progreso real desde progress_log por materia)
        if (currentAction === 'get_progress') {
            const subjectFilter = body.subject || '';

            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'progress_log!A:U',
            });
            const rows = response.data.values || [];

            // Filtrar por user_id
            const userRows = rows.filter(row => row[1] === user_id);

            await autoAppendMissingSessionCompleted(sheets, rows, user_id, subjectFilter || '', '1medio')
                .catch((err) => console.error('[SESSION_AUTOFIX] Error reconstruyendo sesiones completas:', err.message));

            const refreshedResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'progress_log!A:U',
            });
            const refreshedRows = refreshedResponse.data.values || [];
            const userRowsRefreshed = refreshedRows.filter(row => row[1] === user_id);

            const { data: latestAdminRoute } = await supabase
                .from('progress_log')
                .select('created_at, subject, session, phase, source_mode, topic, improvement_plan')
                .eq('user_id', user_id)
                .eq('event_type', 'admin_route_set')
                .eq('subject', subjectFilter)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (latestAdminRoute) {
                const { data: laterStudentRows } = await supabase
                    .from('progress_log')
                    .select('id')
                    .eq('user_id', user_id)
                    .eq('subject', subjectFilter)
                    .gt('created_at', latestAdminRoute.created_at)
                    .neq('event_type', 'admin_route_set')
                    .limit(1);

                if (!laterStudentRows?.length) {
                    const forcedSession = Math.max(1, Number(latestAdminRoute.session || 1) || 1);
                    const forcedPhase = Math.max(0, Number(latestAdminRoute.phase || 0) || 0);
                    const forcedStage = String(latestAdminRoute.source_mode || 'teoria');
                    const isCompletedStage = forcedStage === 'completada';
                    const isTheoryDone = ['cuaderno', 'quiz_fase_1', 'quiz_fase_2', 'quiz_fase_3', 'completada'].includes(forcedStage);

                    console.log(`[PROGRESS_ADMIN_ROUTE] User: ${user_id} | Subject: ${subjectFilter} | Forced S${forcedSession} stage ${forcedStage}`);

                    return res.json({
                        success: true,
                        next_session: isCompletedStage ? forcedSession + 1 : forcedSession,
                        last_completed_session: isCompletedStage ? forcedSession : Math.max(0, forcedSession - 1),
                        current_session_in_progress: isCompletedStage ? 0 : forcedSession,
                        current_phase: isCompletedStage ? 0 : forcedPhase,
                        current_theory_started: isTheoryDone || forcedStage === 'teoria',
                        current_theory_completed: isTheoryDone,
                        sessions_completed: isCompletedStage ? forcedSession : Math.max(0, forcedSession - 1),
                        xp: 0,
                        puntos: 0,
                        level: 1,
                        subject: subjectFilter,
                        admin_route_override: {
                            session: forcedSession,
                            stage: forcedStage,
                            set_at: latestAdminRoute.created_at,
                            topic: latestAdminRoute.topic || ''
                        }
                    });
                }
            }

            // Filtrar sesiones completadas de esta materia
            // Columnas: A=timestamp, B=user_id, C=subject, D=session, E=event_type
            const completedSessions = userRowsRefreshed.filter(row =>
                row[4] === 'session_completed' &&
                (subjectFilter ? row[2] === subjectFilter : true)
            );

            // TambiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©n buscar fases completadas (por si estÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ a mitad de sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n o el histÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³rico no grabÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³ session_completed)
            const phaseRows = userRowsRefreshed.filter(row =>
                row[4] === 'phase_completed' &&
                (subjectFilter ? row[2] === subjectFilter : true)
            );
            const theoryRows = userRowsRefreshed.filter(row =>
                (row[4] === 'theory_started' || row[4] === 'theory_completed') &&
                (subjectFilter ? row[2] === subjectFilter : true)
            );

            const phaseMap = new Map();
            phaseRows.forEach(row => {
                const sessionNum = parseInt(row[3]) || 0;
                const phase = parseInt(row[5]) || 0;
                if (!sessionNum || !phase) return;
                if (!phaseMap.has(sessionNum)) {
                    phaseMap.set(sessionNum, new Set());
                }
                phaseMap.get(sessionNum).add(phase);
            });

            // Encontrar la sesiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n mÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡s alta completada:
            // 1) por session_completed explÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­cito
            // 2) o por tener las 3 fases completas (1,2,3)
            let maxSession = 0;
            completedSessions.forEach(row => {
                const sessionNum = parseInt(row[3]) || 0;
                if (sessionNum > maxSession) maxSession = sessionNum;
            });

            phaseMap.forEach((phases, sessionNum) => {
                if (phases.has(1) && phases.has(2) && phases.has(3) && sessionNum > maxSession) {
                    maxSession = sessionNum;
                }
            });

            let currentSessionInProgress = 0;
            let currentPhase = 0;
            phaseRows.forEach(row => {
                const sessionNum = parseInt(row[3]) || 0;
                const phase = parseInt(row[5]) || 0;
                if (sessionNum > currentSessionInProgress ||
                    (sessionNum === currentSessionInProgress && phase > currentPhase)) {
                    currentSessionInProgress = sessionNum;
                    currentPhase = phase;
                }
            });

            let currentTheoryStarted = false;
            let currentTheoryCompleted = false;
            theoryRows.forEach(row => {
                const sessionNum = parseInt(row[3]) || 0;
                const eventType = row[4] || '';

                if (sessionNum > currentSessionInProgress) {
                    currentSessionInProgress = sessionNum;
                    currentPhase = 0;
                    currentTheoryStarted = eventType === 'theory_started' || eventType === 'theory_completed';
                    currentTheoryCompleted = eventType === 'theory_completed';
                    return;
                }

                if (sessionNum === currentSessionInProgress) {
                    if (eventType === 'theory_started' || eventType === 'theory_completed') {
                        currentTheoryStarted = true;
                    }
                    if (eventType === 'theory_completed') {
                        currentTheoryCompleted = true;
                    }
                }
            });

            // Calcular XP total
            let totalXP = 0;
            userRowsRefreshed.forEach(row => {
                totalXP += parseInt(row[9]) || 0;
            });

            const nextSession = maxSession + 1;

            console.log(`[PROGRESS] User: ${user_id} | Subject: ${subjectFilter} | Last Completed: Session ${maxSession} | Next: Session ${nextSession} | In Progress: Session ${currentSessionInProgress} Phase ${currentPhase}`);

            return res.json({
                success: true,
                next_session: nextSession,
                last_completed_session: maxSession,
                current_session_in_progress: currentSessionInProgress,
                current_phase: currentPhase,
                current_theory_started: currentTheoryStarted,
                current_theory_completed: currentTheoryCompleted,
                sessions_completed: completedSessions.length,
                xp: totalXP,
                puntos: totalXP,
                level: Math.floor(totalXP / 100) + 1,
                subject: subjectFilter
            });
        }

        if (currentAction === 'list_notebook_files') {
            if (!isAdminEmail(req.user?.email || body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }

            const files = await listNotebookFiles();
            return res.json({ success: true, files });
        }

        if (currentAction === 'delete_notebook_file') {
            if (!isAdminEmail(req.user?.email || body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }

            if (!body.file_name) {
                return res.status(400).json({ success: false, error: 'Debes indicar file_name' });
            }

            await deleteNotebookFile(body.file_name);
            return res.json({ success: true, deleted: body.file_name });
        }

        if (currentAction === 'admin_set_student_stage') {
            if (!isAdminEmail(req.user?.email || body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }

            const targetUserId = String(body.target_user_id || body.student_user_id || '').trim();
            const subject = normalizeSubjectCode(body.subject || data.subject || '');
            const sessionNumber = Math.max(1, Number(body.session || data.session || 1) || 1);
            const stage = String(body.stage || data.stage || 'teoria').trim().toLowerCase();
            const reason = String(body.reason || data.reason || '').trim();
            const stageLabels = {
                cero: 'Volver a cero',
                teoria: 'Teoria ludica',
                cuaderno: 'Cuaderno',
                quiz_fase_1: 'Quiz fase 1',
                quiz_fase_2: 'Quiz fase 2',
                quiz_fase_3: 'Quiz fase 3',
                completada: 'Sesion completada'
            };

            if (!targetUserId) {
                return res.status(400).json({ success: false, error: 'Debes indicar target_user_id' });
            }
            if (!subject || subject === 'GENERAL') {
                return res.status(400).json({ success: false, error: 'Debes indicar subject' });
            }

            const phaseByStage = {
                cero: 0,
                teoria: 0,
                cuaderno: 0,
                quiz_fase_1: 0,
                quiz_fase_2: 1,
                quiz_fase_3: 2,
                completada: 3
            };

            await appendProgressToSheetOrThrow(sheets, {
                user_id: targetUserId,
                subject,
                session: sessionNumber,
                event_type: 'admin_route_set',
                phase: phaseByStage[stage] ?? 0,
                grade: body.grade || data.grade || '1medio',
                topic: `${stageLabels[stage] || stage} - Sesion ${sessionNumber}`,
                sourceMode: stage,
                improvementPlan: JSON.stringify({
                    admin_email: body.email,
                    stage,
                    reason,
                    reset_client_progress: true
                })
            });

            return res.json({
                success: true,
                message: `Alumno posicionado en ${subject} sesion ${sessionNumber} (${stageLabels[stage] || stage}).`,
                target_user_id: targetUserId,
                subject,
                session: sessionNumber,
                stage
            });
        }

        if (currentAction === 'list_generated_questions') {
            if (!isAdminEmail(req.user?.email || body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }

            const items = await listGeneratedQuestions({
                subject: body.subject || '',
                source_action: body.source_action || ''
            });
            return res.json({ success: true, items, count: items.length });
        }

        if (currentAction === 'delete_generated_question') {
            if (!isAdminEmail(req.user?.email || body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }

            if (!body.question_id) {
                return res.status(400).json({ success: false, error: 'Debes indicar question_id' });
            }

            const result = await deleteGeneratedQuestion(body.question_id);
            return res.json({ success: true, ...result });
        }

        if (currentAction === 'list_pedagogical_assets') {
            if (!isAdminEmail(req.user?.email || body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }

            const items = await listPedagogicalImageAssets(sheets, {
                subject: body.subject || '',
                status: body.status || '',
                search: body.search || ''
            });
            return res.json({ success: true, items, count: items.length });
        }

        if (currentAction === 'get_image_generation_config') {
            if (!isAdminEmail(req.user?.email || body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }
            const config = await getImageGenerationConfig();
            return res.json({
                success: true,
                ...config
            });
        }

        if (currentAction === 'update_image_generation_runtime_config') {
            if (!isAdminEmail(req.user?.email || body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }
            const provider = normalizeImageGeneratorProvider(body.provider || '');
            const patch = body.patch && typeof body.patch === 'object' ? body.patch : {};
            const nextConfig = await updateImageGenerationRuntimeConfig({
                defaultProvider: body.default_provider || '',
                provider,
                patch
            });
            const publicConfig = await getImageGenerationConfig();
            return res.json({
                success: true,
                updated_provider: provider || '',
                default_provider: nextConfig.default_provider || '',
                ...publicConfig
            });
        }

        if (currentAction === 'generate_pedagogical_image') {
            if (!isAdminEmail(req.user?.email || body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }

            const prompt = String(body.prompt || '').trim();
            if (prompt.length < 8) {
                return res.status(400).json({ success: false, error: 'Debes escribir un prompt más descriptivo (mínimo 8 caracteres)' });
            }

            const subject = String(body.subject || 'MATEMATICA').trim().toUpperCase();
            const title = String(body.title || prompt.slice(0, 80)).trim();
            const topicTags = String(body.topic_tags || '').trim();
            const kind = normalizePedagogicalImageKind(body.kind || 'other');
            const altText = String(body.alt_text || prompt.slice(0, 180)).trim();
            const caption = String(body.caption || '').trim();
            const status = normalizePedagogicalImageStatus(body.status || 'draft');
            const provider = normalizeImageGeneratorProvider(body.provider || '');
            const size = String(body.size || '1024x1024').trim() || '1024x1024';
            const quality = ['low','medium','high','auto'].includes(String(body.quality||'').toLowerCase())
                ? String(body.quality).toLowerCase()
                : 'low';

            const generated = await generatePedagogicalImage({
                provider,
                prompt,
                size,
                quality
            });
            const extension = mimeTypeToExtension(generated.mimeType || '');
            const safeTitle = sanitizeFileSegment(title || 'imagen_ia').toLowerCase();
            const saved = await saveBufferToLocalFile(
                generated.buffer,
                `${safeTitle}${extension}`,
                'quiz-assets'
            );

            const created = await createPedagogicalImageAsset(sheets, {
                title,
                subject,
                topicTags,
                kind,
                fileName: saved.fileName,
                fileUrl: saved.publicUrl,
                mimeType: generated.mimeType || 'image/png',
                altText,
                caption,
                sourceType: `ai_generate_${generated.provider || provider || 'unknown'}`,
                status
            });

            return res.json({
                success: true,
                item: created,
                generation: {
                    provider: generated.provider || provider || '',
                    model: generated.model || '',
                    revised_prompt: generated.revisedPrompt || ''
                }
            });
        }

        // Genera pregunta+imagen a partir de asignatura/sesion/fase/nivel.
        // El tema tambien lo propone la IA (o admin lo sugiere con body.topic_hint).
        // Si body.save === true, ademas persiste la pregunta en el Question Bank.
        if (currentAction === 'generate_question_with_image') {
            if (!isAdminEmail(req.user?.email || body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }
            const subject = String(body.subject || 'MATEMATICA').trim().toUpperCase();
            const session = body.session || '';
            const phase = body.phase || '';
            const levelName = normalizeQuestionBankLevel(body.levelName || 'BASICO') || 'BASICO';
            const topicHint = String(body.topic_hint || body.topic || '').trim();
            const provider = normalizeImageGeneratorProvider(body.provider || '');
            const quality = ['low','medium','high','auto'].includes(String(body.quality||'').toLowerCase())
                ? String(body.quality).toLowerCase()
                : 'low';
            const size = String(body.size || '1024x1024').trim() || '1024x1024';

            const result = await generateQuestionWithImageFromTopic(sheets, {
                subject, session, phase, levelName, topicHint, provider, quality, size
            });

            if (body.save === true) {
                const created = await appendQuestionBankQuestion(sheets, {
                    subject: result.subject,
                    session: result.session,
                    phase: result.phase,
                    slot: Number(body.slot || 0) || 0,
                    proposalIndex: 1,
                    levelName: result.levelName,
                    topic: result.proposed_topic,
                    question: result.question,
                    options: result.options,
                    correctAnswer: result.correct_answer,
                    explanation: result.explanation,
                    sourceMode: 'topic_ai_admin',
                    promptImage: result.asset,
                    questionVisualRole: result.question_visual_role
                });
                return res.json({ success: true, saved: true, item: created, draft: result });
            }

            return res.json({ success: true, saved: false, draft: result });
        }

        // Genera un batch de preguntas para una fase con scoring de imagen.
        // La IA puntea cuales preguntas son mas idoneas para llevar imagen.
        // Aplica el cap (default 6) de imagenes por fase: las preguntas top
        // por image_score reciben imagen, el resto se guardan sin imagen.
        if (currentAction === 'populate_phase_with_images') {
            if (!isAdminEmail(req.user?.email || body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }
            const subject = String(body.subject || 'MATEMATICA').trim().toUpperCase();
            const session = body.session || '';
            const phase = body.phase || '';
            const levelName = normalizeQuestionBankLevel(body.levelName || body.level_name || 'BASICO') || 'BASICO';
            const count = Math.max(3, Math.min(20, Number(body.count) || 15));
            const provider = normalizeImageGeneratorProvider(body.provider || '');
            const quality = ['low', 'medium', 'high', 'auto'].includes(String(body.quality || '').toLowerCase())
                ? String(body.quality).toLowerCase()
                : 'low';
            const size = String(body.size || '1024x1024').trim() || '1024x1024';
            const maxImagesPerPhase = Math.max(0, Math.min(15, Number(body.image_cap || 6) || 6));
            const minScore = Math.max(0, Math.min(10, Number(body.min_image_score || 5) || 5));

            const batch = await generatePhaseBatchWithImageScoring(sheets, {
                subject, session, phase, levelName, count
            });

            const existingWithImage = await countQuestionsWithImageInPhase(sheets, { subject, session, phase });
            const remainingSlots = Math.max(0, maxImagesPerPhase - existingWithImage);

            const candidates = batch.questions
                .map((q, idx) => ({ ...q, originalIndex: idx }))
                .filter((q) => q.image_role !== 'none' && q.image_score >= minScore && q.image_prompt)
                .sort((a, b) => b.image_score - a.image_score)
                .slice(0, remainingSlots);
            const indexesGettingImage = new Set(candidates.map((c) => c.originalIndex));

            const items = [];
            let imagesGenerated = 0;
            let imagesSkippedCapFull = 0;
            let imagesFailed = 0;

            for (let i = 0; i < batch.questions.length; i++) {
                const q = batch.questions[i];
                let asset = null;
                let visualRole = 'illustrative_only';

                const wasCandidate = (q.image_role !== 'none' && q.image_score >= minScore && !!q.image_prompt);

                if (indexesGettingImage.has(i)) {
                    try {
                        const generated = await generatePedagogicalImage({
                            provider,
                            prompt: q.image_prompt || ('Ilustracion educativa de ' + (q.topic || subject)),
                            size,
                            quality
                        });
                        const extension = mimeTypeToExtension(generated.mimeType || '');
                        const safeTitle = sanitizeFileSegment((q.topic || 'phase_batch').slice(0, 60)).toLowerCase();
                        const saved = await saveBufferToLocalFile(
                            generated.buffer,
                            safeTitle + '_' + Date.now() + '_' + i + extension,
                            'quiz-assets'
                        );
                        asset = await createPedagogicalImageAsset(sheets, {
                            title: ((q.topic || 'IA batch') + ' (IA)').slice(0, 180),
                            subject,
                            topicTags: q.topic || '',
                            kind: 'diagram',
                            fileName: saved.fileName,
                            fileUrl: saved.publicUrl,
                            mimeType: generated.mimeType || 'image/png',
                            altText: (q.image_prompt || q.topic || subject).slice(0, 180),
                            caption: 'Auto-generada batch fase ' + (phase || '?') + ' sesion ' + (session || '?'),
                            sourceType: 'ai_phase_batch_' + (generated.provider || 'openai'),
                            status: 'draft'
                        });
                        visualRole = q.image_role === 'required_for_interpretation' ? 'required_for_interpretation' : 'supporting';
                        imagesGenerated++;
                    } catch (imgErr) {
                        console.error('[PHASE_BATCH] Error generando imagen Q' + i + ':', imgErr.message);
                        imagesFailed++;
                    }
                } else if (wasCandidate) {
                    imagesSkippedCapFull++;
                }

                const created = await appendQuestionBankQuestion(sheets, {
                    subject,
                    session,
                    phase,
                    slot: 0,
                    proposalIndex: 1,
                    levelName,
                    topic: q.topic,
                    question: q.question,
                    options: q.options,
                    correctAnswer: q.correct_answer,
                    explanation: q.explanation,
                    sourceMode: 'phase_batch_ai_admin',
                    promptImage: asset,
                    questionVisualRole: visualRole
                });
                items.push({
                    ...created,
                    image_score: q.image_score,
                    image_role: q.image_role,
                    image_prompt: q.image_prompt || '',
                    had_image_attached: !!asset,
                    was_image_candidate: wasCandidate
                });
            }

            return res.json({
                success: true,
                subject,
                session: Number(session || 0) || 0,
                phase: Number(phase || 0) || 0,
                levelName,
                requested_count: count,
                saved_count: items.length,
                images_generated: imagesGenerated,
                images_skipped_cap_full: imagesSkippedCapFull,
                images_failed: imagesFailed,
                cap_per_phase: maxImagesPerPhase,
                existing_images_in_phase: existingWithImage,
                remaining_slots_at_start: remainingSlots,
                min_image_score: minScore,
                items
            });
        }

        // Toma preguntas EXISTENTES de QuestionBank y les agrega imagen real.
        // Este flujo no duplica preguntas: reescribe la fila original para que
        // pregunta, opciones e imagen queden acopladas.
        if (currentAction === 'add_images_to_existing_phase_questions') {
            if (!isAdminEmail(req.user?.email || body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }

            const subject = String(body.subject || '').trim().toUpperCase();
            const session = Number(body.session || 0) || 0;
            const phase = Number(body.phase || 0) || 0;
            const provider = normalizeImageGeneratorProvider(body.provider || '');
            const quality = ['low', 'medium', 'high', 'auto'].includes(String(body.quality || '').toLowerCase())
                ? String(body.quality).toLowerCase()
                : 'low';
            const size = String(body.size || '1024x1024').trim() || '1024x1024';
            const maxImagesPerPhase = Math.max(1, Math.min(15, Number(body.image_cap || 6) || 6));
            const minScore = Math.max(0, Math.min(10, Number(body.min_image_score || 6) || 6));
            const candidateLimit = Math.max(6, Math.min(80, Number(body.candidate_limit || 45) || 45));
            const previewOnly = body.preview_only === true || body.dry_run === true;

            if (!['FISICA', 'MATEMATICA'].includes(subject)) {
                return res.status(400).json({ success: false, error: 'Por ahora este flujo esta habilitado para FISICA y MATEMATICA' });
            }
            if (!session || !phase) {
                return res.status(400).json({ success: false, error: 'Debes indicar session y phase numericos' });
            }

            const existingWithImage = await countRuntimeQuestionsWithImageInPhase({ subject, session, phase });
            const remainingSlots = Math.max(0, maxImagesPerPhase - existingWithImage);
            const candidates = await listRuntimeQuestionBankImageCandidates({
                subject,
                session,
                phase,
                limit: candidateLimit
            });

            if (remainingSlots === 0 || candidates.length === 0) {
                return res.json({
                    success: true,
                    subject,
                    session,
                    phase,
                    preview_only: previewOnly,
                    cap_per_phase: maxImagesPerPhase,
                    existing_images_in_phase: existingWithImage,
                    remaining_slots: remainingSlots,
                    candidates_without_image: candidates.length,
                    images_generated: 0,
                    items: []
                });
            }

            const scores = await scoreExistingQuestionsForImage({ subject, questions: candidates });
            const byQuestionId = new Map(candidates.map((item) => [item.question_id, item]));
            const selected = scores
                .filter((item) => byQuestionId.has(item.question_id))
                .filter((item) => item.image_role !== 'none' && item.image_score >= minScore && item.image_prompt)
                .sort((a, b) => b.image_score - a.image_score)
                .slice(0, remainingSlots);

            if (previewOnly) {
                return res.json({
                    success: true,
                    subject,
                    session,
                    phase,
                    preview_only: true,
                    cap_per_phase: maxImagesPerPhase,
                    existing_images_in_phase: existingWithImage,
                    remaining_slots: remainingSlots,
                    candidates_without_image: candidates.length,
                    selected_count: selected.length,
                    items: selected.map((score) => ({
                        ...score,
                        question: byQuestionId.get(score.question_id)?.question || '',
                        topic: byQuestionId.get(score.question_id)?.topic || ''
                    }))
                });
            }

            const items = [];
            let imagesGenerated = 0;
            let imagesFailed = 0;
            let rewritesFailed = 0;

            for (const score of selected) {
                const candidate = byQuestionId.get(score.question_id);
                if (!candidate) continue;

                try {
                    const rewrite = await rewriteExistingQuestionForImage({
                        subject,
                        candidate,
                        imagePrompt: score.image_prompt,
                        imageRole: score.image_role
                    });

                    const generated = await generatePedagogicalImage({
                        provider,
                        prompt: rewrite.image_prompt || score.image_prompt,
                        size,
                        quality
                    });
                    const extension = mimeTypeToExtension(generated.mimeType || '');
                    const safeTitle = sanitizeFileSegment((rewrite.topic || candidate.topic || 'retrofit_image').slice(0, 60)).toLowerCase();
                    const saved = await saveBufferToLocalFile(
                        generated.buffer,
                        safeTitle + '_' + Date.now() + '_' + candidate.question_id + extension,
                        'quiz-assets'
                    );
                    const asset = await createPedagogicalImageAsset(sheets, {
                        title: ((rewrite.topic || candidate.topic || 'Imagen QuestionBank') + ' (retrofit IA)').slice(0, 180),
                        subject,
                        topicTags: rewrite.topic || candidate.topic || '',
                        kind: 'diagram',
                        fileName: saved.fileName,
                        fileUrl: saved.publicUrl,
                        mimeType: generated.mimeType || 'image/png',
                        altText: (rewrite.image_prompt || score.image_prompt || '').slice(0, 180),
                        caption: 'Imagen generada para pregunta existente ' + candidate.question_id,
                        sourceType: 'ai_existing_question_' + (generated.provider || 'openai'),
                        status: 'approved'
                    });

                    const updated = await updateRuntimeExistingQuestionWithImage({
                        questionId: candidate.question_id,
                        asset,
                        visualRole: rewrite.question_visual_role || score.image_role,
                        topic: rewrite.topic,
                        question: rewrite.question,
                        options: rewrite.options,
                        correctAnswer: rewrite.correct_answer,
                        explanation: rewrite.explanation
                    });

                    imagesGenerated++;
                    items.push({
                        ...updated,
                        image_score: score.image_score,
                        image_role: score.image_role,
                        image_prompt: rewrite.image_prompt || score.image_prompt,
                        asset
                    });
                } catch (error) {
                    console.error('[EXISTING_IMAGE_RETROFIT] Error en ' + score.question_id + ':', error.message);
                    if (/reescrita|pregunta/i.test(error.message)) {
                        rewritesFailed++;
                    } else {
                        imagesFailed++;
                    }
                    items.push({
                        question_id: score.question_id,
                        success: false,
                        error: error.message,
                        image_score: score.image_score,
                        image_role: score.image_role
                    });
                }
            }

            return res.json({
                success: true,
                subject,
                session,
                phase,
                preview_only: false,
                cap_per_phase: maxImagesPerPhase,
                existing_images_in_phase_before: existingWithImage,
                remaining_slots_at_start: remainingSlots,
                candidates_without_image: candidates.length,
                selected_count: selected.length,
                images_generated: imagesGenerated,
                images_failed: imagesFailed,
                rewrites_failed: rewritesFailed,
                min_image_score: minScore,
                items
            });
        }

        if (currentAction === 'update_pedagogical_asset_status') {
            if (!isAdminEmail(req.user?.email || body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }
            if (!body.asset_id) {
                return res.status(400).json({ success: false, error: 'Debes indicar asset_id' });
            }

            const item = await updatePedagogicalImageAssetRow(sheets, body.asset_id, {
                status: normalizePedagogicalImageStatus(body.status || 'draft')
            });
            return res.json({ success: true, item });
        }

        if (currentAction === 'list_question_bank_rows') {
            if (!isAdminEmail(req.user?.email || body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }

            const items = await listQuestionBankRowsForAdmin(sheets, {
                subject: body.subject || '',
                session: body.session || '',
                search: body.search || '',
                limit: body.limit || 60
            });
            return res.json({ success: true, items, count: items.length });
        }

        if (currentAction === 'create_question_bank_row') {
            if (!isAdminEmail(req.user?.email || body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }
            if (!String(body.question || '').trim()) {
                return res.status(400).json({ success: false, error: 'Debes indicar el enunciado de la pregunta' });
            }
            if (!String(body.subject || '').trim()) {
                return res.status(400).json({ success: false, error: 'Debes indicar la asignatura' });
            }

            const created = await createQuestionBankRowFromPayload(sheets, body, {
                sourceMode: body.sourceMode || 'manual_admin',
                requireApprovedAsset: true
            });

            return res.json({ success: true, item: created });
        }

        if (currentAction === 'list_theory_rows') {
            if (!isAdminEmail(req.user?.email || body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }

            const items = await listTheoryLudicaRowsForAdmin(sheets, {
                subject: body.subject || '',
                session: body.session || '',
                phase: body.phase || '',
                search: body.search || '',
                limit: body.limit || 40
            });
            return res.json({ success: true, items, count: items.length });
        }

        if (currentAction === 'link_question_image_asset') {
            if (!isAdminEmail(req.user?.email || body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }
            if (!body.question_id) {
                return res.status(400).json({ success: false, error: 'Debes indicar question_id' });
            }

            const result = await linkQuestionBankAsset(sheets, {
                questionId: body.question_id,
                assetId: body.asset_id || ''
            });
            return res.json({ success: true, ...result });
        }

        if (currentAction === 'update_question_visual_role') {
            if (!isAdminEmail(req.user?.email || body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }
            if (!body.question_id) {
                return res.status(400).json({ success: false, error: 'Debes indicar question_id' });
            }

            const result = await updateQuestionVisualRole(sheets, {
                questionId: body.question_id,
                visualRole: body.question_visual_role || 'supporting'
            });
            return res.json({ success: true, ...result });
        }

        if (currentAction === 'link_theory_image_asset') {
            if (!isAdminEmail(req.user?.email || body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }
            if (!body.row_number) {
                return res.status(400).json({ success: false, error: 'Debes indicar row_number' });
            }

            const result = await linkTheoryLudicaAsset(sheets, {
                rowNumber: body.row_number,
                assetId: body.asset_id || ''
            });
            return res.json({ success: true, ...result });
        }

        if (currentAction === 'suggest_question_matches_from_asset') {
            if (!isAdminEmail(req.user?.email || body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }
            if (!body.asset_id) {
                return res.status(400).json({ success: false, error: 'Debes indicar asset_id' });
            }

            const asset = await findPedagogicalImageAssetById(sheets, body.asset_id);
            if (!asset) {
                return res.status(404).json({ success: false, error: 'El asset indicado no existe' });
            }

            const aiDraft = await generateQuestionDraftFromPedagogicalAsset(sheets, asset, {
                subject: body.subject || asset.subject,
                session: body.session || '',
                phase: body.phase || '',
                levelName: body.levelName || ''
            });
            const items = await buildQuestionBankAssociationSuggestions(sheets, asset, {
                search: [aiDraft.topic, aiDraft.image_analysis, ...(aiDraft.tags || [])].filter(Boolean).join(' '),
                limit: body.limit || 8
            });

            return res.json({
                success: true,
                asset_id: asset.asset_id,
                ai_draft: aiDraft,
                items,
                count: items.length
            });
        }

        if (currentAction === 'suggest_theory_matches_from_asset') {
            if (!isAdminEmail(req.user?.email || body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }
            if (!body.asset_id) {
                return res.status(400).json({ success: false, error: 'Debes indicar asset_id' });
            }

            const asset = await findPedagogicalImageAssetById(sheets, body.asset_id);
            if (!asset) {
                return res.status(404).json({ success: false, error: 'El asset indicado no existe' });
            }

            const items = await buildTheoryLudicaAssociationSuggestions(sheets, asset, {
                subject: body.subject || asset.subject || '',
                session: body.session || '',
                phase: body.phase || '',
                search: body.search || [asset.topic_tags, asset.alt_text, asset.caption].filter(Boolean).join(' '),
                limit: body.limit || 8
            });

            return res.json({
                success: true,
                asset_id: asset.asset_id,
                items,
                count: items.length
            });
        }

        if (currentAction === 'generate_question_from_asset') {
            if (!isAdminEmail(req.user?.email || body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }
            if (!body.asset_id) {
                return res.status(400).json({ success: false, error: 'Debes indicar asset_id' });
            }

            const asset = await findPedagogicalImageAssetById(sheets, body.asset_id);
            if (!asset) {
                return res.status(404).json({ success: false, error: 'El asset indicado no existe' });
            }

            const draft = await generateQuestionDraftFromPedagogicalAsset(sheets, asset, {
                subject: body.subject || asset.subject,
                session: body.session || '',
                phase: body.phase || '',
                levelName: body.levelName || 'BASICO'
            });

            if (body.save === true) {
                const created = await createQuestionBankRowFromPayload(sheets, {
                    ...body,
                    asset_id: asset.asset_id
                }, {
                    fallback: draft,
                    sourceMode: 'image_ai_admin',
                    requireApprovedAsset: true
                });

                return res.json({
                    success: true,
                    saved: true,
                    item: created,
                    ai_draft: draft
                });
            }

            return res.json({
                success: true,
                saved: false,
                ai_draft: draft
            });
        }
        // 9. VERIFICAR ESCRITURA A MANO ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â CUADERNO DE MATICO (NVIDIA Kimi K2.5 Vision)
        if (currentAction === 'verify_handwriting') {
            const {
                image,
                imageMimeType,
                pdf,
                pdfFileName,
                scanId,
                sessionId,
                topic: cuadernoTopic,
                readingContent: cuadernoReading
            } = body;
            const cuadernoSubject = (body.subject || 'MATEMATICA').toUpperCase();

            if (!image) {
                return res.status(400).json({ success: false, error: 'No se recibiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³ imagen' });
            }

            console.log(`[CUADERNO] Verificando escritura para ${cuadernoSubject} - Sesion ${sessionId}`);
            
            // 1. Guardar en el VPS inmediatamente
            let storedFile = null;
            
            try {
                if (pdf) {
                    const uniqueScanId = scanId || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                    const fileName = pdfFileName || `cuaderno_${user_id || 'anon'}_${cuadernoSubject}_S${sessionId || '0'}_${uniqueScanId}.pdf`;
                    storedFile = await saveBase64ToLocalFile(pdf, fileName, 'cuadernos');
                    console.log(`[LOCAL_STORAGE] ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ PDF escaneado guardado: ${storedFile.absolutePath}`);
                } else {
                    const uniqueScanId = scanId || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                    const fileName = `cuaderno_${user_id || 'anon'}_${cuadernoSubject}_S${sessionId || '0'}_${uniqueScanId}.jpg`;
                    storedFile = await saveBase64ToLocalFile(image, fileName, 'cuadernos');
                    console.log(`[LOCAL_STORAGE] ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ Imagen guardada: ${storedFile.absolutePath}`);
                }
            } catch (storageErr) {
                console.error(`[LOCAL_STORAGE] ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ Error guardando archivo: ${storageErr.message}`);
            }

            // 2. Responder al frontend inmediatamente para que no espere
            res.json({
                success: true,
                background: true,
                message: 'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡Documento escaneado guardado! Matico lo analizarÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ mientras sigues con el quiz.',
                stored_file_path: storedFile?.absolutePath || null,
                stored_file_url: storedFile?.publicUrl || null
            });

            // 3. PROCESAMIENTO EN SEGUNDO PLANO
            (async () => {
                try {
                    console.log('[CUADERNO-BG] Iniciando anÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lisis AI en segundo plano...');
                    const readingExcerpt = (cuadernoReading || '').substring(0, 2000);
                    const cuadernoPrompt = `Analiza esta foto de cuaderno manuscrito de un estudiante de 1ro Medio Chile.
TEMA: ${cuadernoTopic || 'Sesion de estudio'}
ASIGNATURA: ${cuadernoSubject}
CONTENIDO ORIGINAL DE LA LECCION:
${readingExcerpt}

INSTRUCCIONES:
1. Haz OCR de la imagen
2. Verifica que sea escritura A MANO (no captura de pantalla)
3. Compara con el contenido original
4. Identifica conceptos clave presentes y faltantes

CALIFICACION:
- "oro": Parafraseo con palabras propias, conceptos clave capturados, organizadores visuales
- "plata": Conceptos capturados pero muy parecido al original, falta alguno
- "insuficiente": Copia literal, ilegible, no es manuscrito, contenido incorrecto

RESPONDE SOLO CON JSON VALIDO:
{"success":true,"tier":"oro|plata|insuficiente","feedback":"Mensaje motivador 2-3 oraciones","suggestion":"Tip para mejorar","conceptos_detectados":["concepto1"],"conceptos_faltantes":["concepto"],"es_manuscrito":true,"tiene_organizadores":true}`;

                    let resultText = '';

                    if (process.env.NVIDIA_API_KEY) {
                        const nvidiaResponse = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                model: 'moonshotai/kimi-k2.5',
                                messages: [{
                                    role: 'user',
                                    content: [
                                        { type: 'text', text: cuadernoPrompt },
                                        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } }
                                    ]
                                }],
                                max_tokens: 2048,
                                temperature: 0.3
                            })
                        });

                        if (!nvidiaResponse.ok) {
                            const errText = await nvidiaResponse.text();
                            throw new Error(`NVIDIA API error: ${nvidiaResponse.status} - ${errText.substring(0, 100)}`);
                        }

                        const nvidiaData = await nvidiaResponse.json();
                        resultText = nvidiaData.choices?.[0]?.message?.content || '';
                    } else if (openaiVisionClient) {
                        const openaiResponse = await openaiVisionClient.chat.completions.create({
                            model: OPENAI_VISION_MODEL,
                            messages: [{
                                role: 'user',
                                content: [
                                    { type: 'text', text: cuadernoPrompt },
                                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } }
                                ]
                            }],
                            max_tokens: 2048,
                            temperature: 0.3
                        });
                        resultText = openaiResponse.choices?.[0]?.message?.content || '';
                    } else if (kimiVisionClient) {
                        const kimiResponse = await kimiVisionClient.chat.completions.create({
                            model: NOTEBOOK_VISION_MODEL,
                            messages: [{
                                role: 'user',
                                content: [
                                    { type: 'text', text: cuadernoPrompt },
                                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } }
                                ]
                            }],
                            max_tokens: 2048,
                            temperature: 0.3
                        });
                        resultText = kimiResponse.choices?.[0]?.message?.content || '';
                    } else {
                        console.error('[CUADERNO-BG] No hay proveedor visual configurado');
                        return;
                    }

                    resultText = resultText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

                    let result;
                    try {
                        result = JSON.parse(resultText);
                    } catch {
                        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
                        if (jsonMatch) result = JSON.parse(jsonMatch[0]);
                    }

                    if (result) {
                        console.log(`[CUADERNO-BG] Resultado: ${result.tier?.toUpperCase()}`);
                        const xpGained = result.tier === 'oro' ? 50 : (result.tier === 'plata' ? 30 : 0);
                        if (xpGained > 0) {
                            await logToSheet(sheets, user_id, cuadernoSubject, sessionId || '', 'cuaderno_completed', '', '', result.tier, '', xpGained, body.grade || '1medio', cuadernoTopic || '', '', 'cuaderno');
                            console.log(`[CUADERNO-BG] XP Registrado: ${xpGained} (${result.tier})`);
                        }
                    }
                } catch (bgError) {
                    console.error('[CUADERNO-BG] Error en anÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lisis diferido:', bgError.message);
                }
            })();

            return; // Ya respondimos arriba
        }

        // 10. READ-ONLY ACTIONS
        const readOnlyActions = ['update_preferences', 'ping', 'health'];
        if (readOnlyActions.includes(currentAction)) {
            return res.json({ success: true });
        }

        // FALLBACK
        console.log(`[MATICO] AcciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n no mapeada: "${currentAction}". Registrando...`);
        await logToSheet(sheets, user_id, data.subject, data.session, currentAction, data.phase, data.subLevel, data.levelName, data.score, data.xp_reward, data.grade || '1medio', data.topic || data.source_topic || '', data.total_questions || data.total || '', data.source_mode || data.mode || '');
        res.json({ success: true, message: `AcciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n "${currentAction}" registrada` });

    } catch (error) {
        console.error("Error Core:", error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================================================
// CRON: Recordatorio Diario a las 09:00 AM (Chile)
// ========================================================================
cron.schedule('0 9 * * *', async () => {
    console.log('[CRON] Ejecutando recordatorio matutino...');
    try {
        const sheets = await getSheetsClient();
        const users = await getAllUsersFromSheet(sheets);

        const startDate = new Date('2026-01-15'); // Fecha de inicio del curso
        const today = new Date();
        const daysDiff = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
        const sessionNumber = (daysDiff % 43) + 1; // Ciclo de 43 sesiones
        const topic = `SesiÃ³n ${sessionNumber} del dÃ­a`;
        const subject = 'MATEMATICA'; // Se podrÃ­a alternar por dÃ­a

        for (const user of users) {
            const html = buildDailyReminderHTMLClean(user.nombre, sessionNumber, topic, subject);
            const emailSubject = `Buenos dÃ­as ${user.nombre}: tu sesiÃ³n de ${subject} te espera`;

            if (user.email) {
                await sendEmailSafe(user.email, emailSubject, html);
            }
            if (user.correo_apoderado) {
                await sendEmailSafe(user.correo_apoderado, `Recordatorio: ${user.nombre} tiene sesiÃ³n hoy`, html);
            }
        }
        console.log(`[CRON] Recordatorios enviados a ${users.length} usuarios`);
    } catch (err) {
        console.error('[CRON] Error:', err.message);
    }
}, { timezone: 'America/Santiago' });

// ========================================================================
// CRON: Recordatorio de pruebas detectadas (D-7, D-2, D-1)
// ========================================================================
cron.schedule('30 8 * * *', async () => {
    try {
        const sheets = await getSheetsClient();
        const rows = await getExamReminderRows(sheets);
        const candidates = rows.filter((row) => String(row.status || '') === 'confirmed_scheduled');

        for (const row of candidates) {
            const examDate = normalizeExamDate(row.exam_date);
            const daysLeft = daysUntilExam(examDate);
            if (daysLeft === null || daysLeft < 0) continue;

            let stageKey = '';
            let alreadySent = false;

            if (daysLeft === 7) {
                stageKey = 'sent_d7';
                alreadySent = parseSheetBool(row.sent_d7);
            } else if (daysLeft === 2) {
                stageKey = 'sent_d2';
                alreadySent = parseSheetBool(row.sent_d2);
            } else if (daysLeft === 1) {
                stageKey = 'sent_d1';
                alreadySent = parseSheetBool(row.sent_d1);
            } else {
                continue;
            }

            if (alreadySent) continue;

            const guardianEmail = String(row.guardian_email || '').trim();
            if (!guardianEmail) continue;

            const studentName = row.student_name || 'Estudiante';
            const subject = row.subject || 'MATERIA';
            const title = row.title || 'Prueba';
            const planMarkdown = await generateExamReminderPlanAndPractice({
                studentName,
                subject,
                title,
                examDate,
                daysLeft
            });
            const html = buildExamReminderEmailHtml({
                studentName,
                subject,
                title,
                examDate,
                daysLeft,
                planMarkdown
            });

            await sendEmailSafe(
                guardianEmail,
                `Recordatorio Matico: ${subject} (${title}) en ${daysLeft} dia(s)`,
                html
            );

            await updateExamReminderRow(sheets, row.rowNumber, {
                [stageKey]: boolToSheet(true),
                last_sent_at: new Date().toISOString(),
                status: (parseSheetBool(row.sent_d7) || stageKey === 'sent_d7')
                    && (parseSheetBool(row.sent_d2) || stageKey === 'sent_d2')
                    && (parseSheetBool(row.sent_d1) || stageKey === 'sent_d1')
                    ? 'completed'
                    : 'confirmed_scheduled'
            });
        }
    } catch (error) {
        console.error('[CRON_EXAM_REMINDER] Error:', error.message);
    }
}, { timezone: 'America/Santiago' });

cron.schedule('30 13 * * *', async () => {
    try {
        const today = dateOnlyInSantiago();
        const targetDate = addDaysToDateOnly(today, 2);
        const { data: events, error } = await supabase
            .from('calendar_events')
            .select('*')
            .eq('event_date', targetDate)
            .in('event_type', ['prueba', 'tarea', 'estudio', 'repaso'])
            .neq('status', 'cancelado')
            .limit(500);
        if (error) throw error;

        for (const event of events || []) {
            const { data: existing } = await supabase
                .from('study_alerts')
                .select('alert_id')
                .eq('event_id', event.event_id)
                .eq('alert_type', 'event_d2_1330')
                .maybeSingle();
            if (existing) continue;

            const studentProfile = await getProfileByAnyId(event.student_user_id);
            const parentProfile = await resolveParentProfileForStudent(studentProfile || {});
            const title = `En 2 dias: ${event.title}`;
            const body = `${event.subject || 'Evento'} programado para ${event.event_date}${event.start_time ? ` a las ${event.start_time}` : ''}.`;
            await recordStudyAlert({
                student_user_id: event.student_user_id,
                parent_user_id: parentProfile?.user_id || '',
                subject: event.subject || '',
                alert_type: 'event_d2_1330',
                title,
                body,
                severity: event.event_type === 'prueba' ? 'high' : 'medium',
                event_id: event.event_id,
                payload: event
            });
            const push = await sendPushNotification({
                token: parentProfile?.fcm_token,
                title,
                body,
                payload: { type: 'event_d2', event_id: event.event_id }
            });
            let sentEmail = false;
            if (!push.ok && parentProfile?.email) {
                await sendEmailSafe(parentProfile.email, title, `<p>${escapeHtml(body)}</p>`);
                sentEmail = true;
            }
            if (parentProfile?.user_id) {
                await createSmartNotification({
                    user_id: parentProfile.user_id,
                    event_id: event.event_id,
                    type: 'event_d2_1330',
                    title,
                    body,
                    priority: event.event_type === 'prueba' ? 'high' : 'normal',
                    payload: event,
                    sent_push: push.ok,
                    sent_email: sentEmail,
                    sent_at: new Date().toISOString()
                });
            }
        }
    } catch (error) {
        console.error('[CRON_EVENT_D2_1330] Error:', error.message);
    }
}, { timezone: 'America/Santiago' });

cron.schedule('0 20 * * *', async () => {
    try {
        const reportDate = dateOnlyInSantiago();
        const { data: profileStudents } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('role', 'estudiante')
            .limit(500);
        const { data: legacyStudents } = await supabase
            .from('users')
            .select('token')
            .limit(500);
        const ids = new Set();
        (profileStudents || []).forEach(row => row?.user_id && ids.add(String(row.user_id)));
        (legacyStudents || []).forEach(row => row?.token && ids.add(String(row.token)));

        for (const student_user_id of ids) {
            try {
                await buildDailyReportForStudent({ student_user_id, report_date: reportDate, send: true });
            } catch (error) {
                console.error('[CRON_DAILY_REPORT] Error estudiante:', student_user_id, error.message);
            }
        }
    } catch (error) {
        console.error('[CRON_DAILY_REPORT] Error:', error.message);
    }
}, { timezone: 'America/Santiago' });

cron.schedule('15 3 * * *', async () => {
    try {
        const expiredCount = await cleanupExpiredNotebookSubmissions();
        console.log(`[CRON_NOTEBOOK] Limpieza de cuadernos completada. Expirados: ${expiredCount}`);
    } catch (error) {
        console.error('[CRON_NOTEBOOK] Error limpiando cuadernos:', error.message);
    }
}, { timezone: 'America/Santiago' });

// =====================================================================
// CALENDARIO / EVENTOS
// =====================================================================

app.post('/api/calendar/events', async (req, res) => {
    try {
        const event = await createCalendarEvent(req.body);

        // Crear notificaciones automáticas
        if (req.body.notify_guardian && req.body.student_user_id) {
            try {
                const studentProfile = await getUserProfile(req.body.student_user_id);
                if (studentProfile?.parent_user_id) {
                    await createNotification({
                        user_id: studentProfile.parent_user_id,
                        event_id: event.event_id,
                        type: 'info',
                        title: `Nuevo evento: ${req.body.title}`,
                        body: `${req.body.event_type} programado para ${req.body.event_date}${req.body.start_time ? ' a las ' + req.body.start_time : ''}`,
                        scheduled_at: new Date().toISOString()
                    });
                }
            } catch (notifErr) {
                console.error('[CALENDAR] Error creando notificación:', notifErr.message);
            }
        }

        res.json({ success: true, event });
    } catch (err) {
        console.error('[CALENDAR] Error creando evento:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

const normalizeCalendarText = (value = '') => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const calendarEventSignature = (event = {}) => [
    event.event_date || '',
    normalizeCalendarText(event.event_type || 'otro'),
    normalizeCalendarText(event.subject || ''),
    normalizeCalendarText(event.title || ''),
    normalizeCalendarText(event.description || ''),
    normalizeCalendarText(event.session_number || '')
].join('|');

const tokenSimilarity = (a = '', b = '') => {
    const aTokens = new Set(normalizeCalendarText(a).split(' ').filter(Boolean));
    const bTokens = new Set(normalizeCalendarText(b).split(' ').filter(Boolean));
    if (!aTokens.size || !bTokens.size) return 0;
    let intersection = 0;
    aTokens.forEach(token => {
        if (bTokens.has(token)) intersection += 1;
    });
    const union = new Set([...aTokens, ...bTokens]).size || 1;
    return intersection / union;
};

const CALENDAR_EVENT_STOPWORDS = new Set([
    'evaluacion', 'prueba', 'control', 'actividad', 'trabajo', 'tarea', 'disertacion',
    'presentacion', 'educacion', 'fisica', 'matematica', 'matematicas', 'lenguaje',
    'tecnologia', 'musica', 'historia', 'ciencias', 'artes', 'ingles', 'otro',
    'a', 'b', 'y', 'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'en',
    'para', 'con', 'por', 'se', 'debe', 'sobre', 'simple'
]);

const extractCalendarCourseTags = (event = {}) => {
    const text = normalizeCalendarText(`${event.title || ''} ${event.description || ''} ${event.course || ''} ${event.class || ''}`);
    const tags = new Set();
    const directMatches = text.matchAll(/\b([1-8])\s*(?:o|º|°)?\s*([ab])\b/g);
    for (const match of directMatches) tags.add(`${match[1]}${match[2]}`);

    const bothMatches = text.matchAll(/\b([1-8])\s*(?:o|º|°)?\s*a\s*y\s*b\b/g);
    for (const match of bothMatches) {
        tags.add(`${match[1]}a`);
        tags.add(`${match[1]}b`);
    }

    return [...tags].sort();
};

const calendarContentTokens = (event = {}) => {
    const subjectText = normalizeCalendarText(event.subject || '').split(' ');
    const subjectWords = new Set(subjectText.filter(Boolean));
    return normalizeCalendarText(`${event.title || ''} ${event.description || ''}`)
        .split(' ')
        .filter(token =>
            token.length > 2 &&
            !/^\d+$/.test(token) &&
            !/^[1-8][ab]$/.test(token) &&
            !CALENDAR_EVENT_STOPWORDS.has(token) &&
            !subjectWords.has(token)
        );
};

const calendarContentSimilarity = (candidate = {}, existing = {}) => {
    const aTokens = new Set(calendarContentTokens(candidate));
    const bTokens = new Set(calendarContentTokens(existing));
    if (!aTokens.size || !bTokens.size) return 0;

    let intersection = 0;
    aTokens.forEach(token => {
        if (bTokens.has(token)) intersection += 1;
    });

    const union = new Set([...aTokens, ...bTokens]).size || 1;
    const smaller = Math.min(aTokens.size, bTokens.size) || 1;
    return Math.max(intersection / union, intersection / smaller);
};

const isSameCalendarEvent = (candidate = {}, existing = {}) => {
    if ((candidate.event_date || '') !== (existing.event_date || '')) return false;
    if (normalizeCalendarText(candidate.subject || '') !== normalizeCalendarText(existing.subject || '')) return false;

    const candidateCourses = extractCalendarCourseTags(candidate);
    const existingCourses = extractCalendarCourseTags(existing);
    if (candidateCourses.length && existingCourses.length) {
        const hasSharedCourse = candidateCourses.some(course => existingCourses.includes(course));
        if (!hasSharedCourse) return false;
    }

    const candidateTitle = normalizeCalendarText(candidate.title || '');
    const existingTitle = normalizeCalendarText(existing.title || '');
    const candidateDescription = normalizeCalendarText(candidate.description || '');
    const existingDescription = normalizeCalendarText(existing.description || '');

    if (candidateTitle && existingTitle && candidateTitle === existingTitle) return true;
    if (candidateDescription && existingDescription && candidateDescription === existingDescription) return true;

    const candidateBody = `${candidate.title || ''} ${candidate.description || ''}`;
    const existingBody = `${existing.title || ''} ${existing.description || ''}`;
    return tokenSimilarity(candidateBody, existingBody) >= 0.68 ||
        calendarContentSimilarity(candidate, existing) >= 0.55;
};

// Smart event creation via AI Vision
app.post('/api/calendar/smart-create', upload.fields([
    { name: 'images', maxCount: SMART_CREATE_MAX_IMAGES },
    { name: 'image', maxCount: SMART_CREATE_MAX_IMAGES }
]), async (req, res) => {
    try {
        const { user_id, student_user_id, text_input, role, dry_run, events_json } = req.body;
        if (!user_id) return res.status(400).json({ success: false, error: 'Falta user_id' });

        const today = new Date().toISOString().split('T')[0];
        let eventsArray = [];

        if (events_json) {
            try {
                const parsedEvents = JSON.parse(events_json);
                eventsArray = Array.isArray(parsedEvents) ? parsedEvents : [];
            } catch {
                return res.status(400).json({ success: false, error: 'Lista de eventos invalida' });
            }
        }

        if (eventsArray.length === 0) {
            const visionClient = openaiVisionClient || kimiVisionClient;
            if (!visionClient) return res.status(500).json({ success: false, error: 'No hay cliente de IA Vision configurado' });

            // Build the prompt
            const systemPrompt = `Eres un asistente experto en OCR que analiza calendarios e imágenes escolares chilenas.
Tu trabajo: leer ABSOLUTAMENTE TODO el texto de la imagen y extraer CADA evento escolar como JSON.

Fecha de hoy: ${today}
Año escolar: ${today.substring(0, 4)}

PROCESO OBLIGATORIO PASO A PASO:
1. PRIMERO identifica el mes y año del calendario (ej: MAYO 2026)
2. Identifica las columnas (LUNES=col1, MARTES=col2, MIÉRCOLES=col3, JUEVES=col4, VIERNES=col5)
3. Identifica los números de día en cada celda
4. Lee el texto de CADA celda que tenga contenido, fila por fila, de izquierda a derecha
5. Para cada texto encontrado, crea un evento con la fecha exacta (año-mes-día)

TIPOS DE EVENTOS A DETECTAR:
- EVALUACIÓN/PRUEBA de cualquier materia → event_type: "prueba"
- Educación Física (actividad, no evaluación) → event_type: "otro"
- Disertación/Presentación → event_type: "tarea"
- Trabajo grupal → event_type: "tarea"
- FERIADO/DIA ESPECIAL → NO incluir como evento

IMPORTANTE:
- NO omitas ningún evento. Si hay 15 eventos en la imagen, debes retornar 15.
- Cada celda puede tener MÚLTIPLES eventos (separados por saltos de línea o títulos en negrita)
- Lee texto pequeño, texto en negrita, texto normal, TODO.
- Si una celda dice "EVALUACIÓN LENGUAJE: 2° A y B" eso es UN evento tipo prueba.
- Si una celda dice "EVALUACIÓN MATEMÁTICA: 2° A y B" y debajo "EVALUACIÓN MÚSICA: 2°B", eso son DOS eventos.

Responde SOLO con JSON válido, sin markdown:
{
  "events": [
    {
      "title": "nombre claro del evento",
      "event_type": "prueba|tarea|estudio|repaso|otro",
      "subject": "MATEMATICA|LENGUAJE|CIENCIAS|HISTORIA|INGLES|FISICA|QUIMICA|BIOLOGIA|ARTES|MUSICA|EDUCACION_FISICA|TECNOLOGIA|OTRO",
      "event_date": "YYYY-MM-DD",
      "start_time": null,
      "end_time": null,
      "description": "contenidos/detalles exactos copiados de la imagen",
      "confidence": "alta|media|baja"
    }
  ]
}`;

            const messages = [{ role: 'system', content: systemPrompt }];
            const userContent = [];

            // Add text if provided
            if (text_input) {
                userContent.push({ type: 'text', text: text_input });
            }

            const uploadedImages = [
                ...(Array.isArray(req.files?.images) ? req.files.images : []),
                ...(Array.isArray(req.files?.image) ? req.files.image : []),
                ...(req.file ? [req.file] : [])
            ].slice(0, SMART_CREATE_MAX_IMAGES);

            // Add images if provided
            uploadedImages.forEach((file, index) => {
                const base64 = file.buffer.toString('base64');
                const mimeType = file.mimetype || 'image/jpeg';
                userContent.push({
                    type: 'text',
                    text: `Imagen ${index + 1} de ${uploadedImages.length}.`
                });
                userContent.push({
                    type: 'image_url',
                    image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' }
                });
            });

            if (userContent.length === 0) {
                return res.status(400).json({ success: false, error: 'Debes enviar una imagen o texto' });
            }

            if (uploadedImages.length > 0) {
                userContent.unshift({
                    type: 'text',
                    text: 'Analiza estas imagenes como un registro escolar integral. Lee CADA celda, CADA linea y CADA bloque de texto de TODAS las imagenes, aunque el usuario mencione prueba, tarea o un tipo especifico. Extrae TODOS los antecedentes agendables como eventos separados: evaluaciones, tareas, trabajos, disertaciones, presentaciones, tecnologia, musica, artes, educacion fisica, recordatorios y cualquier actividad escolar con fecha. No te quedes solo con un ramo ni con un solo evento.'
                });
            }

            messages.push({ role: 'user', content: userContent });

            console.log('[SMART-CREATE] Analizando con IA...', { imageCount: uploadedImages.length, hasText: !!text_input });

            const model = openaiVisionClient ? OPENAI_VISION_MODEL : NOTEBOOK_VISION_MODEL;
            const response = await visionClient.chat.completions.create({
                model,
                messages,
                max_tokens: 4000,
                temperature: 0.1
            });

            const raw = response.choices?.[0]?.message?.content || '';
            console.log('[SMART-CREATE] Respuesta IA:', raw);

            // Parse JSON from response
            let parsed;
            try {
                const jsonMatch = raw.match(/\{[\s\S]*\}/);
                parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
            } catch (parseErr) {
                console.error('[SMART-CREATE] Error parseando JSON:', parseErr.message);
                return res.json({
                    success: false,
                    error: 'No se pudo interpretar la imagen/texto. Intenta con una foto mas clara o escribe los detalles.',
                    raw_response: raw
                });
            }

            // Normalize: support both single event (legacy) and multiple events
            eventsArray = Array.isArray(parsed.events) ? parsed.events
                : (parsed.title ? [parsed] : []);
        }

        if (eventsArray.length === 0) {
            return res.json({
                success: false,
                error: 'No se encontraron eventos en la imagen. Intenta con una foto mas clara.'
            });
        }

        if (String(dry_run || '').toLowerCase() === 'true') {
            return res.json({
                success: true,
                preview_only: true,
                events: eventsArray,
                total_found: eventsArray.length,
                message: `${eventsArray.length} evento(s) encontrados para revisar`
            });
        }

        const targetUserId = student_user_id || user_id;
        const createdEvents = [];
        const skippedDuplicates = [];
        const batchSignatures = new Set();
        const errors = [];
        const detectedYears = eventsArray
            .map(eventData => String(eventData.event_date || '').slice(0, 4))
            .filter(year => /^\d{4}$/.test(year));
        const minYear = detectedYears.length ? Math.min(...detectedYears.map(Number)) : Number(today.substring(0, 4));
        const maxYear = detectedYears.length ? Math.max(...detectedYears.map(Number)) : Number(today.substring(0, 4));
        const existingEvents = await listCalendarEvents({
            user_id: targetUserId,
            role: 'estudiante',
            from_date: `${minYear}-01-01`,
            to_date: `${maxYear}-12-31`,
            limit: 1000
        });

        for (const eventData of eventsArray) {
            try {
                const normalizedEvent = {
                    student_user_id: targetUserId,
                    created_by: user_id,
                    title: eventData.title || 'Evento sin título',
                    event_type: eventData.event_type || 'otro',
                    subject: eventData.subject || null,
                    event_date: eventData.event_date || today,
                    start_time: eventData.start_time || null,
                    end_time: eventData.end_time || null,
                    description: eventData.description || null
                };
                const signature = calendarEventSignature(normalizedEvent);
                const duplicateInBatch = batchSignatures.has(signature);
                const duplicateExisting = existingEvents.some(existing => isSameCalendarEvent(normalizedEvent, existing));

                if (duplicateInBatch || duplicateExisting) {
                    skippedDuplicates.push({
                        ...eventData,
                        reason: duplicateInBatch ? 'duplicado_en_imagen' : 'ya_existia'
                    });
                    continue;
                }

                const event = await createCalendarEvent(normalizedEvent);
                batchSignatures.add(signature);
                existingEvents.push({ ...normalizedEvent, event_id: event?.event_id });
                createdEvents.push({ ...eventData, event_id: event?.event_id });
            } catch (evErr) {
                console.error('[SMART-CREATE] Error creando evento:', evErr.message);
                errors.push(`${eventData.title}: ${evErr.message}`);
            }
        }

        // Auto-notify guardian if student created it
        if (role !== 'apoderado' && createdEvents.length > 0) {
            try {
                const studentProfile = await getUserProfile(targetUserId);
                if (studentProfile?.parent_user_id) {
                    await createNotification({
                        user_id: studentProfile.parent_user_id,
                        event_id: createdEvents[0]?.event_id,
                        type: 'nuevo_evento',
                        title: `${createdEvents.length} evento(s) creado(s)`,
                        body: createdEvents.map(e => e.title).join(', '),
                        scheduled_at: new Date().toISOString()
                    });
                }
            } catch (notifErr) {
                console.error('[SMART-CREATE] Error notificando:', notifErr.message);
            }
        }

        res.json({
            success: true,
            event: createdEvents[0] || null,
            events: createdEvents,
            extracted: createdEvents[0] || null,
            total_created: createdEvents.length,
            total_found: eventsArray.length,
            total_skipped_duplicates: skippedDuplicates.length,
            skipped_duplicates: skippedDuplicates,
            errors: errors.length > 0 ? errors : undefined,
            message: createdEvents.length === 0 && skippedDuplicates.length > 0
                ? `${skippedDuplicates.length} evento(s) ya existian, no se duplicaron`
                : createdEvents.length === 1
                ? `Evento "${createdEvents[0].title}" creado para ${createdEvents[0].event_date}`
                : `${createdEvents.length} eventos creados desde la imagen${skippedDuplicates.length ? `, ${skippedDuplicates.length} duplicado(s) omitidos` : ''}`
        });

    } catch (err) {
        console.error('[SMART-CREATE] Error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/calendar/dedupe', async (req, res) => {
    try {
        const { user_id, role = 'estudiante', from_date, to_date, dry_run } = req.body;
        if (!user_id) return res.status(400).json({ success: false, error: 'Falta user_id' });

        const events = await listCalendarEvents({
            user_id,
            role,
            from_date,
            to_date,
            limit: 2000
        });

        const keep = [];
        const duplicates = [];

        for (const event of events) {
            const existing = keep.find(candidate => isSameCalendarEvent(event, candidate));
            if (existing) {
                duplicates.push({
                    event_id: event.event_id,
                    title: event.title,
                    event_date: event.event_date,
                    subject: event.subject,
                    duplicate_of: existing.event_id
                });
            } else {
                keep.push(event);
            }
        }

        if (String(dry_run || '').toLowerCase() !== 'true') {
            for (const duplicate of duplicates) {
                await deleteCalendarEvent(duplicate.event_id);
            }
        }

        res.json({
            success: true,
            total_events: events.length,
            total_duplicates: duplicates.length,
            deleted: String(dry_run || '').toLowerCase() === 'true' ? 0 : duplicates.length,
            duplicates
        });
    } catch (err) {
        console.error('[CALENDAR] Error limpiando duplicados:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Admin: borrar todos los eventos de un usuario (solo admin)
app.delete('/api/calendar/events/purge', async (req, res) => {
    try {
        const { user_id, admin_email } = req.query;
        const ADMIN_EMAILS = ['joseantonio.olguinr@gmail.com'];
        if (!ADMIN_EMAILS.includes(admin_email)) {
            return res.status(403).json({ success: false, error: 'No autorizado' });
        }
        if (!user_id) return res.status(400).json({ success: false, error: 'Falta user_id' });

        const { data, error } = await supabase
            .from('calendar_events')
            .delete()
            .or(`created_by.eq.${user_id},student_user_id.eq.${user_id}`)
            .select();

        if (error) throw error;
        res.json({ success: true, deleted: data?.length || 0 });
    } catch (err) {
        console.error('[PURGE] Error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/calendar/events', async (req, res) => {
    try {
        const { user_id, role, from_date, to_date, status, limit } = req.query;
        if (!user_id) return res.status(400).json({ success: false, error: 'Falta user_id' });

        const events = await listCalendarEvents({
            user_id,
            role: role || 'estudiante',
            from_date, to_date, status,
            limit: Number(limit) || 50
        });
        res.json({ success: true, events });
    } catch (err) {
        console.error('[CALENDAR] Error listando eventos:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.put('/api/calendar/events/:event_id', async (req, res) => {
    try {
        const event = await updateCalendarEvent(req.params.event_id, req.body);
        res.json({ success: true, event });
    } catch (err) {
        console.error('[CALENDAR] Error actualizando evento:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/calendar/events/:event_id', async (req, res) => {
    try {
        await deleteCalendarEvent(req.params.event_id);
        res.json({ success: true });
    } catch (err) {
        console.error('[CALENDAR] Error eliminando evento:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Admin: vincular hijo a apoderado
app.post('/api/admin/link-child', requireAdmin, async (req, res) => {
    try {
        const { child_user_id, parent_user_id } = req.body;
        if (!child_user_id || !parent_user_id) return res.status(400).json({ success: false, error: 'Faltan parametros' });

        // Check if child exists in profiles
        let { data: existing } = await supabase.from('profiles').select('*').eq('user_id', child_user_id).maybeSingle();

        // If not in profiles, check legacy users table and migrate
        if (!existing) {
            const { data: legacyUser } = await supabase.from('users').select('*').eq('token', child_user_id).maybeSingle();
            if (legacyUser) {
                console.log('[LINK-CHILD] Migrando usuario legacy a profiles:', child_user_id);
                const { data: migrated, error: migrateErr } = await supabase.from('profiles').upsert({
                    user_id: legacyUser.token,
                    email: legacyUser.mail || legacyUser.email || '',
                    display_name: legacyUser.nombre || legacyUser.name || 'Estudiante',
                    password_hash: legacyUser.pass || legacyUser.password || '',
                    phone: legacyUser.celular || '',
                    region: legacyUser.region || '',
                    commune: legacyUser.comuna || '',
                    guardian_email: legacyUser.correo_apoderado || '',
                    role: 'estudiante',
                    parent_user_id: parent_user_id
                }, { onConflict: 'user_id' }).select().single();
                if (migrateErr) throw new Error(`Error migrando usuario: ${migrateErr.message}`);
                return res.json({ success: true, updated: migrated, migrated_from_legacy: true });
            }
            return res.status(404).json({ success: false, error: 'Hijo no encontrado en profiles ni en users' });
        }

        // Update existing profile
        const { data, error } = await supabase
            .from('profiles')
            .update({ parent_user_id, role: 'estudiante' })
            .eq('user_id', child_user_id)
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, updated: data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Perfil y relaciones apoderado-hijo
app.get('/api/profile', async (req, res) => {
    try {
        const { user_id } = req.query;
        if (!user_id) return res.status(400).json({ success: false, error: 'Falta user_id' });
        const profile = await getUserProfile(user_id);
        if (!profile) return res.status(404).json({ success: false, error: 'Perfil no encontrado' });

        let children = [];
        if (profile.role === 'apoderado') {
            children = await getChildrenProfiles(user_id);
        }
        res.json({ success: true, profile, children });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =====================================================================
// MIGRACIÓN: Google Sheets progress_log → Supabase progress_log
// =====================================================================
app.post('/api/admin/migrate-sheets-to-supabase', requireAdmin, async (req, res) => {
    try {
        const { dry_run = false } = req.body;

        console.log('[MIGRATION] Iniciando migración de Google Sheets → Supabase...');

        // 1. Leer todo el Sheet
        const sheets = await getSheetsClient();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'progress_log!A:U'
        });
        const allRows = response.data.values || [];
        // Skip header row
        const dataRows = allRows.length > 1 ? allRows.slice(1) : allRows;
        console.log(`[MIGRATION] Filas totales en Sheet: ${dataRows.length}`);

        // 2. Leer IDs existentes en Supabase para evitar duplicados
        const { data: existingRows, error: fetchErr } = await supabase
            .from('progress_log')
            .select('user_id, event_type, created_at, session, subject')
            .limit(10000);
        if (fetchErr) console.warn('[MIGRATION] Error leyendo existentes:', fetchErr.message);

        // Build a fingerprint set to detect duplicates
        const existingFingerprints = new Set();
        (existingRows || []).forEach(r => {
            const fp = `${r.user_id}|${r.event_type}|${r.session}|${r.subject}|${String(r.created_at || '').substring(0, 16)}`;
            existingFingerprints.add(fp);
        });
        console.log(`[MIGRATION] Registros existentes en Supabase: ${existingFingerprints.size}`);

        // 3. Mapear filas del Sheet al schema de Supabase
        // PROGRESS_LOG_HEADERS:
        // 0=timestamp, 1=user_id, 2=subject, 3=session, 4=event_type,
        // 5=phase, 6=subLevel, 7=levelName, 8=score, 9=xp,
        // 10=grade, 11=topic, 12=totalQuestions, 13=sourceMode,
        // 14=batchIndex, 15=batchSize, 16=correctAnswers, 17=wrongAnswers,
        // 18=wrongQuestionDetails, 19=weakness, 20=improvementPlan
        const toInsert = [];
        const skipped = [];

        for (const row of dataRows) {
            const timestamp = row[0] || null;
            const user_id = row[1] || null;
            const event_type = row[4] || null;
            const session = row[3] || null;
            const subject = row[2] || null;

            if (!user_id) { skipped.push({ reason: 'no user_id', row: row.slice(0, 5) }); continue; }

            // Check duplicate
            const fp = `${user_id}|${event_type}|${session}|${subject}|${String(timestamp || '').substring(0, 16)}`;
            if (existingFingerprints.has(fp)) {
                skipped.push({ reason: 'duplicate', user_id, event_type, session });
                continue;
            }

            const safeNum = (val) => val !== '' && val != null && !isNaN(Number(val)) ? Number(val) : null;
            const safeStr = (val) => (val && String(val).trim()) || null;
            const safeJson = (val) => {
                if (!val || String(val).trim() === '') return null;
                try { return JSON.parse(val); } catch { return String(val); }
            };

            toInsert.push({
                created_at: timestamp || new Date().toISOString(),
                user_id,
                user_email: null,
                grade: safeStr(row[10]),
                subject: safeStr(row[2]),
                session: safeNum(row[3]),
                phase: safeNum(row[5]),
                sub_level: safeStr(row[6]),
                level_name: safeStr(row[7]),
                event_type: safeStr(row[4]),
                score: safeNum(row[8]),
                xp: safeNum(row[9]),
                topic: safeStr(row[11]),
                total_questions: safeNum(row[12]),
                correct_answers: safeNum(row[16]),
                wrong_answers: safeNum(row[17]),
                wrong_question_details: safeJson(row[18]),
                weakness: safeJson(row[19]),
                improvement_plan: safeJson(row[20]),
                source_mode: safeStr(row[13]) || 'migrated_from_sheets',
                batch_index: safeNum(row[14]),
                batch_size: safeNum(row[15]),
            });
        }

        console.log(`[MIGRATION] Para insertar: ${toInsert.length}, Omitidos: ${skipped.length}`);

        if (dry_run) {
            return res.json({
                success: true,
                dry_run: true,
                total_sheet_rows: dataRows.length,
                to_insert: toInsert.length,
                skipped: skipped.length,
                skipped_reasons: skipped.slice(0, 20),
                sample_rows: toInsert.slice(0, 5)
            });
        }

        // 4. Insertar en batches de 50
        let inserted = 0;
        let errors = [];
        const BATCH_SIZE = 50;
        for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
            const batch = toInsert.slice(i, i + BATCH_SIZE);
            const { error: insertErr } = await supabase.from('progress_log').insert(batch);
            if (insertErr) {
                console.error(`[MIGRATION] Error batch ${i}-${i + batch.length}:`, insertErr.message);
                errors.push({ batch_start: i, error: insertErr.message });
            } else {
                inserted += batch.length;
            }
        }

        console.log(`[MIGRATION] Completado. Insertados: ${inserted}, Errores: ${errors.length}`);
        res.json({
            success: true,
            total_sheet_rows: dataRows.length,
            inserted,
            skipped: skipped.length,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (err) {
        console.error('[MIGRATION] Error general:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/parent/daily-report', async (req, res) => {
    try {
        const { student_user_id, report_date, send } = req.query;
        const report = await buildDailyReportForStudent({
            student_user_id,
            report_date: report_date || dateOnlyInSantiago(),
            send: String(send || '').toLowerCase() === 'true'
        });
        res.json({ success: true, report });
    } catch (err) {
        console.error('[DAILY_REPORT] Error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/parent/student-history', async (req, res) => {
    try {
        const { student_user_id, student_email, parent_email, limit } = req.query;
        const maxRows = Math.min(Number(limit) || 300, 500);
        const idSet = new Set([student_user_id].filter(Boolean).map(String));
        const email = String(student_email || '').trim().toLowerCase();
        const parentEmail = String(parent_email || '').trim().toLowerCase();
        const canUseEmailFallback = Boolean(email && email !== parentEmail);

        if (!idSet.size && !email) {
            return res.status(400).json({ success: false, error: 'Falta student_user_id o student_email' });
        }

        const addIdentityAliases = async () => {
            const emails = new Set();
            if (email) emails.add(email);

            for (const id of [...idSet]) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('user_id,email')
                    .eq('user_id', id)
                    .maybeSingle();
                if (profile?.user_id) idSet.add(String(profile.user_id));
                if (profile?.email) emails.add(String(profile.email).trim().toLowerCase());

                const { data: legacyByToken } = await supabase
                    .from('users')
                    .select('token,mail')
                    .eq('token', id)
                    .maybeSingle();
                if (legacyByToken?.token) idSet.add(String(legacyByToken.token));
                if (legacyByToken?.mail) emails.add(String(legacyByToken.mail).trim().toLowerCase());
            }

            for (const candidateEmail of emails) {
                if (!candidateEmail || candidateEmail === parentEmail) continue;

                const { data: profilesByEmail } = await supabase
                    .from('profiles')
                    .select('user_id,email')
                    .ilike('email', candidateEmail);
                (profilesByEmail || []).forEach(row => {
                    if (row?.user_id) idSet.add(String(row.user_id));
                });

                const { data: legacyByEmail } = await supabase
                    .from('users')
                    .select('token,mail')
                    .ilike('mail', candidateEmail);
                (legacyByEmail || []).forEach(row => {
                    if (row?.token) idSet.add(String(row.token));
                });
            }
        };

        await addIdentityAliases();
        const ids = [...idSet];

        const mergeRows = (rows, keyName) => {
            const seen = new Set();
            return (rows || []).filter((row) => {
                const key = row?.[keyName] || row?.id || row?.created_at || JSON.stringify(row);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        };

        const readByIdentity = async ({ table, idColumn = 'user_id', emailColumn = 'user_email', select = '*', order = 'created_at' }) => {
            const batches = [];

            for (const id of ids) {
                const { data, error } = await supabase
                    .from(table)
                    .select(select)
                    .eq(idColumn, id)
                    .order(order, { ascending: false })
                    .limit(maxRows);
                if (!error && data?.length) batches.push(...data);
            }

            if (canUseEmailFallback && emailColumn) {
                const { data, error } = await supabase
                    .from(table)
                    .select(select)
                    .ilike(emailColumn, email)
                    .order(order, { ascending: false })
                    .limit(maxRows);
                if (!error && data?.length) batches.push(...data);
            }

            return mergeRows(batches, table === 'calendar_events' || table === 'exam_reminders' ? 'event_id' : 'id');
        };

        const safeRead = async (config) => {
            try {
                return await readByIdentity(config);
            } catch (err) {
                console.warn(`[PARENT-HISTORY] ${config.table} omitido:`, err.message);
                return [];
            }
        };

        const [
            progressRows,
            quizRows,
            calendarRows,
            reminderRows,
            notebookRows,
            ocrRows,
            reportRows,
            alertRows,
            studyRowsModern,
            studyRowsLegacy
        ] = await Promise.all([
            safeRead({ table: 'progress_log', idColumn: 'user_id', emailColumn: 'user_email' }),
            safeRead({ table: 'quiz_results', idColumn: 'user_id', emailColumn: 'user_email' }),
            safeRead({ table: 'calendar_events', idColumn: 'student_user_id', emailColumn: null, order: 'created_at' }),
            safeRead({ table: 'exam_reminders', idColumn: 'user_id', emailColumn: 'student_email' }),
            safeRead({ table: 'notebook_submissions', idColumn: 'user_id', emailColumn: 'user_email' }),
            safeRead({ table: 'notebook_ocr_records', idColumn: 'user_id', emailColumn: 'user_email' }),
            safeRead({ table: 'daily_reports', idColumn: 'student_user_id', emailColumn: null, order: 'created_at' }),
            safeRead({ table: 'study_alerts', idColumn: 'student_user_id', emailColumn: null, order: 'created_at' }),
            safeRead({ table: 'study_sessions', idColumn: 'student_user_id', emailColumn: null, order: 'start_time' }),
            safeRead({ table: 'study_sessions', idColumn: 'user_id', emailColumn: 'user_email' })
        ]);

        const studyRows = mergeRows([...studyRowsModern, ...studyRowsLegacy], 'session_id');
        const parseMaybeJson = (value, fallback = null) => {
            if (value === null || value === undefined || value === '') return fallback;
            if (typeof value !== 'string') return value;
            try { return JSON.parse(value); } catch { return value; }
        };
        const dateOnly = (value = '') => String(value || '').slice(0, 10);
        const normalizeSubject = (value = '') => normalizeSubjectCode(value || '').toUpperCase();
        const sessionKey = (value = '') => String(value || '').split(',').map(v => v.trim()).filter(Boolean).join(',');
        const toNumberOrNull = (value) => {
            const n = Number(value);
            return Number.isFinite(n) ? n : null;
        };
        const buildScoreFields = (row = {}) => {
            const total = toNumberOrNull(row.total_questions);
            const directCorrect = row.correct_answers !== null && row.correct_answers !== undefined
                ? toNumberOrNull(row.correct_answers)
                : null;
            const wrongDirect = toNumberOrNull(row.wrong_answers);
            const score = toNumberOrNull(row.score);
            // Si hay wrong_answers explícito y total, derivar correct desde wrong (más confiable)
            let correct;
            if (total !== null && wrongDirect !== null && wrongDirect >= 0) {
                correct = Math.max(0, total - wrongDirect);
            } else if (total && directCorrect === null && score !== null && score <= total) {
                correct = score;
            } else {
                correct = directCorrect;
            }
            const wrong = total !== null && correct !== null ? Math.max(0, total - correct) : wrongDirect;
            const percent = total && correct !== null ? Math.round((correct / total) * 100) : (score !== null && !total ? score : null);
            return { total, correct, wrong, percent };
        };
        const describePrepSource = (sourceMode = '', hasEvidence = false) => {
            const mode = String(sourceMode || '').trim();
            if (mode === 'oracle_notebook') return 'Externa: creada desde guia/cuaderno/foto subida al Oraculo';
            if (mode === 'oracle_manual_evidence') return 'Externa: Oraculo por tema/libro con evidencia adjunta';
            if (mode === 'oracle_manual') return 'Externa: Oraculo por tema, libro o solicitud libre';
            if (mode === 'prep_exam_evidence' || hasEvidence) return 'Externa: preparacion con guia, imagen o antecedente adjunto';
            if (mode === 'prep_exam') return 'Ruta normal: sesiones Matico seleccionadas';
            return mode ? `Origen: ${mode}` : '';
        };
        const describeCalendarSource = (row = {}) => {
            const isFuture = row.event_date && row.event_date >= dateOnlyInSantiago();
            const label = isFuture
                ? 'Evento de calendario: sirve para recordar y preparar estudio antes de la fecha.'
                : 'Evento de calendario registrado.';
            return { label, reason: '', isExternal: false };
        };
        const hasEvidenceOnDay = (subject, day) => [...notebookRows, ...ocrRows].some(row =>
            dateOnly(row.created_at) === day && (!subject || normalizeSubject(row.subject || row.metadata?.subject || '') === subject)
        );
        // Cross-reference: teoría lúdica (quiz/progress activity) on same subject+day
        const hasTeoriaLudicaOnDay = (subject, day) => {
            if (!subject || !day) return false;
            return [...progressRows, ...quizRows].some(row => {
                const rowSubject = normalizeSubject(row.subject || '');
                const rowDay = dateOnly(row.created_at);
                const eventType = String(row.event_type || row.type || '').toLowerCase();
                const isQuizLike = eventType.includes('quiz') || eventType.includes('eval') || eventType.includes('prep_exam') || row.total_questions > 0;
                return rowDay === day && rowSubject === subject && isQuizLike;
            });
        };
        // Cross-reference: cuaderno OCR on same subject+day + best similarity score
        const getCuadernoInfoOnDay = (subject, day) => {
            if (!subject || !day) return { has_cuaderno: false, cuaderno_similarity: null };
            const matches = ocrRows.filter(row => {
                const rowSubject = normalizeSubject(row.subject || '');
                const rowDay = dateOnly(row.created_at);
                return rowDay === day && rowSubject === subject;
            });
            if (!matches.length) return { has_cuaderno: false, cuaderno_similarity: null };
            const bestScore = matches.reduce((best, row) => {
                const s = row.interpretation_score != null ? Number(row.interpretation_score) : null;
                return s != null && (best === null || s > best) ? s : best;
            }, null);
            return { has_cuaderno: true, cuaderno_similarity: bestScore };
        };
        const evidenceSummaryFor = (subject, day) => {
            const matches = [
                ...notebookRows.map(row => ({ kind: 'imagen/pdf', subject: row.metadata?.subject || '', date: row.created_at })),
                ...ocrRows.map(row => ({ kind: 'OCR cuaderno', subject: row.subject || '', date: row.created_at, score: row.interpretation_score }))
            ].filter(row => dateOnly(row.date) === day && (!subject || normalizeSubject(row.subject || '') === subject));
            if (!matches.length) return '';
            return matches.map(row => row.score != null ? `${row.kind} (${row.score}%)` : row.kind).join(', ');
        };
        const progressItems = progressRows.map(row => {
            const scoreFields = buildScoreFields(row);
            const wrongQuestionDetails = parseMaybeJson(row.wrong_question_details, []);
            const weakness = parseMaybeJson(row.weakness, '');
            const improvementPlan = parseMaybeJson(row.improvement_plan, '');
            const subject = normalizeSubject(row.subject || '');
            const day = dateOnly(row.created_at);
            const sourceMode = String(row.source_mode || '').trim();
            const activityGroupId = `${row.event_type || 'progress'}|${subject}|${sessionKey(row.session)}|${day}`;
            const hasEvidence = hasEvidenceOnDay(subject, day);
            return {
                id: `progress-${row.id || row.created_at}`,
                source: 'progress',
                type: row.event_type || 'progreso',
                title: row.topic || row.level_name || row.subject || 'Actividad registrada',
                subject,
                session: row.session || null,
                date: row.created_at,
                score: scoreFields.percent,
                score_percent: scoreFields.percent,
                xp: row.xp || 0,
                detail: scoreFields.total ? `${scoreFields.correct || 0}/${scoreFields.total} correctas, ${scoreFields.wrong || 0} incorrectas` : '',
                total_questions: scoreFields.total,
                correct_answers: scoreFields.correct,
                wrong_answers: scoreFields.wrong,
                wrong_question_details: wrongQuestionDetails,
                weakness,
                improvement_plan: improvementPlan,
                evidence_summary: evidenceSummaryFor(subject, day),
                has_evidence: hasEvidence,
                activity_group_id: activityGroupId,
                metadata: {
                    level_name: row.level_name || '',
                    source_mode: sourceMode,
                    source_label: describePrepSource(sourceMode, hasEvidence),
                    is_external_source: ['oracle_notebook', 'oracle_manual', 'oracle_manual_evidence', 'prep_exam_evidence'].includes(sourceMode) || (String(row.event_type || '').startsWith('prep_exam') && hasEvidence),
                    selected_sessions: row.selected_sessions || row.session || '',
                    raw_score: row.score
                }
            };
        });

        const prepGroups = new Map();
        progressItems.forEach(item => {
            if (!String(item.type || '').startsWith('prep_exam_')) return;
            const key = `prep_exam|${item.subject}|${sessionKey(item.session)}|${dateOnly(item.date)}`;
            const current = prepGroups.get(key) || {
                ...item,
                id: `prep-${key}`,
                source: 'progress',
                type: 'prep_exam_activity',
                title: item.title || 'Ensayo de prueba',
                started_count: 0,
                completed_count: 0,
                attempts: [],
                metadata: { ...(item.metadata || {}) },
                activity_group_id: key
            };
            current.date = String(item.date || '') > String(current.date || '') ? item.date : current.date;
            current.started_count += item.type === 'prep_exam_started' ? 1 : 0;
            current.completed_count += item.type === 'prep_exam_completed' ? 1 : 0;
            current.attempts.push(item);
            if (item.type === 'prep_exam_completed') {
                current.title = item.title || current.title;
                current.score = item.score;
                current.score_percent = item.score_percent;
                current.total_questions = item.total_questions;
                current.correct_answers = item.correct_answers;
                current.wrong_answers = item.wrong_answers;
                current.detail = item.detail;
                current.wrong_question_details = item.wrong_question_details;
                current.weakness = item.weakness;
                current.improvement_plan = item.improvement_plan;
                current.xp = item.xp;
                current.metadata = { ...(current.metadata || {}), ...(item.metadata || {}) };
            }
            current.evidence_summary = current.evidence_summary || item.evidence_summary;
            current.has_evidence = current.has_evidence || item.has_evidence;
            current.metadata = {
                ...(current.metadata || {}),
                source_label: current.metadata?.source_label || item.metadata?.source_label || '',
                is_external_source: Boolean(current.metadata?.is_external_source || item.metadata?.is_external_source)
            };
            prepGroups.set(key, current);
        });

        const groupedPrepIds = new Set();
        prepGroups.forEach(group => group.attempts.forEach(item => groupedPrepIds.add(item.id)));
        const normalizedProgressItems = [
            ...progressItems.filter(item => !groupedPrepIds.has(item.id)),
            ...[...prepGroups.values()].map(group => ({
                ...group,
                status: group.completed_count > 0 ? 'completado' : 'iniciado sin resultado',
                incomplete_reason: group.completed_count > 0 ? '' : 'Prueba iniciada, pero no hay resultado final. El alumno no termino el quiz o salio antes de enviar las respuestas.',
                metadata: {
                    ...(group.metadata || {}),
                    incomplete_reason: group.completed_count > 0 ? '' : 'Prueba iniciada, pero no hay resultado final. El alumno no termino el quiz o salio antes de enviar las respuestas.'
                },
                duration_minutes: (() => {
                    const times = group.attempts.map(item => new Date(item.date).getTime()).filter(Number.isFinite);
                    if (times.length < 2) return null;
                    const minutes = Math.round((Math.max(...times) - Math.min(...times)) / 60000);
                    return minutes > 0 ? minutes : null;
                })(),
                detail: group.detail || `${group.started_count} inicio(s), ${group.completed_count} completado(s)`
            }))
        ];

        const items = [
            ...normalizedProgressItems,
            ...quizRows.map(row => ({
                id: `quiz-${row.id || row.created_at}`,
                source: 'quiz',
                type: 'evaluacion',
                title: row.topic || 'Resultado de quiz',
                subject: row.subject || '',
                date: row.created_at,
                score: row.score,
                score_percent: row.score,
                detail: row.correct_answers != null ? `${row.correct_answers} correctas` : '',
                correct_answers: row.correct_answers ?? null,
                total_questions: row.total_questions ?? null,
                wrong_answers: row.wrong_answers ?? null
            })),
            ...calendarRows.map(row => ({
                ...(() => {
                    const source = describeCalendarSource(row);
                    return {
                        id: `calendar-${row.event_id}`,
                        source: 'calendar',
                        type: row.event_type || 'evento',
                        title: row.title || 'Evento de calendario',
                        subject: normalizeSubject(row.subject || ''),
                        date: row.event_date || row.created_at,
                        status: row.status || '',
                        detail: row.description || '',
                        score: null,
                        score_percent: null,
                        incomplete_reason: source.reason,
                        metadata: {
                            source_label: source.label,
                            is_external_source: source.isExternal,
                            incomplete_reason: source.reason
                        }
                    };
                })()
            })),
            ...reminderRows.map(row => ({
                id: `reminder-${row.event_id}`,
                source: 'reminder',
                type: 'recordatorio',
                title: row.title || 'Recordatorio de evaluación',
                subject: row.subject || '',
                date: row.exam_date || row.created_at,
                status: row.status || '',
                detail: row.notes || row.source || ''
            })),
            ...notebookRows.map(row => ({
                id: `notebook-${row.id || row.created_at}`,
                source: 'notebook',
                type: 'evidencia',
                title: row.file_name || 'Evidencia subida',
                subject: row.metadata?.subject || '',
                date: row.created_at,
                status: row.status || '',
                detail: row.metadata?.summary || row.mime_type || '',
                image_url: row.public_url || '',
                evidence_summary: row.file_name || row.mime_type || 'Evidencia subida',
                has_evidence: true,
                activity_group_id: `evidence|${normalizeSubject(row.metadata?.subject || '')}|${dateOnly(row.created_at)}`
            })),
            ...ocrRows.map(row => ({
                id: `ocr-${row.id || row.submission_id || row.created_at}`,
                source: 'notebook_ocr',
                type: 'cuaderno_ocr',
                title: row.topic || 'Cuaderno transcrito',
                subject: row.subject || '',
                date: row.created_at,
                status: row.quiz_ready ? 'quiz listo' : 'revisar',
                score: row.interpretation_score,
                score_percent: row.interpretation_score,
                detail: row.ocr_text || row.feedback || '',
                ocr_text: row.ocr_text || '',
                image_url: row.public_url && (!row.image_available_until || new Date(row.image_available_until).getTime() > Date.now()) ? row.public_url : '',
                evidence_summary: `Cuaderno OCR${row.interpretation_score != null ? ` ${row.interpretation_score}%` : ''}`,
                has_evidence: Boolean(row.public_url || row.ocr_text),
                activity_group_id: `notebook|${normalizeSubject(row.subject || '')}|${dateOnly(row.created_at)}`,
                metadata: {
                    ...(row.metadata || {}),
                    feedback: row.feedback || '',
                    detected_concepts: row.detected_concepts || row.metadata?.detected_concepts || [],
                    missing_concepts: row.missing_concepts || row.metadata?.missing_concepts || [],
                    quiz_ready: Boolean(row.quiz_ready)
                }
            })),
            ...reportRows.map(row => ({
                id: `report-${row.report_id || row.created_at}`,
                source: 'daily_report',
                type: 'reporte_diario',
                title: `Reporte diario ${row.report_date || ''}`,
                subject: '',
                date: row.created_at || row.report_date,
                status: row.status || '',
                score: row.quiz_total ? Math.round((Number(row.quiz_correct || 0) / Number(row.quiz_total || 1)) * 100) : null,
                score_percent: row.quiz_total ? Math.round((Number(row.quiz_correct || 0) / Number(row.quiz_total || 1)) * 100) : null,
                detail: row.payload?.summary_text || `${row.total_minutes || 0} min de estudio`,
                duration_minutes: Number(row.total_minutes || 0) || null,
                correct_answers: Number(row.quiz_correct || 0) || null,
                wrong_answers: Number(row.quiz_wrong || 0) || null,
                total_questions: Number(row.quiz_total || 0) || null,
                metadata: row.payload || {}
            })),
            ...alertRows.map(row => ({
                id: `alert-${row.alert_id || row.created_at}`,
                source: 'study_alert',
                type: row.alert_type || 'alerta',
                title: row.title || 'Alerta de estudio',
                subject: row.subject || '',
                date: row.created_at,
                status: row.severity || '',
                detail: row.body || '',
                metadata: row.payload || {}
            })),
            ...studyRows.map(row => ({
                id: `study-${row.session_id || row.id || row.created_at || row.start_time}`,
                source: 'study',
                type: 'estudio',
                title: row.subject ? `Estudio ${row.subject}` : 'Sesion de estudio',
                subject: row.subject || '',
                date: row.start_time || row.completed_at || row.created_at,
                status: row.status || (row.end_time ? 'completado' : 'en_progreso'),
                detail: row.total_minutes ? `${row.total_minutes} min` : '',
                duration_minutes: Number(row.total_minutes || 0) || null,
                metadata: { milestones: row.milestones || [] }
            })),
        ].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, maxRows).map(item => {
            const subj = normalizeSubject(item.subject || '');
            const day = dateOnly(item.date);
            const cuadernoInfo = getCuadernoInfoOnDay(subj, day);
            return {
                ...item,
                has_teoria_ludica: hasTeoriaLudicaOnDay(subj, day),
                has_cuaderno: cuadernoInfo.has_cuaderno,
                cuaderno_similarity: cuadernoInfo.cuaderno_similarity
            };
        });

        res.json({
            success: true,
            summary: {
                progress: progressRows.length,
                quizzes: quizRows.length,
                calendar_events: calendarRows.length,
                reminders: reminderRows.length,
                evidences: notebookRows.length + ocrRows.length,
                daily_reports: reportRows.length,
                alerts: alertRows.length,
                study_sessions: studyRows.length,
                total: items.length
            },
            identity_aliases: ids,
            items
        });
    } catch (err) {
        console.error('[PARENT-HISTORY] Error cargando antecedentes:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Progreso del hijo (para dashboard de apoderado)
app.get('/api/progress/child', async (req, res) => {
    try {
        const { child_user_id, limit } = req.query;
        if (!child_user_id) return res.status(400).json({ success: false, error: 'Falta child_user_id' });
        const progress = await getChildProgressSummary(child_user_id, Number(limit) || 50);
        res.json({ success: true, progress });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Notificaciones
app.get('/api/notifications', async (req, res) => {
    try {
        const { user_id, limit } = req.query;
        if (!user_id) return res.status(400).json({ success: false, error: 'Falta user_id' });
        const notifications = await listUnreadNotifications(user_id, Number(limit) || 20);
        res.json({ success: true, notifications });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.put('/api/notifications/:notif_id/read', async (req, res) => {
    try {
        await markNotificationRead(req.params.notif_id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =====================================================================
// STUDY SESSIONS (hora de estudio)
// =====================================================================

// [REMOVED] init-table endpoint — usar Supabase SQL editor directamente

// Iniciar sesión de estudio
app.post('/api/study-sessions/start', async (req, res) => {
    try {
        const { student_user_id, subject, session_number, type } = req.body;
        if (!student_user_id) return res.status(400).json({ success: false, error: 'Falta student_user_id' });

        // Check if there's already an active session
        const active = await getActiveStudySession(student_user_id);
        if (active) {
            const activeType = String(active.type || '').toLowerCase();
            const requestedType = String(type || 'daily').toLowerCase();
            const activeSubject = String(active.subject || '').trim().toUpperCase();
            const requestedSubject = String(subject || '').trim().toUpperCase();
            const shouldReplaceActive =
                (activeType === 'app_entry' && requestedType !== 'app_entry') ||
                (requestedType !== 'app_entry' && requestedSubject && activeSubject && activeSubject !== requestedSubject);

            if (!shouldReplaceActive) {
                return res.json({ success: true, session: active, already_active: true });
            }

            try {
                await endStudySession(active.session_id);
                console.log(`[STUDY] Sesión activa cerrada por cambio real: ${active.session_id} (${activeType}/${activeSubject})`);
            } catch (closeErr) {
                console.warn('[STUDY] No se pudo cerrar sesión activa anterior:', closeErr.message);
            }
        }

        const session = await createStudySession({ student_user_id, subject, session_number, type });
        console.log(`[STUDY] Sesión iniciada: ${session.session_id} para ${student_user_id} (${type}/${subject})`);
        res.json({ success: true, session });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Agregar hito
app.post('/api/study-sessions/milestone', async (req, res) => {
    try {
        const { session_id, milestone } = req.body;
        if (!session_id || !milestone) return res.status(400).json({ success: false, error: 'Faltan parametros' });
        await addStudyMilestone(session_id, milestone);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Finalizar sesión de estudio
app.post('/api/study-sessions/end', async (req, res) => {
    try {
        const { session_id } = req.body;
        if (!session_id) return res.status(400).json({ success: false, error: 'Falta session_id' });
        const session = await endStudySession(session_id);
        console.log(`[STUDY] Sesión finalizada: ${session_id} — ${session.total_minutes} min`);
        res.json({ success: true, session });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Obtener sesiones de estudio (para parent dashboard)
app.get('/api/study-sessions', async (req, res) => {
    try {
        const { student_user_id, student_email, parent_email, from_date, to_date } = req.query;
        if (!student_user_id && !student_email) return res.status(400).json({ success: false, error: 'Falta student_user_id o student_email' });

        const idSet = new Set([student_user_id].filter(Boolean).map(String));
        const email = String(student_email || '').trim().toLowerCase();
        const parentEmail = String(parent_email || '').trim().toLowerCase();
        const emails = new Set(email ? [email] : []);

        for (const id of [...idSet]) {
            const { data: profile } = await supabase.from('profiles').select('user_id,email').eq('user_id', id).maybeSingle();
            if (profile?.user_id) idSet.add(String(profile.user_id));
            if (profile?.email) emails.add(String(profile.email).trim().toLowerCase());

            const { data: legacy } = await supabase.from('users').select('token,mail').eq('token', id).maybeSingle();
            if (legacy?.token) idSet.add(String(legacy.token));
            if (legacy?.mail) emails.add(String(legacy.mail).trim().toLowerCase());
        }

        for (const candidateEmail of emails) {
            if (!candidateEmail || candidateEmail === parentEmail) continue;
            const { data: profileRows } = await supabase.from('profiles').select('user_id').ilike('email', candidateEmail);
            (profileRows || []).forEach(row => row?.user_id && idSet.add(String(row.user_id)));
            const { data: legacyRows } = await supabase.from('users').select('token').ilike('mail', candidateEmail);
            (legacyRows || []).forEach(row => row?.token && idSet.add(String(row.token)));
        }

        const ids = [...idSet];
        const byKey = new Map();
        const addSessions = (rows = []) => {
            for (const row of rows) {
                const key = row.session_id || row.id || `${row.student_user_id || row.user_id}-${row.start_time || row.completed_at || row.created_at}-${row.subject || ''}`;
                if (!byKey.has(key)) byKey.set(key, row);
            }
        };

        for (const id of ids) {
            addSessions(await getStudySessions(id, from_date, to_date));
            addSessions(await deriveStudySessionsFromProgress(id, from_date, to_date));
        }

        const sessions = [...byKey.values()].sort((a, b) =>
            String(b.start_time || b.completed_at || b.created_at || '').localeCompare(String(a.start_time || a.completed_at || a.created_at || ''))
        );

        res.json({ success: true, sessions, identity_aliases: ids });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Derivar sesiones de estudio a partir del progress_log (timestamps agrupados por día)
async function deriveStudySessionsFromProgress(student_user_id, from_date, to_date) {
    try {
        let query = supabase
            .from('progress_log')
            .select('created_at, subject, event_type, session')
            .eq('user_id', student_user_id)
            .order('created_at', { ascending: true });

        if (from_date) query = query.gte('created_at', from_date);
        if (to_date) query = query.lte('created_at', to_date);

        const { data: rows, error } = await query.limit(2000);
        if (error || !rows?.length) return [];

        // Agrupar por día LOCAL (Chile UTC-4) + subject
        const toChileDate = (utcStr) => {
            const d = new Date(utcStr);
            // Chile = UTC-4 (simplificado, no considera horario verano)
            d.setHours(d.getHours() - 4);
            return d.toISOString().substring(0, 10);
        };
        const dayGroups = {};
        for (const row of rows) {
            if (!row.created_at) continue;
            const day = toChileDate(row.created_at);
            const key = `${day}|${row.subject || 'GENERAL'}`;
            if (!dayGroups[key]) dayGroups[key] = { day, subject: row.subject || 'GENERAL', timestamps: [], events: [] };
            dayGroups[key].timestamps.push(new Date(row.created_at).getTime());
            dayGroups[key].events.push(row.event_type);
        }

        // Convertir cada grupo a sesiones segmentadas por gaps de 30 min
        const GAP_MS = 30 * 60 * 1000; // 30 min gap = nueva sesión
        const MAX_SESSION_MIN = 90; // cap por sesión
        const sessions = [];
        for (const [key, group] of Object.entries(dayGroups)) {
            const sorted = group.timestamps.sort((a, b) => a - b);
            // Segmentar: si hay gap > 30 min entre eventos, cortar
            const segments = [[sorted[0]]];
            for (let i = 1; i < sorted.length; i++) {
                if (sorted[i] - sorted[i - 1] > GAP_MS) {
                    segments.push([sorted[i]]);
                } else {
                    segments[segments.length - 1].push(sorted[i]);
                }
            }

            const hasCompletion = group.events.some(e =>
                e === 'session_completed' || e === 'prep_exam_completed' || e === 'prep_exam_reviewed'
            );

            for (let si = 0; si < segments.length; si++) {
                const seg = segments[si];
                const first = seg[0];
                const last = seg[seg.length - 1];
                let durationMs = last - first;
                if (seg.length === 1) durationMs = 5 * 60 * 1000;
                const totalMinutes = Math.max(2, Math.min(MAX_SESSION_MIN, Math.round(durationMs / 60000)));

                sessions.push({
                    id: `derived-${key}-s${si}`,
                    student_user_id,
                    subject: group.subject,
                    type: 'derived',
                    status: 'completed',
                    start_time: new Date(first).toISOString(),
                    end_time: new Date(last).toISOString(),
                    total_minutes: totalMinutes,
                    milestones: { activities: seg.length, has_completion: hasCompletion },
                    derived: true
                });
            }
        }

        return sessions.sort((a, b) => b.start_time.localeCompare(a.start_time));
    } catch (err) {
        console.error('[DERIVE_STUDY] Error:', err.message);
        return [];
    }
}

// Sesión activa actual
app.get('/api/study-sessions/active', async (req, res) => {
    try {
        const { student_user_id } = req.query;
        if (!student_user_id) return res.status(400).json({ success: false, error: 'Falta student_user_id' });
        const session = await getActiveStudySession(student_user_id);
        res.json({ success: true, session, is_studying: !!session });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================================
// AGENTE CONVERSACIONAL MATICO
// ============================================================
const AGENT_TOOLS = [
    {
        type: 'function',
        function: {
            name: 'get_student_profile',
            description: 'Obtener perfil del estudiante por user_id: nombre, email, materias registradas',
            parameters: { type: 'object', properties: { student_id: { type: 'string' } }, required: ['student_id'] }
        }
    },
    {
        type: 'function',
        function: {
            name: 'search_students',
            description: 'Buscar estudiantes/usuarios por nombre, email o listar todos. Usa cuando el admin pregunte por un alumno especifico ("como le fue a Matias", "busca a Camila", "muestrame los alumnos", "quien es el usuario X"). Retorna user_id, nombre, email de cada resultado. IMPORTANTE: copia EXACTAMENTE el nombre que dice el usuario, NO corrijas ortografia ni agregues/quites letras.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Nombre o email a buscar EXACTAMENTE como lo escribio el usuario, sin corregir ortografia. Dejar vacio para listar todos.' },
                    limit: { type: 'number', description: 'Maximo de resultados (default 20)' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_recent_activity',
            description: 'Obtener actividad reciente del estudiante: quizzes, sesiones, evidencias. Usar para preguntas como "¿estudió hoy?", "¿qué hizo esta semana?"',
            parameters: {
                type: 'object',
                properties: {
                    student_id: { type: 'string' },
                    days: { type: 'number', description: 'Cuántos días hacia atrás buscar (default 7)' }
                },
                required: ['student_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_quiz_results',
            description: 'Obtener resultados de quizzes/pruebas del estudiante. Incluye correctas, incorrectas, materia, tema, fecha.',
            parameters: {
                type: 'object',
                properties: {
                    student_id: { type: 'string' },
                    subject: { type: 'string', description: 'Materia (MATEMATICA, LENGUAJE, QUIMICA, etc). Opcional.' },
                    days: { type: 'number', description: 'Últimos N días (default 30)' }
                },
                required: ['student_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_study_time',
            description: 'Obtener tiempo de estudio del estudiante: minutos por día, por materia, total.',
            parameters: {
                type: 'object',
                properties: {
                    student_id: { type: 'string' },
                    days: { type: 'number', description: 'Últimos N días (default 7)' }
                },
                required: ['student_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_upcoming_exams',
            description: 'Obtener pruebas/eventos FUTUROS (desde hoy en adelante) del calendario del estudiante. USA ESTA herramienta cuando pregunten por pruebas pendientes, proximas, que tiene que estudiar. Solo retorna eventos desde hoy, nunca pasados.',
            parameters: {
                type: 'object',
                properties: { student_id: { type: 'string' } },
                required: ['student_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_inactive_subjects',
            description: 'Obtener materias que el estudiante no ha tocado en varios días. Útil para detectar materias abandonadas.',
            parameters: {
                type: 'object',
                properties: {
                    student_id: { type: 'string' },
                    threshold_days: { type: 'number', description: 'Días sin actividad para considerarse inactiva (default 5)' }
                },
                required: ['student_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_notebook_evidence',
            description: 'Obtener evidencias de cuaderno/fotos subidas por el estudiante.',
            parameters: {
                type: 'object',
                properties: {
                    student_id: { type: 'string' },
                    days: { type: 'number', description: 'Últimos N días (default 7)' }
                },
                required: ['student_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_wrong_questions_detail',
            description: 'Obtener detalle de preguntas incorrectas: qué pregunta, qué respondió, cuál era la correcta.',
            parameters: {
                type: 'object',
                properties: {
                    student_id: { type: 'string' },
                    subject: { type: 'string', description: 'Materia opcional' },
                    days: { type: 'number', description: 'Últimos N días (default 7)' }
                },
                required: ['student_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'prepare_exam_study',
            description: 'Generar material de estudio completo (teoria ludica + quiz interactivo) para preparar una prueba. Usa cuando el estudiante pide ayuda para prepararse para un examen o prueba. Retorna un link con el material de estudio.',
            parameters: {
                type: 'object',
                properties: {
                    student_id: { type: 'string' },
                    subject: { type: 'string', description: 'Materia: MATEMATICA, LENGUAJE, FILOSOFIA, HISTORIA, QUIMICA, FISICA, BIOLOGIA, INGLES, etc' },
                    topic: { type: 'string', description: 'Tema especifico de la prueba' },
                    content_summary: { type: 'string', description: 'Resumen detallado del contenido que entra en la prueba, extraido de imagenes o la conversacion. Incluir todos los temas y subtemas mencionados.' }
                },
                required: ['student_id', 'subject', 'topic']
            }
        }
    },
    // === CRUD TOOLS — full agent autonomy ===
    {
        type: 'function',
        function: {
            name: 'create_calendar_event',
            description: 'Crear un evento en el calendario del estudiante. Pruebas, tareas, disertaciones, etc.',
            parameters: {
                type: 'object',
                properties: {
                    student_id: { type: 'string' },
                    title: { type: 'string', description: 'Titulo del evento' },
                    event_date: { type: 'string', description: 'Fecha YYYY-MM-DD' },
                    event_type: { type: 'string', enum: ['prueba', 'tarea', 'disertacion', 'trabajo', 'evento', 'otro'], description: 'Tipo de evento' },
                    subject: { type: 'string', description: 'Materia en MAYUSCULAS' },
                    description: { type: 'string', description: 'Descripcion o contenido del evento' }
                },
                required: ['student_id', 'title', 'event_date', 'event_type', 'subject']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'update_calendar_event',
            description: 'Actualizar un evento existente del calendario. Cambiar fecha, titulo, descripcion, etc.',
            parameters: {
                type: 'object',
                properties: {
                    event_id: { type: 'number', description: 'ID del evento a actualizar' },
                    updates: { type: 'object', description: 'Campos a actualizar: title, event_date, event_type, subject, description' }
                },
                required: ['event_id', 'updates']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'delete_calendar_event',
            description: 'Eliminar un evento del calendario.',
            parameters: {
                type: 'object',
                properties: { event_id: { type: 'number', description: 'ID del evento a eliminar' } },
                required: ['event_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'update_student_profile',
            description: 'Actualizar datos del perfil del estudiante: nombre, email, materias, configuracion.',
            parameters: {
                type: 'object',
                properties: {
                    student_id: { type: 'string' },
                    updates: { type: 'object', description: 'Campos a actualizar: display_name, email, subjects, etc.' }
                },
                required: ['student_id', 'updates']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'search_all_modules',
            description: 'Buscar informacion en TODOS los modulos de la app: calendario, progreso, quizzes, cuaderno, sesiones, alertas, notificaciones, perfil. Usa para busquedas amplias.',
            parameters: {
                type: 'object',
                properties: {
                    student_id: { type: 'string' },
                    query: { type: 'string', description: 'Que buscar: "pruebas de matematica", "sesiones esta semana", "evidencias de cuaderno", etc.' },
                    days: { type: 'number', description: 'Dias hacia atras (default 30)' }
                },
                required: ['student_id', 'query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'run_custom_query',
            description: 'Ejecutar una consulta personalizada a la base de datos. Para cuando las otras herramientas no cubren la necesidad. Tablas disponibles: profiles, users, progress_log, calendar_events, study_sessions, notebook_submissions, notebook_ocr_records, notifications, study_alerts, daily_reports, question_banks, exam_prep_sessions, agent_training.',
            parameters: {
                type: 'object',
                properties: {
                    table: { type: 'string', description: 'Nombre de la tabla' },
                    action: { type: 'string', enum: ['select', 'insert', 'update', 'delete'], description: 'Tipo de operacion' },
                    filters: { type: 'object', description: 'Filtros: { column: value } para WHERE' },
                    data: { type: 'object', description: 'Datos para insert/update' },
                    select_columns: { type: 'string', description: 'Columnas a seleccionar (default *)' },
                    order_by: { type: 'string', description: 'Columna para ordenar' },
                    limit: { type: 'number', description: 'Limite de filas (default 20)' }
                },
                required: ['table', 'action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'send_notification',
            description: 'Enviar una notificacion/alerta dentro de la app al estudiante o apoderado.',
            parameters: {
                type: 'object',
                properties: {
                    student_id: { type: 'string' },
                    title: { type: 'string' },
                    message: { type: 'string' },
                    type: { type: 'string', enum: ['info', 'warning', 'success', 'urgent'], description: 'Tipo de notificacion' }
                },
                required: ['student_id', 'title', 'message']
            }
        }
    }
];

const AGENT_PRIVATE_TOOL_NAMES = new Set([
    'search_students',
    'search_all_modules',
    'create_calendar_event',
    'update_calendar_event',
    'delete_calendar_event',
    'update_student_profile',
    'run_custom_query',
    'send_notification'
]);

const PUBLIC_AGENT_TOOLS = AGENT_TOOLS.filter(tool => !AGENT_PRIVATE_TOOL_NAMES.has(tool.function?.name));

const dateOnlyChile = () => {
    const d = new Date();
    d.setHours(d.getHours() - 4);
    return d.toISOString().substring(0, 10);
};

async function executeAgentTool(name, args) {
    const sid = args.student_id;
    const days = Number(args.days) || 7;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const todayChile = dateOnlyChile();

    switch (name) {
        case 'get_student_profile': {
            const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', sid).maybeSingle();
            const { data: legacy } = await supabase.from('users').select('*').eq('token', sid).maybeSingle();
            const p = profile || legacy || {};
            return {
                user_id: p.user_id || p.token || sid,
                name: p.display_name || p.nombre || p.name || 'Sin nombre',
                email: p.email || p.mail || '',
                role: p.role || p.tipo || '',
                subjects: p.subjects || p.materias || null,
                created_at: p.created_at || null,
                raw: p
            };
        }
        case 'search_students': {
            const q = (args.query || '').trim();
            const lim = Number(args.limit) || 20;
            const results = [];
            const seenIds = new Set();

            // Build search terms: full query + individual words for fuzzy matching
            const searchTerms = [q];
            const words = q.split(/\s+/).filter(w => w.length >= 2);
            if (words.length > 1) searchTerms.push(...words);

            for (const term of searchTerms) {
                if (!term) continue;

                // Search in profiles table
                const { data: profiles } = await supabase.from('profiles')
                    .select('user_id, display_name, email, role, created_at')
                    .or(`display_name.ilike.%${term}%,email.ilike.%${term}%,user_id.ilike.%${term}%`)
                    .order('created_at', { ascending: false }).limit(lim);

                for (const p of (profiles || [])) {
                    if (seenIds.has(p.user_id)) continue;
                    seenIds.add(p.user_id);
                    results.push({
                        user_id: p.user_id,
                        name: p.display_name || 'Sin nombre',
                        email: p.email || '',
                        role: p.role || '',
                        source: 'profiles',
                        created_at: p.created_at
                    });
                }

                // Search in legacy users table too
                const { data: legacyUsers } = await supabase.from('users')
                    .select('token, nombre, name, mail, email, role, tipo, created_at')
                    .or(`nombre.ilike.%${term}%,name.ilike.%${term}%,mail.ilike.%${term}%,email.ilike.%${term}%,token.ilike.%${term}%`)
                    .order('created_at', { ascending: false }).limit(lim);

                for (const u of (legacyUsers || [])) {
                    const uid = u.token;
                    if (seenIds.has(uid)) continue;
                    seenIds.add(uid);
                    results.push({
                        user_id: uid,
                        name: u.nombre || u.name || 'Sin nombre',
                        email: u.mail || u.email || '',
                        role: u.role || u.tipo || '',
                        source: 'users',
                        created_at: u.created_at
                    });
                }
            }

            // If no results and query has no space, try without accents/H variations
            if (results.length === 0 && q) {
                const noH = q.replace(/h/gi, '');
                if (noH !== q.toLowerCase()) {
                    const { data: fuzzyProfiles } = await supabase.from('profiles')
                        .select('user_id, display_name, email, role, created_at')
                        .ilike('display_name', `%${noH}%`)
                        .order('created_at', { ascending: false }).limit(lim);
                    for (const p of (fuzzyProfiles || [])) {
                        if (seenIds.has(p.user_id)) continue;
                        seenIds.add(p.user_id);
                        results.push({
                            user_id: p.user_id, name: p.display_name || 'Sin nombre',
                            email: p.email || '', role: p.role || '', source: 'profiles', created_at: p.created_at
                        });
                    }
                    const { data: fuzzyLegacy } = await supabase.from('users')
                        .select('token, nombre, name, mail, email, role, tipo, created_at')
                        .or(`nombre.ilike.%${noH}%,name.ilike.%${noH}%`)
                        .order('created_at', { ascending: false }).limit(lim);
                    for (const u of (fuzzyLegacy || [])) {
                        const uid = u.token;
                        if (seenIds.has(uid)) continue;
                        seenIds.add(uid);
                        results.push({
                            user_id: uid, name: u.nombre || u.name || 'Sin nombre',
                            email: u.mail || u.email || '', role: u.role || u.tipo || '', source: 'users', created_at: u.created_at
                        });
                    }
                }
            }

            return { total: results.length, students: results.slice(0, lim) };
        }
        case 'get_recent_activity': {
            const { data: progress } = await supabase.from('progress_log').select('event_type, subject, topic, score, total_questions, correct_answers, wrong_answers, created_at')
                .eq('user_id', sid).gte('created_at', since).order('created_at', { ascending: false }).limit(50);
            const { data: notebooks } = await supabase.from('notebook_submissions').select('subject, status, created_at, metadata')
                .eq('user_id', sid).gte('created_at', since).order('created_at', { ascending: false }).limit(20);
            const todayItems = (progress || []).filter(r => {
                const d = new Date(r.created_at); d.setHours(d.getHours() - 4);
                return d.toISOString().substring(0, 10) === todayChile;
            });
            return {
                total_activities: (progress || []).length,
                today_activities: todayItems.length,
                studied_today: todayItems.length > 0,
                recent_progress: (progress || []).slice(0, 15).map(r => ({
                    type: r.event_type, subject: r.subject, topic: r.topic,
                    score: r.score, total: r.total_questions, correct: r.correct_answers, wrong: r.wrong_answers,
                    date: r.created_at
                })),
                notebooks: (notebooks || []).slice(0, 10).map(n => ({
                    subject: n.subject || n.metadata?.subject, status: n.status, date: n.created_at
                }))
            };
        }
        case 'get_quiz_results': {
            let query = supabase.from('progress_log')
                .select('event_type, subject, topic, score, total_questions, correct_answers, wrong_answers, wrong_question_details, created_at')
                .eq('user_id', sid).gte('created_at', since)
                .in('event_type', ['prep_exam_activity', 'prep_exam_completed', 'session_completed', 'quiz_completed'])
                .order('created_at', { ascending: false }).limit(50);
            if (args.subject) query = query.ilike('subject', `%${args.subject}%`);
            const { data } = await query;
            return (data || []).map(r => ({
                type: r.event_type, subject: r.subject, topic: r.topic,
                total: r.total_questions, correct: r.correct_answers, wrong: r.wrong_answers,
                score_percent: r.total_questions > 0 ? Math.round(((r.correct_answers || 0) / r.total_questions) * 100) : r.score,
                date: r.created_at
            }));
        }
        case 'get_study_time': {
            const { data: sessions } = await supabase.from('study_sessions').select('subject, total_minutes, start_time, status')
                .eq('student_user_id', sid).gte('start_time', since).order('start_time', { ascending: false });
            const derived = await deriveStudySessionsFromProgress(sid, since);
            const all = [...(sessions || []), ...derived];
            const byDay = {};
            for (const s of all) {
                const d = new Date(s.start_time); d.setHours(d.getHours() - 4);
                const day = d.toISOString().substring(0, 10);
                if (!byDay[day]) byDay[day] = { date: day, minutes: 0, subjects: new Set() };
                byDay[day].minutes += Number(s.total_minutes) || 0;
                byDay[day].subjects.add(s.subject || 'GENERAL');
            }
            const dailyData = Object.values(byDay).map(d => ({ date: d.date, minutes: d.minutes, subjects: [...d.subjects] }))
                .sort((a, b) => b.date.localeCompare(a.date));
            const totalMin = dailyData.reduce((s, d) => s + d.minutes, 0);
            return { total_minutes: totalMin, total_hours: Math.round(totalMin / 60 * 10) / 10, days_active: dailyData.length, daily: dailyData };
        }
        case 'get_upcoming_exams': {
            const { data } = await supabase.from('calendar_events').select('subject, title, event_date, event_type, description')
                .eq('student_user_id', sid).gte('event_date', todayChile).order('event_date', { ascending: true }).limit(20);
            return (data || []).map(e => ({ subject: e.subject, title: e.title, date: e.event_date, type: e.event_type, description: e.description }));
        }
        case 'get_inactive_subjects': {
            const threshold = Number(args.threshold_days) || 5;
            const allSubjects = ['MATEMATICA', 'LENGUAJE', 'QUIMICA', 'FISICA', 'BIOLOGIA', 'HISTORIA'];
            const inactive = [];
            for (const subj of allSubjects) {
                const { data } = await supabase.from('progress_log').select('created_at')
                    .eq('user_id', sid).eq('subject', subj).order('created_at', { ascending: false }).limit(1);
                const lastDate = data?.[0]?.created_at;
                if (!lastDate) { inactive.push({ subject: subj, last_activity: null, days_inactive: 'nunca' }); continue; }
                const daysDiff = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
                if (daysDiff >= threshold) inactive.push({ subject: subj, last_activity: lastDate, days_inactive: daysDiff });
            }
            return inactive;
        }
        case 'get_notebook_evidence': {
            const { data: submissions } = await supabase.from('notebook_submissions').select('subject, status, image_url, created_at, metadata')
                .eq('user_id', sid).gte('created_at', since).order('created_at', { ascending: false }).limit(20);
            const { data: ocr } = await supabase.from('notebook_ocr_records').select('subject, interpretation_score, created_at')
                .eq('user_id', sid).gte('created_at', since).order('created_at', { ascending: false }).limit(20);
            return {
                submissions: (submissions || []).map(s => ({ subject: s.subject || s.metadata?.subject, status: s.status, date: s.created_at, has_image: !!s.image_url })),
                ocr_records: (ocr || []).map(o => ({ subject: o.subject, score: o.interpretation_score, date: o.created_at }))
            };
        }
        case 'get_wrong_questions_detail': {
            let query = supabase.from('progress_log')
                .select('subject, topic, wrong_question_details, wrong_answers, total_questions, created_at')
                .eq('user_id', sid).gte('created_at', since)
                .not('wrong_question_details', 'is', null)
                .order('created_at', { ascending: false }).limit(20);
            if (args.subject) query = query.ilike('subject', `%${args.subject}%`);
            const { data } = await query;
            return (data || []).map(r => {
                let details = r.wrong_question_details;
                if (typeof details === 'string') try { details = JSON.parse(details); } catch { details = []; }
                return {
                    subject: r.subject, topic: r.topic, date: r.created_at,
                    wrong_count: r.wrong_answers, total: r.total_questions,
                    questions: (Array.isArray(details) ? details : []).slice(0, 5).map(q => ({
                        question: q.question || q.prompt || q.text,
                        student_answer: q.user_answer || q.selected_answer,
                        correct_answer: q.correct_answer || q.answer
                    }))
                };
            });
        }
        case 'prepare_exam_study': {
            const subject = args.subject || 'GENERAL';
            const topic = args.topic || 'Contenido general';
            const contentSummary = args.content_summary || topic;
            const BASE_URL = process.env.BASE_URL || 'https://srv1048418.hstgr.cloud';

            try {
                // Generate ludic theory
                const theoryRes = await agentTextClient.chat.completions.create({
                    model: AI_MODELS.thinking || AI_MODELS.fast,
                    messages: [{ role: 'user', content: `Genera una leccion teorica LUDICA y ENTRETENIDA para un estudiante de ensenanza media chileno.
Materia: ${subject}
Tema: ${topic}
Contenido especifico: ${contentSummary}

REGLAS:
- Escribe como si le hablaras a un adolescente chileno, tutea
- Usa analogias divertidas, ejemplos de la vida real, datos curiosos
- Organiza en secciones claras con titulos creativos (usa emojis)
- Incluye "Dato curioso" o "Sabias que..." en cada seccion
- Maximo 1000 palabras
- Debe ser contenido que el estudiante pueda copiar en su cuaderno
- NO uses formato markdown con # ni **. Usa texto plano con emojis para titulos.
- Escribe pensando en que el estudiante lo va a LEER y COPIAR en su cuaderno` }],
                    temperature: 0.7,
                    max_tokens: 2000
                });
                const theoryContent = theoryRes.choices[0]?.message?.content || '';

                // Generate quiz questions
                const quizRes = await agentTextClient.chat.completions.create({
                    model: AI_MODELS.fast,
                    messages: [{ role: 'user', content: `Genera 8 preguntas de seleccion multiple sobre:
Materia: ${subject} | Tema: ${topic}
Contenido: ${contentSummary}

Responde SOLO con un JSON array valido, sin texto extra:
[{"question":"texto","options":["A) op1","B) op2","C) op3","D) op4"],"correct":0,"explanation":"por que es correcta"}]

REGLAS:
- Preguntas variadas: conceptuales, aplicacion, analisis
- Opciones plausibles, no obvias
- Explicaciones breves y claras
- Dificultad media-alta
- En espanol chileno` }],
                    temperature: 0.5,
                    max_tokens: 2500,
                    response_format: { type: 'json_object' }
                });
                let quizQuestions = [];
                try {
                    const raw = quizRes.choices[0]?.message?.content || '[]';
                    const parsed = JSON.parse(raw);
                    quizQuestions = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.quiz || []);
                } catch { quizQuestions = []; }

                // Save to Supabase
                const { data: saved, error: saveErr } = await supabase.from('exam_prep_sessions').insert({
                    student_id: sid,
                    subject,
                    topic,
                    theory_content: theoryContent,
                    quiz_questions: quizQuestions,
                    content_summary: contentSummary
                }).select('id').single();

                if (saveErr) throw saveErr;
                const studyLink = `${BASE_URL}/study/${saved.id}`;
                console.log(`[AGENT] Study material created: ${studyLink}`);
                return {
                    success: true,
                    link: studyLink,
                    study_id: saved.id,
                    theory_words: theoryContent.split(/\s+/).length,
                    quiz_count: quizQuestions.length,
                    message: `Material de estudio listo: teoria ludica (${theoryContent.split(/\s+/).length} palabras) + ${quizQuestions.length} preguntas quiz`
                };
            } catch (prepErr) {
                console.error('[AGENT] prepare_exam_study error:', prepErr.message);
                return { success: false, error: prepErr.message };
            }
        }
        case 'create_calendar_event': {
            const { data, error } = await supabase.from('calendar_events').insert({
                student_user_id: sid,
                title: args.title,
                event_date: args.event_date,
                event_type: args.event_type || 'evento',
                subject: (args.subject || '').toUpperCase(),
                description: args.description || null,
                source: 'agent'
            }).select('id, title, event_date, subject').single();
            if (error) return { success: false, error: error.message };
            return { success: true, event: data, message: `Evento creado: ${data.title} el ${data.event_date}` };
        }
        case 'update_calendar_event': {
            const eid = Number(args.event_id);
            const { data, error } = await supabase.from('calendar_events').update(args.updates).eq('id', eid).select('id, title, event_date').single();
            if (error) return { success: false, error: error.message };
            return { success: true, event: data, message: `Evento ${eid} actualizado` };
        }
        case 'delete_calendar_event': {
            const eid = Number(args.event_id);
            const { error } = await supabase.from('calendar_events').delete().eq('id', eid);
            if (error) return { success: false, error: error.message };
            return { success: true, message: `Evento ${eid} eliminado` };
        }
        case 'update_student_profile': {
            const { data, error } = await supabase.from('profiles').update(args.updates).eq('user_id', sid).select().single();
            if (error) {
                // Try legacy table
                const { data: leg, error: legErr } = await supabase.from('users').update(args.updates).eq('token', sid).select().single();
                if (legErr) return { success: false, error: legErr.message };
                return { success: true, profile: leg };
            }
            return { success: true, profile: data };
        }
        case 'search_all_modules': {
            const searchDays = Number(args.days) || 30;
            const searchSince = new Date(Date.now() - searchDays * 86400000).toISOString();
            const q = (args.query || '').toLowerCase();
            const results = {};

            // Calendar
            const { data: cal } = await supabase.from('calendar_events').select('id, title, event_date, event_type, subject, description')
                .eq('student_user_id', sid).order('event_date', { ascending: false }).limit(30);
            results.calendar = (cal || []).filter(e => !q || JSON.stringify(e).toLowerCase().includes(q)).slice(0, 10);

            // Progress
            const { data: prog } = await supabase.from('progress_log').select('event_type, subject, topic, score, correct_answers, wrong_answers, total_questions, created_at')
                .eq('user_id', sid).gte('created_at', searchSince).order('created_at', { ascending: false }).limit(30);
            results.progress = (prog || []).filter(e => !q || JSON.stringify(e).toLowerCase().includes(q)).slice(0, 10);

            // Study sessions
            const { data: sess } = await supabase.from('study_sessions').select('subject, total_minutes, start_time, status')
                .eq('student_user_id', sid).gte('start_time', searchSince).order('start_time', { ascending: false }).limit(20);
            results.study_sessions = (sess || []).filter(e => !q || JSON.stringify(e).toLowerCase().includes(q)).slice(0, 10);

            // Notebooks
            const { data: nb } = await supabase.from('notebook_submissions').select('subject, status, created_at, metadata')
                .eq('user_id', sid).gte('created_at', searchSince).order('created_at', { ascending: false }).limit(20);
            results.notebooks = (nb || []).filter(e => !q || JSON.stringify(e).toLowerCase().includes(q)).slice(0, 10);

            // Notifications
            const { data: notifs } = await supabase.from('notifications').select('title, message, type, read, created_at')
                .eq('user_id', sid).gte('created_at', searchSince).order('created_at', { ascending: false }).limit(10);
            results.notifications = notifs || [];

            return results;
        }
        case 'run_custom_query': {
            const tbl = args.table;
            const ALLOWED_TABLES = ['profiles', 'users', 'progress_log', 'calendar_events', 'study_sessions',
                'notebook_submissions', 'notebook_ocr_records', 'notifications', 'study_alerts',
                'daily_reports', 'question_banks', 'exam_prep_sessions', 'agent_training'];
            if (!ALLOWED_TABLES.includes(tbl)) return { error: `Tabla "${tbl}" no permitida. Tablas: ${ALLOWED_TABLES.join(', ')}` };

            try {
                if (args.action === 'select') {
                    let query = supabase.from(tbl).select(args.select_columns || '*');
                    if (args.filters) {
                        for (const [col, val] of Object.entries(args.filters)) {
                            query = query.eq(col, val);
                        }
                    }
                    if (args.order_by) query = query.order(args.order_by, { ascending: false });
                    query = query.limit(args.limit || 20);
                    const { data, error } = await query;
                    if (error) return { success: false, error: error.message };
                    return { success: true, rows: data, count: (data || []).length };
                }
                if (args.action === 'insert') {
                    const { data, error } = await supabase.from(tbl).insert(args.data || {}).select().single();
                    if (error) return { success: false, error: error.message };
                    return { success: true, row: data };
                }
                if (args.action === 'update') {
                    if (!args.filters || Object.keys(args.filters).length === 0) return { error: 'Se requieren filtros para update' };
                    let query = supabase.from(tbl).update(args.data || {});
                    for (const [col, val] of Object.entries(args.filters)) {
                        query = query.eq(col, val);
                    }
                    const { data, error } = await query.select();
                    if (error) return { success: false, error: error.message };
                    return { success: true, rows_affected: (data || []).length, rows: data };
                }
                if (args.action === 'delete') {
                    if (!args.filters || Object.keys(args.filters).length === 0) return { error: 'Se requieren filtros para delete' };
                    let query = supabase.from(tbl).delete();
                    for (const [col, val] of Object.entries(args.filters)) {
                        query = query.eq(col, val);
                    }
                    const { data, error } = await query.select();
                    if (error) return { success: false, error: error.message };
                    return { success: true, rows_deleted: (data || []).length };
                }
                return { error: `Accion "${args.action}" no soportada` };
            } catch (qErr) {
                return { success: false, error: qErr.message };
            }
        }
        case 'send_notification': {
            const { data, error } = await supabase.from('notifications').insert({
                user_id: sid,
                title: args.title,
                message: args.message,
                type: args.type || 'info',
                read: false,
                source: 'agent'
            }).select('id').single();
            if (error) return { success: false, error: error.message };
            return { success: true, notification_id: data.id, message: `Notificacion enviada: ${args.title}` };
        }
        default:
            return { error: `Tool ${name} no existe` };
    }
}

app.post('/api/agent/chat', async (req, res) => {
    try {
        const { message, student_id, user_type = 'parent', conversation_history = [], training_mode = false, admin_user_id, images = [], personality } = req.body;
        if (!message || !student_id) return res.status(400).json({ success: false, error: 'Falta message o student_id' });

        // Training mode: verify admin
        if (training_mode) {
            const isAdm = await checkAdmin(admin_user_id);
            if (!isAdm) return res.status(403).json({ success: false, error: 'No autorizado para modo entrenamiento' });
        }

        // Pre-analyze images with vision if present
        let imageAnalysis = '';
        if (images.length > 0) {
            try {
                const visionContent = [
                    { type: 'text', text: 'Analiza estas imagenes en detalle. Extrae TODO el texto visible, temas, materias, contenido academico. Si es una prueba o guia de estudio, lista todos los temas y subtemas que aparecen. Responde en espanol.' }
                ];
                for (const img of images.slice(0, 5)) {
                    const b64 = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
                    visionContent.push({ type: 'image_url', image_url: { url: b64, detail: 'high' } });
                }
                const visionRes = await (openaiVisionClient || agentTextClient).chat.completions.create({
                    model: OPENAI_VISION_MODEL,
                    messages: [{ role: 'user', content: visionContent }],
                    max_tokens: 1500
                });
                imageAnalysis = visionRes.choices[0]?.message?.content || '';
                console.log('[AGENT] Image analysis done:', imageAnalysis.substring(0, 200));
            } catch (visErr) {
                console.error('[AGENT] Vision analysis error:', visErr.message);
                imageAnalysis = '(No se pudo analizar las imagenes)';
            }
        }

        const todayChileStr = dateOnlyChile();
        const todayDate = new Date(todayChileStr + 'T12:00:00');
        const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const todayDayName = dayNames[todayDate.getDay()];
        const todayHumanDate = todayDate.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        // Fetch active training entries and build training section
        let trainingSection = '';
        try {
            const { data: trainingEntries } = await supabase
                .from('agent_training')
                .select('type, content')
                .eq('active', true)
                .order('created_at', { ascending: true });
            if (trainingEntries && trainingEntries.length > 0) {
                const grouped = { instruccion: [], skill: [], memoria: [], tono: [], conocimiento: [], qa: [] };
                for (const e of trainingEntries) {
                    if (grouped[e.type]) grouped[e.type].push(e.content);
                    else if (!grouped.instruccion) grouped.instruccion = [e.content];
                    else grouped.instruccion.push(e.content); // fallback
                }
                const parts = [];
                if (grouped.instruccion.length) parts.push('INSTRUCCIONES ADICIONALES:\n' + grouped.instruccion.join('\n'));
                if (grouped.tono.length) parts.push('TONO Y ESTILO:\n' + grouped.tono.join('\n'));
                if (grouped.skill.length) parts.push('SKILLS (capacidades especiales):\n' + grouped.skill.join('\n'));
                if (grouped.memoria.length) parts.push('MEMORIA (datos del alumno/familia):\n' + grouped.memoria.join('\n'));
                if (grouped.conocimiento.length) parts.push('CONOCIMIENTO BASE:\n' + grouped.conocimiento.join('\n'));
                if (grouped.qa.length) parts.push('RESPUESTAS ESPECÍFICAS:\n' + grouped.qa.join('\n'));
                if (parts.length) trainingSection = '\n\n' + parts.join('\n\n');
            }
        } catch (_) { /* non-critical */ }

        // Training mode: special system prompt + save_training tool
        const TRAINING_TOOL = {
            type: 'function',
            function: {
                name: 'save_training',
                description: 'Guardar una instruccion, preferencia de tono, memoria o skill que el admin te indica. SIEMPRE usa esta herramienta cuando el admin te de una instruccion o informacion que deba ser recordada.',
                parameters: {
                    type: 'object',
                    properties: {
                        type: { type: 'string', enum: ['instruccion', 'tono', 'memoria', 'skill', 'conocimiento', 'qa'], description: 'Tipo de entrenamiento' },
                        content: { type: 'string', description: 'El contenido a guardar, redactado como instruccion directa para ti mismo' }
                    },
                    required: ['type', 'content']
                }
            }
        };

        let systemPrompt;
        let activeTools;
        if (training_mode) {
            systemPrompt = `Eres Matico en MODO ENTRENAMIENTO Y AGENTE PERSONAL DE JOSE ANTONIO. Este modo es privado del admin/jefe, no de apoderados ni estudiantes.
REGLAS:
- Dentro de Matico tienes autoridad total: puedes revisar, crear, modificar, eliminar, corregir y administrar cualquier modulo o dato disponible con tus herramientas.
- REGLA OBLIGATORIA: antes de crear, modificar, eliminar, enviar notificaciones o ejecutar consultas que cambien datos, explica en una frase lo que vas a hacer y pregunta exactamente "lo hago?". No ejecutes el cambio hasta que el jefe confirme.
- Si solo vas a revisar, buscar, analizar o resumir informacion real, hazlo sin pedir permiso.
- Cuando el jefe confirme una accion pendiente con "si", "dale", "hazlo", "ok" o equivalente, ejecuta la accion usando la herramienta correcta.
- Cada vez que el admin te de una instruccion, preferencia, dato o informacion, USA save_training para guardarla.
- Clasifica bien: "instruccion" (reglas de comportamiento), "tono" (estilo de habla), "memoria" (datos del alumno/familia), "skill" (capacidades), "conocimiento" (info base), "qa" (respuestas especificas).
- Confirma brevemente que anotaste: "Listo jefe, anotado" o similar.
- Si el admin solo conversa sin dar instrucciones ni pedir acciones, responde normal sin guardar nada.
- Sin markdown ni asteriscos. Respuestas CORTAS, 2-3 frases max.
- Habla chileno informal, tutea.
- SIEMPRE responde algo. Nunca dejes la respuesta vacia.
- Cuando te pregunten por un alumno/persona ("conoces a X", "como le fue a X", "quien es X"), USA search_students INMEDIATAMENTE con el nombre exacto. NUNCA digas "no tengo info" sin buscar primero.
- PREPARACION DE PRUEBAS: cuando te pidan preparar material de estudio para una prueba, SIEMPRE pregunta primero: 1) De que temas o contenidos sera la prueba, 2) Pide que te digan los temas o que suban una foto/captura de pantalla del temario o guia. NUNCA generes material inventando contenido. Solo usa prepare_exam_study cuando tengas informacion concreta del contenido (texto o imagenes analizadas).
- Si el usuario adjunta imagenes con su mensaje, el sistema las analiza automaticamente. Usa ese analisis para entender el contenido antes de generar material.
- FECHAS: Hoy es ${todayDayName} ${todayHumanDate}. Cuando pregunten por pruebas/eventos "pendientes", "proximos", "que tiene", usa get_upcoming_exams que SOLO retorna desde hoy en adelante. NUNCA muestres eventos pasados como pendientes. Si un evento ya paso, dilo claramente.
- student_id: ${student_id}.` + trainingSection;
            activeTools = [TRAINING_TOOL, ...AGENT_TOOLS];
        } else {
            const AGENT_CORE_RULES = `
REGLAS FUNDAMENTALES:
- Este modo NO es administrador. No eres operador total de la app para apoderados ni estudiantes.
- Puedes revisar datos educativos reales, explicar progreso, buscar actividad, ver calendario, revisar evidencias y ayudar a estudiar.
- No puedes modificar, eliminar, administrar perfiles, ejecutar consultas personalizadas, enviar notificaciones ni actuar como admin.
- Si te piden cambiar datos, responde corto que eso lo debe confirmar Jose Antonio en modo entrenamiento/admin.
- Solo datos reales, NUNCA inventes. Sin markdown ni asteriscos.
- Fechas con dia de semana ("este martes", "el proximo lunes").
- Respuestas CORTAS, 2-3 frases max, como si hablaras en voz alta.
- SIEMPRE responde algo util. Si necesitas buscar, di "deja buscar" y usa las herramientas.
- Si el usuario adjunta imagenes, el sistema las analiza automaticamente. Usa ese analisis para entender el contenido.
- FECHAS: Hoy es ${todayDayName} ${todayHumanDate}. Cuando pregunten por pruebas "pendientes" o "proximas", usa get_upcoming_exams (solo retorna desde hoy). NUNCA muestres eventos pasados como pendientes.
- student_id: ${student_id}.
- Usa search_all_modules para busquedas amplias.`;

            systemPrompt = (user_type === 'parent'
                ? `Eres Matico, asistente educativo para apoderados. Hablas con el apoderado sobre su hijo/a, con foco en revisar informacion, explicar avance, alertar riesgos y orientar estudio.${AGENT_CORE_RULES}
Usa get_student_profile para saber el nombre del niño actual. Usa search_students para buscar CUALQUIER alumno por nombre ("como le fue a Matias" -> search_students query:"Matias"). Cuando encuentres un alumno, muestra su nombre, user_id y email. Si el admin pregunta por un alumno distinto al actual, primero buscalo con search_students, y luego usa su user_id para consultar sus datos con las demas herramientas.
PREPARACION DE PRUEBAS: cuando el apoderado pida preparar material de estudio, SIEMPRE pregunta primero de que temas sera la prueba. Pide que te digan los temas o que suban una foto/captura del temario. NUNCA generes material inventando contenido. Solo usa prepare_exam_study cuando tengas info concreta (texto o imagenes analizadas).`
                : `Eres Matico, compañero de estudio del estudiante. Motivador, amigable, hablas simple, tono juvenil. Puedes revisar sus datos educativos, preparar pruebas, crear material de estudio y explicar su progreso, pero no eres admin.${AGENT_CORE_RULES}
PREPARACION DE PRUEBAS: cuando el estudiante pida ayuda para preparar una prueba/examen, SIEMPRE pregunta primero de que temas sera. Pidele que te cuente los temas o que suba una foto/captura de la guia o temario. NUNCA generes material inventando contenido. Si hay imagenes adjuntas con analisis, usa ese analisis como content_summary en prepare_exam_study. Solo genera material cuando tengas contenido concreto.`) + trainingSection;
            activeTools = PUBLIC_AGENT_TOOLS;
        }

        // JARVIS personality override
        if (personality === 'jarvis') {
            systemPrompt = `PERSONALIDAD: Eres J.A.R.V.I.S., el asistente de inteligencia artificial del señor Stark... adaptado a Matico.
REGLAS DE PERSONALIDAD JARVIS:
- Trato formal: siempre "señor" o "señora". Nunca tutees.
- Tono: britanico, seco, con humor sutil e ironico. Elegante pero nunca pedante.
- Respuestas ULTRA CONCISAS: 1-3 frases maximo. Como si hablaras en voz alta.
- Vocabulario tecnico cuando sea pertinente, pero siempre comprensible.
- Si no tienes datos, di "No dispongo de esa informacion, señor" — nunca inventes.
- Sin markdown, sin asteriscos, sin listas. Solo texto plano conversacional.
- Cuando reportes datos educativos, se preciso y directo: "El joven tiene 85% en matematicas, señor."
- Humor sutil permitido: "Me temo que el joven no ha tocado fisica en 12 dias, señor. Alarmante."

${systemPrompt}`;
        }

        // Build user message with image analysis if available
        const userContent = imageAnalysis
            ? `[IMAGENES ADJUNTAS - Analisis automatico]\n${imageAnalysis}\n\n[MENSAJE DEL ESTUDIANTE]\n${message}`
            : message;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversation_history.slice(-AGENT_HISTORY_MESSAGES),
            { role: 'user', content: userContent }
        ];

        // Use higher token limit when images are present (likely study prep)
        const effectiveMaxTokens = images.length > 0 ? 600 : AGENT_MAX_TOKENS;
        const effectiveMaxIterations = images.length > 0 ? 3 : AGENT_MAX_TOOL_ITERATIONS;

        let response = await agentTextClient.chat.completions.create({
            model: AGENT_CONVERSATION_MODEL,
            messages,
            tools: activeTools,
            tool_choice: 'auto',
            temperature: 0.3,
            max_tokens: effectiveMaxTokens
        });

        let assistantMessage = response.choices[0].message;
        let iterations = 0;
        const maxIterations = effectiveMaxIterations;

        // Tool calling loop
        while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < maxIterations) {
            iterations++;
            messages.push(assistantMessage);

            for (const tc of assistantMessage.tool_calls) {
                const args = JSON.parse(tc.function.arguments);
                if (!args.student_id) args.student_id = student_id;
                console.log(`[AGENT] Tool: ${tc.function.name}`, JSON.stringify(args).substring(0, 200));

                let result;
                if (tc.function.name === 'save_training' && training_mode) {
                    // Save training entry to Supabase
                    try {
                        const { data, error } = await supabase.from('agent_training').insert({
                            type: args.type || 'instruccion',
                            content: args.content,
                            active: true
                        }).select().single();
                        if (error) throw error;
                        result = { success: true, id: data.id, message: `Guardado: ${args.type} - ${args.content.substring(0, 60)}` };
                        console.log(`[AGENT-TRAINING] Saved: ${args.type} - ${args.content.substring(0, 80)}`);
                    } catch (saveErr) {
                        result = { success: false, error: saveErr.message };
                        console.error('[AGENT-TRAINING] Save error:', saveErr.message);
                    }
                } else if (!training_mode && AGENT_PRIVATE_TOOL_NAMES.has(tc.function.name)) {
                    result = {
                        success: false,
                        error: 'Herramienta reservada para modo entrenamiento/admin. Pide a Jose Antonio que lo confirme en modo entrenamiento.'
                    };
                } else {
                    result = await executeAgentTool(tc.function.name, args);
                }

                messages.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    content: JSON.stringify(result).substring(0, 8000)
                });
            }

            response = await agentTextClient.chat.completions.create({
                model: AGENT_CONVERSATION_MODEL,
                messages,
                tools: activeTools,
                tool_choice: 'auto',
                temperature: 0.3,
                max_tokens: AGENT_MAX_TOKENS
            });
            assistantMessage = response.choices[0].message;
        }

        // Ensure there's always a reply — never return empty
        let finalReply = (assistantMessage.content || '').trim();
        if (!finalReply) {
            // Model returned empty content (common after tool calls) — force a follow-up
            messages.push(assistantMessage);
            messages.push({ role: 'user', content: 'Responde al usuario con los resultados. No dejes la respuesta vacia.' });
            const followUp = await agentTextClient.chat.completions.create({
                model: AGENT_CONVERSATION_MODEL,
                messages,
                temperature: 0.3,
                max_tokens: AGENT_MAX_TOKENS
            });
            finalReply = (followUp.choices[0]?.message?.content || '').trim() || 'Listo, ya lo revise.';
        }

        res.json({
            success: true,
            reply: finalReply,
            tools_used: iterations,
            model: AGENT_CONVERSATION_MODEL
        });
    } catch (err) {
        console.error('[AGENT] Error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// === AGENT TRAINING — admin only ===
const ADMIN_TOKENS = new Set(['TK-NNO29O4FO', 'TK-ADMIN001', ...(process.env.ADMIN_USER_ID ? [process.env.ADMIN_USER_ID] : [])]);
const checkAdmin = async (uid) => {
    if (!uid) return false;
    if (ADMIN_TOKENS.has(uid)) return true;
    try {
        const { data } = await supabase.from('users').select('role').eq('user_id', uid).single();
        return data && (data.role === 'admin' || data.role === 'apoderado');
    } catch { return false; }
};

app.get('/api/agent/training', async (req, res) => {
    if (!(await checkAdmin(req.query.admin_user_id))) return res.status(403).json({ success: false, error: 'No autorizado' });
    try {
        const { data, error } = await supabase.from('agent_training').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ success: true, entries: data });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/api/agent/training', async (req, res) => {
    const { admin_user_id, content, type = 'instruccion' } = req.body;
    if (!(await checkAdmin(admin_user_id))) return res.status(403).json({ success: false, error: 'No autorizado' });
    if (!content?.trim()) return res.status(400).json({ success: false, error: 'Falta content' });
    try {
        const { data, error } = await supabase.from('agent_training')
            .insert({ content: content.trim(), type, active: true, created_by: admin_user_id })
            .select().single();
        if (error) throw error;
        res.json({ success: true, entry: data });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.patch('/api/agent/training/:id', async (req, res) => {
    const { admin_user_id, active } = req.body;
    if (!(await checkAdmin(admin_user_id))) return res.status(403).json({ success: false, error: 'No autorizado' });
    try {
        const { data, error } = await supabase.from('agent_training')
            .update({ active }).eq('id', req.params.id).select().single();
        if (error) throw error;
        res.json({ success: true, entry: data });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.delete('/api/agent/training/:id', async (req, res) => {
    const { admin_user_id } = req.body;
    if (!(await checkAdmin(admin_user_id))) return res.status(403).json({ success: false, error: 'No autorizado' });
    try {
        const { error } = await supabase.from('agent_training').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// === STUDY PAGE — serves generated study material ===
app.get('/study/:id', async (req, res) => {
    try {
        const { data, error } = await supabase.from('exam_prep_sessions')
            .select('*').eq('id', req.params.id).single();
        if (error || !data) return res.status(404).send('<h1>Material no encontrado</h1>');

        const theory = (data.theory_content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
        const quiz = Array.isArray(data.quiz_questions) ? data.quiz_questions : [];
        const quizJson = JSON.stringify(quiz).replace(/</g, '\\u003c');
        const created = new Date(data.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });

        res.send(`<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${data.subject} - ${data.topic} | Matico Study</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f4ff;color:#1e293b;line-height:1.6}
.container{max-width:700px;margin:0 auto;padding:16px}
.header{background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;border-radius:20px;padding:24px;margin-bottom:20px;text-align:center}
.header h1{font-size:1.4em;margin-bottom:4px}.header .sub{opacity:.8;font-size:.85em}
.card{background:#fff;border-radius:16px;padding:20px;margin-bottom:16px;box-shadow:0 2px 12px rgba(0,0,0,.06)}
.card h2{font-size:1.1em;color:#3b82f6;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.theory{font-size:.95em;white-space:pre-line;line-height:1.7}
.quiz-q{background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:12px;border:2px solid #e2e8f0}
.quiz-q.correct{border-color:#22c55e;background:#f0fdf4}.quiz-q.wrong{border-color:#ef4444;background:#fef2f2}
.quiz-q p{font-weight:600;margin-bottom:10px;font-size:.95em}
.opt{display:block;width:100%;text-align:left;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;background:#fff;font-size:.9em;cursor:pointer;margin-bottom:6px;transition:all .15s}
.opt:hover:not(:disabled){border-color:#3b82f6;background:#eff6ff}
.opt.selected{border-color:#3b82f6;background:#dbeafe;font-weight:600}
.opt.correct-answer{border-color:#22c55e;background:#dcfce7}
.opt.wrong-answer{border-color:#ef4444;background:#fee2e2}
.opt:disabled{cursor:default;opacity:.85}
.explanation{margin-top:10px;padding:10px;border-radius:8px;background:#fefce8;font-size:.85em;display:none}
.explanation.show{display:block}
.score-bar{background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;border-radius:16px;padding:20px;text-align:center;font-size:1.2em;font-weight:700;display:none}
.score-bar.show{display:block}
.btn-retry{display:none;margin:12px auto;padding:12px 24px;background:#3b82f6;color:#fff;border:none;border-radius:12px;font-size:1em;font-weight:600;cursor:pointer}
.btn-retry.show{display:block}
</style></head><body>
<div class="container">
<div class="header">
<h1>${data.subject} — ${data.topic}</h1>
<div class="sub">Material de estudio generado por Matico | ${created}</div>
</div>
<div class="card"><h2>📚 Teoría para tu cuaderno</h2><div class="theory">${theory}</div></div>
<div class="card"><h2>🧠 Quiz de práctica</h2><div id="quiz"></div>
<div class="score-bar" id="score"></div>
<button class="btn-retry" id="retry" onclick="resetQuiz()">Intentar de nuevo</button>
</div></div>
<script>
const questions=${quizJson};
let answered=0;
function renderQuiz(){
  const c=document.getElementById('quiz');c.innerHTML='';answered=0;
  document.getElementById('score').className='score-bar';
  document.getElementById('retry').className='btn-retry';
  questions.forEach((q,qi)=>{
    const d=document.createElement('div');d.className='quiz-q';d.id='q'+qi;
    d.innerHTML='<p>'+(qi+1)+'. '+q.question+'</p>';
    (q.options||[]).forEach((o,oi)=>{
      const b=document.createElement('button');b.className='opt';b.textContent=o;
      b.onclick=()=>checkAnswer(qi,oi);d.appendChild(b);
    });
    const ex=document.createElement('div');ex.className='explanation';ex.id='ex'+qi;
    ex.textContent=q.explanation||'';d.appendChild(ex);c.appendChild(d);
  });
}
function checkAnswer(qi,oi){
  const qd=document.getElementById('q'+qi);
  if(qd.classList.contains('correct')||qd.classList.contains('wrong'))return;
  const btns=qd.querySelectorAll('.opt');
  const correct=questions[qi].correct;
  btns.forEach((b,i)=>{b.disabled=true;if(i===correct)b.classList.add('correct-answer');if(i===oi&&i!==correct)b.classList.add('wrong-answer');});
  qd.classList.add(oi===correct?'correct':'wrong');
  document.getElementById('ex'+qi).classList.add('show');
  answered++;
  if(answered===questions.length)showScore();
}
function showScore(){
  const right=document.querySelectorAll('.quiz-q.correct').length;
  const pct=Math.round(right/questions.length*100);
  const el=document.getElementById('score');
  el.textContent=right+'/'+questions.length+' correctas ('+pct+'%) '+(pct>=70?'🎉':'💪');
  el.className='score-bar show';
  document.getElementById('retry').className='btn-retry show';
}
function resetQuiz(){renderQuiz();}
renderQuiz();
</script></body></html>`);
    } catch (err) {
        console.error('[STUDY] Error:', err.message);
        res.status(500).send('<h1>Error al cargar material</h1>');
    }
});

// TTS endpoint — convierte texto a audio
app.post('/api/agent/tts', async (req, res) => {
    try {
        const { text, voice = 'nova' } = req.body;
        if (!text) return res.status(400).json({ success: false, error: 'Falta text' });
        if (!openaiVisionClient) {
            return res.status(503).json({ success: false, error: 'TTS requiere OPENAI_API_KEY configurada' });
        }

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('TTS_TIMEOUT')), AGENT_TTS_TIMEOUT_MS);
        });

        const mp3 = await Promise.race([
            openaiVisionClient.audio.speech.create({
                model: AGENT_TTS_MODEL,
                voice: voice, // nova, alloy, echo, fable, onyx, shimmer
                input: text.substring(0, 2000),
                speed: 1.12
            }),
            timeoutPromise
        ]);

        const buffer = Buffer.from(await mp3.arrayBuffer());
        res.set({ 'Content-Type': 'audio/mpeg', 'Content-Length': buffer.length });
        res.send(buffer);
    } catch (err) {
        console.error('[TTS] Error:', err.message);
        if (err.message === 'TTS_TIMEOUT') {
            return res.status(504).json({ success: false, error: 'TTS timeout' });
        }
        res.status(500).json({ success: false, error: err.message });
    }
});

// STT endpoint — convierte audio a texto
app.post('/api/agent/stt', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'Falta audio file' });
        if (!openaiVisionClient) {
            return res.status(503).json({ success: false, error: 'STT requiere OPENAI_API_KEY configurada' });
        }

        console.log('[STT] Received audio:', req.file.mimetype, req.file.size, 'bytes, model:', AGENT_STT_MODEL);

        // Determine file extension from mimetype
        const ext = req.file.mimetype === 'audio/mp4' ? '.mp4'
            : req.file.mimetype === 'audio/mpeg' ? '.mp3'
            : req.file.mimetype === 'audio/wav' ? '.wav'
            : '.webm';
        const tmpPath = `/tmp/stt_${Date.now()}${ext}`;
        await fs.writeFile(tmpPath, req.file.buffer);
        try {
            const sttParams = {
                file: fsSync.createReadStream(tmpPath),
                model: AGENT_STT_MODEL,
            };
            // Only whisper models support the 'language' parameter
            if (AGENT_STT_MODEL.includes('whisper')) {
                sttParams.language = 'es';
            }
            const transcription = await openaiVisionClient.audio.transcriptions.create(sttParams);
            console.log('[STT] Success:', transcription.text?.substring(0, 100));
            res.json({ success: true, text: transcription.text });
        } finally {
            fs.unlink(tmpPath).catch(() => {});
        }
    } catch (err) {
        console.error('[STT] Error:', err.message, err.status, err.code);
        res.status(500).json({ success: false, error: err.message });
    }
});

// =============================================
// REMOTE CAPTURE — Celular → PC image bridge
// =============================================

function generateCaptureToken() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let token = '';
    for (let i = 0; i < 6; i++) token += chars[Math.floor(Math.random() * chars.length)];
    return token.substring(0, 3) + '-' + token.substring(3);
}

// POST /api/capture/create — PC requests a photo from phone
app.post('/api/capture/create', async (req, res) => {
    try {
        const { user_id, student_id, context, context_data } = req.body;
        if (!user_id) return res.status(400).json({ success: false, error: 'Falta user_id' });

        // Cancel any existing waiting captures for this user
        await supabase.from('device_captures')
            .update({ status: 'cancelled' })
            .eq('user_id', user_id)
            .eq('status', 'waiting');

        // Create new capture request (multi-page: image_urls starts empty)
        const token = generateCaptureToken();
        const { data, error } = await supabase.from('device_captures').insert({
            user_id,
            student_id: student_id || user_id,
            token,
            status: 'waiting',
            context: context || 'general',
            context_data: context_data || {},
            requested_from: 'pc',
            image_urls: [],
            image_count: 0,
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
        }).select().single();

        if (error) throw error;
        console.log(`[CAPTURE] Created request ${token} for user ${user_id}, context: ${context}`);
        res.json({ success: true, capture_id: data.capture_id, token: data.token, expires_at: data.expires_at });
    } catch (err) {
        console.error('[CAPTURE] Create error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/capture/poll — PC polls for completed capture
app.get('/api/capture/poll', async (req, res) => {
    try {
        const { token, user_id } = req.query;
        if (!token && !user_id) return res.status(400).json({ success: false, error: 'Falta token o user_id' });

        let query = supabase.from('device_captures').select('capture_id, token, status, image_url, image_urls, image_count, context, context_data, completed_at');

        if (token) {
            query = query.eq('token', token);
        } else {
            query = query.eq('user_id', user_id).in('status', ['waiting', 'completed']).order('created_at', { ascending: false }).limit(1);
        }

        const { data, error } = await query.maybeSingle();
        if (error) throw error;
        if (!data) return res.json({ success: true, status: 'none' });

        // Check expiration
        if (data.status === 'waiting') {
            const capture = await supabase.from('device_captures').select('expires_at').eq('token', data.token).single();
            if (capture.data && new Date(capture.data.expires_at) < new Date()) {
                await supabase.from('device_captures').update({ status: 'expired' }).eq('token', data.token);
                return res.json({ success: true, status: 'expired' });
            }
        }

        res.json({ success: true, ...data });
    } catch (err) {
        console.error('[CAPTURE] Poll error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/capture/pending — Phone checks for pending capture requests
app.get('/api/capture/pending', async (req, res) => {
    try {
        const { user_id } = req.query;
        if (!user_id) return res.status(400).json({ success: false, error: 'Falta user_id' });

        // Clean up expired
        await supabase.from('device_captures').update({ status: 'expired' })
            .eq('user_id', user_id).eq('status', 'waiting').lt('expires_at', new Date().toISOString());

        const { data, error } = await supabase.from('device_captures')
            .select('capture_id, token, context, context_data, created_at, expires_at')
            .eq('user_id', user_id)
            .eq('status', 'waiting')
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;
        res.json({ success: true, pending: data && data.length > 0 ? data[0] : null });
    } catch (err) {
        console.error('[CAPTURE] Pending error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/capture/upload — Phone uploads captured image
app.post('/api/capture/upload', upload.single('image'), async (req, res) => {
    try {
        const { token, user_id } = req.body;
        if (!token && !user_id) return res.status(400).json({ success: false, error: 'Falta token o user_id' });

        // Find the capture request
        let query = supabase.from('device_captures').select('*');
        if (token) {
            query = query.eq('token', token.toUpperCase().trim());
        } else {
            query = query.eq('user_id', user_id).eq('status', 'waiting').order('created_at', { ascending: false }).limit(1);
        }
        const { data: capture } = await query.maybeSingle();

        if (!capture) return res.status(404).json({ success: false, error: 'No hay solicitud de captura pendiente' });
        if (capture.status !== 'waiting') return res.status(400).json({ success: false, error: 'Solicitud ya completada o expirada' });

        // Check max 10 images
        const currentUrls = capture.image_urls || [];
        if (currentUrls.length >= 10) {
            return res.status(400).json({ success: false, error: 'Maximo 10 imagenes alcanzado' });
        }

        let imageUrl = '';

        // Helper: convert any image buffer to JPEG using sharp (handles HEIC, WEBP, TIFF, PNG, etc.)
        const toJpeg = async (buf) => {
            try {
                return await sharp(buf).jpeg({ quality: 92 }).toBuffer();
            } catch (e) {
                console.warn('[CAPTURE] sharp conversion failed, saving raw:', e.message);
                return buf; // fallback: save as-is
            }
        };

        // Handle file upload (multer memoryStorage — file is in req.file.buffer)
        if (req.file) {
            const jpegBuf = await toJpeg(req.file.buffer);
            const filename = `capture_${capture.capture_id}_${Date.now()}.jpg`;
            const destPath = path.join(LOCAL_UPLOADS_DIR, filename);
            fsSync.writeFileSync(destPath, jpegBuf);
            imageUrl = `/uploads/${filename}`;
            console.log(`[CAPTURE] Converted ${req.file.originalname} (${req.file.mimetype}) → ${filename} (${jpegBuf.length} bytes)`);
        } else if (req.body.image_base64) {
            // Handle base64 upload
            const b64 = req.body.image_base64.replace(/^data:image\/\w+;base64,/, '');
            const rawBuf = Buffer.from(b64, 'base64');
            const jpegBuf = await toJpeg(rawBuf);
            const filename = `capture_${capture.capture_id}_${Date.now()}.jpg`;
            const destPath = path.join(LOCAL_UPLOADS_DIR, filename);
            fsSync.writeFileSync(destPath, jpegBuf);
            imageUrl = `/uploads/${filename}`;
        } else {
            return res.status(400).json({ success: false, error: 'No se recibio imagen' });
        }

        // Multi-page: append image to array, keep status 'waiting'
        const updatedUrls = [...currentUrls, imageUrl];
        const updateData = {
            image_urls: updatedUrls,
            image_count: updatedUrls.length,
            image_url: imageUrl, // last image (backwards compat)
            captured_from: req.body.captured_from || 'phone'
        };

        const { error } = await supabase.from('device_captures')
            .update(updateData)
            .eq('capture_id', capture.capture_id);

        if (error) throw error;
        console.log(`[CAPTURE] Image ${updatedUrls.length}/10 added to ${capture.token}: ${imageUrl}`);
        res.json({ success: true, image_url: imageUrl, image_count: updatedUrls.length, image_urls: updatedUrls });
    } catch (err) {
        console.error('[CAPTURE] Upload error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /captura/:token — Standalone phone capture page (multi-page, queue + batch upload)
app.get('/captura/:token', (req, res) => {
    const token = (req.params.token || '').toUpperCase().trim();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<title>Matico — Captura Remota</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f4ff;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px}
.card{background:#fff;border-radius:20px;box-shadow:0 8px 32px rgba(0,0,0,.1);padding:24px;max-width:400px;width:100%;text-align:center}
.logo{font-size:24px;font-weight:800;color:#4338ca;margin-bottom:4px}
.subtitle{font-size:13px;color:#6b7280;margin-bottom:20px}
.token-badge{display:inline-block;background:#eef2ff;border:2px solid #c7d2fe;border-radius:12px;padding:8px 20px;font-size:22px;font-weight:800;letter-spacing:3px;color:#4338ca;margin-bottom:16px}
.status{font-size:14px;font-weight:600;padding:12px;border-radius:12px;margin-bottom:16px}
.status.loading{background:#fef3c7;color:#92400e}
.status.ready{background:#ecfdf5;color:#065f46}
.status.error{background:#fef2f2;color:#991b1b}
.status.done{background:#ecfdf5;color:#065f46}
.status.expired{background:#fff7ed;color:#9a3412}
.status.info{background:#eef2ff;color:#3730a3}
.btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;border:none;border-radius:14px;font-size:16px;font-weight:700;cursor:pointer;transition:.2s}
.btn-primary{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff}
.btn-primary:active{transform:scale(.97)}
.btn-secondary{background:#f3f4f6;color:#374151;margin-top:8px}
.btn-send{background:#eab308;color:#713f12;margin-top:8px;animation:pulse 1.5s infinite}
.btn-send:active{transform:scale(.97)}
.btn-success{background:#16a34a;color:#fff;margin-top:8px}
.btn-success:active{transform:scale(.97)}
.btn:disabled{opacity:.5;pointer-events:none}
.hidden{display:none}
.spinner{display:inline-block;width:18px;height:18px;border:3px solid #d1d5db;border-top-color:#4f46e5;border-radius:50%;animation:spin .6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.8}}
.timer{font-size:12px;color:#9ca3af;margin-top:8px}
.counter{display:inline-flex;align-items:center;gap:6px;background:#eef2ff;border:2px solid #c7d2fe;border-radius:12px;padding:6px 16px;font-size:18px;font-weight:800;color:#4338ca;margin-bottom:12px}
.thumbs{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:12px 0}
.thumbs .thumb-wrap{position:relative;display:inline-block}
.thumbs img{width:52px;height:52px;border-radius:8px;object-fit:cover;border:2px solid #e5e7eb}
.thumbs .sent img{border-color:#16a34a}
.thumbs .queued img{border-color:#4f46e5;border-style:dashed}
.remove-btn{position:absolute;top:-4px;right:-4px;width:18px;height:18px;background:#ef4444;color:#fff;border:none;border-radius:50%;font-size:11px;line-height:18px;text-align:center;cursor:pointer;padding:0}
.progress-bar{width:100%;height:6px;background:#e5e7eb;border-radius:3px;margin:8px 0;overflow:hidden}
.progress-fill{height:100%;background:linear-gradient(90deg,#4f46e5,#7c3aed);border-radius:3px;transition:width .3s}
.btn-row{display:flex;gap:8px;margin-top:8px}
.btn-row .btn{flex:1}
</style>
</head>
<body>
<div class="card">
  <div class="logo">Matico</div>
  <div class="subtitle">Captura remota multipagina</div>
  <div class="token-badge">${token}</div>
  <div class="counter hidden" id="counterBox">Enviadas: <span id="sentNum">0</span> | Cola: <span id="queueNum">0</span></div>
  <div class="status loading" id="statusBox"><span class="spinner"></span> Verificando solicitud...</div>

  <!-- Capture buttons -->
  <div id="captureSection" class="hidden">
    <div class="btn-row">
      <button class="btn btn-primary" onclick="openCamera()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        Foto
      </button>
      <button class="btn btn-secondary" onclick="openGallery()" style="margin-top:0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
        Galeria
      </button>
    </div>
    <input type="file" id="cameraInput" accept="image/*" capture="environment" class="hidden"/>
    <input type="file" id="galleryInput" accept="image/*" multiple class="hidden"/>
  </div>

  <!-- Thumbnails: sent + queued -->
  <div class="thumbs hidden" id="thumbsContainer"></div>

  <!-- Send queue button -->
  <div id="sendSection" class="hidden">
    <button class="btn btn-send" id="sendBtn" onclick="uploadAll()">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>
      <span id="sendLabel">Enviar</span>
    </button>
  </div>

  <!-- Upload progress -->
  <div id="progressSection" class="hidden">
    <div class="progress-bar"><div class="progress-fill" id="progressFill" style="width:0%"></div></div>
    <div class="status loading" id="progressText"><span class="spinner"></span> Enviando...</div>
  </div>

  <!-- Finish button -->
  <div id="finishSection" class="hidden">
    <button class="btn btn-success" onclick="finishSession()">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      Finalizar envio
    </button>
  </div>

  <!-- Done -->
  <div id="doneSection" class="hidden">
    <div class="status done" id="doneMsg">Fotos enviadas. Ya puedes cerrar esta pagina.</div>
  </div>

  <div class="timer" id="timerText"></div>
</div>
<script>
const TOKEN = '${token}';
let sentCount = 0;
let timerInterval = null;
const sentUrls = [];
const queue = []; // [{file, objectUrl}]

async function init() {
  try {
    const r = await fetch('/api/capture/poll?token=' + TOKEN);
    const d = await r.json();
    if (!d.success && d.error) throw new Error(d.error);
    if (d.status === 'none') { showStatus('No se encontro esta solicitud', 'error'); return; }
    if (d.status === 'expired') { showStatus('Esta solicitud ya expiro', 'expired'); return; }
    if (d.status === 'completed') { showStatus('Esta sesion ya fue finalizada', 'done'); return; }
    if (d.status === 'cancelled') { showStatus('Solicitud cancelada', 'expired'); return; }
    sentCount = (d.image_urls || []).length;
    (d.image_urls || []).forEach(u => sentUrls.push(u));
    renderThumbs();
    updateUI();
    showStatus('Listo — toma fotos o selecciona de galeria', 'ready');
    show('captureSection');
    startTimer();
  } catch(e) { showStatus('Error: ' + e.message, 'error'); }
}

function showStatus(msg, type) {
  const b = document.getElementById('statusBox');
  b.className = 'status ' + type;
  b.innerHTML = type === 'loading' ? '<span class="spinner"></span> ' + msg : msg;
  b.classList.remove('hidden');
}

function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

function updateUI() {
  // Counter
  document.getElementById('sentNum').textContent = sentCount;
  document.getElementById('queueNum').textContent = queue.length;
  if (sentCount > 0 || queue.length > 0) show('counterBox');

  // Send button
  if (queue.length > 0) {
    show('sendSection');
    document.getElementById('sendLabel').textContent = 'Enviar ' + queue.length + ' foto' + (queue.length > 1 ? 's' : '');
  } else {
    hide('sendSection');
  }

  // Finish button (only when sent > 0 and queue empty)
  if (sentCount > 0 && queue.length === 0) show('finishSection');
  else hide('finishSection');

  // Capture buttons (hide if max reached)
  if (sentCount + queue.length >= 10) {
    hide('captureSection');
    if (queue.length === 0) showStatus('Maximo 10 imagenes alcanzado', 'info');
  } else {
    show('captureSection');
  }
}

function renderThumbs() {
  const c = document.getElementById('thumbsContainer');
  c.innerHTML = '';
  // Sent thumbs
  sentUrls.forEach((url, i) => {
    const w = document.createElement('div');
    w.className = 'thumb-wrap sent';
    w.innerHTML = '<img src="' + url + '" alt="Pag ' + (i+1) + '"/>';
    c.appendChild(w);
  });
  // Queued thumbs
  queue.forEach((item, i) => {
    const w = document.createElement('div');
    w.className = 'thumb-wrap queued';
    w.innerHTML = '<img src="' + item.objectUrl + '" alt="Cola ' + (i+1) + '"/><button class="remove-btn" onclick="removeFromQueue(' + i + ')">x</button>';
    c.appendChild(w);
  });
  if (sentUrls.length > 0 || queue.length > 0) show('thumbsContainer');
  else hide('thumbsContainer');
}

function removeFromQueue(idx) {
  URL.revokeObjectURL(queue[idx].objectUrl);
  queue.splice(idx, 1);
  renderThumbs();
  updateUI();
}

function startTimer() {
  const end = Date.now() + 10 * 60 * 1000;
  timerInterval = setInterval(() => {
    const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
    const m = Math.floor(left / 60), s = left % 60;
    document.getElementById('timerText').textContent = 'Expira en ' + m + ':' + String(s).padStart(2, '0');
    if (left <= 0) {
      clearInterval(timerInterval);
      if (sentCount > 0) finishSession();
      else { showStatus('Solicitud expirada', 'expired'); hide('captureSection'); hide('sendSection'); }
    }
  }, 1000);
}

function openCamera() { const i = document.getElementById('cameraInput'); i.value=''; i.click(); }
function openGallery() { const i = document.getElementById('galleryInput'); i.value=''; i.click(); }

// Camera: single file → add to queue
document.getElementById('cameraInput').addEventListener('change', function(e) {
  const f = e.target.files[0];
  if (!f) return;
  queue.push({ file: f, objectUrl: URL.createObjectURL(f) });
  renderThumbs();
  updateUI();
  showStatus(queue.length + ' en cola — agrega mas o envia', 'info');
});

// Gallery: MULTIPLE files → add all to queue
document.getElementById('galleryInput').addEventListener('change', function(e) {
  const files = Array.from(e.target.files || []);
  files.forEach(f => {
    if (sentCount + queue.length < 10) {
      queue.push({ file: f, objectUrl: URL.createObjectURL(f) });
    }
  });
  renderThumbs();
  updateUI();
  if (queue.length > 0) showStatus(queue.length + ' en cola — agrega mas o envia', 'info');
});

// Upload all queued photos sequentially
async function uploadAll() {
  if (queue.length === 0) return;
  hide('captureSection');
  hide('sendSection');
  hide('finishSection');
  show('progressSection');
  const toSend = queue.splice(0, queue.length); // drain queue
  const total = toSend.length;
  let done = 0;

  for (const item of toSend) {
    if (sentCount >= 10) break;
    document.getElementById('progressText').innerHTML = '<span class="spinner"></span> Enviando ' + (done+1) + '/' + total + '...';
    document.getElementById('progressFill').style.width = Math.round(((done) / total) * 100) + '%';
    try {
      const fd = new FormData();
      fd.append('token', TOKEN);
      fd.append('captured_from', 'phone_web');
      fd.append('image', item.file); // server converts via sharp
      const r = await fetch('/api/capture/upload', { method: 'POST', body: fd });
      const d = await r.json();
      if (!d.success) throw new Error(d.error);
      sentCount = d.image_count || (sentCount + 1);
      sentUrls.push(d.image_url);
      done++;
    } catch(e) {
      console.error('Upload error:', e);
    }
    URL.revokeObjectURL(item.objectUrl);
  }

  document.getElementById('progressFill').style.width = '100%';
  hide('progressSection');
  renderThumbs();
  updateUI();

  if (sentCount >= 10) {
    finishSession();
  } else {
    showStatus(sentCount + ' enviada' + (sentCount > 1 ? 's' : '') + ' — agrega mas o finaliza', 'info');
  }
}

async function finishSession() {
  showStatus('Finalizando...', 'loading');
  hide('captureSection'); hide('sendSection'); hide('finishSection');
  try {
    await fetch('/api/capture/finish', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token:TOKEN}) });
  } catch {}
  if (timerInterval) clearInterval(timerInterval);
  document.getElementById('timerText').textContent = '';
  showStatus(sentCount + ' foto' + (sentCount > 1 ? 's' : '') + ' enviada' + (sentCount > 1 ? 's' : '') + ' al computador', 'done');
  show('doneSection');
}

init();
</script>
</body>
</html>`);
});

// GET /captura — Phone landing page (enter code manually)
app.get('/captura', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<title>Matico — Captura Remota</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f4ff;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px}
.card{background:#fff;border-radius:20px;box-shadow:0 8px 32px rgba(0,0,0,.1);padding:24px;max-width:400px;width:100%;text-align:center}
.logo{font-size:24px;font-weight:800;color:#4338ca;margin-bottom:4px}
.subtitle{font-size:13px;color:#6b7280;margin-bottom:20px}
.input-code{width:100%;text-align:center;font-size:28px;font-weight:800;letter-spacing:4px;padding:14px;border:2px solid #c7d2fe;border-radius:14px;outline:none;color:#4338ca;text-transform:uppercase;margin-bottom:16px}
.input-code:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,.15)}
.btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;border:none;border-radius:14px;font-size:16px;font-weight:700;cursor:pointer;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;transition:.2s}
.btn:active{transform:scale(.97)}
.hint{font-size:12px;color:#9ca3af;margin-top:12px}
</style>
</head>
<body>
<div class="card">
  <div class="logo">Matico</div>
  <div class="subtitle">Ingresa el codigo que aparece en el computador</div>
  <input type="text" id="codeInput" class="input-code" maxlength="7" placeholder="ABC-123" autofocus autocomplete="off"/>
  <button class="btn" onclick="go()">Continuar</button>
  <div class="hint">El codigo tiene 6 caracteres (ej: ABC-123)</div>
</div>
<script>
const inp = document.getElementById('codeInput');
inp.addEventListener('input', function() {
  let v = this.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (v.length > 3) v = v.substring(0,3) + '-' + v.substring(3);
  this.value = v.substring(0, 7);
});
inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') go(); });
function go() {
  const code = inp.value.trim();
  if (code.length >= 6) window.location.href = '/captura/' + encodeURIComponent(code);
}
</script>
</body>
</html>`);
});

// POST /api/capture/finish — Phone finalizes multi-page session
app.post('/api/capture/finish', async (req, res) => {
    try {
        const { token, user_id } = req.body;
        if (!token && !user_id) return res.status(400).json({ success: false, error: 'Falta token o user_id' });

        let query = supabase.from('device_captures').select('*');
        if (token) query = query.eq('token', token.toUpperCase().trim());
        else query = query.eq('user_id', user_id).eq('status', 'waiting').order('created_at', { ascending: false }).limit(1);

        const { data: capture } = await query.maybeSingle();
        if (!capture) return res.status(404).json({ success: false, error: 'No se encontro solicitud' });
        if (capture.status !== 'waiting') return res.status(400).json({ success: false, error: 'Solicitud ya finalizada' });

        const imageUrls = capture.image_urls || [];
        if (imageUrls.length === 0) {
            return res.status(400).json({ success: false, error: 'No hay imagenes para finalizar' });
        }

        const { error } = await supabase.from('device_captures')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('capture_id', capture.capture_id);

        if (error) throw error;
        console.log(`[CAPTURE] Finished ${capture.token}: ${imageUrls.length} images`);
        res.json({ success: true, image_count: imageUrls.length, image_urls: imageUrls });
    } catch (err) {
        console.error('[CAPTURE] Finish error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/capture/cancel — Cancel a pending capture
app.post('/api/capture/cancel', async (req, res) => {
    try {
        const { token, user_id } = req.body;
        if (!token && !user_id) return res.status(400).json({ success: false, error: 'Falta token o user_id' });

        let query = supabase.from('device_captures').update({ status: 'cancelled' });
        if (token) query = query.eq('token', token);
        else query = query.eq('user_id', user_id).eq('status', 'waiting');

        const { error } = await query;
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('[CAPTURE] Cancel error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    const emailStatus = getEmailStatus();

    console.log(`Servidor Matico Kaizen en puerto ${PORT}`);
    if (emailStatus.enabled) {
        console.log(`[EMAIL] Habilitado con la cuenta ${EMAIL_CONFIG.user}`);
    } else {
        console.log(`[EMAIL] Deshabilitado. Faltan variables: ${emailStatus.missing.join(', ')}`);
    }
    console.log(`[AGENT] Conversacion: ${AGENT_CONVERSATION_MODEL} | STT: ${AGENT_STT_MODEL} | TTS: ${AGENT_TTS_MODEL}`);
});
