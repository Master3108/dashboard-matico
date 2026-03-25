import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GENERATED_QUESTIONS_DIR = path.join(__dirname, 'data');
const GENERATED_QUESTIONS_FILE = path.join(GENERATED_QUESTIONS_DIR, 'generated_questions.json');

let writeQueue = Promise.resolve();

const normalizeText = (value = '') => String(value)
    .trim()
    .replace(/\s+/g, ' ');

const normalizeOptions = (options = {}) => {
    const normalized = {};
    ['A', 'B', 'C', 'D'].forEach((letter) => {
        const value = options?.[letter];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            normalized[letter] = normalizeText(value);
        }
    });
    return normalized;
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

    const optionText = Object.values(normalizeOptions(options))
        .map(clean)
        .sort()
        .join(' | ');

    return `${clean(questionText)} || ${optionText}`;
};

const ensureStore = async () => {
    await fs.mkdir(GENERATED_QUESTIONS_DIR, { recursive: true });

    try {
        const raw = await fs.readFile(GENERATED_QUESTIONS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.items)) {
            throw new Error('Invalid generated question store');
        }
        return parsed;
    } catch {
        const initialStore = {
            version: 1,
            updatedAt: new Date().toISOString(),
            items: []
        };
        await fs.writeFile(GENERATED_QUESTIONS_FILE, JSON.stringify(initialStore, null, 2), 'utf8');
        return initialStore;
    }
};

const persistStore = async (store) => {
    await fs.mkdir(GENERATED_QUESTIONS_DIR, { recursive: true });
    await fs.writeFile(
        GENERATED_QUESTIONS_FILE,
        JSON.stringify({
            version: 1,
            updatedAt: new Date().toISOString(),
            items: store.items || []
        }, null, 2),
        'utf8'
    );
};

const withWriteLock = (task) => {
    const next = writeQueue.then(task, task);
    writeQueue = next.catch(() => {});
    return next;
};

const toGeneratedQuestionRecord = (question, meta = {}) => {
    const now = new Date().toISOString();
    const questionText = normalizeText(question?.question || '');
    if (!questionText) return null;

    const options = normalizeOptions(question?.options || {});
    const signature = normalizeQuestionSignature(questionText, options);
    const subject = normalizeText(meta.subject || question?.subject || '').toUpperCase();
    const sourceAction = normalizeText(meta.source_action || question?.source_action || 'generated_question');
    const sourceMode = normalizeText(meta.source_mode || question?.source_mode || '');
    const sourceSession = Number(question?.source_session ?? meta.source_session ?? 0) || 0;
    const batchIndex = Number(question?.batch_index ?? meta.batch_index ?? 0) || 0;
    const questionIndex = Number(question?.question_index ?? meta.question_index ?? 0) || 0;

    return {
        id: question?.id || `gq_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
        signature,
        question: questionText,
        options,
        correct_answer: normalizeText(question?.correct_answer || 'A').toUpperCase().slice(0, 1) || 'A',
        explanation: normalizeText(question?.explanation || 'Sin explicación disponible.'),
        subject,
        source_session: sourceSession,
        source_topic: normalizeText(question?.source_topic || meta.source_topic || ''),
        source_action: sourceAction,
        source_mode: sourceMode,
        levelName: normalizeText(question?.levelName || meta.levelName || meta.level || ''),
        batch_index: batchIndex,
        question_index: questionIndex,
        occurrences: Number(question?.occurrences || 1) || 1,
        created_at: question?.created_at || now,
        updated_at: now,
        last_generated_at: now,
        metadata: {
            ...(question?.metadata || {}),
            ...(meta.metadata || {}),
            origin_user_id: meta.user_id || question?.metadata?.origin_user_id || '',
            prompt_topic: normalizeText(meta.topic || question?.metadata?.prompt_topic || ''),
            created_via: sourceAction,
            source_mode: sourceMode
        }
    };
};

export const listGeneratedQuestions = async (filters = {}) => {
    const store = await ensureStore();
    const subjectFilter = normalizeText(filters.subject || '').toUpperCase();
    const sourceActionFilter = normalizeText(filters.source_action || '');

    return store.items
        .filter((item) => {
            if (subjectFilter && item.subject !== subjectFilter) return false;
            if (sourceActionFilter && item.source_action !== sourceActionFilter) return false;
            return true;
        })
        .slice()
        .sort((a, b) => new Date(b.last_generated_at || b.updated_at || b.created_at) - new Date(a.last_generated_at || a.updated_at || a.created_at));
};

export const sampleGeneratedQuestions = async (filters = {}) => {
    const store = await ensureStore();
    const subjectFilter = normalizeText(filters.subject || '').toUpperCase();
    const sourceModeFilter = normalizeText(filters.source_mode || '');
    const sourceActionFilter = normalizeText(filters.source_action || '');
    const sourceTopicFilter = normalizeText(filters.source_topic || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const levelFilter = normalizeText(filters.levelName || filters.level || '').toUpperCase();
    const sessionFilter = Number(filters.source_session || 0) || 0;
    const batchFilter = Number(filters.batch_index ?? filters.batchIndex ?? -1);
    const limit = Math.max(0, Number(filters.limit || 5) || 5);
    const excludeSignatures = new Set(
        Array.isArray(filters.exclude_signatures)
            ? filters.exclude_signatures.map((item) => normalizeText(item))
            : []
    );

    const normalizedTopic = (value = '') => normalizeText(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const matches = store.items.filter((item) => {
        if (excludeSignatures.has(normalizeText(item.signature))) return false;
        if (subjectFilter && item.subject !== subjectFilter) return false;
        if (sourceModeFilter && item.source_mode !== sourceModeFilter) return false;
        if (sourceActionFilter && item.source_action !== sourceActionFilter) return false;
        if (sessionFilter && Number(item.source_session || 0) !== sessionFilter) return false;
        if (batchFilter >= 0 && Number(item.batch_index ?? -1) !== batchFilter) return false;
        if (levelFilter) {
            const storedLevel = normalizeText(item.levelName || item.metadata?.level || '').toUpperCase();
            if (storedLevel !== levelFilter) return false;
        }
        if (sourceTopicFilter) {
            const itemTopic = normalizedTopic(item.source_topic || item.metadata?.prompt_topic || '');
            if (itemTopic && !itemTopic.includes(sourceTopicFilter) && !sourceTopicFilter.includes(itemTopic)) {
                return false;
            }
        }
        return true;
    });

    const shuffled = matches
        .slice()
        .sort(() => Math.random() - 0.5)
        .slice(0, limit)
        .map((item) => ({
            ...item,
            options: { ...(item.options || {}) },
            metadata: { ...(item.metadata || {}) }
        }));

    return shuffled;
};

export const recordGeneratedQuestions = async (questions = [], meta = {}) => {
    if (!Array.isArray(questions) || questions.length === 0) {
        return { inserted: 0, updated: 0, skipped: 0, total: 0 };
    }

    return withWriteLock(async () => {
        const store = await ensureStore();
        const now = new Date().toISOString();
        const bySignature = new Map(store.items.map((item) => [item.signature, item]));

        let inserted = 0;
        let updated = 0;
        let skipped = 0;

        for (const question of questions) {
            const normalized = toGeneratedQuestionRecord(question, meta);
            if (!normalized) {
                skipped += 1;
                continue;
            }

            const existing = bySignature.get(normalized.signature);
            if (existing) {
                existing.occurrences = Number(existing.occurrences || 1) + 1;
                existing.updated_at = now;
                existing.last_generated_at = now;
                existing.question = existing.question || normalized.question;
                existing.options = existing.options || normalized.options;
                existing.correct_answer = existing.correct_answer || normalized.correct_answer;
                existing.explanation = existing.explanation || normalized.explanation;
                existing.subject = existing.subject || normalized.subject;
                existing.source_session = existing.source_session || normalized.source_session;
                existing.source_topic = existing.source_topic || normalized.source_topic;
                existing.source_action = existing.source_action || normalized.source_action;
                existing.source_mode = existing.source_mode || normalized.source_mode;
                existing.levelName = existing.levelName || normalized.levelName;
                existing.batch_index = existing.batch_index || normalized.batch_index;
                existing.question_index = existing.question_index || normalized.question_index;
                existing.metadata = {
                    ...(existing.metadata || {}),
                    ...(normalized.metadata || {})
                };
                updated += 1;
                continue;
            }

            store.items.push(normalized);
            bySignature.set(normalized.signature, normalized);
            inserted += 1;
        }

        store.items.sort((a, b) => new Date(b.last_generated_at || b.updated_at || b.created_at) - new Date(a.last_generated_at || a.updated_at || a.created_at));
        await persistStore(store);

        return {
            inserted,
            updated,
            skipped,
            total: store.items.length
        };
    });
};

export const deleteGeneratedQuestion = async (questionId) => {
    if (!questionId) {
        throw new Error('Debes indicar question_id');
    }

    return withWriteLock(async () => {
        const store = await ensureStore();
        const originalLength = store.items.length;
        const removedItem = store.items.find((item) => item.id === questionId || item.signature === questionId);

        if (!removedItem) {
            throw new Error('La pregunta no existe');
        }

        store.items = store.items.filter((item) => item.id !== questionId && item.signature !== questionId);
        await persistStore(store);

        return {
            deleted: true,
            removed: removedItem,
            total: store.items.length,
            removedCount: originalLength - store.items.length
        };
    });
};
