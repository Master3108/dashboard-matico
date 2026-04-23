import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import cron from 'node-cron';
import { Readable } from 'stream';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { deleteGeneratedQuestion, listGeneratedQuestions, recordGeneratedQuestions, sampleGeneratedQuestions } from './generatedQuestionBank.js';
import { recordAdaptiveEvent, getAdaptiveSnapshot, backfillAdaptiveProfileFromProgressRows } from './adaptiveProfileStore.js';
import { getCurriculumContext } from './curriculumCatalog.js';
import { resolveMoralejaContext } from './moralejaCompetenciaLectora.js';
import { resolveMoralejaMatematicaContext } from './moralejaMatematica.js';
import { resolveMoralejaBiologiaContext } from './moralejaBiologia.js';
import { resolveMoralejaQuimicaContext } from './moralejaQuimica.js';
import { resolveMoralejaFisicaContext } from './moralejaFisica.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_UPLOADS_DIR = path.join(__dirname, 'uploads');
const NOTEBOOK_UPLOADS_DIR = path.join(LOCAL_UPLOADS_DIR, 'cuadernos');
const PEDAGOGICAL_ASSETS_UPLOADS_DIR = path.join(LOCAL_UPLOADS_DIR, 'quiz-assets');
const DATA_DIR = path.join(__dirname, 'data');
const NOTEBOOK_SUBMISSIONS_FILE = path.join(DATA_DIR, 'notebook_submissions.json');
const NOTEBOOK_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const NOTEBOOK_QUIZ_THRESHOLD = 80;

app.use('/uploads', express.static(LOCAL_UPLOADS_DIR));

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
    const rows = await getPedagogicalImageRows(sheets);
    const subjectFilter = normalizeSheetText(filters.subject).toUpperCase();
    const statusFilter = normalizePedagogicalImageStatus(filters.status || '');
    const searchFilter = normalizeSheetText(filters.search).toLowerCase();

    return rows
        .filter((row) => !subjectFilter || normalizeSheetText(row.subject).toUpperCase() === subjectFilter)
        .filter((row) => !filters.status || normalizePedagogicalImageStatus(row.status) === statusFilter)
        .filter((row) => {
            if (!searchFilter) return true;
            const haystack = [
                row.asset_id,
                row.title,
                row.subject,
                row.topic_tags,
                row.alt_text,
                row.caption
            ].map((item) => normalizeSheetText(item).toLowerCase()).join(' ');
            return haystack.includes(searchFilter);
        })
        .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())
        .map((row) => ({
            ...row,
            status: normalizePedagogicalImageStatus(row.status),
            absolute_file_url: buildAbsolutePublicUrl(row.file_url)
        }));
};

const findPedagogicalImageAssetById = async (sheets, assetId = '', { approvedOnly = false } = {}) => {
    const normalizedId = String(assetId || '').trim();
    if (!normalizedId) return null;
    const rows = await getPedagogicalImageRows(sheets);
    const found = rows.find((row) => String(row.asset_id || '').trim() === normalizedId) || null;
    if (!found) return null;
    if (approvedOnly && normalizePedagogicalImageStatus(found.status) !== 'approved') return null;
    return {
        ...found,
        status: normalizePedagogicalImageStatus(found.status),
        absolute_file_url: buildAbsolutePublicUrl(found.file_url)
    };
};

const updatePedagogicalImageAssetRow = async (sheets, assetId = '', patch = {}) => {
    const rows = await getPedagogicalImageRows(sheets);
    const current = rows.find((row) => String(row.asset_id || '').trim() === String(assetId || '').trim());
    if (!current) throw new Error('El asset pedagógico no existe');

    const next = {
        ...current,
        ...patch,
        updated_at: new Date().toISOString()
    };
    const values = PEDAGOGICAL_IMAGE_HEADERS.map((header) => String(next?.[header] || '').trim());
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PEDAGOGICAL_IMAGE_SHEET}!A${current.rowNumber}:N${current.rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: { values: [values] }
    });

    return {
        ...next,
        rowNumber: current.rowNumber,
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
    const normalizedSubject = normalizeSheetText(subject).toUpperCase();
    const assetId = await buildPedagogicalAssetId(sheets, normalizedSubject);
    const timestamp = new Date().toISOString();
    const record = {
        asset_id: assetId,
        title: String(title || '').trim(),
        subject: normalizedSubject,
        topic_tags: String(topicTags || '').trim(),
        kind: normalizePedagogicalImageKind(kind),
        file_name: String(fileName || '').trim(),
        file_url: String(fileUrl || '').trim(),
        mime_type: String(mimeType || '').trim(),
        alt_text: String(altText || '').trim(),
        caption: String(caption || '').trim(),
        source_type: String(sourceType || 'admin_upload').trim(),
        status: normalizePedagogicalImageStatus(status),
        created_at: timestamp,
        updated_at: timestamp
    };

    await ensureSheetHeaders(sheets, PEDAGOGICAL_IMAGE_SHEET, PEDAGOGICAL_IMAGE_HEADERS);
    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PEDAGOGICAL_IMAGE_SHEET}!A:N`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [PEDAGOGICAL_IMAGE_HEADERS.map((header) => String(record?.[header] || ''))]
        }
    });

    return {
        ...record,
        absolute_file_url: buildAbsolutePublicUrl(record.file_url)
    };
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
    const rows = await getQuestionBankRows(sheets);

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
    const subjectFilter = normalizeSheetText(subject).toUpperCase();
    const sessionFilter = Number(session || 0) || 0;
    const searchFilter = normalizeSheetText(search).toLowerCase();
    const rows = await getQuestionBankRows(sheets);

    return rows
        .filter((row) => normalizeSheetBool(row.active === '' ? 'TRUE' : row.active))
        .filter((row) => !subjectFilter || normalizeSheetText(row.subject).toUpperCase() === subjectFilter)
        .filter((row) => !sessionFilter || (Number(row.session || 0) || 0) === sessionFilter)
        .filter((row) => {
            if (!searchFilter) return true;
            const haystack = [
                row.question_id,
                row.topic,
                row.question
            ].map((item) => normalizeSheetText(item).toLowerCase()).join(' ');
            return haystack.includes(searchFilter);
        })
        .sort((a, b) => {
            const aSession = Number(a.session || 0) || 0;
            const bSession = Number(b.session || 0) || 0;
            if (aSession !== bSession) return bSession - aSession;
            return (Number(a.slot || 0) || 0) - (Number(b.slot || 0) || 0);
        })
        .slice(0, Math.max(1, Number(limit || 60) || 60))
        .map((row) => ({
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
            question_visual_role: normalizeQuestionVisualRole(row.question_visual_role || '')
        }));
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
        const finalScore = clampNumber(Math.min(safeAiScore, 100), 0, 100);
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

    const finalScore = clampNumber(Math.min(safeAiScore, strictScore), 0, 100);

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
        public_url: resolveNotebookPublicUrl(current),
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
            public_url: resolveNotebookPublicUrl(submission),
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
            const storedTheory = await findTheoryLudicaByKey(sheets, lookup);
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

            if (!isAdminEmail(req.body?.email || '')) {
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

        const draftId = `ORACLE_NOTEBOOK_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        oracleNotebookDrafts.set(draftId, {
            createdAt: Date.now(),
            user_id: String(user_id || '').trim(),
            email: String(email || '').trim(),
            question_count: Math.max(5, Math.min(45, Number(question_count || 15) || 15)),
            preview
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
            questions: firstQuestions,
            practice_guide: practiceGuide,
            source_mix: sourceMix
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

        return res.json({
            success: true,
            batch_index: batchIndex,
            total_batches: ctx.totalBatches,
            has_more: hasMore,
            questions,
            total_generated: newTotal,
            total_expected: ctx.questionCount
        });
    } catch (error) {
        console.error('[ORACLE_NOTEBOOK_GENERATE_BATCH] Error:', error.message);
        return res.status(500).json({ success: false, error: error.message || 'No se pudo generar la tanda' });
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
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Usuarios!A:I', // A:token, B:pass, C:created, D:mail, E:nombre, F:celular, G:region, H:comuna, I:correo_apoderado
    });
    const rows = response.data.values || [];
    const row = rows.find(r => r[0] === user_id);
    if (!row) return null;
    return {
        token: row[0],
        email: row[3] || '',
        nombre: row[4] || 'Estudiante',
        celular: row[5] || '',
        region: row[6] || '',
        comuna: row[7] || '',
        correo_apoderado: row[8] || '',
    };
};

// --- HELPER: Obtener TODOS los usuarios ---
const getAllUsersFromSheet = async (sheets) => {
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Usuarios!A:I',
    });
    const rows = response.data.values || [];
    // Saltar header (fila 1)
    return rows.slice(1).map(row => ({
        token: row[0] || '',
        email: row[3] || '',
        nombre: row[4] || 'Estudiante',
        correo_apoderado: row[8] || '',
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
        await ensureSheetHeaders(sheets, 'progress_log', PROGRESS_LOG_HEADERS);
        const timestamp = new Date().toISOString();
        const values = [
            timestamp,
            user_id || '',
            subject || '',
            session || '',
            event_type || '',
            phase || '',
            subLevel || '',
            levelName || '',
            score || '0',
            xp || '0',
            grade || '',
            topic || '',
            totalQuestions || '',
            sourceMode || '',
            batchIndex || '',
            batchSize || '',
            correctAnswers || '',
            wrongAnswers || '',
            wrongQuestionDetails || '',
            weakness || '',
            improvementPlan || ''
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'progress_log!A:U',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [values] },
        });

        console.log('[SHEET] ? ' + event_type + ' | User: ' + user_id + ' | Subj: ' + subject + ' | Phase: ' + phase + ' | XP: ' + xp);
    } catch (err) {
        console.error('[SHEET] ? Error:', err.message);
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
    const values = [
        timestamp,
        user_id || '',
        subject || '',
        session || '',
        event_type || '',
        phase || '',
        subLevel || '',
        levelName || '',
        score || '0',
        xp || '0',
        grade || '',
        topic || '',
        totalQuestions || '',
        sourceMode || '',
        batchIndex || '',
        batchSize || '',
        correctAnswers || '',
        wrongAnswers || '',
        wrongQuestionDetails || '',
        weakness || '',
        improvementPlan || ''
    ];

    try {
        await ensureSheetHeaders(sheets, 'progress_log', PROGRESS_LOG_HEADERS);
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'progress_log!A:U',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [values] },
        });
        console.log('[SHEET_APPEND_OK]', JSON.stringify({
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
        console.error('[SHEET_APPEND_FAIL]', JSON.stringify({
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

const findTheoryLudicaByKey = async (sheets, { subject = '', session = '', phase = '' } = {}) => {
    const key = resolveTheoryLookup({ subject, session, phase });
    if (!key.subject || !key.session || !key.phase) return null;

    const rows = await getTheoryLudicaRows(sheets);
    const matches = rows
        .filter((row) => normalizeSheetBool(row.active === '' ? 'TRUE' : row.active))
        .filter((row) => normalizeTheorySubject(row.subject) === key.subject)
        .filter((row) => normalizeTheorySession(row.session) === key.session)
        .filter((row) => normalizeTheoryPhase(row.phase) === key.phase)
        .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

    return matches[0] || null;
};

const listTheoryLudicaRowsForAdmin = async (sheets, {
    subject = '',
    session = '',
    phase = '',
    search = '',
    limit = 40
} = {}) => {
    const subjectFilter = normalizeTheorySubject(subject);
    const sessionFilter = normalizeTheorySession(session);
    const phaseFilter = normalizeTheoryPhase(phase);
    const searchFilter = normalizeSheetText(search).toLowerCase();
    const rows = await getTheoryLudicaRows(sheets);

    return rows
        .filter((row) => normalizeSheetBool(row.active === '' ? 'TRUE' : row.active))
        .filter((row) => !subjectFilter || normalizeTheorySubject(row.subject) === subjectFilter)
        .filter((row) => !sessionFilter || normalizeTheorySession(row.session) === sessionFilter)
        .filter((row) => !phaseFilter || normalizeTheoryPhase(row.phase) === phaseFilter)
        .filter((row) => {
            if (!searchFilter) return true;
            const haystack = [row.subject, row.session, row.phase, row.topic]
                .map((item) => normalizeSheetText(item).toLowerCase())
                .join(' ');
            return haystack.includes(searchFilter);
        })
        .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
        .slice(0, Math.max(1, Number(limit || 40) || 40))
        .map((row) => ({
            rowNumber: row.rowNumber,
            timestamp: row.timestamp,
            subject: row.subject,
            session: row.session,
            phase: row.phase,
            topic: row.topic,
            support_image_asset_id: row.support_image_asset_id || '',
            support_image_url: row.support_image_url || '',
            support_image_alt: row.support_image_alt || '',
            support_image_caption: row.support_image_caption || ''
        }));
};

const appendTheoryLudicaToSheet = async (sheets, {
    subject = '',
    session = '',
    phase = '',
    topic = '',
    theoryMarkdown = '',
    source = 'ai_generated',
    supportImage = null
} = {}) => {
    const key = resolveTheoryLookup({ subject, session, phase, topic });
    if (!key.subject || !key.session || !key.phase || !String(theoryMarkdown || '').trim()) return null;

    const rows = await getTheoryLudicaRows(sheets);
    const matchingRows = rows.filter((row) =>
        normalizeTheorySubject(row.subject) === key.subject
        && normalizeTheorySession(row.session) === key.session
        && normalizeTheoryPhase(row.phase) === key.phase
        && normalizeSheetBool(row.active === '' ? 'TRUE' : row.active)
    );

    for (const row of matchingRows) {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${THEORY_LUDICA_SHEET}!H${row.rowNumber}`,
            valueInputOption: 'RAW',
            requestBody: { values: [['FALSE']] }
        });
    }

    const timestamp = new Date().toISOString();
    const values = [[
        timestamp,
        key.subject,
        key.session,
        key.phase,
        String(topic || '').trim(),
        String(theoryMarkdown || '').trim(),
        String(source || 'ai_generated').trim(),
        'TRUE',
        String(supportImage?.asset_id || '').trim(),
        String(supportImage?.file_url || '').trim(),
        String(supportImage?.alt_text || '').trim(),
        String(supportImage?.caption || '').trim()
    ]];

    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${THEORY_LUDICA_SHEET}!A:L`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values }
    });

    return {
        timestamp,
        subject: key.subject,
        session: key.session,
        phase: key.phase,
        topic: String(topic || '').trim(),
        theory_markdown: String(theoryMarkdown || '').trim(),
        source: String(source || 'ai_generated').trim(),
        active: 'TRUE',
        support_image_asset_id: String(supportImage?.asset_id || '').trim(),
        support_image_url: String(supportImage?.file_url || '').trim(),
        support_image_alt: String(supportImage?.alt_text || '').trim(),
        support_image_caption: String(supportImage?.caption || '').trim()
    };
};

const linkQuestionBankAsset = async (sheets, { questionId = '', assetId = '' } = {}) => {
    const rows = await getQuestionBankRows(sheets);
    const target = rows.find((row) => String(row.question_id || '').trim() === String(questionId || '').trim());
    if (!target) throw new Error('La pregunta del banco no existe');

    let asset = null;
    if (assetId) {
        asset = await findPedagogicalImageAssetById(sheets, assetId, { approvedOnly: true });
        if (!asset) throw new Error('El asset no existe o no está aprobado');
    }

    const patch = {
        ...target,
        prompt_image_asset_id: asset?.asset_id || '',
        prompt_image_url: asset?.file_url || '',
        prompt_image_alt: asset?.alt_text || '',
        prompt_image_caption: asset?.caption || '',
        question_visual_role: asset ? normalizeQuestionVisualRole(target.question_visual_role || 'supporting') : ''
    };

    await updateSheetRowByHeaders(sheets, QUESTION_BANK_SHEET, QUESTION_BANK_HEADERS, target.rowNumber, patch);

    return {
        question_id: target.question_id,
        prompt_image_asset_id: patch.prompt_image_asset_id,
        prompt_image_url: patch.prompt_image_url,
        prompt_image_alt: patch.prompt_image_alt,
        prompt_image_caption: patch.prompt_image_caption,
        question_visual_role: patch.question_visual_role
    };
};

const updateQuestionVisualRole = async (sheets, { questionId = '', visualRole = '' } = {}) => {
    const rows = await getQuestionBankRows(sheets);
    const target = rows.find((row) => String(row.question_id || '').trim() === String(questionId || '').trim());
    if (!target) throw new Error('La pregunta del banco no existe');

    const patch = {
        ...target,
        question_visual_role: normalizeQuestionVisualRole(visualRole || target.question_visual_role || 'supporting')
    };

    await updateSheetRowByHeaders(sheets, QUESTION_BANK_SHEET, QUESTION_BANK_HEADERS, target.rowNumber, patch);
    return { question_id: target.question_id, question_visual_role: patch.question_visual_role };
};

const linkTheoryLudicaAsset = async (sheets, { rowNumber = 0, assetId = '' } = {}) => {
    const rows = await getTheoryLudicaRows(sheets);
    const target = rows.find((row) => Number(row.rowNumber) === Number(rowNumber));
    if (!target) throw new Error('La teoría no existe');

    let asset = null;
    if (assetId) {
        asset = await findPedagogicalImageAssetById(sheets, assetId, { approvedOnly: true });
        if (!asset) throw new Error('El asset no existe o no está aprobado');
    }

    const patch = {
        ...target,
        support_image_asset_id: asset?.asset_id || '',
        support_image_url: asset?.file_url || '',
        support_image_alt: asset?.alt_text || '',
        support_image_caption: asset?.caption || ''
    };

    await updateSheetRowByHeaders(sheets, THEORY_LUDICA_SHEET, THEORY_LUDICA_HEADERS, target.rowNumber, patch);

    return {
        rowNumber: target.rowNumber,
        support_image_asset_id: patch.support_image_asset_id,
        support_image_url: patch.support_image_url,
        support_image_alt: patch.support_image_alt,
        support_image_caption: patch.support_image_caption
    };
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
    await ensureSheetHeaders(sheets, EXAM_REMINDER_SHEET, EXAM_REMINDER_HEADERS);
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${EXAM_REMINDER_SHEET}!A:Q`
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

const appendExamReminderRow = async (sheets, record = {}) => {
    await ensureSheetHeaders(sheets, EXAM_REMINDER_SHEET, EXAM_REMINDER_HEADERS);
    const values = EXAM_REMINDER_HEADERS.map((header) => String(record?.[header] || ''));
    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${EXAM_REMINDER_SHEET}!A:Q`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] }
    });
};

const updateExamReminderRow = async (sheets, rowNumber, patch = {}) => {
    const rows = await getExamReminderRows(sheets);
    const current = rows.find((row) => Number(row.rowNumber) === Number(rowNumber));
    if (!current) return null;

    const next = { ...current, ...patch };
    const values = EXAM_REMINDER_HEADERS.map((header) => String(next?.[header] || ''));
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${EXAM_REMINDER_SHEET}!A${rowNumber}:Q${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] }
    });
    return { ...next, rowNumber };
};

const findExamReminderById = async (sheets, eventId = '') => {
    const normalized = String(eventId || '').trim();
    if (!normalized) return null;
    const rows = await getExamReminderRows(sheets);
    return rows.find((row) => String(row.event_id || '').trim() === normalized) || null;
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
    const headers = [
        'timestamp',
        'user_id',
        'grade',
        'subject',
        'session',
        'topic',
        'event_type',
        'mastery',
        'total_attempts',
        'total_correct',
        'total_questions',
        'next_action',
        'weak_sessions',
        'strong_sessions',
        'source_mode'
    ];
    const values = [
        timestamp,
        user_id || "",
        grade || "",
        subject || "",
        session || "",
        topic || "",
        event_type || "",
        mastery || 0,
        totalAttempts || 0,
        totalCorrect || 0,
        totalQuestions || 0,
        nextAction || "",
        JSON.stringify(weakSessions || []),
        JSON.stringify(strongSessions || []),
        sourceMode || ""
    ];

    await ensureSheetTabExists(sheets, ADAPTIVE_PROFILE_SHEET, headers);

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: ADAPTIVE_PROFILE_SHEET + '!A:O',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [values] },
        });
        console.log("[ADAPTIVE_SHEET_APPEND_OK]", JSON.stringify({
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
        console.error("[ADAPTIVE_SHEET_APPEND_FAIL]", JSON.stringify({
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

const buildTheoryUserPrompt = ({ topic = '', subject = '', session = 0, phase = '' } = {}) => {
    const segments = [`Tema solicitado: ${topic || 'Sin tema especificado'}`];
    const normalizedSubject = String(subject || '').toUpperCase();

    if (normalizedSubject) segments.push(`Asignatura: ${normalizedSubject}`);
    if (phase) segments.push(`Fase actual: ${phase}`);

    if (isReadingSubject(normalizedSubject)) {
        const moralejaContext = resolveMoralejaContext({
            topic,
            session,
            phase,
            mode: 'theory'
        });
        segments.push(`[BASE MORALEJA]\n${moralejaContext.theoryGuidance}`);
        segments.push('Cierra con una mini estrategia aplicable y un ejemplo breve de como resolver una pregunta tipo PAES.');
    } else if (isMathSubject(normalizedSubject)) {
        const moralejaMathContext = resolveMoralejaMatematicaContext({
            topic,
            session,
            phase,
            mode: 'theory'
        });
        segments.push(`[BASE MORALEJA MATEMATICA]\n${moralejaMathContext.theoryGuidance}`);
        segments.push('Cierra con un mini tip de procedimiento y un ejemplo breve estilo DEMRE/PAES.');
    } else if (isBiologySubject(normalizedSubject)) {
        const moralejaBiologiaContext = resolveMoralejaBiologiaContext({
            topic,
            session,
            phase,
            mode: 'theory'
        });
        segments.push(`[BASE MORALEJA BIOLOGIA]\n${moralejaBiologiaContext.theoryGuidance}`);
        segments.push('Cierra con una mini clave de analisis biologico y un ejemplo breve tipo DEMRE/PAES.');
    } else if (isChemistrySubject(normalizedSubject)) {
        const moralejaQuimicaContext = resolveMoralejaQuimicaContext({
            topic,
            session,
            phase,
            mode: 'theory'
        });
        segments.push(`[BASE MORALEJA QUIMICA]\n${moralejaQuimicaContext.theoryGuidance}`);
        segments.push('Cierra con una mini clave de resolucion quimica y un ejemplo breve tipo DEMRE/PAES.');
    } else if (isPhysicsSubject(normalizedSubject)) {
        const moralejaFisicaContext = resolveMoralejaFisicaContext({
            topic,
            session,
            phase,
            mode: 'theory'
        });
        segments.push(`[BASE MORALEJA FISICA]\n${moralejaFisicaContext.theoryGuidance}`);
        segments.push('Cierra con una mini clave de razonamiento fisico y un ejemplo breve tipo DEMRE/PAES.');
    }

    return segments.filter(Boolean).join('\n\n');
};

const buildReadingPromptContext = ({ topic = '', subject = '', session = 0, phase = '', batchIndex = 0, totalBatches = QUIZ_BATCHES_PER_PHASE, requestedCount = QUIZ_BATCH_SIZE }) => {
    const moralejaContext = resolveMoralejaContext({
        topic,
        session,
        phase,
        mode: 'quiz'
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

const buildMathPromptContext = ({ topic = '', subject = '', session = 0, phase = '', batchIndex = 0, totalBatches = QUIZ_BATCHES_PER_PHASE, requestedCount = QUIZ_BATCH_SIZE }) => {
    const moralejaMathContext = resolveMoralejaMatematicaContext({
        topic,
        session,
        phase,
        mode: 'quiz'
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

const buildBiologyPromptContext = ({ topic = '', subject = '', session = 0, phase = '', batchIndex = 0, totalBatches = QUIZ_BATCHES_PER_PHASE, requestedCount = QUIZ_BATCH_SIZE }) => {
    const moralejaBiologiaContext = resolveMoralejaBiologiaContext({
        topic,
        session,
        phase,
        mode: 'quiz'
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

const buildChemistryPromptContext = ({ topic = '', subject = '', session = 0, phase = '', batchIndex = 0, totalBatches = QUIZ_BATCHES_PER_PHASE, requestedCount = QUIZ_BATCH_SIZE }) => {
    const moralejaQuimicaContext = resolveMoralejaQuimicaContext({
        topic,
        session,
        phase,
        mode: 'quiz'
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

const buildPhysicsPromptContext = ({ topic = '', subject = '', session = 0, phase = '', batchIndex = 0, totalBatches = QUIZ_BATCHES_PER_PHASE, requestedCount = QUIZ_BATCH_SIZE }) => {
    const moralejaFisicaContext = resolveMoralejaFisicaContext({
        topic,
        session,
        phase,
        mode: 'quiz'
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

app.post('/webhook/MATICO', async (req, res) => {
    const body = req.body;
    const currentAction = body.action || body.accion || '';
    const user_id = body.user_id;
    const data = body.data || {};

    console.log(`[MATICO] Accion: "${currentAction}" | Topic: ${body.tema || body.topic || '(sin tema)'}`);

    try {
        const sheets = await getSheetsClient();

        // 1. LOGIN / REGISTER
        if (currentAction === 'login' || currentAction === 'register') {
            const { email, password, name, phone, region, commune, correo_apoderado } = body;

            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Usuarios!A:I',
            });
            const rows = response.data.values || [];
            const user = rows.find(row => row[3] === email);

            if (currentAction === 'login') {
                if (user && user[1] === password) {
                    return res.json({ success: true, user_id: user[0], name: user[4] || 'Estudiante' });
                }
                return res.status(401).json({ success: false, message: "Credenciales invÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lidas" });
            }

            if (currentAction === 'register') {
                if (user) return res.status(400).json({ success: false, message: "El usuario ya existe" });
                const newToken = `TK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                await sheets.spreadsheets.values.append({
                    spreadsheetId: SPREADSHEET_ID,
                    range: 'Usuarios!A:I',
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [[newToken, password, new Date().toISOString(), email, name || 'Estudiante', phone || '', region || '', commune || '', correo_apoderado || '']]
                    },
                });
                return res.json({ success: true, user_id: newToken, name: name || 'Estudiante' });
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
                    const storedTheory = await findTheoryLudicaByKey(sheets, theoryLookup);
                    if (storedTheory?.theory_markdown) {
                        return res.json({
                            output: storedTheory.theory_markdown,
                            theory_source: 'sheet',
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

            const systemMsg = `Eres Matico, un mentor carismatico y experto en el curriculum chileno de 1ro Medio.
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
                        phase: theoryPhase
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
                        source: 'ai_generated'
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
                    requestedCount
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
                    requestedCount
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
                    requestedCount
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
                    requestedCount
                })
                : null;

            const seenSignatures = new Set(
                excludeSignatures
                    .map((item) => String(item || '').trim())
                    .filter(Boolean)
            );

            const useSpreadsheetQuestionBank = isMathSubject(subject) || isReadingSubject(subject);
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
                source: useSpreadsheetQuestionBank ? 'spreadsheet' : 'local_json'
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
                        source_action: question.source_action || (useSpreadsheetQuestionBank ? 'question_bank' : 'generate_quiz')
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
                    requestedCount: aiRequestedCount
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
                    requestedCount: aiRequestedCount
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
                    requestedCount: aiRequestedCount
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
                    requestedCount: aiRequestedCount
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
            if (!isAdminEmail(body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }

            const files = await listNotebookFiles();
            return res.json({ success: true, files });
        }

        if (currentAction === 'delete_notebook_file') {
            if (!isAdminEmail(body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }

            if (!body.file_name) {
                return res.status(400).json({ success: false, error: 'Debes indicar file_name' });
            }

            await deleteNotebookFile(body.file_name);
            return res.json({ success: true, deleted: body.file_name });
        }

        if (currentAction === 'list_generated_questions') {
            if (!isAdminEmail(body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }

            const items = await listGeneratedQuestions({
                subject: body.subject || '',
                source_action: body.source_action || ''
            });
            return res.json({ success: true, items, count: items.length });
        }

        if (currentAction === 'delete_generated_question') {
            if (!isAdminEmail(body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }

            if (!body.question_id) {
                return res.status(400).json({ success: false, error: 'Debes indicar question_id' });
            }

            const result = await deleteGeneratedQuestion(body.question_id);
            return res.json({ success: true, ...result });
        }

        if (currentAction === 'list_pedagogical_assets') {
            if (!isAdminEmail(body.email)) {
                return res.status(403).json({ success: false, error: 'Acceso solo para administrador' });
            }

            const items = await listPedagogicalImageAssets(sheets, {
                subject: body.subject || '',
                status: body.status || '',
                search: body.search || ''
            });
            return res.json({ success: true, items, count: items.length });
        }

        if (currentAction === 'update_pedagogical_asset_status') {
            if (!isAdminEmail(body.email)) {
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
            if (!isAdminEmail(body.email)) {
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

        if (currentAction === 'list_theory_rows') {
            if (!isAdminEmail(body.email)) {
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
            if (!isAdminEmail(body.email)) {
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
            if (!isAdminEmail(body.email)) {
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
            if (!isAdminEmail(body.email)) {
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

cron.schedule('15 3 * * *', async () => {
    try {
        const expiredCount = await cleanupExpiredNotebookSubmissions();
        console.log(`[CRON_NOTEBOOK] Limpieza de cuadernos completada. Expirados: ${expiredCount}`);
    } catch (error) {
        console.error('[CRON_NOTEBOOK] Error limpiando cuadernos:', error.message);
    }
}, { timezone: 'America/Santiago' });

app.listen(PORT, () => {
    const emailStatus = getEmailStatus();

    console.log(`Servidor Matico Kaizen en puerto ${PORT}`);
    if (emailStatus.enabled) {
        console.log(`[EMAIL] Habilitado con la cuenta ${EMAIL_CONFIG.user}`);
    } else {
        console.log(`[EMAIL] Deshabilitado. Faltan variables: ${emailStatus.missing.join(', ')}`);
    }
});
