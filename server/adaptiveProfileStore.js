import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'adaptive_profiles.json');

let writeQueue = Promise.resolve();

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toKey = (value = '') => String(value).trim().toUpperCase() || 'SIN_VALOR';

const safeNumber = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
};

const ensureStore = async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });

    try {
        const raw = await fs.readFile(STORE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !parsed.users) {
            throw new Error('invalid store');
        }
        return parsed;
    } catch {
        const initial = {
            version: 1,
            updatedAt: new Date().toISOString(),
            users: {}
        };
        await fs.writeFile(STORE_FILE, JSON.stringify(initial, null, 2), 'utf8');
        return initial;
    }
};

const persistStore = async (store) => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STORE_FILE, JSON.stringify({
        version: 1,
        updatedAt: new Date().toISOString(),
        users: store.users || {}
    }, null, 2), 'utf8');
};

const withLock = (task) => {
    const next = writeQueue.then(task, task);
    writeQueue = next.catch(() => {});
    return next;
};

const ensureUserNode = (store, userId) => {
    const key = String(userId || '').trim();
    if (!key) throw new Error('user_id requerido');

    if (!store.users[key]) {
        store.users[key] = {
            user_id: key,
            grades: {},
            updatedAt: new Date().toISOString()
        };
    }

    return store.users[key];
};

const ensureGradeNode = (userNode, grade) => {
    const gradeKey = toKey(grade || '1medio');
    if (!userNode.grades[gradeKey]) {
        userNode.grades[gradeKey] = {
            grade: gradeKey,
            subjects: {},
            updatedAt: new Date().toISOString()
        };
    }
    return userNode.grades[gradeKey];
};

const ensureSubjectNode = (gradeNode, subject) => {
    const subjectKey = toKey(subject);
    if (!gradeNode.subjects[subjectKey]) {
        gradeNode.subjects[subjectKey] = {
            subject: subjectKey,
            sessions: {},
            mastery: 0,
            totalAttempts: 0,
            totalCorrect: 0,
            totalQuestions: 0,
            weakSessions: [],
            strongSessions: [],
            nextAction: 'Comienza con una sesión guiada para construir base.',
            updatedAt: new Date().toISOString()
        };
    }
    return gradeNode.subjects[subjectKey];
};

const estimateTotalQuestions = (eventType, data = {}) => {
    const explicit = safeNumber(data.total_questions || data.total || data.questions_total || 0, 0);
    if (explicit > 0) return explicit;
    if (eventType === 'prep_exam_completed') return 45;
    if (eventType === 'phase_completed') return 15;
    if (eventType === 'quiz_completed') return 15;
    return 0;
};

const buildSessionRecommendation = (entry) => {
    if (entry.mastery >= 85) return 'Avanzar a la siguiente sesión';
    if (entry.mastery >= 65) return 'Hacer 5 preguntas nuevas para consolidar';
    if (entry.mastery >= 40) return 'Volver a teoría lúdica y repaso guiado';
    return 'Reestudiar la base y responder preguntas más simples';
};

const recalcSubjectSummary = (subjectNode) => {
    const sessions = Object.values(subjectNode.sessions || {});
    sessions.sort((a, b) => {
        const masteryDelta = (a.mastery || 0) - (b.mastery || 0);
        if (masteryDelta !== 0) return masteryDelta;
        return (b.lastEventAt || '').localeCompare(a.lastEventAt || '');
    });

    const totalMastery = sessions.reduce((sum, item) => sum + safeNumber(item.mastery, 0), 0);
    subjectNode.totalAttempts = sessions.reduce((sum, item) => sum + safeNumber(item.attempts, 0), 0);
    subjectNode.totalCorrect = sessions.reduce((sum, item) => sum + safeNumber(item.correct, 0), 0);
    subjectNode.totalQuestions = sessions.reduce((sum, item) => sum + safeNumber(item.totalQuestions, 0), 0);
    subjectNode.mastery = sessions.length ? Math.round(totalMastery / sessions.length) : 0;
    subjectNode.weakSessions = sessions
        .filter((item) => item.mastery < 70 || item.lastAccuracy < 75)
        .sort((a, b) => (a.mastery - b.mastery) || (a.lastAccuracy - b.lastAccuracy))
        .slice(0, 5)
        .map((item) => ({
            session: item.session,
            topic: item.topic,
            mastery: item.mastery,
            accuracy: item.lastAccuracy,
            recommendation: buildSessionRecommendation(item)
        }));
    subjectNode.strongSessions = sessions
        .filter((item) => item.mastery >= 85)
        .sort((a, b) => b.mastery - a.mastery)
        .slice(0, 5)
        .map((item) => ({
            session: item.session,
            topic: item.topic,
            mastery: item.mastery,
            accuracy: item.lastAccuracy
        }));

    const weakest = subjectNode.weakSessions[0];
    if (weakest) {
        subjectNode.nextAction = `Reforzar Sesión ${weakest.session}: ${weakest.topic}`;
    } else if (subjectNode.mastery >= 85) {
        subjectNode.nextAction = 'Avanzar al siguiente contenido del curso';
    } else {
        subjectNode.nextAction = 'Mantener ritmo con práctica guiada';
    }

    subjectNode.updatedAt = new Date().toISOString();
    return subjectNode;
};

const mergeEventIntoSession = (sessionNode, eventType, data, now) => {
    const totalQuestions = estimateTotalQuestions(eventType, data);
    const score = safeNumber(data.score || 0, 0);
    const accuracy = totalQuestions > 0 ? clamp(Math.round((score / totalQuestions) * 100), 0, 100) : 0;

    sessionNode.session = safeNumber(data.session || sessionNode.session || 0, 0);
    sessionNode.topic = data.topic || sessionNode.topic || '';
    sessionNode.levelName = data.levelName || sessionNode.levelName || '';
    sessionNode.grade = data.grade || sessionNode.grade || '1medio';
    sessionNode.subject = data.subject || sessionNode.subject || '';
    sessionNode.lastEventType = eventType;
    sessionNode.lastEventAt = now;
    sessionNode.lastScore = score;
    sessionNode.lastTotalQuestions = totalQuestions;
    sessionNode.lastAccuracy = accuracy;
    sessionNode.attempts = safeNumber(sessionNode.attempts, 0) + 1;
    sessionNode.totalQuestions = safeNumber(sessionNode.totalQuestions, 0) + totalQuestions;
    sessionNode.correct = safeNumber(sessionNode.correct, 0) + score;

    if (eventType === 'theory_started') {
        sessionNode.exposures = safeNumber(sessionNode.exposures, 0) + 1;
        sessionNode.mastery = clamp(Math.round(safeNumber(sessionNode.mastery, 0) * 0.9 + 4), 0, 100);
    } else if (eventType === 'theory_completed') {
        sessionNode.exposures = safeNumber(sessionNode.exposures, 0) + 1;
        sessionNode.mastery = clamp(Math.round(safeNumber(sessionNode.mastery, 0) * 0.8 + 8), 0, 100);
    } else if (eventType === 'cuaderno_completed') {
        sessionNode.mastery = clamp(Math.round(safeNumber(sessionNode.mastery, 0) * 0.88 + 6), 0, 100);
    } else {
        const masteryFromAccuracy = totalQuestions > 0 ? accuracy : (score > 0 ? 100 : 0);
        sessionNode.mastery = clamp(Math.round(safeNumber(sessionNode.mastery, 0) * 0.45 + masteryFromAccuracy * 0.55), 0, 100);
    }

    sessionNode.weak = sessionNode.mastery < 70 || sessionNode.lastAccuracy < 75;
    sessionNode.recommendation = buildSessionRecommendation(sessionNode);
    sessionNode.lastUpdatedAt = now;
    return sessionNode;
};

export const recordAdaptiveEvent = async ({ user_id, grade = '1medio', subject = '', session = '', topic = '', event_type = '', phase = '', levelName = '', score = '', total = '', xp = '', metadata = {} }) => {
    if (!user_id || !subject) return null;

    return withLock(async () => {
        const store = await ensureStore();
        const now = new Date().toISOString();
        const userNode = ensureUserNode(store, user_id);
        const gradeNode = ensureGradeNode(userNode, grade);
        const subjectNode = ensureSubjectNode(gradeNode, subject);
        const sessionKey = String(session || phase || '0');

        if (!subjectNode.sessions[sessionKey]) {
            subjectNode.sessions[sessionKey] = {
                session: safeNumber(session, 0),
                topic: topic || '',
                grade: grade || '1medio',
                subject: toKey(subject),
                mastery: 0,
                attempts: 0,
                correct: 0,
                totalQuestions: 0,
                weak: true,
                recommendation: 'Comienza con una sesión guiada para construir base.',
                createdAt: now,
                lastUpdatedAt: now,
                lastEventAt: now,
                lastEventType: event_type || 'progress_update',
                lastScore: safeNumber(score, 0),
                lastTotalQuestions: safeNumber(total, 0),
                lastAccuracy: 0,
                levelName: levelName || '',
                metadata: {}
            };
        }

        const sessionNode = subjectNode.sessions[sessionKey];
        if (topic) sessionNode.topic = topic;
        if (levelName) sessionNode.levelName = levelName;
        sessionNode.metadata = { ...(sessionNode.metadata || {}), ...metadata };

        mergeEventIntoSession(sessionNode, event_type || 'progress_update', { grade, subject, session, topic, levelName, score, total }, now);

        userNode.updatedAt = now;
        gradeNode.updatedAt = now;
        subjectNode.sessions[sessionKey] = sessionNode;

        recalcSubjectSummary(subjectNode);
        await persistStore(store);

        return {
            user_id,
            grade: gradeNode.grade,
            subject: subjectNode.subject,
            summary: buildSubjectSummary(subjectNode)
        };
    });
};

const buildSubjectSummary = (subjectNode) => ({
    subject: subjectNode.subject,
    mastery: subjectNode.mastery,
    totalAttempts: subjectNode.totalAttempts,
    totalCorrect: subjectNode.totalCorrect,
    totalQuestions: subjectNode.totalQuestions,
    nextAction: subjectNode.nextAction,
    weakSessions: subjectNode.weakSessions || [],
    strongSessions: subjectNode.strongSessions || [],
    sessions: Object.values(subjectNode.sessions || {}).sort((a, b) => a.session - b.session)
});

export const getAdaptiveSnapshot = async ({ user_id, grade = '1medio', subject = '' }) => {
    if (!user_id) return null;

    const store = await ensureStore();
    const userNode = store.users?.[user_id];
    if (!userNode) {
        return {
            user_id,
            grade,
            subject: toKey(subject),
            mastery: 0,
            totalAttempts: 0,
            totalCorrect: 0,
            totalQuestions: 0,
            nextAction: 'Comienza con una sesión guiada para construir base.',
            weakSessions: [],
            strongSessions: [],
            sessions: []
        };
    }

    const gradeNode = userNode.grades?.[toKey(grade)] || Object.values(userNode.grades || {})[0];
    if (!gradeNode) {
        return {
            user_id,
            grade,
            subject: toKey(subject),
            mastery: 0,
            totalAttempts: 0,
            totalCorrect: 0,
            totalQuestions: 0,
            nextAction: 'Comienza con una sesión guiada para construir base.',
            weakSessions: [],
            strongSessions: [],
            sessions: []
        };
    }

    if (subject) {
        const subjectNode = gradeNode.subjects?.[toKey(subject)];
        if (!subjectNode) {
            return {
                user_id,
                grade: gradeNode.grade,
                subject: toKey(subject),
                mastery: 0,
                totalAttempts: 0,
                totalCorrect: 0,
                totalQuestions: 0,
                nextAction: 'Aún no hay dominio registrado en esta materia.',
                weakSessions: [],
                strongSessions: [],
                sessions: []
            };
        }
        return {
            user_id,
            grade: gradeNode.grade,
            ...buildSubjectSummary(subjectNode)
        };
    }

    const subjectSummaries = Object.values(gradeNode.subjects || {}).map((node) => buildSubjectSummary(node));
    const weakest = subjectSummaries
        .flatMap((item) => item.weakSessions.map((session) => ({ ...session, subject: item.subject })))
        .sort((a, b) => (a.mastery - b.mastery) || (a.accuracy - b.accuracy))[0] || null;

    return {
        user_id,
        grade: gradeNode.grade,
        subjects: subjectSummaries,
        weakest,
        nextAction: weakest
            ? `Reforzar ${weakest.subject} - Sesión ${weakest.session}: ${weakest.topic}`
            : 'Todo va bien por ahora. Puedes avanzar al siguiente contenido.',
        overallMastery: subjectSummaries.length
            ? Math.round(subjectSummaries.reduce((sum, item) => sum + safeNumber(item.mastery, 0), 0) / subjectSummaries.length)
            : 0
    };
};

