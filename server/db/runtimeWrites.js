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
    questionVisualRole = '',
    grade = '1medio'
} = {}) => {
    const question_id = generateId('QB');
    const optionsJsonb = typeof options === 'object' ? options : { A: '', B: '', C: '', D: '' };
    const _g = String(grade || '').trim().toLowerCase();
    const normalizedGrade = _g === '3medio' ? '3medio' : _g === '2medio' ? '2medio' : '1medio';

    const row = {
        question_id,
        grade: normalizedGrade,
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
    limit = 60,
    grade = ''
} = {}) => {
    let query = supabase.from('question_bank').select('*');

    if (grade) {
        const _g = String(grade || '').trim().toLowerCase();
    const normalizedGrade = _g === '3medio' ? '3medio' : _g === '2medio' ? '2medio' : '1medio';
        query = query.eq('grade', normalizedGrade);
    }
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
    const _g = String(grade || '').trim().toLowerCase();
    const normalizedGrade = _g === '3medio' ? '3medio' : _g === '2medio' ? '2medio' : '1medio';
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
    const _g = String(grade || '').trim().toLowerCase();
    const normalizedGrade = _g === '3medio' ? '3medio' : _g === '2medio' ? '2medio' : '1medio';
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

export const updateRuntimeUserGrade = async ({ user_id = '', grade = '1medio' } = {}) => {
    if (!user_id) throw new Error('updateRuntimeUserGrade: user_id requerido');
    const g = String(grade || '').trim().toLowerCase();
    const normalizedGrade = g === '3medio' ? '3medio' : g === '2medio' ? '2medio' : '1medio';

    const { data, error } = await supabase
        .from('profiles')
        .update({ current_grade: normalizedGrade, updated_at: new Date().toISOString() })
        .eq('user_id', user_id)
        .select()
        .maybeSingle();

    if (error) throw new Error(`updateRuntimeUserGrade: ${error.message}`);
    if (!data) throw new Error('updateRuntimeUserGrade: usuario no encontrado');

    return { user_id: data.user_id, current_grade: data.current_grade || normalizedGrade };
};

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

// Cap absoluto por sesion: si el alumno deja todo abierto 5h, no le contamos
// mas que esto (defensa final contra fraude/olvido). Se aplica en TODOS los
// calculos de minutos activos para no inflar el dashboard mientras la sesion
// esta viva.
const SESSION_CAP_MINUTES = 90;

// Calcula minutos activos = wall-clock - paused_ms_total, descontando si esta
// pausada ahora (resta lo que va corrido desde last_paused_at). Aplica cap.
const computeActiveMinutes = (session, nowMs = Date.now()) => {
    if (!session?.start_time) return 1;
    const start = new Date(session.start_time).getTime();
    const wallMs = Math.max(0, nowMs - start);
    let pausedMs = Number(session.paused_ms_total || 0);
    if (session.last_paused_at) {
        const lastPaused = new Date(session.last_paused_at).getTime();
        if (Number.isFinite(lastPaused)) pausedMs += Math.max(0, nowMs - lastPaused);
    }
    const activeMs = Math.max(0, wallMs - pausedMs);
    const minutes = Math.round(activeMs / 60000);
    return Math.max(1, Math.min(SESSION_CAP_MINUTES, minutes));
};

export async function addStudyMilestone(session_id, milestone) {
    const { data: session } = await supabase
        .from('study_sessions')
        .select('milestones,start_time,subject,paused_ms_total,last_paused_at')
        .eq('session_id', session_id)
        .single();

    const milestones = session?.milestones || [];
    const now = new Date().toISOString();
    const entry = (typeof milestone === 'string' || milestone == null)
        ? { name: String(milestone || 'milestone'), at: now }
        : { name: milestone.name || milestone.event_type || 'milestone', at: now, ...milestone };
    milestones.push(entry);

    const total_minutes = computeActiveMinutes(session);

    const { error } = await supabase
        .from('study_sessions')
        .update({ milestones, total_minutes, confirmed_minutes: total_minutes })
        .eq('session_id', session_id);
    if (error) throw new Error(`addStudyMilestone: ${error.message}`);
    return { success: true, milestone: entry, total_minutes };
}

// PAUSAR sesion activa (page hidden / window blur). Idempotente: si ya esta
// pausada no abre otra pausa.
export async function pauseStudySession(session_id, { reason = 'visibility_hidden' } = {}) {
    const { data: session } = await supabase
        .from('study_sessions')
        .select('milestones, last_paused_at, paused_ms_total, start_time')
        .eq('session_id', session_id)
        .maybeSingle();
    if (!session) return { success: false, error: 'session_not_found' };
    if (session.last_paused_at) {
        // ya esta pausada — devolver estado
        return { success: true, already_paused: true, last_paused_at: session.last_paused_at };
    }
    const now = new Date().toISOString();
    const milestones = Array.isArray(session.milestones) ? session.milestones : [];
    milestones.push({ name: 'paused', at: now, reason });

    const { error } = await supabase
        .from('study_sessions')
        .update({ last_paused_at: now, pause_reason: reason, milestones })
        .eq('session_id', session_id);
    if (error) throw new Error(`pauseStudySession: ${error.message}`);
    return { success: true, paused_at: now };
}

// REANUDAR sesion pausada. Acumula el tramo en paused_ms_total y recalcula
// total_minutes/confirmed_minutes.
export async function resumeStudySession(session_id) {
    const { data: session } = await supabase
        .from('study_sessions')
        .select('milestones, last_paused_at, paused_ms_total, start_time')
        .eq('session_id', session_id)
        .maybeSingle();
    if (!session) return { success: false, error: 'session_not_found' };
    if (!session.last_paused_at) {
        return { success: true, already_active: true };
    }
    const now = new Date();
    const pausedFor = Math.max(0, now.getTime() - new Date(session.last_paused_at).getTime());
    const newPausedTotal = Number(session.paused_ms_total || 0) + pausedFor;
    const milestones = Array.isArray(session.milestones) ? session.milestones : [];
    milestones.push({ name: 'resumed', at: now.toISOString(), paused_ms: pausedFor });

    // Recalcular minutos activos (sin la pausa abierta porque la cerramos ahora)
    const total_minutes = computeActiveMinutes(
        { ...session, paused_ms_total: newPausedTotal, last_paused_at: null },
        now.getTime()
    );

    const { error } = await supabase
        .from('study_sessions')
        .update({
            last_paused_at: null,
            pause_reason: null,
            paused_ms_total: newPausedTotal,
            milestones,
            total_minutes,
            confirmed_minutes: total_minutes
        })
        .eq('session_id', session_id);
    if (error) throw new Error(`resumeStudySession: ${error.message}`);
    return { success: true, paused_for_ms: pausedFor, paused_ms_total: newPausedTotal, total_minutes };
}

export async function endStudySession(session_id) {
    const { data: session } = await supabase
        .from('study_sessions')
        .select('start_time, paused_ms_total, last_paused_at, milestones')
        .eq('session_id', session_id)
        .single();
    if (!session) throw new Error('Session not found');

    // Si la sesion estaba pausada cuando se termina, cerrar la pausa primero
    let pausedTotal = Number(session.paused_ms_total || 0);
    const milestones = Array.isArray(session.milestones) ? session.milestones : [];
    const endDate = new Date();
    if (session.last_paused_at) {
        const pausedFor = Math.max(0, endDate.getTime() - new Date(session.last_paused_at).getTime());
        pausedTotal += pausedFor;
        milestones.push({ name: 'resumed_on_end', at: endDate.toISOString(), paused_ms: pausedFor });
    }
    // Recomputar minutos activos
    const synthetic = { ...session, paused_ms_total: pausedTotal, last_paused_at: null };
    const activeMin = computeActiveMinutes(synthetic, endDate.getTime());
    const total_minutes = Math.max(1, Math.min(SESSION_CAP_MINUTES, activeMin));
    const confirmed_minutes = total_minutes; // por ahora son iguales; los caps por fase vienen en una iteracion siguiente

    const { data, error } = await supabase
        .from('study_sessions')
        .update({
            end_time: endDate.toISOString(),
            total_minutes,
            confirmed_minutes,
            paused_ms_total: pausedTotal,
            last_paused_at: null,
            pause_reason: null,
            milestones
        })
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
// RAG — busqueda semantica sobre theory_ludica_bank / question_bank /
// notebook_ocr_records / progress_log usando pgvector + funciones match_*
// =====================================================================
// scope: 'theory' | 'questions' | 'notebook' | 'progress' | 'all'
// filters: { grade, subject, session, user_id, days_back }
export async function ragSearch({
    queryEmbedding,
    scope = 'all',
    match_threshold = 0.50,
    match_count = 5,
    filters = {}
}) {
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== 1536) {
        throw new Error('queryEmbedding debe ser array de 1536 floats');
    }
    const results = {};
    const calls = [];

    if (scope === 'theory' || scope === 'all') {
        calls.push(supabase.rpc('match_theory_ludica', {
            query_embedding: queryEmbedding,
            match_threshold, match_count,
            filter_grade: filters.grade || null,
            filter_subject: filters.subject || null
        }).then(({ data, error }) => { results.theory = error ? { error: error.message } : (data || []); }));
    }
    if (scope === 'questions' || scope === 'all') {
        calls.push(supabase.rpc('match_question_bank', {
            query_embedding: queryEmbedding,
            match_threshold, match_count,
            filter_grade: filters.grade || null,
            filter_subject: filters.subject || null,
            filter_session: filters.session ?? null
        }).then(({ data, error }) => { results.questions = error ? { error: error.message } : (data || []); }));
    }
    if ((scope === 'notebook' || scope === 'all') && filters.user_id) {
        calls.push(supabase.rpc('match_notebook_ocr', {
            query_embedding: queryEmbedding,
            filter_user_id: filters.user_id,
            match_threshold, match_count,
            filter_subject: filters.subject || null,
            days_back: filters.days_back || 90
        }).then(({ data, error }) => { results.notebook = error ? { error: error.message } : (data || []); }));
    }
    if ((scope === 'progress' || scope === 'all') && filters.user_id) {
        calls.push(supabase.rpc('match_progress_log', {
            query_embedding: queryEmbedding,
            filter_user_id: filters.user_id,
            match_threshold, match_count,
            days_back: filters.days_back || 30
        }).then(({ data, error }) => { results.progress = error ? { error: error.message } : (data || []); }));
    }

    await Promise.all(calls);
    return results;
}

// =====================================================================
// TELEMETRIA — escribir evento(s) granular(es) a progress_log
// =====================================================================
// event_type canonicos esperados desde el frontend:
//   Teoria: theory_started, theory_scroll, theory_completed, theory_closed
//   Cuaderno: cuaderno_opened, cuaderno_photo_added, cuaderno_completed
//   Quiz: prep_exam_started, quiz_question_answered, prep_exam_completed,
//         prep_exam_reviewed, quiz_phase_completed
//   Navegacion: page_view, modal_open, modal_close, tab_changed
//   Sesion: app_opened, app_closed, study_resumed
//   Voz/Agente: agent_chat, agent_voice_started, agent_voice_ended
//   Cualquier otro string es valido — solo recomendamos usar snake_case.
export async function writeProgressEvent({
    user_id, user_email = null, grade = null,
    subject = null, session = null, phase = null,
    event_type, score = null, xp = null, topic = null,
    total_questions = null, correct_answers = null, wrong_answers = null,
    level_name = null, sub_level = null, source_mode = null,
    batch_index = null, batch_size = null
}) {
    if (!user_id || !event_type) throw new Error('writeProgressEvent: faltan user_id o event_type');
    const row = {
        user_id, user_email, grade,
        subject, session, phase,
        event_type, score, xp, topic,
        total_questions, correct_answers, wrong_answers,
        level_name, sub_level, source_mode,
        batch_index, batch_size,
        created_at: new Date().toISOString()
    };
    // Limpiar nulls (Supabase los acepta pero ahorramos espacio)
    Object.keys(row).forEach(k => row[k] === null && delete row[k]);
    const { data, error } = await supabase.from('progress_log').insert(row).select('id').single();
    if (error) throw new Error(`writeProgressEvent: ${error.message}`);
    return { id: data?.id, event_type, at: row.created_at };
}

export async function writeProgressBatch(events = []) {
    if (!Array.isArray(events) || events.length === 0) return { inserted: 0 };
    const now = new Date();
    const rows = events.map((e, i) => {
        if (!e?.user_id || !e?.event_type) return null;
        const row = {
            user_id: e.user_id, user_email: e.user_email || null, grade: e.grade || null,
            subject: e.subject || null, session: e.session ?? null, phase: e.phase ?? null,
            event_type: e.event_type, score: e.score ?? null, xp: e.xp ?? null, topic: e.topic || null,
            total_questions: e.total_questions ?? null, correct_answers: e.correct_answers ?? null,
            wrong_answers: e.wrong_answers ?? null, level_name: e.level_name || null,
            sub_level: e.sub_level || null, source_mode: e.source_mode || null,
            batch_index: e.batch_index ?? null, batch_size: e.batch_size ?? null,
            // Si el cliente trae timestamp lo usamos, si no, distribuimos ms para preservar orden
            created_at: e.at || e.created_at || new Date(now.getTime() + i).toISOString()
        };
        Object.keys(row).forEach(k => row[k] === null && delete row[k]);
        return row;
    }).filter(Boolean);
    if (!rows.length) return { inserted: 0, skipped: events.length };
    const { error } = await supabase.from('progress_log').insert(rows);
    if (error) throw new Error(`writeProgressBatch: ${error.message}`);
    return { inserted: rows.length, skipped: events.length - rows.length };
}

// =====================================================================
// STUDENT PROGRESS DETAIL — por subject/session/phase, qué hizo y qué falta
// =====================================================================
export async function getStudentProgressDetail(student_user_id, { days = 30 } = {}) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data: events, error } = await supabase
        .from('progress_log')
        .select('subject, session, phase, level_name, event_type, score, correct_answers, wrong_answers, total_questions, xp, topic, weakness, improvement_plan, wrong_question_details, created_at')
        .eq('user_id', student_user_id)
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(5000);
    if (error) throw new Error(`getStudentProgressDetail: ${error.message}`);
    if (!events?.length) return { subjects: {}, total_events: 0, days };

    // Agrupar por subject -> session -> phase
    const bySubject = {};
    for (const ev of events) {
        const subj = String(ev.subject || 'OTROS').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const sess = Number(ev.session) || 0;
        const phase = Number(ev.phase) || 0;
        if (!bySubject[subj]) bySubject[subj] = {};
        if (!bySubject[subj][sess]) bySubject[subj][sess] = {};
        if (!bySubject[subj][sess][phase]) bySubject[subj][sess][phase] = {
            level_name: null,
            topic: null,                  // tema concreto de la sesion (de progress_log.topic)
            theory_started: false, theory_completed: false,
            cuaderno_completed: false,
            prep_exam_started: 0, prep_exam_completed: false, prep_exam_reviewed: false,
            best_score: null, last_score: null,
            questions_answered: 0, questions_total: 0,
            xp_earned: 0,
            improvement_plan: null,       // ultima recomendacion IA
            weakness: null,               // ultima debilidad detectada
            wrong_topics: [],             // temas donde fallo (agregados)
            first_activity_at: null, last_activity_at: null,
            events_count: 0
        };
        const cell = bySubject[subj][sess][phase];
        cell.events_count++;
        if (!cell.first_activity_at) cell.first_activity_at = ev.created_at;
        cell.last_activity_at = ev.created_at;
        if (ev.level_name && !cell.level_name) cell.level_name = ev.level_name;
        if (ev.topic && !cell.topic) cell.topic = ev.topic; // primer topic visto
        if (ev.improvement_plan) cell.improvement_plan = ev.improvement_plan;
        if (ev.weakness) cell.weakness = ev.weakness;
        if (ev.xp) cell.xp_earned += Number(ev.xp) || 0;
        switch (ev.event_type) {
            case 'theory_started': cell.theory_started = true; break;
            case 'theory_completed': cell.theory_completed = true; cell.theory_started = true; break;
            case 'cuaderno_completed': cell.cuaderno_completed = true; break;
            case 'prep_exam_started': cell.prep_exam_started++; break;
            case 'prep_exam_completed':
                cell.prep_exam_completed = true;
                cell.last_score = ev.score;
                if (cell.best_score == null || (ev.score != null && ev.score > cell.best_score)) cell.best_score = ev.score;
                cell.questions_answered = Math.max(cell.questions_answered, Number(ev.correct_answers || 0));
                cell.questions_total = Math.max(cell.questions_total, Number(ev.total_questions || 0));
                break;
            case 'prep_exam_reviewed': cell.prep_exam_reviewed = true; break;
        }
    }

    // Transformar a estructura util para el dashboard
    const PHASE_LABELS = { 1: 'BASICO', 2: 'INTERMEDIO', 3: 'AVANZADO' };
    const subjects = {};
    for (const [subj, sessions] of Object.entries(bySubject)) {
        const sessionList = [];
        for (const [sessNum, phases] of Object.entries(sessions)) {
            const phaseList = Object.entries(phases).map(([pNum, d]) => {
                let status;
                if (d.prep_exam_completed) status = 'completed';
                else if (d.prep_exam_started > 0) status = 'quiz_in_progress';
                else if (d.cuaderno_completed) status = 'ready_for_quiz';
                else if (d.theory_completed) status = 'ready_for_cuaderno';
                else if (d.theory_started) status = 'reading_theory';
                else status = 'not_started';

                let next_action;
                if (status === 'completed') next_action = null;
                else if (!d.theory_started) next_action = 'Abrir teoria ludica';
                else if (!d.theory_completed) next_action = 'Terminar teoria';
                else if (!d.cuaderno_completed) next_action = 'Subir foto del cuaderno';
                else if (!d.prep_exam_started) next_action = 'Empezar quiz';
                else next_action = `Terminar quiz (${d.questions_answered}/${d.questions_total || 15} preguntas)`;

                return {
                    phase: Number(pNum),
                    level_name: d.level_name || PHASE_LABELS[Number(pNum)] || null,
                    topic: d.topic,
                    status,
                    theory: { started: d.theory_started, completed: d.theory_completed },
                    cuaderno: { completed: d.cuaderno_completed },
                    quiz: {
                        attempts: d.prep_exam_started,
                        completed: d.prep_exam_completed,
                        reviewed: d.prep_exam_reviewed,
                        questions_answered: d.questions_answered,
                        questions_total: d.questions_total || 15,
                        last_score: d.last_score,
                        best_score: d.best_score
                    },
                    next_action,
                    xp_earned: d.xp_earned,
                    improvement_plan: d.improvement_plan,
                    weakness: d.weakness,
                    first_activity_at: d.first_activity_at,
                    last_activity_at: d.last_activity_at,
                    events_count: d.events_count
                };
            }).sort((a, b) => a.phase - b.phase);

            // Estado global de la sesion
            const sessLastAt = phaseList.reduce((max, p) => max > (p.last_activity_at || '') ? max : (p.last_activity_at || ''), '');
            const allCompleted = phaseList.length === 3 && phaseList.every(p => p.status === 'completed');
            const someCompleted = phaseList.some(p => p.status === 'completed');
            const someStarted = phaseList.some(p => p.status !== 'not_started');
            const sessionStatus = allCompleted ? 'completed' : (someStarted ? 'in_progress' : 'not_started');

            // Total preguntas hechas vs target (45 = 3 fases * 15)
            const totalDone = phaseList.reduce((s, p) => s + (p.quiz.questions_answered || 0), 0);
            const totalTarget = phaseList.reduce((s, p) => s + (p.quiz.questions_total || 15), 0) || 45;

            sessionList.push({
                session: Number(sessNum),
                status: sessionStatus,
                phases: phaseList,
                quiz_progress: { done: totalDone, target: totalTarget, pct: Math.round(100 * totalDone / totalTarget) },
                last_activity_at: sessLastAt
            });
        }
        sessionList.sort((a, b) => String(b.last_activity_at).localeCompare(String(a.last_activity_at)));
        subjects[subj] = sessionList;
    }

    return {
        subjects,
        total_events: events.length,
        days,
        generated_at: new Date().toISOString()
    };
}

// =====================================================================
// TIMELINE — eventos enriquecidos para el padre (cuando, que, donde, puntaje)
// =====================================================================
export async function getStudentTimeline(student_user_id, { days = 14, limit = 200 } = {}) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data, error } = await supabase
        .from('progress_log')
        .select('id, created_at, event_type, subject, session, phase, level_name, topic, score, xp, correct_answers, wrong_answers, total_questions, improvement_plan, weakness')
        .eq('user_id', student_user_id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw new Error(`getStudentTimeline: ${error.message}`);
    return data || [];
}

// =====================================================================
// WEAKNESSES — donde le cuesta a Matias (temas/materias con menos %)
// =====================================================================
export async function getStudentWeaknesses(student_user_id, { days = 30 } = {}) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data, error } = await supabase
        .from('progress_log')
        .select('subject, topic, score, correct_answers, total_questions, wrong_answers, wrong_question_details, weakness, created_at')
        .eq('user_id', student_user_id)
        .gte('created_at', since)
        .in('event_type', ['prep_exam_completed', 'prep_exam_reviewed', 'phase_completed', 'session_completed'])
        .limit(500);
    if (error) throw new Error(`getStudentWeaknesses: ${error.message}`);

    // Agregar por (subject, topic): % aciertos promedio
    const bySubjectTopic = {};
    for (const r of (data || [])) {
        const key = `${(r.subject || 'OTROS').toUpperCase()}|${r.topic || 'GENERAL'}`;
        if (!bySubjectTopic[key]) bySubjectTopic[key] = {
            subject: r.subject, topic: r.topic,
            attempts: 0, total_correct: 0, total_questions: 0,
            last_score: null, last_at: null, last_weakness: null
        };
        const cell = bySubjectTopic[key];
        cell.attempts++;
        cell.total_correct += Number(r.correct_answers || 0);
        cell.total_questions += Number(r.total_questions || 0);
        if (!cell.last_at || r.created_at > cell.last_at) {
            cell.last_at = r.created_at;
            cell.last_score = r.score;
            cell.last_weakness = r.weakness || cell.last_weakness;
        }
    }

    const rows = Object.values(bySubjectTopic).map(c => ({
        ...c,
        pct: c.total_questions > 0 ? Math.round(100 * c.total_correct / c.total_questions) : null
    }));

    // Ordenar por % ascendente (peor primero) — esos son los focos a mejorar
    const weakest = rows.filter(r => r.pct != null && r.pct < 70).sort((a, b) => a.pct - b.pct).slice(0, 10);
    const strongest = rows.filter(r => r.pct != null && r.pct >= 90).sort((a, b) => b.pct - a.pct).slice(0, 5);

    return { weakest, strongest, total_topics: rows.length };
}

// =====================================================================
// NOTEBOOK ACTIVITY — fotos del cuaderno con OCR (notebook_ocr_records)
// =====================================================================
export async function getStudentNotebookActivity(student_user_id, { days = 30, limit = 30 } = {}) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data, error } = await supabase
        .from('notebook_ocr_records')
        .select('id, subject, page_count, interpretation_score, ocr_text, created_at')
        .eq('user_id', student_user_id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw new Error(`getStudentNotebookActivity: ${error.message}`);
    const records = (data || []).map(r => ({
        id: r.id,
        subject: r.subject,
        page_count: r.page_count,
        score: r.interpretation_score,
        excerpt: String(r.ocr_text || '').slice(0, 200),
        created_at: r.created_at
    }));
    // Agregado por materia
    const bySubject = {};
    for (const r of records) {
        const key = (r.subject || 'GENERAL').toUpperCase();
        if (!bySubject[key]) bySubject[key] = { subject: key, count: 0, pages: 0, avg_score: 0, scores: [], last_at: null };
        bySubject[key].count++;
        bySubject[key].pages += Number(r.page_count || 0);
        if (r.score != null) bySubject[key].scores.push(Number(r.score));
        if (!bySubject[key].last_at || r.created_at > bySubject[key].last_at) bySubject[key].last_at = r.created_at;
    }
    for (const s of Object.values(bySubject)) {
        s.avg_score = s.scores.length ? Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length) : null;
        delete s.scores;
    }
    return { records, by_subject: bySubject, total: records.length };
}

// =====================================================================
// DAILY TREND — daily_reports ultimos N dias (para grafico)
// =====================================================================
export async function getStudentDailyTrend(student_user_id, { days = 14 } = {}) {
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const { data, error } = await supabase
        .from('daily_reports')
        .select('report_date, studied_today, total_minutes, quiz_total, quiz_correct, quiz_wrong, notebook_count, status')
        .eq('student_user_id', student_user_id)
        .gte('report_date', since)
        .order('report_date', { ascending: false });
    if (error) throw new Error(`getStudentDailyTrend: ${error.message}`);
    return data || [];
}

// =====================================================================
// ADAPTIVE INSIGHTS — perfil adaptativo (recomendaciones, sesiones debiles/fuertes)
// =====================================================================
export async function getStudentAdaptiveInsights(student_user_id, { limit = 20 } = {}) {
    const { data, error } = await supabase
        .from('adaptive_profile_log')
        .select('*')
        .or(`user_id.eq.${student_user_id}`)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) return { items: [], error: error.message };
    return { items: data || [] };
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

// =====================================================================
// ALARM CONFIG — Sistema de alarmas Matico
// =====================================================================

export async function getAlarmConfigs(user_id) {
    const { data, error } = await supabase
        .from('alarm_config')
        .select('*')
        .eq('user_id', user_id)
        .eq('enabled', true)
        .order('hour', { ascending: true });
    if (error) return [];
    return data || [];
}

/**
 * Trae TODAS las alarmas del par apoderado+estudiante (incluidas las desactivadas).
 * Para la pantalla de configuración/edición de alarmas.
 */
export async function getAlarmConfigsManage(parent_user_id, student_user_id) {
    const ids = [parent_user_id, student_user_id].filter(Boolean);
    if (ids.length === 0) return [];
    const { data, error } = await supabase
        .from('alarm_config')
        .select('*')
        .in('user_id', ids)
        .eq('student_user_id', student_user_id)
        .order('hour', { ascending: true });
    if (error) return [];
    return data || [];
}

export async function upsertAlarmConfig({
    alarm_id, user_id, student_user_id, role, alarm_type,
    hour, minute, days_active, subjects_monitor, stale_threshold_days, sound, enabled
}) {
    const row = {
        user_id, student_user_id, role, alarm_type,
        hour, minute,
        days_active: JSON.stringify(days_active || ['lun','mar','mie','jue','vie']),
        subjects_monitor: JSON.stringify(subjects_monitor || []),
        stale_threshold_days: stale_threshold_days || 3,
        sound: sound || 'urgente',
        enabled: enabled !== false,
        updated_at: new Date().toISOString()
    };

    if (alarm_id) {
        const { data, error } = await supabase
            .from('alarm_config')
            .update(row)
            .eq('alarm_id', alarm_id)
            .select()
            .single();
        if (error) throw new Error(`upsertAlarmConfig update: ${error.message}`);
        return data;
    } else {
        const { data, error } = await supabase
            .from('alarm_config')
            .insert(row)
            .select()
            .single();
        if (error) throw new Error(`upsertAlarmConfig insert: ${error.message}`);
        return data;
    }
}

export async function deleteAlarmConfig(alarm_id) {
    const { error } = await supabase
        .from('alarm_config')
        .delete()
        .eq('alarm_id', alarm_id);
    if (error) throw new Error(`deleteAlarmConfig: ${error.message}`);
    return { success: true };
}

export async function recordAlarmFired({ alarm_id, user_id, alarm_type, digest_data }) {
    const { data, error } = await supabase
        .from('alarm_history')
        .insert({ alarm_id, user_id, alarm_type, digest_data: JSON.stringify(digest_data) })
        .select()
        .single();
    if (error) throw new Error(`recordAlarmFired: ${error.message}`);
    return data;
}

export async function updateAlarmAction(history_id, action_taken) {
    const { error } = await supabase
        .from('alarm_history')
        .update({ action_taken })
        .eq('history_id', history_id);
    if (error) throw new Error(`updateAlarmAction: ${error.message}`);
    return { success: true };
}

// =====================================================================
// ALARM DIGEST — Datos inteligentes para cada tipo de alarma
// =====================================================================

/**
 * Genera el digest para alarma de APODERADO 13:30 (parent_alert)
 * - Eventos próximos (7 días)
 * - Materias sin estudiar (stale)
 * - Resumen rápido de actividad reciente
 */
export async function getParentAlertDigest(student_user_id, stale_threshold_days = 3) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const in7days = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];
    const staleCutoff = new Date(now.getTime() - stale_threshold_days * 86400000).toISOString();

    // 1. Eventos próximos (pruebas, trabajos, etc.)
    const { data: events } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('student_user_id', student_user_id)
        .gte('event_date', todayStr)
        .lte('event_date', in7days)
        .in('event_type', ['prueba', 'trabajo', 'examen', 'tarea', 'ensayo'])
        .order('event_date', { ascending: true })
        .limit(10);

    // 2. Última actividad por materia (para detectar stale)
    const { data: recentProgress } = await supabase
        .from('progress_log')
        .select('subject, created_at, event_type, score')
        .eq('user_id', student_user_id)
        .order('created_at', { ascending: false })
        .limit(200);

    // Calcular última actividad real por materia
    const ALL_SUBJECTS = ['MATEMATICA', 'LENGUAJE', 'COMPETENCIA_LECTORA', 'FISICA', 'QUIMICA', 'BIOLOGIA', 'HISTORIA'];
    const REAL_ACTIVITIES = [
        // event_type reales escritos por la app
        'prep_exam_started', 'prep_exam_completed', 'prep_exam_reviewed',
        'theory_started', 'theory_completed',
        'cuaderno_completed', 'evidence_upload',
        // legacy / nombres usados en algunas rutas viejas
        'quiz', 'interactive_quiz', 'oracle_exam', 'ensayo', 'study_session', 'cuaderno'
    ];
    const lastActivityBySubject = {};

    for (const subject of ALL_SUBJECTS) {
        const variants = [subject, subject.toLowerCase(), subject.charAt(0) + subject.slice(1).toLowerCase()];
        // Buscar con/sin acento
        if (subject === 'FISICA') variants.push('FÍSICA', 'Física', 'física');
        if (subject === 'QUIMICA') variants.push('QUÍMICA', 'Química', 'química');
        if (subject === 'BIOLOGIA') variants.push('BIOLOGÍA', 'Biología', 'biología');
        if (subject === 'HISTORIA') variants.push('Historia', 'historia');

        const match = (recentProgress || []).find(p =>
            variants.includes(p.subject) && REAL_ACTIVITIES.includes(p.event_type)
        );
        lastActivityBySubject[subject] = match ? match.created_at : null;
    }

    // Materias sin estudiar
    const staleSubjects = [];
    for (const [subject, lastDate] of Object.entries(lastActivityBySubject)) {
        if (!lastDate) {
            staleSubjects.push({ subject, days_inactive: 999, never_studied: true });
        } else if (new Date(lastDate) < new Date(staleCutoff)) {
            const daysInactive = Math.floor((now - new Date(lastDate)) / 86400000);
            staleSubjects.push({ subject, days_inactive: daysInactive, last_activity: lastDate });
        }
    }
    staleSubjects.sort((a, b) => b.days_inactive - a.days_inactive);

    // 3. Actividad de los últimos 3 días (resumen rápido)
    const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString();
    const recentReal = (recentProgress || []).filter(p =>
        REAL_ACTIVITIES.includes(p.event_type) && p.created_at >= threeDaysAgo
    );

    return {
        alarm_type: 'parent_alert',
        student_user_id,
        generated_at: now.toISOString(),
        upcoming_events: events || [],
        stale_subjects: staleSubjects,
        recent_activity_count: recentReal.length,
        recent_activity_subjects: [...new Set(recentReal.map(p => p.subject))],
    };
}

/**
 * Genera el digest para alarma de ESTUDIANTE 17:00 (student_reminder)
 * - Eventos próximos (3 días)
 * - Materias prioritarias para hoy
 * - Misiones pendientes
 */
export async function getStudentReminderDigest(student_user_id, stale_threshold_days = 3) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const in3days = new Date(now.getTime() + 3 * 86400000).toISOString().split('T')[0];
    const staleCutoff = new Date(now.getTime() - stale_threshold_days * 86400000).toISOString();

    // 1. Eventos próximos (3 días)
    const { data: events } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('student_user_id', student_user_id)
        .gte('event_date', todayStr)
        .lte('event_date', in3days)
        .order('event_date', { ascending: true })
        .limit(10);

    // 2. Materias que necesita estudiar hoy (basado en eventos + stale)
    const { data: recentProgress } = await supabase
        .from('progress_log')
        .select('subject, created_at, event_type')
        .eq('user_id', student_user_id)
        .gte('created_at', staleCutoff)
        .limit(100);

    const REAL_ACTIVITIES = [
        // event_type reales escritos por la app
        'prep_exam_started', 'prep_exam_completed', 'prep_exam_reviewed',
        'theory_started', 'theory_completed',
        'cuaderno_completed', 'evidence_upload',
        // legacy / nombres usados en algunas rutas viejas
        'quiz', 'interactive_quiz', 'oracle_exam', 'ensayo', 'study_session', 'cuaderno'
    ];
    const recentSubjects = new Set(
        (recentProgress || [])
            .filter(p => REAL_ACTIVITIES.includes(p.event_type))
            .map(p => (p.subject || '').toUpperCase())
    );

    // Materias de eventos próximos que NO ha estudiado recientemente
    const eventSubjects = [...new Set((events || []).map(e => (e.subject || '').toUpperCase()).filter(Boolean))];
    const prioritySubjects = eventSubjects.filter(s => !recentSubjects.has(s));

    // 3. Actividad de hoy
    const todayStart = todayStr + 'T00:00:00';
    const { data: todayActivity } = await supabase
        .from('progress_log')
        .select('subject, event_type, score')
        .eq('user_id', student_user_id)
        .gte('created_at', todayStart)
        .limit(50);

    const studiedToday = (todayActivity || []).filter(p => REAL_ACTIVITIES.includes(p.event_type));

    return {
        alarm_type: 'student_reminder',
        student_user_id,
        generated_at: now.toISOString(),
        upcoming_events: events || [],
        priority_subjects: prioritySubjects,
        event_subjects: eventSubjects,
        studied_today: studiedToday.length > 0,
        studied_today_subjects: [...new Set(studiedToday.map(p => p.subject))],
    };
}

/**
 * Genera el digest para alarma de APODERADO 21:00 (parent_report)
 * - Actividad del día completa
 * - Cuaderno subido sí/no
 * - Quizzes del día (nota, fuente)
 * - Teoría lúdica completada
 * - Tiempo total estudiado
 * - Racha
 */
export async function getParentReportDigest(student_user_id) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const todayStart = todayStr + 'T00:00:00';
    const yesterdayStart = new Date(now.getTime() - 86400000).toISOString().split('T')[0] + 'T00:00:00';

    // 1. Toda la actividad de HOY
    const { data: todayProgress } = await supabase
        .from('progress_log')
        .select('*')
        .eq('user_id', student_user_id)
        .gte('created_at', todayStart)
        .order('created_at', { ascending: true });

    // 2. Sesiones de estudio de hoy (para tiempo total)
    const { data: todaySessions } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('student_user_id', student_user_id)
        .gte('start_time', todayStart);

    const totalMinutes = (todaySessions || []).reduce((sum, s) => sum + (s.total_minutes || 0), 0);

    // 3. Clasificar actividad del día
    const REAL_ACTIVITIES = [
        // event_type reales escritos por la app
        'prep_exam_started', 'prep_exam_completed', 'prep_exam_reviewed',
        'theory_started', 'theory_completed',
        'cuaderno_completed', 'evidence_upload',
        // legacy / nombres usados en algunas rutas viejas
        'quiz', 'interactive_quiz', 'oracle_exam', 'ensayo', 'study_session', 'cuaderno'
    ];
    const activities = todayProgress || [];

    const quizzes = activities.filter(p => ['quiz', 'interactive_quiz', 'oracle_exam', 'prep_exam_started', 'prep_exam_completed', 'prep_exam_reviewed'].includes(p.event_type));
    const cuadernoUploads = activities.filter(p => ['cuaderno', 'cuaderno_completed', 'evidence_upload'].includes(p.event_type));
    const theoryLudica = activities.filter(p => ['theory_started', 'theory_completed', 'teoria_ludica', 'theory'].includes(p.event_type));

    // Quiz detail: nota, materia, fuente
    const quizDetails = quizzes.map(q => ({
        subject: q.subject,
        score: q.score,
        correct: q.correct_answers,
        wrong: q.wrong_answers,
        total: q.total_questions,
        source: q.source || (q.event_type === 'oracle_exam' ? 'cuaderno' : (String(q.event_type || '').startsWith('prep_exam') ? 'banco_ia' : 'banco_ia')),
        event_type: q.event_type
    }));

    // Cuaderno subido por materia
    const cuadernoBySubject = {};
    for (const c of cuadernoUploads) {
        cuadernoBySubject[c.subject || 'general'] = true;
    }

    // 4. Racha (días consecutivos con actividad real)
    const { data: last30 } = await supabase
        .from('progress_log')
        .select('created_at, event_type')
        .eq('user_id', student_user_id)
        .gte('created_at', new Date(now.getTime() - 30 * 86400000).toISOString())
        .order('created_at', { ascending: false });

    let streak = 0;
    const checkedDates = new Set();
    const realLast30 = (last30 || []).filter(p => REAL_ACTIVITIES.includes(p.event_type));
    for (const p of realLast30) {
        const d = p.created_at.split('T')[0];
        checkedDates.add(d);
    }
    // Contar días consecutivos hacia atrás desde hoy
    for (let i = 0; i < 30; i++) {
        const checkDate = new Date(now.getTime() - i * 86400000).toISOString().split('T')[0];
        if (checkedDates.has(checkDate)) {
            streak++;
        } else if (i > 0) {
            break; // Se rompe la racha
        }
    }

    // 5. Comparación con ayer
    const { data: yesterdayProgress } = await supabase
        .from('progress_log')
        .select('event_type')
        .eq('user_id', student_user_id)
        .gte('created_at', yesterdayStart)
        .lt('created_at', todayStart);

    const yesterdayReal = (yesterdayProgress || []).filter(p => REAL_ACTIVITIES.includes(p.event_type));
    const todayReal = activities.filter(p => REAL_ACTIVITIES.includes(p.event_type));

    return {
        alarm_type: 'parent_report',
        student_user_id,
        generated_at: now.toISOString(),
        total_study_minutes: totalMinutes,
        quizzes: quizDetails,
        cuaderno_uploaded: cuadernoBySubject,
        theory_ludica_completed: theoryLudica.length > 0,
        theory_ludica_count: theoryLudica.length,
        total_activities_today: todayReal.length,
        total_activities_yesterday: yesterdayReal.length,
        trend: todayReal.length > yesterdayReal.length ? 'up' : todayReal.length < yesterdayReal.length ? 'down' : 'same',
        streak,
        subjects_studied_today: [...new Set(todayReal.map(p => p.subject).filter(Boolean))],
    };
}
