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
import { fileURLToPath } from 'url';
import { deleteGeneratedQuestion, listGeneratedQuestions, recordGeneratedQuestions } from './generatedQuestionBank.js';
import { recordAdaptiveEvent, getAdaptiveSnapshot } from './adaptiveProfileStore.js';
import { getCurriculumContext } from './curriculumCatalog.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_UPLOADS_DIR = path.join(__dirname, 'uploads');
const NOTEBOOK_UPLOADS_DIR = path.join(LOCAL_UPLOADS_DIR, 'cuadernos');

app.use('/uploads', express.static(LOCAL_UPLOADS_DIR));

const PORT = process.env.PORT || 5000;

// Configuración DeepSeek
const openai = new OpenAI({ 
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY,
    baseURL: 'https://api.deepseek.com/v1'
});

// Configuración Google Sheets
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

const sanitizeFileSegment = (value = '') => {
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80) || 'archivo';
};

const saveBase64ToLocalFile = async (base64File, fileName, subfolder = 'general') => {
    const targetDir = path.join(LOCAL_UPLOADS_DIR, subfolder);
    await fs.mkdir(targetDir, { recursive: true });

    const cleanName = sanitizeFileSegment(path.parse(fileName).name);
    const extension = path.extname(fileName) || '.bin';
    const finalName = `${cleanName}${extension}`;
    const absolutePath = path.join(targetDir, finalName);

    await fs.writeFile(absolutePath, Buffer.from(base64File, 'base64'));

    return {
        absolutePath,
        publicUrl: `/uploads/${subfolder}/${finalName}`,
        fileName: finalName
    };
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
    await fs.mkdir(NOTEBOOK_UPLOADS_DIR, { recursive: true });
    const entries = await fs.readdir(NOTEBOOK_UPLOADS_DIR, { withFileTypes: true });

    const files = await Promise.all(entries
        .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
        .map(async (entry) => {
            const absolutePath = path.join(NOTEBOOK_UPLOADS_DIR, entry.name);
            const stats = await fs.stat(absolutePath);

            return {
                fileName: entry.name,
                absolutePath,
                publicUrl: `/uploads/cuadernos/${entry.name}`,
                sizeBytes: stats.size,
                sizeLabel: `${(stats.size / 1024).toFixed(1)} KB`,
                updatedAt: stats.mtime.toISOString(),
                updatedAtLabel: stats.mtime.toLocaleString('es-CL')
            };
        }));

    return files.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
};

const deleteNotebookFile = async (fileName) => {
    const safeName = path.basename(fileName);
    const absolutePath = path.join(NOTEBOOK_UPLOADS_DIR, safeName);
    await fs.unlink(absolutePath);
    return absolutePath;
};

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

// --- Configuración Nodemailer (Gmail) ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

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
        console.log(`[EMAIL] ⚠️ No se envió: destinatario=${to}, gmail_user=${process.env.GMAIL_USER}`);
        return;
    }
    try {
        await transporter.sendMail({
            from: `"Matico 🐶" <${process.env.GMAIL_USER}>`,
            to: to,
            subject: subject,
            html: htmlBody,
        });
        console.log(`[EMAIL] ✅ Enviado a ${to}: "${subject}"`);
    } catch (err) {
        console.error(`[EMAIL] ❌ Error enviando a ${to}:`, err.message);
    }
};

// --- HELPER: Guardar evento en progress_log ---
const logToSheet = async (sheets, user_id, subject, session, event_type, phase, subLevel, levelName, score, xp, grade = '', topic = '', totalQuestions = '', sourceMode = '') => {
    try {
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
            sourceMode || ''
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'progress_log!A:N',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [values] },
        });

        console.log('[SHEET] ? ' + event_type + ' | User: ' + user_id + ' | Subj: ' + subject + ' | Phase: ' + phase + ' | XP: ' + xp);
    } catch (err) {
        console.error('[SHEET] ? Error:', err.message);
    }
};

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
    sourceMode = ''
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
        sourceMode || ''
    ];

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'progress_log!A:N',
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
            sourceMode
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
            error: err.message
        }));
        throw err;
    }
};
// --- HELPER: Generar HTML bonito para correos ---
const buildSessionReportHTML = (nombre, subject, session, topic, stats, wrongAnswers = [], aiAnalysis = '') => {
    const successRate = Math.round((stats.correct / 45) * 100);
    const emoji = successRate >= 80 ? '🏆' : (successRate >= 60 ? '👍' : '💪');
    const color = successRate >= 80 ? '#22c55e' : (successRate >= 60 ? '#eab308' : '#ef4444');
    const wrongCount = wrongAnswers.length;

    // Helper: Convertir LaTeX a texto legible para emails
    const cleanLatex = (text) => {
        if (!text) return '';
        return text
            .replace(/\$([^$]+)\$/g, '$1')           // Quitar delimitadores $...$
            .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')  // \frac{a}{b} → a/b
            .replace(/\\left\(/g, '(')                // \left( → (
            .replace(/\\right\)/g, ')')               // \right) → )
            .replace(/\\left\[/g, '[')
            .replace(/\\right\]/g, ']')
            .replace(/\\times/g, '×')                 // \times → ×
            .replace(/\\div/g, '÷')                   // \div → ÷
            .replace(/\\cdot/g, '·')                  // \cdot → ·
            .replace(/\\pm/g, '±')                    // \pm → ±
            .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')   // \sqrt{x} → √(x)
            .replace(/\^(\{[^}]+\})/g, (_, exp) => {  // ^{2} → ²
                const superscripts = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', 'n': 'ⁿ' };
                const inner = exp.replace(/[{}]/g, '');
                return inner.split('').map(c => superscripts[c] || `^${c}`).join('');
            })
            .replace(/\^(\d)/g, (_, d) => {           // ^2 → ²
                const sup = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
                return sup[d] || `^${d}`;
            })
            .replace(/_(\{[^}]+\})/g, (_, sub) => sub.replace(/[{}]/g, ''))  // _{n} → n
            .replace(/_(\d)/g, '$1')                   // _1 → 1
            .replace(/\\text\{([^}]+)\}/g, '$1')       // \text{...} → ...
            .replace(/\\\\/g, '')                      // Backslashes sueltos
            .replace(/\s+/g, ' ')                      // Espacios múltiples
            .trim();
    };

    // Generar tabla de errores
    let errorsHTML = '';
    if (wrongCount > 0) {
        const errorRows = wrongAnswers.slice(0, 10).map((w, i) => {
            const cleanQ = cleanLatex(w.question || '');
            const shortQ = cleanQ.substring(0, 80) + (cleanQ.length > 80 ? '...' : '');
            return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px; font-size: 13px; color: #475569;">${i + 1}. ${shortQ}</td>
                <td style="padding: 10px; text-align: center; color: #ef4444; font-weight: bold;">${w.user_answer}</td>
                <td style="padding: 10px; text-align: center; color: #22c55e; font-weight: bold;">${w.correct_answer}</td>
            </tr>`;
        }).join('');

        errorsHTML = `
            <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #fecaca; margin: 16px 0;">
                <h3 style="margin-top: 0; color: #dc2626;">❌ Preguntas Incorrectas (${wrongCount})</h3>
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
                ${wrongCount > 10 ? `<p style="color: #94a3b8; font-size: 12px; margin-top: 8px;">... y ${wrongCount - 10} más</p>` : ''}
            </div>`;
    }

    // Sección de análisis IA
    let analysisHTML = '';
    if (aiAnalysis) {
        analysisHTML = `
            <div style="background: linear-gradient(135deg, #eff6ff, #f0fdf4); border-radius: 12px; padding: 20px; border: 2px solid #6366f1; margin: 16px 0;">
                <h3 style="margin-top: 0; color: #4f46e5;">🧠 Análisis Inteligente de Matico</h3>
                <div style="color: #334155; font-size: 14px; line-height: 1.7;">
                    ${aiAnalysis}
                </div>
            </div>`;
    }

    return `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">🐶 Reporte Matico</h1>
            <p style="margin: 8px 0 0; opacity: 0.9;">Sesión de Estudio Completada</p>
        </div>
        <div style="padding: 30px;">
            <h2 style="color: #1e293b;">¡Hola! Aquí está el reporte de <strong>${nombre}</strong></h2>
            <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; margin: 16px 0;">
                <p><strong>📚 Asignatura:</strong> ${subject}</p>
                <p><strong>📖 Sesión ${session}:</strong> ${topic}</p>
                <p><strong>📅 Fecha:</strong> ${new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div style="text-align: center; margin: 24px 0;">
                <div style="display: inline-block; background: ${color}; color: white; border-radius: 50%; width: 100px; height: 100px; line-height: 100px; font-size: 32px; font-weight: bold;">
                    ${successRate}%
                </div>
                <p style="font-size: 20px; margin-top: 12px;">${emoji} ${stats.correct} de 45 correctas</p>
            </div>
            <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0;">
                <h3 style="margin-top: 0;">📊 Desglose por Nivel</h3>
                <p>🟢 <strong>Básico (15 preguntas):</strong> Completado</p>
                <p>🟡 <strong>Avanzado (15 preguntas):</strong> Completado</p>
                <p>🔴 <strong>Crítico (15 preguntas):</strong> Completado</p>
            </div>
            ${errorsHTML}
            ${analysisHTML}
            <p style="color: #64748b; font-size: 13px; text-align: center; margin-top: 24px;">
                Este correo fue enviado automáticamente por Matico 🐶
            </p>
        </div>
    </div>`;
};

const buildDailyReminderHTML = (nombre, session, topic, subject) => {
    return `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #f59e0b, #f97316); padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">☀️ ¡Buenos Días!</h1>
            <p style="margin: 8px 0 0; opacity: 0.9;">Tu sesión de hoy te espera</p>
        </div>
        <div style="padding: 30px;">
            <h2 style="color: #1e293b;">¡Hola <strong>${nombre}</strong>! 👋</h2>
            <p style="color: #475569; font-size: 16px;">Hoy es un gran día para aprender. Tu sesión de estudio ya está lista:</p>
            <div style="background: white; border-radius: 12px; padding: 24px; border: 2px solid #6366f1; margin: 20px 0; text-align: center;">
                <p style="font-size: 14px; color: #6366f1; font-weight: bold; margin: 0;">📚 ${subject}</p>
                <h3 style="font-size: 22px; color: #1e293b; margin: 8px 0;">Sesión ${session}: ${topic}</h3>
                <p style="color: #64748b;">45 preguntas en 3 niveles: Básico → Avanzado → Crítico</p>
            </div>
            <p style="color: #475569;">¡Recuerda que cada sesión completada te acerca más a tu meta! 🏆</p>
            <p style="color: #64748b; font-size: 13px; text-align: center; margin-top: 24px;">
                Matico 🐶 — Tu compañero de estudio
            </p>
        </div>
    </div>`;
};

const getQuizPromptConfig = (subject, tema, options = {}) => {
    const { includeSourceMetadata = false } = options;
    const sourceFields = includeSourceMetadata ? `,
      "source_session": 12,
      "source_topic": "Tema de origen"` : '';
    const sourceRules = includeSourceMetadata ? `
5. Cada pregunta DEBE indicar en "source_session" la sesión exacta de origen.
6. Cada pregunta DEBE indicar en "source_topic" el tema exacto de origen.` : '';

    let systemMsg = '';
    let aiTemperature = 0.2;

    if (subject.includes('LENGUAJE') || subject.includes('LECTURA')) {
        aiTemperature = 0.5;
        systemMsg = `Eres Matico, profesor experto en Lenguaje y Comunicación del currículum chileno.
El estudiante aprenderá: ${tema}.

PROTOCOLO OBLIGATORIO PARA CADA PREGUNTA:
1. Las preguntas deben evaluar comprensión lectora avanzada, pensamiento crítico e inferencia.
2. Escribe una explicación clara del porqué esa es la opción correcta en "explanation".
3. CREA 4 opciones, asegurándote que UNA coincide con tu explicación.
4. Al final, escribe la Letra correcta (A, B, C, D) en "correct_answer".${sourceRules}

ESTRUCTURA JSON EXACTA QUE DEBES USAR:
{
  "questions": [
    {
      "question": "texto de la pregunta de lectura o texto corto más la pregunta...",
      "explanation": "Explica aquí por qué la opción correcta es la adecuada basados en inferencia o pistas textuales.",
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

Genera SOLO JSON válido sin markdown.`;
    } else if (subject.includes('HISTORIA')) {
        aiTemperature = 0.4;
        systemMsg = `Eres Matico, historiador y profesor experto en Historia y Geografía.
Tema a evaluar: ${tema}.

PROTOCOLO OBLIGATORIO PARA CADA PREGUNTA:
1. Las preguntas deben evaluar análisis histórico, comprensión de contextos y causas/consecuencias, no solo fechas memorizadas.
2. Escribe una breve explicación histórica en "explanation" PRIMERO.
3. CREA 4 opciones.
4. Al final, escribe la Letra correcta en "correct_answer".${sourceRules}

ESTRUCTURA JSON EXACTA QUE DEBES USAR:
{
  "questions": [
    {
      "question": "contexto histórico y la pregunta...",
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

Genera SOLO JSON válido sin markdown.`;
    } else {
        aiTemperature = 0.2;
        systemMsg = `Eres Matico, mentor académico experto.
Tema: ${tema}.

PROTOCOLO OBLIGATORIO PARA CADA PREGUNTA:
1. DEBES hacer el desarrollo o razonamiento en "explanation" PRIMERO.
2. CREA 4 opciones, asegurándote que UNA coincide con tu razonamiento.
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

Genera SOLO JSON válido sin markdown.`;
    }

    return { systemMsg, aiTemperature };
};

const buildPrepExamAssignments = (sessionDetails = [], totalQuestions = 45) => {
    const normalized = sessionDetails
        .filter(item => item && item.session)
        .map(item => ({
            session: Number(item.session),
            topic: item.topic || `Sesión ${item.session}`
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
                return res.status(401).json({ success: false, message: "Credenciales inválidas" });
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

        // 2A. GENERAR TEORÍA LÚDICA
        if (currentAction.toLowerCase().includes('teoría') || currentAction.toLowerCase().includes('teoria')) {
            const tema = body.tema || body.topic || 'Matemáticas General';
            const systemMsg = `Eres Matico 🐶, un mentor carismático y experto en el currículum chileno de 1° Medio.
Responde SIEMPRE en Markdown legible y amigable para un estudiante joven.
Usa emojis frecuentemente para hacer la lectura divertida y motivadora.
Estructura tu respuesta con títulos (##), subtítulos (###), listas, **negritas** y ejemplos claros.
NUNCA respondas con JSON crudo. Solo texto enriquecido en Markdown.
Tu tono es cercano, motivador y lleno de energía, como un tutor favorito.`;

            const comp = await openai.chat.completions.create({
                model: "deepseek-chat",
                messages: [{ role: "system", content: systemMsg }, { role: "user", content: tema }]
            });
            return res.json({ output: comp.choices[0].message.content });
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
                topic: topics[index] || `Sesión ${session}`
            }));

            if (!sessionDetails.length) {
                return res.status(400).json({ success: false, error: 'Debes enviar al menos una sesión para la prueba preparatoria' });
            }

            const assignmentPlan = buildPrepExamAssignments(sessionDetails, questionCount);
            const totalBatches = Math.ceil(assignmentPlan.length / 5);
            const baseTopic = `Prueba preparatoria acumulativa de ${subject} sobre estas sesiones:\n${sessionDetails.map(item => `- Sesión ${item.session}: ${item.topic}`).join('\n')}`;
            const { systemMsg, aiTemperature } = getQuizPromptConfig(subject, baseTopic, { includeSourceMetadata: true });

            const fetchPrepBatch = async (batchIndex, avoidSignatures = []) => {
                const batchAssignments = assignmentPlan.slice(batchIndex * 5, batchIndex * 5 + 5);
                const batchInstructions = batchAssignments.map((item, index) => `${index + 1}. Sesión ${item.session} | Tema: ${item.topic}`).join('\n');
                const batchPrompt = `${baseTopic}

[MODO PRUEBA PREPARATORIA DIAGNÓSTICA]
- Genera EXACTAMENTE ${batchAssignments.length} preguntas.
- Esta es la tanda ${batchIndex + 1} de ${totalBatches}.
- Debes seguir ESTA distribución exacta, una pregunta por línea:
${batchInstructions}
- Si una sesión se repite, crea preguntas distintas entre sí.
- NO repitas preguntas ya usadas ni reformules la misma idea con cambios menores.
- Evita duplicados exactos y tambi�n preguntas casi iguales.
- Si te muestro ejemplos previos o patrones similares, crea una variante nueva.
- Preguntas previas a evitar: ${avoidSignatures.length > 0 ? avoidSignatures.slice(0, 10).join(' || ') : 'Ninguna'}
- "source_session" y "source_topic" deben coincidir EXACTAMENTE con cada línea asignada.
- Mantén alternativas A/B/C/D y explicación útil para corrección.
- Responde SOLO con JSON válido.`;

                const comp = await openai.chat.completions.create({
                    model: 'deepseek-chat',
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
                        explanation: question.explanation || 'Explicación no disponible.',
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

            const sessionDetails = sessions.map((session, index) => ({
                session,
                topic: topics[index] || `Sesi�n ${session}`
            }));

            if (!sessionDetails.length) {
                return res.status(400).json({ success: false, error: 'Debes enviar al menos una sesi�n para la prueba preparatoria' });
            }

            const assignmentPlan = buildPrepExamAssignments(sessionDetails, totalBatches * batchSize);
            const batchAssignments = assignmentPlan.slice(batchIndex * batchSize, batchIndex * batchSize + batchSize);
            const baseTopic = `Prueba preparatoria acumulativa de ${subject} sobre estas sesiones:\n${sessionDetails.map(item => `- Sesi�n ${item.session}: ${item.topic}`).join('\n')}`;
            const { systemMsg, aiTemperature } = getQuizPromptConfig(subject, baseTopic, { includeSourceMetadata: true });
            const batchInstructions = batchAssignments.map((item, index) => `${index + 1}. Sesi�n ${item.session} | Tema: ${item.topic}`).join('\n');
            const batchPrompt = `${baseTopic}\n\n[MODO PRUEBA PREPARATORIA DIAGN�STICA]\n- Genera EXACTAMENTE ${batchAssignments.length} preguntas.\n- Esta es la tanda ${batchIndex + 1} de ${totalBatches}.\n- Debes seguir ESTA distribuci�n exacta, una pregunta por l�nea:\n${batchInstructions}\n- Si una sesi�n se repite, crea preguntas distintas entre s�.\n- NO repitas preguntas ya usadas ni reformules la misma idea con cambios menores.\n- Evita duplicados exactos y tambi�n preguntas casi iguales.\n- \"source_session\" y \"source_topic\" deben coincidir EXACTAMENTE con cada l�nea asignada.\n- Mant�n alternativas A/B/C/D y explicaci�n �til para correcci�n.\n- Responde SOLO con JSON v�lido.`;

            const comp = await openai.chat.completions.create({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemMsg },
                    { role: 'user', content: batchPrompt }
                ],
                response_format: { type: 'json_object' },
                temperature: aiTemperature
            });

            const parsed = JSON.parse(comp.choices[0].message.content);
            const questions = Array.isArray(parsed.questions) ? parsed.questions : [];

            const normalizedQuestions = questions.map((question, index) => {
                const assigned = batchAssignments[index] || batchAssignments[0];
                return {
                    question: question.question,
                    options: question.options || {},
                    correct_answer: (question.correct_answer || 'A').toUpperCase(),
                    explanation: question.explanation || 'Explicaci�n no disponible.',
                    source_session: Number(question.source_session) || assigned.session,
                    source_topic: question.source_topic || assigned.topic
                };
            }).filter(question => question.question);

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
            }).catch((err) => console.error('[QUESTION_BANK] Error guardando batch de prueba preparatoria:', err.message));

            return res.json({
                success: true,
                mode: 'diagnostic_review',
                subject,
                sessions,
                batch_index: batchIndex,
                batch_size: batchSize,
                total_batches: totalBatches,
                questions: normalizedQuestions
            });
        }
        // 2B. GENERAR QUIZ (5 preguntas por lote) — MULTIASIGNATURA
        if (currentAction.toLowerCase().includes('quiz') || currentAction.toLowerCase().includes('generar') || currentAction === 'generate_quiz') {
            const tema = body.tema || body.topic || 'Conocimiento General';
            const subject = (body.subject || body.sujeto || body.materia || data?.subject || 'MATEMATICA').toUpperCase();

            let systemMsg = "";
            let verifyPrompt = "";
            let aiTemperature = 0.2; // Por defecto baja para matemáticas

            if (subject.includes('LENGUAJE') || subject.includes('LECTURA')) {
                // PROMPT PARA LENGUAJE / COMPRENSIÓN LECTORA
                aiTemperature = 0.5; // Un poco más creativo para redactar textos
                systemMsg = `Eres Matico, profesor experto en Lenguaje y Comunicación del currículum chileno.
El estudiante aprenderá: ${tema}.

PROTOCOLO OBLIGATORIO PARA CADA PREGUNTA:
1. Las preguntas deben evaluar comprensión lectora avanzada, pensamiento crítico e inferencia.
2. Escribe una explicación clara del porqué esa es la opción correcta en "explanation".
3. CREA 4 opciones, asegurándote que UNA coincide con tu explicación.
4. Al final, escribe la Letra correcta (A, B, C, D) en "correct_answer".

ESTRUCTURA JSON EXACTA QUE DEBES USAR:
{
  "questions": [
    {
      "question": "texto de la pregunta de lectura o texto corto más la pregunta...",
      "explanation": "Explica aquí por qué la opción correcta es la adecuada basados en inferencia o pistas textuales.",
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

Genera SOLO JSON válido sin markdown.`;
                verifyPrompt = `Lee la pregunta de comprensión crítica cuidadosamente. LUEGO, di cuál letra (A, B, C o D) tiene la respuesta correcta basándote en la inferencia lógica.
Estructura JSON:
{"my_calculation": "tu razonamiento aquí", "correct_letter": "LETRA FINAL"}`;

            } else if (subject.includes('HISTORIA')) {
                // PROMPT PARA HISTORIA
                aiTemperature = 0.4;
                systemMsg = `Eres Matico, historiador y profesor experto en Historia y Geografía.
Tema a evaluar: ${tema}.

PROTOCOLO OBLIGATORIO PARA CADA PREGUNTA:
1. Las preguntas deben evaluar análisis histórico, comprensión de contextos y causas/consecuencias, no solo fechas memorizadas.
2. Escribe una breve explicación histórica en "explanation" PRIMERO.
3. CREA 4 opciones.
4. Al final, escribe la Letra correcta en "correct_answer".

ESTRUCTURA JSON EXACTA QUE DEBES USAR:
{
  "questions": [
    {
      "question": "contexto histórico y la pregunta...",
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

Genera SOLO JSON válido sin markdown.`;
                verifyPrompt = `Analiza el hecho histórico. LUEGO, di cuál letra (A, B, C o D) tiene la respuesta correcta.
Estructura JSON:
{"my_calculation": "tu razonamiento histórico aquí", "correct_letter": "LETRA FINAL"}`;

            } else {
                // PROMPT POR DEFECTO: MATEMÁTICAS (Protocolo anti-errores original)
                aiTemperature = 0.2;
                systemMsg = `Eres Matico, mentor matemático experto.
Tema: ${tema}.

PROTOCOLO OBLIGATORIO PARA CADA PREGUNTA:
1. DEBES hacer el cálculo matemático en "explanation" PRIMERO.
2. CREA 4 opciones, asegurándote que UNA coincide con tu cálculo.
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

Genera SOLO JSON válido sin markdown.`;
                verifyPrompt = `Resuelve el problema matemático paso a paso. LUEGO, di cuál letra (A, B, C o D) tiene la respuesta correcta.
Estructura JSON:
{"my_calculation": "tu desarrollo paso a paso aquí primero", "correct_letter": "LETRA FINAL"}`;
            }

            const comp = await openai.chat.completions.create({
                model: "deepseek-chat",
                messages: [{ role: "system", content: systemMsg }, { role: "user", content: tema }],
                response_format: { type: "json_object" },
                temperature: aiTemperature
            });

            const content = comp.choices[0].message.content;
            let questions = [];
            try {
                const parsed = JSON.parse(content);
                questions = parsed.questions || [];
            } catch {
                return res.json({ output: content });
            }

            // PASO 2: VERIFICACIÓN INDEPENDIENTE — Segunda IA revisa cada pregunta
            if (questions.length > 0) {
                console.log(`[VERIFY] 🔍 Verificando ${questions.length} preguntas de ${subject}...`);
                let corrected = 0;

                for (let idx = 0; idx < questions.length; idx++) {
                    const q = questions[idx];
                    try {
                        const optionsText = Object.entries(q.options || {})
                            .map(([k, v]) => `${k}: ${v}`).join('\n');

                        // Delay de 500ms para evitar Rate Limits de NVIDIA / OpenAI al paralelizar 3 batches de 5 preguntas
                        if (idx > 0) await new Promise(r => setTimeout(r, 500));

                        const verifyComp = await openai.chat.completions.create({
                            model: "deepseek-chat",
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
                            console.log(`[VERIFY] ⚠️ Q${idx + 1} CORREGIDA: "${q.question.substring(0, 50)}..." | AI dijo: ${q.correct_answer} → Verificador: ${verifiedLetter}`);
                            q.correct_answer = verifiedLetter;
                            corrected++;
                        }
                    } catch (err) {
                        console.log(`[VERIFY] Error en Q${idx + 1}:`, err.message);
                    }
                }
                console.log(`[VERIFY] ✅ Verificación completa. Corregidas: ${corrected}/${questions.length}`);
            }

            await recordGeneratedQuestions(questions, {
                subject,
                source_action: 'generate_quiz',
                source_mode: 'quiz',
                grade: body.grade || '1medio',
                source_topic: tema,
                source_session: body.session || data.session || '',
                metadata: {
                    currentAction,
                    level: body.level || body.nivel || data.level || '',
                    topic: tema,
                    user_id: user_id || ''
                }
            }).catch((err) => console.error('[QUESTION_BANK] Error guardando quiz generado:', err.message));

            return res.json({ questions });
        }

        // 3. RESPONDER DUDAS / REMEDIAL / PROFUNDIZAR
        if (['answer_doubts', 'deepen_knowledge', 'generate_remedial_lesson', 'remedial_explanation',
            'Responder Duda', 'Profundizar y Desafiar', 'Explicar y Simplificar'].includes(currentAction)) {
            const tema = body.tema || body.topic || body.pregunta_usuario || 'Explícame más';
            const systemMsg = "Eres Matico, mentor experto y carismático del currículum chileno de 1° Medio. Usa emojis y analogías.";
            const comp = await openai.chat.completions.create({
                model: "deepseek-chat",
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
                .map(item => `Sesión ${item.session}: ${item.topic}\nContexto: ${(item.readingContent || '').substring(0, 1200) || 'Sin lectura asociada.'}`)
                .join('\n\n');

            const wrongContext = wrongAnswers
                .map((item, index) => `${index + 1}. Sesión ${item.session} | ${item.topic}\nPregunta fallada: ${item.question}`)
                .join('\n');

            const comp = await openai.chat.completions.create({
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: 'Eres Matico, tutor académico de 1° medio. Redacta un repaso guiado breve, concreto y accionable para un apoderado y un estudiante. Usa Markdown simple con títulos y listas. Debe incluir qué repasar, en qué orden y cómo practicar.'
                    },
                    {
                        role: 'user',
                        content: `ASIGNATURA: ${subject}
SESIONES DÉBILES: ${weakSessions.join(', ') || 'Sin sesiones marcadas'}

CONTEXTO DE SESIONES:
${weakContext || 'Sin contexto adicional.'}

ERRORES DETECTADOS:
${wrongContext || 'Sin errores específicos.'}

Entrega:
1. Un resumen corto del problema.
2. Un plan de repaso por sesión.
3. 3 recomendaciones prácticas para preparar la prueba real.`
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
                sourceMode: data.source_mode || data.mode || ''
            });
            await recordAdaptiveEvent({
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
            }).catch((err) => console.error('[ADAPTIVE_PROFILE] Error actualizando perfil:', err.message));
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
                spreadsheetId: SPREADSHEET_ID, range: 'progress_log!A:J',
            });
            const rows = response.data.values || [];
            const userRows = rows.filter(row => row[1] === user_id);
            let totalXP = 0, sessionsCompleted = 0;
            userRows.forEach(row => {
                totalXP += parseInt(row[9]) || 0;
                if (row[4] === 'session_completed') sessionsCompleted++;
            });
            const userData = await getUserFromSheet(sheets, user_id);
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

        // 6. ENVIAR REPORTE DE SESI        // 6. ENVIAR REPORTE DE SESIÓN (email al alumno + apoderado CON ANÁLISIS IA)
        if (currentAction === 'send_session_report' || currentAction === 'notify_parent') {
            const userData = await getUserFromSheet(sheets, user_id);
            if (userData) {
                const stats = body.stats || { correct: 0, total: 45 };
                const subject = body.subject || 'Materia';
                const session = body.session || '?';
                const topic = body.topic || body.tema || '';
                const wrongAnswers = body.wrong_answers || [];

                // GENERAR ANÁLISIS IA DE LOS ERRORES
                let aiAnalysis = '';
                if (wrongAnswers.length > 0) {
                    try {
                        const errorSummary = wrongAnswers.slice(0, 15).map((w, i) =>
                            `${i + 1}. Pregunta: "${w.question}" | Respondió: ${w.user_answer} | Correcta: ${w.correct_answer}`
                        ).join('\n');

                        const analysisComp = await openai.chat.completions.create({
                            model: "deepseek-chat",
                            messages: [
                                {
                                    role: "system", content: `Eres un tutor experto en educación chilena de 1° Medio. Analiza los errores del estudiante y genera un reporte breve EN HTML (usando <p>, <ul>, <li>, <strong>). NO uses markdown. El reporte debe:
1. Identificar PATRONES en los errores (ej: "confunde fracciones con decimales")
2. Señalar las ÁREAS DÉBILES específicas
3. Dar 3 SUGERENCIAS CONCRETAS para mejorar
4. Un mensaje MOTIVADOR al final
Sé conciso (máximo 200 palabras). Usa lenguaje cercano.` },
                                { role: "user", content: `Estudiante: ${userData.nombre}\nAsignatura: ${subject}\nTema: ${topic}\nResultado: ${stats.correct}/45\n\nPREGUNTAS INCORRECTAS:\n${errorSummary}` }
                            ]
                        });
                        aiAnalysis = analysisComp.choices[0].message.content;
                        console.log('[AI] ✅ Análisis de errores generado');
                    } catch (err) {
                        console.error('[AI] Error generando análisis:', err.message);
                    }
                }

                const html = buildSessionReportHTML(userData.nombre, subject, session, topic, stats, wrongAnswers, aiAnalysis);
                const emailSubject = `📊 Reporte Matico: ${userData.nombre} completó ${subject} - Sesión ${session}`;

                // Enviar al alumno
                if (userData.email) {
                    await sendEmail(userData.email, emailSubject, html);
                }
                // Enviar al apoderado
                if (userData.correo_apoderado) {
                    await sendEmail(userData.correo_apoderado, `👨‍👩‍👧 ${emailSubject}`, html);
                }
            }
            return res.json({ success: true, message: "Reportes enviados con análisis IA" });
        }

        // 7. GET PROGRESS (Leer progreso real desde progress_log por materia)
        if (currentAction === 'get_progress') {
            const subjectFilter = body.subject || '';

            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'progress_log!A:J',
            });
            const rows = response.data.values || [];

            // Filtrar por user_id
            const userRows = rows.filter(row => row[1] === user_id);

            // Filtrar sesiones completadas de esta materia
            // Columnas: A=timestamp, B=user_id, C=subject, D=session, E=event_type
            const completedSessions = userRows.filter(row =>
                row[4] === 'session_completed' &&
                (subjectFilter ? row[2] === subjectFilter : true)
            );

            // Encontrar la sesión más alta completada
            let maxSession = 0;
            let lastPhase = 0;
            completedSessions.forEach(row => {
                const sessionNum = parseInt(row[3]) || 0;
                if (sessionNum > maxSession) maxSession = sessionNum;
            });

            // También buscar fases completadas (por si está a mitad de sesión)
            const phaseRows = userRows.filter(row =>
                row[4] === 'phase_completed' &&
                (subjectFilter ? row[2] === subjectFilter : true)
            );

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

            // Calcular XP total
            let totalXP = 0;
            userRows.forEach(row => {
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
        // 9. VERIFICAR ESCRITURA A MANO — CUADERNO DE MATICO (NVIDIA Kimi K2.5 Vision)
        if (currentAction === 'verify_handwriting') {
            const {
                image,
                imageMimeType,
                pdf,
                pdfFileName,
                sessionId,
                topic: cuadernoTopic,
                readingContent: cuadernoReading
            } = body;
            const cuadernoSubject = (body.subject || 'MATEMATICA').toUpperCase();

            if (!image) {
                return res.status(400).json({ success: false, error: 'No se recibió imagen' });
            }

            console.log(`[CUADERNO] Verificando escritura para ${cuadernoSubject} - Sesion ${sessionId}`);
            
            // 1. Guardar en el VPS inmediatamente
            let storedFile = null;
            
            try {
                if (pdf) {
                    const fileName = pdfFileName || `cuaderno_${user_id || 'anon'}_${cuadernoSubject}_S${sessionId || '0'}_${Date.now()}.pdf`;
                    storedFile = await saveBase64ToLocalFile(pdf, fileName, 'cuadernos');
                    console.log(`[LOCAL_STORAGE] ✅ PDF escaneado guardado: ${storedFile.absolutePath}`);
                } else {
                    const fileName = `cuaderno_${user_id || 'anon'}_${cuadernoSubject}_S${sessionId || '0'}_${Date.now()}.jpg`;
                    storedFile = await saveBase64ToLocalFile(image, fileName, 'cuadernos');
                    console.log(`[LOCAL_STORAGE] ✅ Imagen guardada: ${storedFile.absolutePath}`);
                }
            } catch (storageErr) {
                console.error(`[LOCAL_STORAGE] ❌ Error guardando archivo: ${storageErr.message}`);
            }

            // 2. Responder al frontend inmediatamente para que no espere
            res.json({
                success: true,
                background: true,
                message: '¡Documento escaneado guardado! Matico lo analizará mientras sigues con el quiz.',
                stored_file_path: storedFile?.absolutePath || null,
                stored_file_url: storedFile?.publicUrl || null
            });

            // 3. PROCESAMIENTO EN SEGUNDO PLANO
            (async () => {
                try {
                    console.log('[CUADERNO-BG] Iniciando análisis AI en segundo plano...');
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

                    if (!process.env.NVIDIA_API_KEY) {
                        console.error('[CUADERNO-BG] NVIDIA_API_KEY no configurada');
                        return;
                    }

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
                    let resultText = nvidiaData.choices?.[0]?.message?.content || '';
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
                    console.error('[CUADERNO-BG] Error en análisis diferido:', bgError.message);
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
        console.log(`[MATICO] Acción no mapeada: "${currentAction}". Registrando...`);
        await logToSheet(sheets, user_id, data.subject, data.session, currentAction, data.phase, data.subLevel, data.levelName, data.score, data.xp_reward, data.grade || '1medio', data.topic || data.source_topic || '', data.total_questions || data.total || '', data.source_mode || data.mode || '');
        res.json({ success: true, message: `Acción "${currentAction}" registrada` });

    } catch (error) {
        console.error("Error Core:", error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================================================
// CRON: Recordatorio Diario a las 09:00 AM (Chile)
// ========================================================================
cron.schedule('0 9 * * *', async () => {
    console.log('[CRON] ⏰ Ejecutando recordatorio matutino...');
    try {
        const sheets = await getSheetsClient();
        const users = await getAllUsersFromSheet(sheets);

        // Calcular qué sesión toca hoy (simplificado: día desde inicio)
        const startDate = new Date('2026-01-15'); // Fecha de inicio del curso
        const today = new Date();
        const daysDiff = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
        const sessionNumber = (daysDiff % 43) + 1; // Ciclo de 43 sesiones
        const topic = `Sesión ${sessionNumber} del día`;
        const subject = 'MATEMATICA'; // Se podría alternar por día

        for (const user of users) {
            const html = buildDailyReminderHTML(user.nombre, sessionNumber, topic, subject);
            const emailSubject = `☀️ ¡Buenos Días ${user.nombre}! Tu sesión de ${subject} te espera`;

            // Al alumno
            if (user.email) {
                await sendEmail(user.email, emailSubject, html);
            }
            // Al apoderado
            if (user.correo_apoderado) {
                await sendEmail(user.correo_apoderado, `📋 Recordatorio: ${user.nombre} tiene sesión hoy`, html);
            }
        }
        console.log(`[CRON] ✅ Recordatorios enviados a ${users.length} usuarios`);
    } catch (err) {
        console.error('[CRON] Error:', err.message);
    }
}, { timezone: 'America/Santiago' });

app.listen(PORT, () => console.log(`🚀 Servidor Matico Kaizen en puerto ${PORT}`));










