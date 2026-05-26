// =====================================================================
// MATICO - runtimeWrites.js
// =====================================================================
// Todas las operaciones de lectura/escritura a Supabase para el backend.
// Reemplaza las antiguas funciones que escribían a Google Sheets.
//
// Cada función mapea los nombres legacy (usados en index.js) a las
// columnas reales de Supabase definidas en supabase/01_schema.sql.
// =====================================================================

import { supabase, ensureSupabaseOk } from './supabaseClient.js';
import crypto from 'crypto';

// ----- helpers internos -----

const generateId = (prefix = 'ID') => {
    const ts = Date.now().toString(36);
    const rnd = crypto.randomBytes(4).toString('hex');
    return `${prefix}_${ts}_${rnd}`;
};

/** Convierte options JSONB {A:'..', B:'..', C:'..', D:'..'} a campos planos */
const flattenOptions = (row) => {
    const opts = row.options || {};
    return {
        option_a: opts.A || opts.a || '',
        option_b: opts.B || opts.b || '',
        option_c: opts.C || opts.c || '',
        option_d: opts.D || opts.d || '',
    };
};

/**
 * Transforma una fila de question_bank de Supabase al shape que espera
 * index.js (con option_a/b/c/d planos y campos legacy).
 */
const mapQuestionRow = (row) => {
    if (!row) return null;
    const flat = flattenOptions(row);
    return {
        question_id: row.question_id,
        subject: row.subject,
        session: row.session,
        phase: row.phase,
        slot: row.slot,
        proposal_index: row.proposal_index,
        levelName: row.level_name || '',
        level_name: row.level_name || '',
        topic: row.topic || '',
        question: row.question,
        options: row.options,
        ...flat,
        correct_answer: row.correct_answer,
        explanation: row.explanation || '',
        source_mode: row.source_mode || '',
        active: row.active,
        prompt_image_asset_id: row.prompt_image_asset_id || '',
        prompt_image_url: '',   // se resuelve en join o en caller
        prompt_image_alt: '',
        prompt_image_caption: '',
        question_visual_role: row.question_visual_role || '',
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
};

/**
 * Transforma una fila de pedagogical_assets al shape legacy.
 * El campo clave para los callers es `file_url` (relativo /uploads/...).
 */
const mapAssetRow = (row) => {
    if (!row) return null;
    return {
        asset_id: row.asset_id,
        title: row.title || '',
        subject: row.subject || '',
        topicTags: row.topic_tags || '',
        topic_tags: row.topic_tags || '',
        kind: row.kind || '',
        file_name: row.storage_path ? row.storage_path.split('/').pop() : '',
        file_url: row.public_url || row.storage_path || '',
        storage_path: row.storage_path || '',
        public_url: row.public_url || '',
        mime_type: row.mime_type || '',
        altText: row.alt_text || '',
        alt_text: row.alt_text || '',
        caption: row.caption || '',
        sourceType: row.source_type || '',
        source_type: row.source_type || '',
        status: row.status || 'draft',
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
};

// =====================================================================
// 1. PEDAGOGICAL ASSETS
// =====================================================================

export const createRuntimePedagogicalAsset = async ({
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
    const asset_id = generateId('IMG');
    const storagePath = fileUrl.startsWith('/uploads/')
        ? fileUrl
        : (fileName ? `/uploads/quiz-assets/${fileName}` : fileUrl);

    const { data, error } = await supabase
        .from('pedagogical_assets')
        .insert({
            asset_id,
            title,
            subject: subject || null,
            topic_tags: topicTags,
            kind,
            storage_path: storagePath,
            public_url: fileUrl || storagePath,
            mime_type: mimeType,
            alt_text: altText,
            caption,
            source_type: sourceType,
            status,
        })
        .select()
        .single();

    if (error) throw new Error(`createRuntimePedagogicalAsset: ${error.message}`);
    return mapAssetRow(data);
};

export const findRuntimePedagogicalAssetById = async (assetId, { approvedOnly = false } = {}) => {
    let query = supabase
        .from('pedagogical_assets')
        .select('*')
        .eq('asset_id', assetId);

    if (approvedOnly) query = query.eq('status', 'approved');

    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`findRuntimePedagogicalAssetById: ${error.message}`);
    return data ? mapAssetRow(data) : null;
};

export const listRuntimePedagogicalAssets = async (filters = {}) => {
    let query = supabase.from('pedagogical_assets').select('*');

    if (filters.subject) query = query.eq('subject', filters.subject);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.kind) query = query.eq('kind', filters.kind);
    if (filters.search) query = query.ilike('title', `%${filters.search}%`);
    if (filters.limit) query = query.limit(filters.limit);

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw new Error(`listRuntimePedagogicalAssets: ${error.message}`);
    return (data || []).map(mapAssetRow);
};

export const updateRuntimePedagogicalAsset = async (assetId, patch = {}) => {
    const updateObj = {};
    if (patch.title !== undefined) updateObj.title = patch.title;
    if (patch.subject !== undefined) updateObj.subject = patch.subject;
    if (patch.topicTags !== undefined) updateObj.topic_tags = patch.topicTags;
    if (patch.topic_tags !== undefined) updateObj.topic_tags = patch.topic_tags;
    if (patch.kind !== undefined) updateObj.kind = patch.kind;
    if (patch.fileName !== undefined) {
        updateObj.storage_path = `/uploads/quiz-assets/${patch.fileName}`;
    }
    if (patch.fileUrl !== undefined) {
        updateObj.public_url = patch.fileUrl;
        updateObj.storage_path = patch.fileUrl.startsWith('/uploads/')
            ? patch.fileUrl
            : (updateObj.storage_path || patch.fileUrl);
    }
    if (patch.mimeType !== undefined) updateObj.mime_type = patch.mimeType;
    if (patch.altText !== undefined) updateObj.alt_text = patch.altText;
    if (patch.caption !== undefined) updateObj.caption = patch.caption;
    if (patch.sourceType !== undefined) updateObj.source_type = patch.sourceType;
    if (patch.status !== undefined) updateObj.status = patch.status;
    updateObj.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('pedagogical_assets')
        .update(updateObj)
        .eq('asset_id', assetId)
        .select()
        .single();

    if (error) throw new Error(`updateRuntimePedagogicalAsset: ${error.message}`);
    return mapAssetRow(data);
};

// =====================================================================
// 2. QUESTION BANK
// =====================================================================

export const createRuntimeQuestionBankQuestion = async ({
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
    questionVisualRole = ''
} = {}) => {
    const question_id = generateId('QB');
    const optionsJsonb = typeof options === 'object' ? options : { A: '', B: '', C: '', D: '' };

    const row = {
        question_id,
        grade: '1medio',  // default; callers can override if needed
        subject,
        session: Number(session) || 0,
        phase: Number(phase) || 0,
        slot: Number(slot) || null,
        proposal_index: Number(proposalIndex) || 1,
        level_name: levelName,
        topic,
        question,
        options: optionsJsonb,
        correct_answer: correctAnswer,
        explanation,
        source_mode: sourceMode,
        active: true,
        prompt_image_asset_id: promptImage || null,
        question_visual_role: questionVisualRole || null,
    };

    const { data, error } = await supabase
        .from('question_bank')
        .insert(row)
        .select()
        .single();

    if (error) throw new Error(`createRuntimeQuestionBankQuestion: ${error.message}`);
    return mapQuestionRow(data);
};

export const listRuntimeQuestionBankRowsForAdmin = async ({
    subject = '',
    session = '',
    phase = '',
    search = '',
    limit = 60
} = {}) => {
    let query = supabase.from('question_bank').select('*');

    if (subject) query = query.eq('subject', subject);
    if (session) query = query.eq('session', Number(session));
    if (phase) query = query.eq('phase', Number(phase));
    if (search) query = query.ilike('question', `%${search}%`);
    query = query.eq('active', true);
    query = query.order('session', { ascending: true })
                 .order('phase', { ascending: true })
                 .order('slot', { ascending: true });
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(`listRuntimeQuestionBankRowsForAdmin: ${error.message}`);

    return (data || []).map((row) => {
        const mapped = mapQuestionRow(row);
        // Enrich with image URL from joined asset if present
        return mapped;
    });
};

export const listRuntimeQuestionBankImageCandidates = async ({
    subject = '',
    session = '',
    phase = '',
    limit = 45
} = {}) => {
    // Questions that are active AND don't have an image yet
    let query = supabase
        .from('question_bank')
        .select('*')
        .eq('active', true)
        .is('prompt_image_asset_id', null);

    if (subject) query = query.eq('subject', subject);
    if (session) query = query.eq('session', Number(session));
    if (phase) query = query.eq('phase', Number(phase));
    query = query.order('slot', { ascending: true });
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(`listRuntimeQuestionBankImageCandidates: ${error.message}`);
    return (data || []).map(mapQuestionRow);
};

export const countRuntimeQuestionsWithImageInPhase = async ({
    subject = '',
    session = '',
    phase = ''
} = {}) => {
    const { count, error } = await supabase
        .from('question_bank')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)
        .eq('subject', subject)
        .eq('session', Number(session))
        .eq('phase', Number(phase))
        .not('prompt_image_asset_id', 'is', null);

    if (error) throw new Error(`countRuntimeQuestionsWithImageInPhase: ${error.message}`);
    return count || 0;
};

export const linkRuntimeQuestionBankAsset = async ({ questionId = '', assetId = '' } = {}) => {
    const { data, error } = await supabase
        .from('question_bank')
        .update({
            prompt_image_asset_id: assetId || null,
            updated_at: new Date().toISOString(),
        })
        .eq('question_id', questionId)
        .select()
        .single();

    if (error) throw new Error(`linkRuntimeQuestionBankAsset: ${error.message}`);
    return mapQuestionRow(data);
};

export const updateRuntimeQuestionVisualRole = async ({ questionId = '', visualRole = '' } = {}) => {
    const { data, error } = await supabase
        .from('question_bank')
        .update({
            question_visual_role: visualRole || null,
            updated_at: new Date().toISOString(),
        })
        .eq('question_id', questionId)
        .select()
        .single();

    if (error) throw new Error(`updateRuntimeQuestionVisualRole: ${error.message}`);
    return mapQuestionRow(data);
};

export const updateRuntimeExistingQuestionWithImage = async ({
    questionId = '',
    asset = null,
    visualRole = '',
    topic = '',
    question = '',
    options = null,
    correctAnswer = '',
    explanation = ''
} = {}) => {
    const updateObj = {
        updated_at: new Date().toISOString(),
    };

    if (asset && asset.asset_id) {
        updateObj.prompt_image_asset_id = asset.asset_id;
    }
    if (visualRole) updateObj.question_visual_role = visualRole;
    if (topic) updateObj.topic = topic;
    if (question) updateObj.question = question;
    if (options && typeof options === 'object') {
        // Normalize: accept both {A,B,C,D} or {a,b,c,d}
        updateObj.options = {
            A: options.A || options.a || '',
            B: options.B || options.b || '',
            C: options.C || options.c || '',
            D: options.D || options.d || '',
        };
    }
    if (correctAnswer) updateObj.correct_answer = correctAnswer;
    if (explanation) updateObj.explanation = explanation;

    const { data, error } = await supabase
        .from('question_bank')
        .update(updateObj)
        .eq('question_id', questionId)
        .select()
        .single();

    if (error) throw new Error(`updateRuntimeExistingQuestionWithImage: ${error.message}`);
    return mapQuestionRow(data);
};

// =====================================================================
// 3. THEORY LUDICA
// =====================================================================

export const findRuntimeTheoryLudicaByKey = async ({ subject = '', session = '', phase = '', grade = '1medio' } = {}) => {
    const normalizedGrade = String(grade || '').trim().toLowerCase() === '2medio' ? '2medio' : '1medio';
    const { data, error } = await supabase
        .from('theory_ludica_bank')
        .select('*')
        .eq('grade', normalizedGrade)
        .eq('subject', subject)
        .eq('session', Number(session))
        .eq('phase', Number(phase))
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw new Error(`findRuntimeTheoryLudicaByKey: ${error.message}`);
    if (!data) return null;

    return {
        id: data.id,
        grade: data.grade || '1medio',
        subject: data.subject,
        session: data.session,
        phase: data.phase,
        topic: data.topic || '',
        theoryMarkdown: data.theory_markdown || '',
        theory_markdown: data.theory_markdown || '',
        source: data.source || '',
        active: data.active,
        support_image_asset_id: data.support_image_asset_id || '',
        created_at: data.created_at,
    };
};

export const listRuntimeTheoryLudicaRowsForAdmin = async ({
    subject = '',
    session = '',
    phase = '',
    search = '',
    limit = 40
} = {}) => {
    let query = supabase.from('theory_ludica_bank').select('*');

    if (subject) query = query.eq('subject', subject);
    if (session) query = query.eq('session', Number(session));
    if (phase) query = query.eq('phase', Number(phase));
    if (search) query = query.ilike('theory_markdown', `%${search}%`);
    query = query.eq('active', true);
    query = query.order('session', { ascending: true })
                 .order('phase', { ascending: true });
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(`listRuntimeTheoryLudicaRowsForAdmin: ${error.message}`);

    return (data || []).map((row) => ({
        id: row.id,
        rowNumber: row.id,  // legacy compat
        subject: row.subject,
        session: row.session,
        phase: row.phase,
        topic: row.topic || '',
        theoryMarkdown: row.theory_markdown || '',
        theory_markdown: row.theory_markdown || '',
        source: row.source || '',
        active: row.active,
        support_image_asset_id: row.support_image_asset_id || '',
        created_at: row.created_at,
    }));
};

export const appendRuntimeTheoryLudica = async ({
    subject = '',
    session = '',
    phase = '',
    topic = '',
    theoryMarkdown = '',
    source = 'ai_generated',
    supportImage = null,
    grade = '1medio'
} = {}) => {
    const normalizedGrade = String(grade || '').trim().toLowerCase() === '2medio' ? '2medio' : '1medio';
    const { data, error } = await supabase
        .from('theory_ludica_bank')
        .insert({
            grade: normalizedGrade,
            subject,
            session: Number(session) || 0,
            phase: Number(phase) || 0,
            topic,
            theory_markdown: theoryMarkdown,
            source,
            active: true,
            support_image_asset_id: supportImage || null,
        })
        .select()
        .single();

    if (error) throw new Error(`appendRuntimeTheoryLudica: ${error.message}`);
    return {
        id: data.id,
        grade: data.grade || normalizedGrade,
        subject: data.subject,
        session: data.session,
        phase: data.phase,
        topic: data.topic || '',
        theoryMarkdown: data.theory_markdown || '',
        source: data.source || '',
    };
};

export const linkRuntimeTheoryLudicaAsset = async ({ rowNumber = 0, assetId = '' } = {}) => {
    const { data, error } = await supabase
        .from('theory_ludica_bank')
        .update({ support_image_asset_id: assetId || null })
        .eq('id', rowNumber)
        .select()
        .single();

    if (error) throw new Error(`linkRuntimeTheoryLudicaAsset: ${error.message}`);
    return { id: data.id, support_image_asset_id: data.support_image_asset_id };
};

// =====================================================================
// 4. USERS (profiles)
// =====================================================================

/**
 * The legacy "users" sheet had columns: token, pass, mail, nombre, celular,
 * region, comuna, correo_apoderado.
 * In Supabase the `profiles` table uses: user_id, email, display_name, etc.
 * We store the extra legacy fields in a `metadata` JSONB column if it exists,
 * but for now we map to the schema columns we have.
 *
 * IMPORTANT: The legacy code treats `token` as the user_id (UUID-ish string
 * like "TK-ABC123"). We store it as `user_id` in profiles.
 */

export const getRuntimeUserByEmail = async (email) => {
    if (!email) return null;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', normalizedEmail)
        .maybeSingle();

    if (error) throw new Error(`getRuntimeUserByEmail: ${error.message}`);
    if (data) return mapProfileToLegacy(data);

    const { data: legacyData, error: legacyError } = await supabase
        .from('users')
        .select('*')
        .ilike('mail', normalizedEmail)
        .maybeSingle();

    if (legacyError) {
        console.warn(`[getRuntimeUserByEmail] fallback users failed: ${legacyError.message}`);
        return null;
    }

    return legacyData ? mapLegacyUserToLegacy(legacyData) : null;
};

export const getRuntimeUserByToken = async (user_id) => {
    if (!user_id) return null;
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user_id)
        .maybeSingle();

    if (error) throw new Error(`getRuntimeUserByToken: ${error.message}`);
    if (!data) return null;

    return mapProfileToLegacy(data);
};

export const listRuntimeUsers = async () => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw new Error(`listRuntimeUsers: ${error.message}`);
    return (data || []).map(mapProfileToLegacy);
};

export const upsertRuntimeUser = async ({
    token = '',
    pass = '',
    mail = '',
    nombre = 'Estudiante',
    celular = '',
    region = '',
    comuna = '',
    correo_apoderado = '',
    current_grade = ''
} = {}) => {
    const upsertData = {
        user_id: token || `TK-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
        email: mail,
        display_name: nombre,
        password_hash: pass,
        phone: celular,
        region: region,
        commune: comuna,
        guardian_email: correo_apoderado,
    };
    // Solo incluir current_grade si viene explicito; si no, dejar el default de DB ('1medio')
    if (current_grade) {
        upsertData.current_grade = current_grade;
    }

    const { error } = await supabase
        .from('profiles')
        .upsert(upsertData, { onConflict: 'email' });

    if (error) throw new Error(`upsertRuntimeUser: ${error.message}`);
};

/**
 * Map a profiles row to the legacy shape expected by index.js callers.
 * Legacy fields: token, pass, mail, nombre, celular, region, comuna, correo_apoderado
 */
/**
 * Map a profiles row to the legacy shape expected by index.js callers.
 * Legacy fields: token, pass, mail, nombre, celular, region, comuna, correo_apoderado
 *
 * Requires migration 02_profiles_extend.sql to add: password_hash, phone,
 * region, commune, guardian_email columns.
 */
const mapProfileToLegacy = (row) => {
    if (!row) return null;
    return {
        token: row.user_id || '',
        user_id: row.user_id || '',
        pass: row.password_hash || '',
        mail: row.email || '',
        email: row.email || '',
        nombre: row.display_name || 'Estudiante',
        display_name: row.display_name || 'Estudiante',
        celular: row.phone || '',
        region: row.region || '',
        comuna: row.commune || '',
        correo_apoderado: row.guardian_email || '',
        is_admin: row.is_admin || false,
        current_grade: row.current_grade || '1medio',
        role: row.role || 'estudiante',
        parent_user_id: row.parent_user_id || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
};

const mapLegacyUserToLegacy = (row) => {
    if (!row) return null;
    return {
        token: row.token || '',
        user_id: row.token || '',
        pass: row.pass || '',
        mail: row.mail || '',
        email: row.mail || '',
        nombre: row.nombre || 'Estudiante',
        display_name: row.nombre || 'Estudiante',
        celular: row.celular || '',
        region: row.region || '',
        comuna: row.comuna || '',
        correo_apoderado: row.correo_apoderado || '',
        is_admin: row.is_admin || false,
        current_grade: row.current_grade || '1medio',
        role: row.role || 'estudiante',
        parent_user_id: row.parent_user_id || null,
        created_at: row.created,
        updated_at: row.updated_at,
    };
};

// =====================================================================
// 5. PROGRESS LOG
// =====================================================================

export const insertRuntimeProgressLog = async ({
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
} = {}) => {
    const row = {
        user_id: user_id || null,
        user_email: null,  // filled if available
        grade: grade || null,
        subject: subject || null,
        session: Number(session) || null,
        phase: Number(phase) || null,
        sub_level: subLevel || null,
        level_name: levelName || null,
        event_type: event_type || null,
        score: score !== '' ? Number(score) : null,
        xp: xp !== '' ? Number(xp) : null,
        topic: topic || null,
        total_questions: totalQuestions !== '' ? Number(totalQuestions) : null,
        correct_answers: correctAnswers !== '' ? Number(correctAnswers) : null,
        wrong_answers: wrongAnswers !== '' ? Number(wrongAnswers) : null,
        wrong_question_details: wrongQuestionDetails
            ? (typeof wrongQuestionDetails === 'string' ? safeJsonParse(wrongQuestionDetails) : wrongQuestionDetails)
            : null,
        weakness: weakness
            ? (typeof weakness === 'string' ? safeJsonParse(weakness) : weakness)
            : null,
        improvement_plan: improvementPlan
            ? (typeof improvementPlan === 'string' ? safeJsonParse(improvementPlan) : improvementPlan)
            : null,
        source_mode: sourceMode || null,
        batch_index: batchIndex !== '' ? Number(batchIndex) : null,
        batch_size: batchSize !== '' ? Number(batchSize) : null,
    };

    const { error } = await supabase.from('progress_log').insert(row);
    if (error) {
        console.error('[insertRuntimeProgressLog] Supabase error:', error.message);
        // Don't throw — fire and forget
    }
};

const safeJsonParse = (value) => {
    if (!value || typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
};

// =====================================================================
// 6. ADAPTIVE PROFILE
// =====================================================================

export const insertRuntimeAdaptiveSnapshot = async ({
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
    weakSessions = '',
    strongSessions = '',
    sourceMode = ''
} = {}) => {
    const payload = {
        grade,
        session: Number(session) || 0,
        topic,
        event_type,
        mastery,
        totalAttempts,
        totalCorrect,
        totalQuestions,
        nextAction,
        weakSessions,
        strongSessions,
        sourceMode,
    };

    const { error } = await supabase.from('adaptive_profile_log').insert({
        user_id: user_id || null,
        subject: subject || null,
        payload,
    });

    if (error) {
        console.error('[insertRuntimeAdaptiveSnapshot] Supabase error:', error.message);
        // Don't throw — fire and forget
    }
};

// =====================================================================
// 7. EXAM REMINDERS
// =====================================================================

export const listRuntimeExamReminders = async () => {
    const { data, error } = await supabase
        .from('exam_reminders')
        .select('*')
        .order('exam_date', { ascending: true });

    if (error) throw new Error(`listRuntimeExamReminders: ${error.message}`);
    return (data || []).map(mapExamReminderRow);
};

export const findRuntimeExamReminderById = async (eventId) => {
    if (!eventId) return null;
    const { data, error } = await supabase
        .from('exam_reminders')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle();

    if (error) throw new Error(`findRuntimeExamReminderById: ${error.message}`);
    return data ? mapExamReminderRow(data) : null;
};

export const upsertRuntimeExamReminder = async (record = {}) => {
    const eventId = record.event_id || record.eventId || generateId('EV');

    const row = {
        event_id: eventId,
        user_id: record.user_id || null,
        user_email: record.user_email || record.email || null,
        student_name: record.student_name || record.nombre || null,
        student_email: record.student_email || null,
        guardian_email: record.guardian_email || record.correo_apoderado || null,
        subject: record.subject || null,
        exam_date: record.exam_date || null,
        title: record.title || null,
        source: record.source || null,
        confidence: record.confidence != null ? Number(record.confidence) : null,
        status: record.status || null,
        sent_d7: record.sent_d7 === true || record.sent_d7 === 'TRUE',
        sent_d2: record.sent_d2 === true || record.sent_d2 === 'TRUE',
        sent_d1: record.sent_d1 === true || record.sent_d1 === 'TRUE',
        last_sent_at: record.last_sent_at || null,
        notes: record.notes || null,
    };

    const { error } = await supabase
        .from('exam_reminders')
        .upsert(row, { onConflict: 'event_id' });

    if (error) {
        console.error('[upsertRuntimeExamReminder] Supabase error:', error.message);
    }
};

const mapExamReminderRow = (row) => {
    if (!row) return null;
    return {
        event_id: row.event_id,
        rowNumber: row.event_id,  // legacy compat
        user_id: row.user_id || '',
        user_email: row.user_email || '',
        student_name: row.student_name || '',
        student_email: row.student_email || '',
        guardian_email: row.guardian_email || '',
        subject: row.subject || '',
        exam_date: row.exam_date || '',
        title: row.title || '',
        source: row.source || '',
        confidence: row.confidence,
        status: row.status || '',
        sent_d7: row.sent_d7 || false,
        sent_d2: row.sent_d2 || false,
        sent_d1: row.sent_d1 || false,
        last_sent_at: row.last_sent_at || '',
        notes: row.notes || '',
        created_at: row.created_at,
    };
};

// =====================================================================
// CALENDARIO Y EVENTOS
// =====================================================================

export async function createCalendarEvent({
    created_by, student_user_id, event_type = 'estudio', title, description,
    subject, session_number, event_date, start_time, end_time, all_day = false,
    recurrence = 'none', recurrence_end, evidences = [],
    notify_guardian = true, notify_student = true, reminder_minutes = 15, alarm_sound = true
}) {
    const { data, error } = await supabase
        .from('calendar_events')
        .insert({
            created_by, student_user_id, event_type, title, description,
            subject, session_number, event_date, start_time, end_time, all_day,
            recurrence, recurrence_end, evidences: JSON.stringify(evidences),
            notify_guardian, notify_student, reminder_minutes, alarm_sound,
            status: 'pendiente'
        })
        .select()
        .single();
    if (error) throw new Error(`createCalendarEvent: ${error.message}`);
    return data;
}

export async function listCalendarEvents({ user_id, role = 'estudiante', from_date, to_date, status, limit = 50 }) {
    // Apoderado ve eventos de sus hijos, estudiante ve los propios
    let query = supabase.from('calendar_events').select('*');

    if (role === 'apoderado') {
        query = query.or(`created_by.eq.${user_id},student_user_id.eq.${user_id}`);
    } else {
        query = query.eq('student_user_id', user_id);
    }

    if (from_date) query = query.gte('event_date', from_date);
    if (to_date) query = query.lte('event_date', to_date);
    if (status) query = query.eq('status', status);

    query = query.order('event_date', { ascending: true }).order('start_time', { ascending: true }).limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(`listCalendarEvents: ${error.message}`);
    return data || [];
}

export async function updateCalendarEvent(event_id, updates) {
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase
        .from('calendar_events')
        .update(updates)
        .eq('event_id', event_id)
        .select()
        .single();
    if (error) throw new Error(`updateCalendarEvent: ${error.message}`);
    return data;
}

export async function deleteCalendarEvent(event_id) {
    const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('event_id', event_id);
    if (error) throw new Error(`deleteCalendarEvent: ${error.message}`);
    return { success: true };
}

export async function getUserProfile(user_id) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user_id)
        .single();
    if (error) return null;
    return data;
}

export async function getChildrenProfiles(parent_user_id) {
    const { data: parentProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', parent_user_id)
        .maybeSingle();

    const guardianEmail = String(parentProfile?.email || '').trim().toLowerCase();
    const children = [];

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('parent_user_id', parent_user_id);
    if (!error && data?.length) children.push(...data);

    if (guardianEmail) {
        const { data: byGuardianEmail } = await supabase
            .from('profiles')
            .select('*')
            .ilike('guardian_email', guardianEmail);
        if (byGuardianEmail?.length) children.push(...byGuardianEmail);

        const { data: legacyChildren } = await supabase
            .from('users')
            .select('*')
            .ilike('correo_apoderado', guardianEmail);
        if (legacyChildren?.length) children.push(...legacyChildren.map(mapLegacyUserToLegacy));
    }

    const seen = new Set();
    return children.filter((child) => {
        const key = child.user_id || child.token || child.email || child.mail;
        if (key === parent_user_id) return false;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export async function createNotification({ user_id, event_id, type = 'reminder', title, body, scheduled_at }) {
    const { data, error } = await supabase
        .from('notifications')
        .insert({ user_id, event_id, type, title, body, scheduled_at })
        .select()
        .single();
    if (error) throw new Error(`createNotification: ${error.message}`);
    return data;
}

export async function listUnreadNotifications(user_id, limit = 20) {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user_id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) return [];
    return data || [];
}

export async function markNotificationRead(notif_id) {
    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('notif_id', notif_id);
    if (error) throw new Error(`markNotificationRead: ${error.message}`);
    return { success: true };
}

// =====================================================================
// STUDY SESSIONS (hora de estudio)
// =====================================================================

export async function createStudySession({ student_user_id, subject, session_number, type = 'daily' }) {
    const session_id = `SS-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const { data, error } = await supabase
        .from('study_sessions')
        .insert({
            session_id,
            student_user_id,
            subject,
            session_number,
            type,
            start_time: new Date().toISOString(),
            milestones: [],
            total_minutes: 0
        })
        .select()
        .single();
    if (error) throw new Error(`createStudySession: ${error.message}`);
    return data;
}

export async function addStudyMilestone(session_id, milestone_name) {
    const { data: session } = await supabase
        .from('study_sessions')
        .select('milestones,start_time')
        .eq('session_id', session_id)
        .single();

    const milestones = session?.milestones || [];
    milestones.push({ name: milestone_name, at: new Date().toISOString() });
    const startedAt = session?.start_time ? new Date(session.start_time) : null;
    const total_minutes = startedAt
        ? Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 60000))
        : 1;

    const { error } = await supabase
        .from('study_sessions')
        .update({ milestones, total_minutes })
        .eq('session_id', session_id);
    if (error) throw new Error(`addStudyMilestone: ${error.message}`);
    return { success: true };
}

export async function endStudySession(session_id) {
    const { data: session } = await supabase
        .from('study_sessions')
        .select('start_time')
        .eq('session_id', session_id)
        .single();

    if (!session) throw new Error('Session not found');
    const start = new Date(session.start_time);
    const end = new Date();
    const total_minutes = Math.max(1, Math.round((end - start) / 60000));

    const { data, error } = await supabase
        .from('study_sessions')
        .update({ end_time: end.toISOString(), total_minutes })
        .eq('session_id', session_id)
        .select()
        .single();
    if (error) throw new Error(`endStudySession: ${error.message}`);
    return data;
}

export async function getStudySessions(student_user_id, from_date = null, to_date = null) {
    let query = supabase
        .from('study_sessions')
        .select('*')
        .eq('student_user_id', student_user_id)
        .order('start_time', { ascending: false });
    if (from_date) query = query.gte('start_time', from_date);
    if (to_date) query = query.lte('start_time', to_date);
    const { data, error } = await query.limit(100);
    if (error) return [];
    return data || [];
}

export async function getActiveStudySession(student_user_id) {
    const { data } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('student_user_id', student_user_id)
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();
    return data || null;
}

// =====================================================================
// PROGRESS SUMMARY (for parent dashboard)
// =====================================================================
export async function getChildProgressSummary(child_user_id, limit = 50) {
    const { data, error } = await supabase
        .from('progress_log')
        .select('*')
        .eq('user_id', child_user_id)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) return [];
    return data || [];
}
