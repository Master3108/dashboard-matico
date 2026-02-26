import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { google } from 'googleapis';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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

// --- HELPER: Guardar evento en progress_log ---
const logToSheet = async (sheets, user_id, subject, session, event_type, phase, subLevel, levelName, score, xp) => {
    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'progress_log!A:J',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[
                    new Date().toISOString(),   // timestamp (A)
                    user_id || '',              // user_id (B)
                    subject || '',              // subject (C)
                    session || '',              // session (D)
                    event_type || '',           // event_type (E)
                    phase || '',                // phase (F)
                    subLevel || '',             // sub_level (G)
                    levelName || '',            // levelName (H)
                    score || '',                // score (I)
                    xp || ''                    // xp (J)
                ]]
            },
        });
        console.log(`[SHEET] ✅ Registrado: ${event_type} | ${subject} | ${levelName}`);
    } catch (err) {
        console.error("[SHEET] Error:", err.message);
    }
};

// --- ENDPOINTS ---

app.post('/webhook/MATICO', async (req, res) => {
    const body = req.body;
    const currentAction = body.action || body.accion || '';
    const user_id = body.user_id;
    const email = body.email;
    const data = body.data || {};

    console.log(`[MATICO] Accion: "${currentAction}" | Topic: ${body.tema || body.topic || '(sin tema)'}`);

    try {
        const sheets = await getSheetsClient();

        // =====================================================================
        // 1. LOGIN / REGISTER
        // =====================================================================
        if (currentAction === 'login' || currentAction === 'register') {
            const { email, password, name, phone, region, commune } = body;

            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Usuarios!A:H',
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
                    range: 'Usuarios!A:H',
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [[newToken, password, new Date().toISOString(), email, name || 'Estudiante', phone || '', region || '', commune || '']]
                    },
                });
                return res.json({ success: true, user_id: newToken, name: name || 'Estudiante' });
            }
        }

        // =====================================================================
        // 2. GENERAR QUIZ (Compatible con frontend Kaizen: 5 preguntas por lote)
        //    El frontend envía: accion='Generar Quiz de Validación' o action='generate_quiz'
        // =====================================================================
        if (currentAction.toLowerCase().includes('quiz') || currentAction.toLowerCase().includes('generar')) {
            const tema = body.tema || body.topic || 'Matemáticas General';

            // El prompt del frontend ya viene con instrucciones detalladas en 'tema'
            const systemMsg = "Eres Matico, mentor experto en el currículum chileno de 1° Medio. Genera SOLO JSON válido sin markdown.";

            const comp = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemMsg },
                    { role: "user", content: tema }
                ],
                response_format: { type: "json_object" }
            });

            const content = comp.choices[0].message.content;

            // Responder en formato compatible con parseN8NResponse del frontend
            // El frontend espera un JSON con campo "output" O directamente "questions"
            try {
                const parsed = JSON.parse(content);
                // Si ya tiene "questions", enviar tal cual
                if (parsed.questions) {
                    return res.json(parsed);
                }
                // Si es otro formato, envolver en output
                return res.json({ output: content });
            } catch {
                return res.json({ output: content });
            }
        }

        // =====================================================================
        // 3. RESPONDER DUDAS / REMEDIAL / PROFUNDIZAR
        // =====================================================================
        if (currentAction === 'answer_doubts' || currentAction === 'deepen_knowledge' ||
            currentAction === 'generate_remedial_lesson' || currentAction === 'remedial_explanation') {

            const tema = body.tema || body.topic || body.pregunta_usuario || 'Explícame más';
            const systemMsg = "Eres Matico, mentor experto y carismático del currículum chileno de 1° Medio. Usa emojis y analogías.";

            const comp = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemMsg },
                    { role: "user", content: tema }
                ]
            });

            return res.json({ output: comp.choices[0].message.content });
        }

        // =====================================================================
        // 4. GUARDAR PROGRESO (save_progress) → progress_log
        //    El frontend envía: accion='save_progress' con data.type como event_type
        // =====================================================================
        if (currentAction === 'save_progress' || currentAction === 'save') {
            const eventType = data.type || 'progress_update';

            await logToSheet(
                sheets,
                user_id,
                data.subject || '',
                data.session || '',
                eventType,              // event_type: phase_completed, session_completed, etc.
                data.phase || '',
                data.subLevel || '',
                data.levelName || '',
                data.score || '',
                data.xp_reward || ''
            );

            return res.json({ success: true, message: `Evento ${eventType} registrado` });
        }

        // =====================================================================
        // 5. GET PROFILE (Leer XP y progreso del usuario)
        // =====================================================================
        if (currentAction === 'get_profile') {
            // Leer todas las filas de progress_log para este user_id
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'progress_log!A:J',
            });
            const rows = response.data.values || [];
            const userRows = rows.filter(row => row[1] === user_id);

            // Sumar XP total (columna J)
            let totalXP = 0;
            let sessionsCompleted = 0;
            userRows.forEach(row => {
                totalXP += parseInt(row[9]) || 0;
                if (row[4] === 'session_completed') sessionsCompleted++;
            });

            // Buscar nombre en Usuarios
            const usersResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Usuarios!A:E',
            });
            const userRow = (usersResponse.data.values || []).find(r => r[0] === user_id);

            return res.json({
                xp: totalXP,
                puntos: totalXP,
                streak: 0,
                racha: 0,
                level: Math.floor(totalXP / 100) + 1,
                nivel: Math.floor(totalXP / 100) + 1,
                username: userRow?.[4] || 'Estudiante',
                nombre: userRow?.[4] || 'Estudiante',
                sessions_completed: sessionsCompleted
            });
        }

        // =====================================================================
        // 6. UPDATE PREFERENCES
        // =====================================================================
        if (currentAction === 'update_preferences') {
            return res.json({ success: true, message: "Preferencias actualizadas" });
        }

        // =====================================================================
        // FALLBACK: Acción no reconocida → registrar y responder OK
        // =====================================================================
        console.log(`[MATICO] Acción no mapeada: "${currentAction}". Registrando...`);

        await logToSheet(sheets, user_id, data.subject, data.session, currentAction, data.phase, data.subLevel, data.levelName, data.score, data.xp_reward);

        res.json({ success: true, message: `Acción "${currentAction}" registrada` });

    } catch (error) {
        console.error("Error Core:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Servidor Matico Kaizen en puerto ${PORT}`));
