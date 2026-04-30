// =====================================================================
// MATICO - Migracion de Google Sheets a Supabase
// =====================================================================
// Copia el contenido de las hojas del Google Sheet al esquema Supabase.
//
// Caracteristicas:
//   - IDEMPOTENTE: usa UPSERT, podes correrlo N veces sin duplicar.
//   - VERBOSO: muestra cuantas filas lee y cuantas escribe por tabla.
//   - SEGURO: en error de fila individual, sigue con la siguiente.
//   - DRY-RUN: con --dry-run lee pero no escribe.
//
// Uso (desde server/):
//   npm run migrate                   # migra TODO
//   npm run migrate -- --dry-run      # simula, no escribe
//   npm run migrate -- --table=users  # solo una tabla
//
// Tablas que se migran:
//   users, question_bank, theory_ludica_bank, pedagogical_assets,
//   exam_reminders, progress_log, adaptive_profile_log
//
// Tablas que NO se migran (no tienen datos en Sheets):
//   profiles, quiz_results, study_sessions, session_progress,
//   question_bank_builds
// =====================================================================

import dotenv from 'dotenv';
import { google } from 'googleapis';
import { supabase } from '../db/supabaseClient.js';

dotenv.config();

// ---------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------
const args = process.argv.slice(2);
const flagDryRun = args.includes('--dry-run');
const flagTable = (args.find(a => a.startsWith('--table=')) || '').split('=')[1];

// ---------------------------------------------------------------------
// Helpers de log
// ---------------------------------------------------------------------
const banner = (msg) => console.log(`\n${'='.repeat(70)}\n  ${msg}\n${'='.repeat(70)}`);
const info = (msg) => console.log(`  [INFO] ${msg}`);
const ok = (msg) => console.log(`  [OK]   ${msg}`);
const warn = (msg) => console.log(`  [WARN] ${msg}`);
const fail = (msg) => console.log(`  [FAIL] ${msg}`);

// ---------------------------------------------------------------------
// Google Sheets client (reutiliza misma logica que index.js)
// ---------------------------------------------------------------------
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

const normalizePrivateKey = (value = '') => value
    .trim()
    .replace(/^"(.*)"$/s, '$1')
    .replace(/^'(.*)'$/s, '$1')
    .replace(/\\r/g, '')
    .replace(/\\n/g, '\n');

const getSheetsClient = async () => {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY || '');
    if (!clientEmail || !privateKey) {
        throw new Error('Faltan credenciales Google: GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_PRIVATE_KEY');
    }
    const auth = new google.auth.GoogleAuth({
        credentials: { client_email: clientEmail, private_key: privateKey },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    return google.sheets({ version: 'v4', auth });
};

let _sheets = null;
const sheetsClient = async () => {
    if (!_sheets) _sheets = await getSheetsClient();
    return _sheets;
};

// ---------------------------------------------------------------------
// Helpers de transformacion
// ---------------------------------------------------------------------
const stripText = (v) => String(v ?? '').trim();

const toBoolish = (v) => {
    const s = String(v ?? '').trim().toUpperCase();
    if (!s) return null;
    if (['TRUE', 'VERDADERO', '1', 'SI', 'YES'].includes(s)) return true;
    if (['FALSE', 'FALSO', '0', 'NO'].includes(s)) return false;
    return null;
};

const toNum = (v) => {
    const s = String(v ?? '').trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
};

const toInt = (v) => {
    const n = toNum(v);
    return n === null ? null : Math.trunc(n);
};

const toIso = (v) => {
    const s = String(v ?? '').trim();
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const toJsonb = (v) => {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'object') return v;
    try { return JSON.parse(String(v)); } catch { return null; }
};

// ---------------------------------------------------------------------
// Normalizacion de SUBJECT (resuelve aliases historicos del Sheet)
// ---------------------------------------------------------------------
const SUBJECT_ALIASES = {
    'LENGUAJE': 'COMPETENCIA_LECTORA',
    'LECTURA': 'COMPETENCIA_LECTORA',
    'COMPETENCIA LECTORA': 'COMPETENCIA_LECTORA',
};
const VALID_SUBJECTS = new Set([
    'MATEMATICA', 'FISICA', 'QUIMICA', 'BIOLOGIA', 'HISTORIA', 'COMPETENCIA_LECTORA',
]);

const normalizeSubjectCode = (raw) => {
    const s = String(raw ?? '').trim().toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return SUBJECT_ALIASES[s] || s;
};

// Filtra filas con subject invalido y reporta cuantas se descartaron.
// Si allowNull=true, deja pasar filas con subject null/vacio (las setea a null).
const filterValidSubjects = (rows, tableName, { allowNull = false } = {}) => {
    const invalid = {};
    const valid = rows.filter(r => {
        const sub = r.subject;
        if (!sub) {
            if (allowNull) {
                r.subject = null;
                return true;
            }
            invalid['(vacio)'] = (invalid['(vacio)'] || 0) + 1;
            return false;
        }
        if (!VALID_SUBJECTS.has(sub)) {
            invalid[sub] = (invalid[sub] || 0) + 1;
            return false;
        }
        return true;
    });
    if (Object.keys(invalid).length > 0) {
        warn(`${tableName}: descartadas ${rows.length - valid.length} filas por subject invalido:`);
        Object.entries(invalid).forEach(([k, v]) => warn(`     "${k}": ${v} filas`));
    }
    return valid;
};

// Deduplica filas por una columna clave (queda la ultima ocurrencia)
const dedupeBy = (rows, key) => {
    const seen = new Map();
    rows.forEach(r => seen.set(r[key], r));
    const deduped = Array.from(seen.values());
    if (deduped.length < rows.length) {
        warn(`Deduplicadas ${rows.length - deduped.length} filas con ${key} repetido (se queda la ultima)`);
    }
    return deduped;
};

// ---------------------------------------------------------------------
// Reader: trae todas las filas de una hoja como array de objetos
// ---------------------------------------------------------------------
async function readSheet(tabName, range = 'A:ZZ') {
    if (!SPREADSHEET_ID) throw new Error('Falta GOOGLE_SHEETS_ID en .env');
    const sheets = await sheetsClient();
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tabName}!${range}`,
    });
    const rows = response.data.values || [];
    if (rows.length === 0) {
        info(`Hoja ${tabName}: vacia (sin headers)`);
        return [];
    }
    const headers = rows[0].map(h => String(h || '').trim());
    const data = rows.slice(1)
        .filter(r => r.some(c => String(c || '').trim().length > 0))  // skip empty rows
        .map(r => {
            const obj = {};
            headers.forEach((h, i) => { obj[h] = r[i] ?? ''; });
            return obj;
        });
    info(`Hoja ${tabName}: ${data.length} filas (${headers.length} cols: ${headers.slice(0, 4).join(', ')}...)`);
    return data;
}

// ---------------------------------------------------------------------
// Writer: hace upsert en bloques (chunks) para no saturar Supabase
// ---------------------------------------------------------------------
async function upsertBatch(table, rows, conflictKey) {
    if (rows.length === 0) {
        info(`Tabla ${table}: nada para escribir`);
        return { inserted: 0, errors: 0 };
    }
    if (flagDryRun) {
        warn(`[DRY-RUN] Se hubiera hecho upsert de ${rows.length} filas en ${table}`);
        return { inserted: rows.length, errors: 0 };
    }

    const CHUNK = 500;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const opts = conflictKey ? { onConflict: conflictKey } : undefined;
        const { error } = await supabase.from(table).upsert(chunk, opts);
        if (error) {
            errors += chunk.length;
            fail(`Tabla ${table} chunk ${i}-${i + chunk.length}: ${error.message}`);
        } else {
            inserted += chunk.length;
        }
    }

    if (errors === 0) {
        ok(`Tabla ${table}: ${inserted} filas escritas`);
    } else {
        warn(`Tabla ${table}: ${inserted} ok, ${errors} errores`);
    }
    return { inserted, errors };
}

// ---------------------------------------------------------------------
// MIGRACIONES POR TABLA
// ---------------------------------------------------------------------

async function migrateUsers() {
    banner('1) Usuarios -> users');
    const sheet = await readSheet('Usuarios', 'A:I');
    const mapped = sheet.map(r => ({
        token: stripText(r.token),
        pass: stripText(r.pass || r.password) || null,
        created: toIso(r.created || r.created_at),
        mail: stripText(r.mail).toLowerCase() || null,
        nombre: stripText(r.nombre) || null,
        celular: stripText(r.celular) || null,
        region: stripText(r.region) || null,
        comuna: stripText(r.comuna) || null,
        correo_apoderado: stripText(r.correo_apoderado).toLowerCase() || null,
    })).filter(r => r.token);
    const rows = dedupeBy(mapped, 'token');
    return upsertBatch('users', rows, 'token');
}

async function migrateQuestionBank() {
    banner('2) QuestionBank -> question_bank');
    const sheet = await readSheet('QuestionBank', 'A:X');
    const mapped = sheet.map(r => ({
        question_id: stripText(r.question_id),
        grade: '1medio',  // todas las preguntas actuales son 1° medio
        subject: normalizeSubjectCode(r.subject),
        session: toInt(r.session) ?? 0,
        phase: toInt(r.phase) ?? 1,
        slot: toInt(r.slot),
        proposal_index: toInt(r.proposal_index) ?? 1,
        level_name: stripText(r.levelName) || null,
        topic: stripText(r.topic) || null,
        question: stripText(r.question),
        options: {
            A: stripText(r.option_a),
            B: stripText(r.option_b),
            C: stripText(r.option_c),
            D: stripText(r.option_d),
        },
        correct_answer: stripText(r.correct_answer),
        explanation: stripText(r.explanation) || null,
        source_mode: stripText(r.sourceMode) || null,
        active: toBoolish(r.active) ?? true,
        prompt_image_asset_id: stripText(r.prompt_image_asset_id) || null,
        question_visual_role: stripText(r.question_visual_role) || null,
        created_at: toIso(r.created_at) || new Date().toISOString(),
        updated_at: toIso(r.updated_at) || new Date().toISOString(),
    })).filter(r => r.question_id && r.subject && r.question);
    const filtered = filterValidSubjects(mapped, 'question_bank');
    const rows = dedupeBy(filtered, 'question_id');
    return upsertBatch('question_bank', rows, 'question_id');
}

async function migrateTheoryLudicaBank() {
    banner('3) TheoryLudicaBank -> theory_ludica_bank');
    const sheet = await readSheet('TheoryLudicaBank', 'A:L');
    const mapped = sheet.map(r => ({
        grade: '1medio',
        subject: normalizeSubjectCode(r.subject),
        session: toInt(r.session) ?? 0,
        phase: toInt(r.phase) ?? 1,
        topic: stripText(r.topic) || null,
        theory_markdown: stripText(r.theory_markdown),
        source: stripText(r.source) || null,
        active: toBoolish(r.active) ?? true,
        support_image_asset_id: stripText(r.support_image_asset_id) || null,
        created_at: toIso(r.timestamp) || new Date().toISOString(),
    })).filter(r => r.subject && r.theory_markdown);
    const rows = filterValidSubjects(mapped, 'theory_ludica_bank');
    // theory_ludica_bank tiene id bigserial (no PK natural), no usamos onConflict
    return upsertBatch('theory_ludica_bank', rows);
}

async function migratePedagogicalAssets() {
    banner('4) PedagogicalImageBank -> pedagogical_assets');
    const sheet = await readSheet('PedagogicalImageBank', 'A:N');
    const mapped = sheet.map(r => {
        const fileName = stripText(r.file_name);
        const assetId = stripText(r.asset_id);
        const subjectRaw = normalizeSubjectCode(r.subject);
        const subject = VALID_SUBJECTS.has(subjectRaw) ? subjectRaw : null;
        // construimos un storage_path estandar a partir de los datos del sheet
        const storagePath = fileName
            ? `pedagogical/${subject || 'general'}/${assetId}/${fileName}`
            : `pedagogical/${subject || 'general'}/${assetId}/asset`;
        return {
            asset_id: assetId,
            title: stripText(r.title) || null,
            subject: subject,
            topic_tags: stripText(r.topic_tags) || null,
            kind: stripText(r.kind) || null,
            storage_path: storagePath,
            public_url: stripText(r.file_url) || null,
            mime_type: stripText(r.mime_type) || null,
            alt_text: stripText(r.alt_text) || null,
            caption: stripText(r.caption) || null,
            source_type: stripText(r.source_type) || null,
            status: stripText(r.status) || 'approved',
            created_at: toIso(r.created_at) || new Date().toISOString(),
            updated_at: toIso(r.updated_at) || new Date().toISOString(),
        };
    }).filter(r => r.asset_id);
    const rows = dedupeBy(mapped, 'asset_id');
    return upsertBatch('pedagogical_assets', rows, 'asset_id');
}

async function migrateExamReminders() {
    banner('5) ExamReminderBank -> exam_reminders');
    const sheet = await readSheet('ExamReminderBank', 'A:Q');
    const rows = sheet.map(r => ({
        event_id: stripText(r.event_id),
        // user_id se omite (formato uuid no compatible con tokens del sheet)
        user_email: stripText(r.student_email).toLowerCase() || null,
        student_name: stripText(r.student_name) || null,
        student_email: stripText(r.student_email).toLowerCase() || null,
        guardian_email: stripText(r.guardian_email).toLowerCase() || null,
        subject: stripText(r.subject) || null,
        exam_date: stripText(r.exam_date) || null,  // postgres acepta YYYY-MM-DD directo
        title: stripText(r.title) || null,
        source: stripText(r.source) || null,
        confidence: toNum(r.confidence),
        status: stripText(r.status) || null,
        sent_d7: toBoolish(r.sent_d7) ?? false,
        sent_d2: toBoolish(r.sent_d2) ?? false,
        sent_d1: toBoolish(r.sent_d1) ?? false,
        last_sent_at: toIso(r.last_sent_at),
        notes: stripText(r.notes) || null,
        created_at: toIso(r.timestamp) || new Date().toISOString(),
    })).filter(r => r.event_id);
    return upsertBatch('exam_reminders', rows, 'event_id');
}

async function migrateProgressLog() {
    banner('6) progress_log -> progress_log');
    const sheet = await readSheet('progress_log', 'A:U');
    const mapped = sheet.map(r => ({
        // user_id se omite (token != uuid). user_email es la clave de join.
        user_email: stripText(r.user_email).toLowerCase() || stripText(r.user_id).toLowerCase() || null,
        grade: stripText(r.grade) || '1medio',
        subject: normalizeSubjectCode(r.subject) || null,
        session: toInt(r.session),
        phase: toInt(r.phase),
        sub_level: stripText(r.subLevel) || null,
        level_name: stripText(r.levelName) || null,
        event_type: stripText(r.event_type) || null,
        score: toNum(r.score),
        xp: toInt(r.xp),
        topic: stripText(r.topic) || null,
        total_questions: toInt(r.totalQuestions),
        correct_answers: toInt(r.correctAnswers),
        wrong_answers: toInt(r.wrongAnswers),
        wrong_question_details: toJsonb(r.wrongQuestionDetails),
        weakness: toJsonb(r.weakness),
        improvement_plan: toJsonb(r.improvementPlan),
        source_mode: stripText(r.sourceMode) || null,
        batch_index: toInt(r.batchIndex),
        batch_size: toInt(r.batchSize),
        created_at: toIso(r.timestamp) || new Date().toISOString(),
    })).filter(r => r.user_email || r.subject);
    const rows = filterValidSubjects(mapped, 'progress_log', { allowNull: true });
    // progress_log es append-only con id bigserial, sin onConflict
    return upsertBatch('progress_log', rows);
}

async function migrateAdaptiveProfileLog() {
    banner('7) adaptive_profile_log -> adaptive_profile_log');
    const sheet = await readSheet('adaptive_profile_log', 'A:O');
    const rows = sheet.map(r => {
        // todos los campos extra van en payload jsonb
        const { timestamp, user_id, subject, ...rest } = r;
        const payload = {};
        Object.entries(rest).forEach(([k, v]) => {
            if (v === '' || v === null || v === undefined) return;
            // intentar parsear JSON si parece JSON
            if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
                try { payload[k] = JSON.parse(v); return; } catch {}
            }
            payload[k] = v;
        });
        return {
            user_email: stripText(user_id).toLowerCase() || null,
            subject: normalizeSubjectCode(subject) || null,
            payload,
            created_at: toIso(timestamp) || new Date().toISOString(),
        };
    }).filter(r => r.user_email || r.subject);
    const filtered = filterValidSubjects(rows, 'adaptive_profile_log', { allowNull: true });
    return upsertBatch('adaptive_profile_log', filtered);
}

// ---------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------
const ALL_MIGRATIONS = {
    users: migrateUsers,
    question_bank: migrateQuestionBank,
    theory_ludica_bank: migrateTheoryLudicaBank,
    pedagogical_assets: migratePedagogicalAssets,
    exam_reminders: migrateExamReminders,
    progress_log: migrateProgressLog,
    adaptive_profile_log: migrateAdaptiveProfileLog,
};

async function main() {
    banner('MIGRACION GOOGLE SHEETS -> SUPABASE');
    info(`Sheet ID: ${SPREADSHEET_ID}`);
    info(`Supabase: ${process.env.SUPABASE_URL}`);
    if (flagDryRun) warn('Modo DRY-RUN: NO se va a escribir en Supabase');
    if (flagTable) info(`Solo migrando tabla: ${flagTable}`);

    const tablesToRun = flagTable
        ? [flagTable]
        : Object.keys(ALL_MIGRATIONS);

    const summary = {};
    for (const table of tablesToRun) {
        const fn = ALL_MIGRATIONS[table];
        if (!fn) {
            fail(`Tabla "${table}" no existe. Tablas disponibles: ${Object.keys(ALL_MIGRATIONS).join(', ')}`);
            continue;
        }
        try {
            summary[table] = await fn();
        } catch (err) {
            fail(`Error fatal en ${table}: ${err.message}`);
            summary[table] = { inserted: 0, errors: -1, fatal: err.message };
        }
    }

    banner('RESUMEN FINAL');
    let totalInserted = 0;
    let totalErrors = 0;
    Object.entries(summary).forEach(([table, res]) => {
        const status = res.errors === 0 ? '[OK]  ' : (res.errors > 0 ? '[WARN]' : '[FAIL]');
        console.log(`  ${status} ${table.padEnd(28)} insertados=${res.inserted}  errores=${res.errors}`);
        totalInserted += res.inserted || 0;
        totalErrors += res.errors > 0 ? res.errors : 0;
    });
    console.log(`\n  TOTAL: ${totalInserted} filas insertadas, ${totalErrors} errores`);
    console.log(flagDryRun ? '  (DRY-RUN: nada se escribio en Supabase)\n' : '');
    process.exitCode = totalErrors > 0 ? 1 : 0;
}

main().catch((err) => {
    console.error('\n[ERROR FATAL]', err);
    process.exitCode = 1;
});
