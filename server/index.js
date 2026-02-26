import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { google } from 'googleapis';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Configuración OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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

// --- ENDPOINTS ---

app.post('/webhook/MATICO', async (req, res) => {
    const { action, accion, user_id, email, subject, topic, data } = req.body;
    const currentAction = action || accion;

    console.log(`[MATICO] Accion: ${currentAction} | Topic: ${topic}`);

    try {
        let responseData = { success: true };

        // --- 1. LOGIN / REGISTER (Google Sheets Real) ---
        if (currentAction === 'login' || currentAction === 'register') {
            const sheets = await getSheetsClient();
            const { email, password, name, phone, region, commune } = req.body;

            // Traer todos los usuarios
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Usuarios!A:H',
            });
            const rows = response.data.values || [];
            const user = rows.find(row => row[3] === email); // Columna D es mail

            if (currentAction === 'login') {
                if (user && user[1] === password) {
                    return res.json({ success: true, user_id: user[0], name: user[4] || 'Estudiante' });
                }
                return res.status(401).json({ success: false, message: "Credenciales inválidas" });
            }

            if (currentAction === 'register') {
                if (user) return res.status(400).json({ success: false, message: "El usuario ya existe" });

                const newToken = `TK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                const newUserRow = [
                    newToken,           // token (A)
                    password,           // password (B)
                    new Date().toISOString(), // created_at (C)
                    email,              // mail (D)
                    name || 'Estudiante', // nombre (E)
                    phone || '',        // celular (F)
                    region || '',       // region (G)
                    commune || ''       // comuna (H)
                ];

                await sheets.spreadsheets.values.append({
                    spreadsheetId: SPREADSHEET_ID,
                    range: 'Usuarios!A:H',
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [newUserRow] },
                });
                return res.json({ success: true, user_id: newToken, name: name || 'Estudiante' });
            }
        }

        // --- 2. GENERADORES IA ---
        else if (currentAction === 'generate_quiz' || currentAction === 'generate_remedial_lesson' || currentAction === 'answer_doubts' || currentAction === 'deepen_knowledge') {
            const isQuiz = currentAction === 'generate_quiz';
            const isRemedial = currentAction === 'generate_remedial_lesson';

            let systemMsg = "Eres Matico, mentor experto en el currículum chileno de 1° Medio.";
            let userMsg = "";

            if (isQuiz) {
                userMsg = `Genera un JSON con 30 preguntas sobre ${topic}. Formato: {"questions": [{"question": "...", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, "correct_answer": "...", "explanation": "..."}]}`;
            } else if (isRemedial) {
                userMsg = `Crea una mini-lección remedial Markdown para ${topic}. Pregunta fallada: "${req.body.question}". R.Correcta: "${req.body.correct_answer}". Paso a paso.`;
            } else {
                userMsg = `Responde la duda o profundiza en ${topic}: ${req.body.pregunta_usuario || 'Explícame más'}`;
            }

            const comp = await openai.chat.completions.create({
                model: isQuiz ? "gpt-4o-mini" : "gpt-4o",
                messages: [{ role: "system", content: systemMsg }, { role: "user", content: userMsg }],
                response_format: isQuiz ? { type: "json_object" } : undefined
            });

            const content = comp.choices[0].message.content;
            responseData = isQuiz ? JSON.parse(content) : { output: content, content };
        }

        // --- 3. GUARDAR PROGRESO (Google Sheets) ---
        // Siempre guardamos el evento antes de responder
        if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && currentAction !== 'login' && currentAction !== 'register') {
            try {
                const sheets = await getSheetsClient();
                let range = 'progress_log!A:J';
                if (currentAction.includes('quiz')) range = 'quiz_results!A:J';
                else if (currentAction.includes('session')) range = 'study_sessions!A:J';

                await sheets.spreadsheets.values.append({
                    spreadsheetId: SPREADSHEET_ID,
                    range: range,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [[
                            new Date().toLocaleString('es-CL'),
                            user_id || 'matico-son',
                            subject || '',
                            data?.session || '',
                            currentAction,
                            data?.phase || '',
                            data?.subLevel || '',
                            data?.levelName || '',
                            data?.score || '',
                            data?.xp_reward || ''
                        ]]
                    },
                });
            } catch (sheetErr) {
                console.error("Sheet Log Error:", sheetErr);
            }
        }

        res.json(responseData);

    } catch (error) {
        console.error("Error Core:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Servidor Matico para Google Sheets en puerto ${PORT}`));
