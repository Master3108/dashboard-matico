import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

let moralejaContent = '';
try {
    moralejaContent = fs.readFileSync(path.join(__dirname, 'moraleja.txt'), 'utf8');
    console.log(`[INIT] Loaded moraleja.txt (${moralejaContent.length} chars)`);
} catch (e) {
    console.log('[INIT] moraleja.txt not found, skipping local RAG.');
}

function extractRelevantContext(query, content, maxLength = 35000) {
    if (!content) return '';
    // Extraer palabras clave del query, eliminando conectores
    const ignored = ['para', 'como', 'este', 'esto', 'sobre', 'desde', 'hacia', 'hasta', 'cuando', 'donde'];
    const words = query.toLowerCase().replace(/[^a-záéíóúüñ]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !ignored.includes(w));

    if (words.length === 0) return content.substring(0, maxLength);

    const paragraphs = content.split(/\n\s*\n/);
    const scored = paragraphs.map((p, idx) => {
        const lower = p.toLowerCase();
        let score = 0;
        words.forEach(w => {
            // Dar más puntaje a ocurrencias exactas o en mayúsculas
            const matches = lower.match(new RegExp(w, 'g'));
            if (matches) score += matches.length;
        });
        return { p, score, idx };
    });

    // Filtrar párrafos relevantes
    const relevant = scored.filter(item => item.score > 0).sort((a, b) => b.score - a.score);

    let extracted = '';
    // Tomamos los párrafos más relevantes hasta alcanzar el límite
    for (let item of relevant) {
        if ((extracted.length + item.p.length) > maxLength) break;
        // Agregamos contexto de párrafos aledaños (+1 y -1) para coherencia leída
        const prev = paragraphs[item.idx - 1] ? paragraphs[item.idx - 1] + "\n" : "";
        const next = paragraphs[item.idx + 1] ? "\n" + paragraphs[item.idx + 1] : "";

        extracted += prev + item.p + next + "\n\n---\n\n";
    }

    if (extracted.length < 1000) return content.substring(0, maxLength); // Fallback if no matching at all
    return extracted.substring(0, maxLength);
}

const PORT = process.env.PORT || 5000;

// Configuración OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configuración Google Sheets
const SPREADSHEET_ID = '1l1GLMXh8_Uo_O7XJOY7ZJxh1TER2hxrXTOsc_EcByHo';

const getSheetsClient = async () => {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth });
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
const logToSheet = async (sheets, user_id, subject, session, event_type, phase, subLevel, levelName, score, xp) => {
    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'progress_log!A:J',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[
                    new Date().toISOString(),
                    user_id || '', subject || '', session || '',
                    event_type || '', phase || '', subLevel || '',
                    levelName || '', score || '', xp || ''
                ]]
            },
        });
        console.log(`[SHEET] ✅ Registrado: ${event_type} | ${subject} | ${levelName}`);
    } catch (err) {
        console.error("[SHEET] Error:", err.message);
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
            let systemMsg = `Eres Matico 🐶, un mentor carismático y experto en el currículum chileno de 1° Medio.
Responde SIEMPRE en Markdown legible y amigable para un estudiante joven.
Usa emojis frecuentemente para hacer la lectura divertida y motivadora.
Estructura tu respuesta con títulos (##), subtítulos (###), listas, **negritas** y ejemplos claros.
NUNCA respondas con JSON crudo. Solo texto enriquecido en Markdown.
Tu tono es cercano, motivador y lleno de energía, como un tutor favorito.`;

            let userPrompt = tema;

            // Inyección de Contenido Base (Moraleja via Frontend o Búsqueda Interna)
            let baseText = body.readingContent || '';

            // Si es Lenguaje y no hay suficiente contenido en readingContent, buscamos en todo el libro
            if (moralejaContent && (tema.toLowerCase().includes('lenguaje') || body.topic || true)) {
                const extracted = extractRelevantContext(tema, moralejaContent, 40000);
                baseText += `\n[EXTRACTOS ADICIONALES DEL LIBRO MORALEJA RELACIONADOS AL TEMA]:\n${extracted}`;
            }

            if (baseText.length > 10) {
                systemMsg += `\n\n**INSTRUCCIÓN CRÍTICA Y DOBLE ENFOQUE:**
Hoy debes enseñar el tema del Ministerio de Educación: "${tema}".
SIN EMBARGO, para preparar al alumno para la prueba PAES, DEBES buscar en la información extraída del libro "Moraleja" a continuación y usarla como tu fuente principal.
Tu deber es **conectar ingeniosamente** el tema del Ministerio ("${tema}") con la materia del libro.
Explica la materia al alumno basándote estrictamente en esos extractos de texto, rescatando ejercicios, ejemplos y tips de la PAES si los hay. Nutre y rellena cualquier vacío para que la explicación sea perfecta y sirva tanto para entender el tema escolar de MINEDUC como para dominar las habilidades PAES provistas por el libro.`;
                userPrompt = `Tema Oficial MINEDUC: ${tema}\n\nMATERIAL DE TEXTO (Libro Moraleja PAES):\n${body.readingTitle || 'Extractos Libro Matico'}\n${baseText}`;
            }

            const comp = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "system", content: systemMsg }, { role: "user", content: userPrompt }]
            });
            return res.json({ output: comp.choices[0].message.content });
        }

        // 2B. GENERAR QUIZ (5 preguntas por lote) — MULTIASIGNATURA
        if (currentAction.toLowerCase().includes('quiz') || currentAction.toLowerCase().includes('generar') || currentAction === 'generate_quiz') {
            const tema = body.tema || body.topic || 'Conocimiento General';
            const subject = (body.subject || body.sujeto || body.materia || data?.subject || 'MATEMATICA').toUpperCase();

            let systemMsg = "";
            let verifyPrompt = "";
            let aiTemperature = 0.2; // Por defecto baja para matemáticas

            if (subject.includes('LENGUAJE') || subject.includes('LECTURA')) {
                // PROMPT PARA LENGUAJE / COMPRENSIÓN LECTORA (INTEGRACIÓN MORALEJA)
                aiTemperature = 0.5; // Un poco más creativo para redactar textos

                let baseQuestionsContext = '';
                if (body.baseQuestions && Array.isArray(body.baseQuestions) && body.baseQuestions.length > 0) {
                    baseQuestionsContext = `\nPREGUNTAS BASE DEL LIBRO PAES:\n${JSON.stringify(body.baseQuestions, null, 2)}
                    \n**REGLA DE ORO:** Existen preguntas obligatorias proporcionadas arriba. DEBES incluirlas textuales en tu JSON final para practicar la prueba estandarizada PAES. Si notas errores (ej. faltan alternativas), Rellénalas.
                    \nLuego, si se requieren generar más preguntas para llegar a un total de 5, debes construirlas basándote en la LECTURA ingresada, PERO enfocándolas en el Tema Escolar a evaluar: "${tema}". Así conectamos el currículum con la lectura.`;
                }

                let finalReadingContent = body.readingContent || '';
                if (moralejaContent) {
                    const extractedForQuiz = extractRelevantContext(tema, moralejaContent, 40000);
                    finalReadingContent += `\n[MÁS EXTRACTOS RELEVANTES DEL LIBRO MORALEJA (PARA FORMULAR LAS PREGUNTAS)]:\n${extractedForQuiz}`;
                }

                systemMsg = `Eres Matico, profesor experto en Lenguaje y Comunicación del currículum chileno.
El estudiante aprenderá y será evaluado sobre el TEMA MINEDUC: "${tema}".
A LA PAR, estamos practicando basándonos ÚNICAMENTE en este contenido extraído del libro estratégico PAES Moraleja:
${finalReadingContent}
${baseQuestionsContext}

PROTOCOLO OBLIGATORIO PARA CADA PREGUNTA:
1. Las preguntas deben evaluar interactivamente el cruce entre el Tema: "${tema}" y la Lectura, exigiendo pensamiento crítico e inferencia.
2. Escribe una explicación clara de por qué esa es la opción correcta en "explanation", relacionándola con el aprendizaje de PAES o MINEDUC.
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

Genera SOLO JSON válido sin markdown. No omitas las preguntas base si fueron provistas.`;
                verifyPrompt = `Lee la pregunta de comprensión crítica cuidadosamente. LUEGO, di cuál letra (A, B, C o D) tiene la respuesta correcta basándote en la inferencia lógica o en el fragmento leído.
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
                model: "gpt-4o",
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

                const verifyPromises = questions.map(async (q, idx) => {
                    try {
                        const optionsText = Object.entries(q.options || {})
                            .map(([k, v]) => `${k}: ${v}`).join('\n');

                        const verifyComp = await openai.chat.completions.create({
                            model: "gpt-4o",
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
                    return q;
                });

                questions = await Promise.all(verifyPromises);
                console.log(`[VERIFY] ✅ Verificación completa. Corregidas: ${corrected}/${questions.length}`);
            }

            return res.json({ questions });
        }

        // 3. RESPONDER DUDAS / REMEDIAL / PROFUNDIZAR
        if (['answer_doubts', 'deepen_knowledge', 'generate_remedial_lesson', 'remedial_explanation',
            'Responder Duda', 'Profundizar y Desafiar', 'Explicar y Simplificar'].includes(currentAction)) {
            const tema = body.tema || body.topic || body.pregunta_usuario || 'Explícame más';
            const systemMsg = "Eres Matico, mentor experto y carismático del currículum chileno de 1° Medio. Usa emojis y analogías.";
            const comp = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "system", content: systemMsg }, { role: "user", content: tema }]
            });
            return res.json({ output: comp.choices[0].message.content });
        }

        // 4. GUARDAR PROGRESO
        if (currentAction === 'save_progress' || currentAction === 'save') {
            const eventType = data.type || 'progress_update';
            await logToSheet(sheets, user_id, data.subject || '', data.session || '', eventType,
                data.phase || '', data.subLevel || '', data.levelName || '', data.score || '', data.xp_reward || '');
            return res.json({ success: true, message: `Evento ${eventType} registrado` });
        }

        // 5. GET PROFILE
        if (currentAction === 'get_profile') {
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
            return res.json({
                xp: totalXP, puntos: totalXP, streak: 0, racha: 0,
                level: Math.floor(totalXP / 100) + 1, nivel: Math.floor(totalXP / 100) + 1,
                username: userData?.nombre || 'Estudiante', nombre: userData?.nombre || 'Estudiante',
                sessions_completed: sessionsCompleted
            });
        }

        // 6. ENVIAR REPORTE DE SESIÓN (email al alumno + apoderado CON ANÁLISIS IA)
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
                            model: "gpt-4o-mini",
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

        // 8. READ-ONLY ACTIONS
        const readOnlyActions = ['update_preferences', 'ping', 'health'];
        if (readOnlyActions.includes(currentAction)) {
            return res.json({ success: true });
        }

        // FALLBACK
        console.log(`[MATICO] Acción no mapeada: "${currentAction}". Registrando...`);
        await logToSheet(sheets, user_id, data.subject, data.session, currentAction, data.phase, data.subLevel, data.levelName, data.score, data.xp_reward);
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
