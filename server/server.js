const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuración Google Sheets
const SPREADSHEET_ID = '1l1GLMXh8_Uo_O7XJOY7ZJxh1TER2hxrXTOsc_EcByHo';
const SHEETS_API_KEY = process.env.GOOGLE_API_KEY || ''; // Opcional: usar API key para lectura pública

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Crear carpetas necesarias
const UPLOADS_DIR = path.join(__dirname, 'uploads', 'notebooks');
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ============================================
// GOOGLE SHEETS INTEGRACIÓN
// ============================================

// Autenticación con Service Account
let auth = null;
let sheets = null;

try {
    // Buscar archivo de credenciales
    const keyFile = path.join(__dirname, 'google-credentials.json');
    
    if (fs.existsSync(keyFile)) {
        auth = new google.auth.GoogleAuth({
            keyFile: keyFile,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        sheets = google.sheets({ version: 'v4', auth });
        console.log('[GOOGLE] ✅ Conectado a Google Sheets');
    } else {
        console.log('[GOOGLE] ⚠️  No se encontró google-credentials.json');
        console.log('[GOOGLE] Creando archivo de ejemplo...');
        
        const exampleCredentials = {
            "type": "service_account",
            "project_id": "matico-app",
            "private_key_id": "...",
            "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
            "client_email": "matico-server@matico-app.iam.gserviceaccount.com",
            "client_id": "...",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/matico-server%40matico-app.iam.gserviceaccount.com"
        };
        
        fs.writeFileSync(
            path.join(__dirname, 'google-credentials.example.json'),
            JSON.stringify(exampleCredentials, null, 2)
        );
    }
} catch (error) {
    console.error('[GOOGLE] Error inicializando Sheets:', error.message);
}

// Helper: Leer de Google Sheets
async function readSheet(range) {
    if (!sheets) {
        console.log('[GOOGLE] Sheets no configurado, usando fallback local');
        return null;
    }
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
        });
        return response.data.values;
    } catch (error) {
        console.error('[GOOGLE] Error leyendo sheet:', error.message);
        return null;
    }
}

const normalizeSheetRows = (value) => {
    if (Array.isArray(value)) {
        return value;
    }

    if (Array.isArray(value?.values)) {
        return value.values;
    }

    if (Array.isArray(value?.data?.values)) {
        return value.data.values;
    }

    return [];
};

// Helper: Escribir en Google Sheets
async function writeSheet(range, values) {
    if (!sheets) {
        console.log('[GOOGLE] Sheets no configurado, usando fallback local');
        return false;
    }
    
    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'RAW',
            resource: { values: values },
        });
        return true;
    } catch (error) {
        console.error('[GOOGLE] Error escribiendo sheet:', error.message);
        return false;
    }
}

// ============================================
// DATOS LOCALES (Fallback)
// ============================================

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PROGRESS_FILE = path.join(DATA_DIR, 'progress.json');
const NOTEBOOKS_FILE = path.join(DATA_DIR, 'notebooks.json');

// Inicializar archivos
[USERS_FILE, PROGRESS_FILE, NOTEBOOKS_FILE].forEach(file => {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify({}, null, 2));
    }
});

const getUsers = () => {
    try {
        const parsed = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));

        if (Array.isArray(parsed)) {
            return parsed.reduce((acc, item) => {
                if (!item || !item.email) return acc;
                acc[item.email] = item;
                return acc;
            }, {});
        }

        if (parsed && typeof parsed === 'object') {
            return parsed;
        }

        return {};
    } catch (error) {
        console.error('[DATA] Error leyendo users.json, usando objeto vacio:', error.message);
        return {};
    }
};
const saveUsers = (users) => fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
const getProgress = () => JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
const saveProgress = (progress) => fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
const getNotebooks = () => JSON.parse(fs.readFileSync(NOTEBOOKS_FILE, 'utf8'));
const saveNotebooks = (notebooks) => fs.writeFileSync(NOTEBOOKS_FILE, JSON.stringify(notebooks, null, 2));

// ============================================
// ENDPOINTS API
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        googleSheets: sheets ? 'connected' : 'not_configured',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ============================================
// AUTENTICACIÓN
// ============================================

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email y contraseña requeridos' 
            });
        }
        
        // Intentar leer de Google Sheets primero
        let userData = null;
        const sheetData = normalizeSheetRows(await readSheet('users'));
        
        if (sheetData.length > 0) {
            // Buscar usuario en sheet
            const userRow = sheetData.find(row => row[0] === email && row[1] === password);
            if (userRow) {
                userData = {
                    user_id: userRow[2] || uuidv4(),
                    email: userRow[0],
                    name: userRow[3] || email.split('@')[0],
                    xp: parseInt(userRow[4]) || 0,
                    level: parseInt(userRow[5]) || 1,
                    streak: parseInt(userRow[6]) || 0
                };
            }
        }
        
        // Fallback a datos locales
        if (!userData) {
            const users = getUsers();
            const user = users[email];
            
            if (!user || user.password !== password) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Credenciales inválidas' 
                });
            }
            
            userData = {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                xp: user.xp || 0,
                level: user.level || 1,
                streak: user.streak || 0
            };
        }
        
        console.log(`[AUTH] Login exitoso: ${email}`);
        
        res.json({
            success: true,
            ...userData
        });
        
    } catch (error) {
        console.error('[AUTH] Error en login:', error);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// Registro
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email y contraseña requeridos' 
            });
        }
        
        const users = getUsers();
        
        if (users[email]) {
            return res.status(400).json({ 
                success: false, 
                error: 'Usuario ya existe' 
            });
        }
        
        const userId = uuidv4();
        users[email] = {
            user_id: userId,
            email,
            password,
            name: name || email.split('@')[0],
            createdAt: new Date().toISOString(),
            xp: 0,
            level: 1,
            streak: 0
        };
        
        saveUsers(users);
        
        // También guardar en Sheets si está disponible
        if (sheets) {
            await writeSheet('users', [[
                email, 
                password, 
                userId, 
                users[email].name, 
                0, 
                1, 
                0,
                new Date().toISOString()
            ]]);
        }
        
        console.log(`[AUTH] Usuario registrado: ${email}`);
        
        res.json({
            success: true,
            user_id: userId,
            name: users[email].name,
            email,
            xp: 0,
            level: 1,
            streak: 0
        });
        
    } catch (error) {
        console.error('[AUTH] Error en registro:', error);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// Obtener perfil
app.get('/api/auth/profile', async (req, res) => {
    try {
        const { email } = req.query;
        const users = getUsers();
        const user = users[email];
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: 'Usuario no encontrado' 
            });
        }
        
        res.json({
            success: true,
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            xp: user.xp || 0,
            level: user.level || 1,
            streak: user.streak || 0
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// ============================================
// PROGRESO
// ============================================

// Obtener progreso
app.post('/api/progress/get', async (req, res) => {
    try {
        const { user_id, email, subject } = req.body;
        
        // Intentar leer de Sheets
        const sheetData = await readSheet('progress');
        let userProgress = null;
        
        if (sheetData) {
            const progressRow = sheetData.find(row => 
                row[0] === email && row[1] === subject
            );
            if (progressRow) {
                userProgress = {
                    next_session: parseInt(progressRow[2]) || 1,
                    last_completed_session: parseInt(progressRow[3]) || 0,
                    current_session_in_progress: parseInt(progressRow[4]) || 1,
                    current_phase: parseInt(progressRow[5]) || 1,
                    total_score: parseInt(progressRow[6]) || 0
                };
            }
        }
        
        // Fallback local
        if (!userProgress) {
            const progress = getProgress();
            const key = `${email}_${subject}`;
            const localProgress = progress[key] || {};
            
            const completedSessions = Object.keys(localProgress.sessions || {})
                .map(s => parseInt(s))
                .filter(s => !isNaN(s));
            
            const lastCompleted = completedSessions.length > 0 
                ? Math.max(...completedSessions) 
                : 0;
            
            userProgress = {
                next_session: lastCompleted + 1,
                last_completed_session: lastCompleted,
                current_session_in_progress: lastCompleted + 1,
                current_phase: 1,
                total_score: localProgress.totalScore || 0
            };
        }
        
        res.json({
            success: true,
            ...userProgress
        });
        
    } catch (error) {
        console.error('[PROGRESS] Error obteniendo:', error);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// Guardar progreso
app.post('/api/progress/save', async (req, res) => {
    try {
        const { user_id, email, subject, type, data } = req.body;
        
        // Guardar en datos locales
        const progress = getProgress();
        const key = `${email}_${subject}`;
        
        if (!progress[key]) {
            progress[key] = {
                user_id,
                email,
                subject,
                sessions: {},
                lastUpdated: new Date().toISOString()
            };
        }
        
        // Actualizar según el tipo
        if (type === 'session_completed' && data.session) {
            progress[key].sessions[data.session] = {
                completed: true,
                score: data.score || 0,
                xp_earned: data.xp_reward || 0,
                completedAt: new Date().toISOString()
            };
        }
        
        // Calcular totales
        const sessions = Object.values(progress[key].sessions);
        progress[key].totalSessions = sessions.length;
        progress[key].totalScore = sessions.reduce((acc, s) => acc + (s.score || 0), 0);
        progress[key].totalXP = sessions.reduce((acc, s) => acc + (s.xp_earned || 0), 0);
        progress[key].lastUpdated = new Date().toISOString();
        
        saveProgress(progress);
        
        // Actualizar XP del usuario
        const users = getUsers();
        if (users[email] && data.xp_reward) {
            users[email].xp = (users[email].xp || 0) + data.xp_reward;
            saveUsers(users);
        }
        
        // También guardar en Sheets
        if (sheets) {
            await writeSheet('progress', [[
                email,
                subject,
                (progress[key].last_completed_session || 0) + 1, // next_session
                progress[key].last_completed_session || 0,
                progress[key].current_session_in_progress || 1,
                progress[key].current_phase || 1,
                progress[key].totalScore || 0,
                progress[key].totalXP || 0,
                new Date().toISOString()
            ]]);
        }
        
        res.json({ success: true, message: 'Progreso guardado' });
        
    } catch (error) {
        console.error('[PROGRESS] Error guardando:', error);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// ============================================
// CUADERNOS (PDFs ESCANEADOS)
// ============================================

// Guardar PDF del cuaderno
app.post('/api/save-notebook', async (req, res) => {
    try {
        const { 
            email, 
            user_id, 
            session_id, 
            subject, 
            topic, 
            pdf_base64, 
            file_name, 
            scan_id,
            timestamp 
        } = req.body;

        if (!pdf_base64) {
            return res.status(400).json({ 
                success: false, 
                error: 'No se recibió el PDF' 
            });
        }

        // Generar nombre único
        const uniqueId = uuidv4().slice(0, 8);
        const safeFileName = file_name || `matico_scan_${subject || 'materia'}_${uniqueId}.pdf`;
        const filePath = path.join(UPLOADS_DIR, safeFileName);

        // Decodificar y guardar PDF
        const pdfBuffer = Buffer.from(pdf_base64, 'base64');
        fs.writeFileSync(filePath, pdfBuffer);

        // Guardar metadata
        const fileRecord = {
            id: uniqueId,
            fileName: safeFileName,
            originalName: file_name,
            email: email || 'anonimo',
            user_id: user_id || 'anonimo',
            session_id: session_id || 1,
            subject: subject || 'Materia',
            topic: topic || 'Tema',
            scan_id: scan_id || uniqueId,
            filePath: `/uploads/notebooks/${safeFileName}`,
            fileSize: pdfBuffer.length,
            createdAt: timestamp || new Date().toISOString(),
            downloaded: false
        };

        // Guardar localmente
        const notebooks = getNotebooks();
        if (!notebooks[email]) notebooks[email] = [];
        notebooks[email].push(fileRecord);
        saveNotebooks(notebooks);
        
        // Guardar en Google Sheets
        if (sheets) {
            await writeSheet('notebooks', [[
                email,
                user_id || 'anonimo',
                session_id || 1,
                subject || 'Materia',
                topic || 'Tema',
                safeFileName,
                fileRecord.filePath,
                pdfBuffer.length,
                fileRecord.createdAt,
                scan_id || uniqueId
            ]]);
        }

        console.log(`[SERVER] PDF guardado: ${safeFileName} (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);

        res.json({
            success: true,
            message: 'PDF guardado exitosamente',
            file_path: fileRecord.filePath,
            file_id: uniqueId,
            file_name: safeFileName
        });

    } catch (error) {
        console.error('[SERVER] Error guardando PDF:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno al guardar el PDF',
            details: error.message
        });
    }
});

// Listar todos los PDFs
app.get('/api/list-notebooks', (req, res) => {
    try {
        const notebooks = getNotebooks();
        const allFiles = [];
        
        Object.values(notebooks).forEach(userNotebooks => {
            allFiles.push(...userNotebooks);
        });
        
        // Ordenar por fecha descendente
        const sorted = allFiles.sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        res.json({
            success: true,
            count: sorted.length,
            files: sorted
        });

    } catch (error) {
        console.error('[SERVER] Error listando PDFs:', error);
        res.status(500).json({
            success: false,
            error: 'Error al listar los PDFs'
        });
    }
});

// Eliminar PDF
app.delete('/api/delete-notebook/:id', (req, res) => {
    try {
        const { id } = req.params;
        const notebooks = getNotebooks();
        
        let deleted = false;
        
        for (const email in notebooks) {
            const idx = notebooks[email].findIndex(f => f.id === id);
            if (idx !== -1) {
                const fileRecord = notebooks[email][idx];
                const filePath = path.join(UPLOADS_DIR, fileRecord.fileName);
                
                // Eliminar archivo físico
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                
                // Eliminar de metadata
                notebooks[email].splice(idx, 1);
                deleted = true;
                
                console.log(`[SERVER] PDF eliminado: ${fileRecord.fileName}`);
                break;
            }
        }
        
        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'Archivo no encontrado'
            });
        }
        
        saveNotebooks(notebooks);

        res.json({
            success: true,
            message: 'PDF eliminado exitosamente'
        });

    } catch (error) {
        console.error('[SERVER] Error eliminando PDF:', error);
        res.status(500).json({
            success: false,
            error: 'Error al eliminar el PDF'
        });
    }
});

// Descargar PDF
app.get('/api/download-notebook/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(UPLOADS_DIR, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'Archivo no encontrado'
            });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

    } catch (error) {
        console.error('[SERVER] Error descargando PDF:', error);
        res.status(500).json({
            success: false,
            error: 'Error al descargar el PDF'
        });
    }
});

// Ver PDF (inline)
app.get('/api/view-notebook/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(UPLOADS_DIR, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'Archivo no encontrado'
            });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

    } catch (error) {
        console.error('[SERVER] Error mostrando PDF:', error);
        res.status(500).json({
            success: false,
            error: 'Error al mostrar el PDF'
        });
    }
});

// Stats
app.get('/api/stats', (req, res) => {
    try {
        const notebooks = getNotebooks();
        const users = getUsers();
        
        let totalFiles = 0;
        let totalSize = 0;
        const bySubject = {};
        
        Object.values(notebooks).forEach(userNotebooks => {
            totalFiles += userNotebooks.length;
            userNotebooks.forEach(file => {
                totalSize += file.fileSize || 0;
                const subject = file.subject || 'Desconocido';
                bySubject[subject] = (bySubject[subject] || 0) + 1;
            });
        });
        
        // Obtener recientes
        const allFiles = [];
        Object.values(notebooks).forEach(userNotebooks => {
            allFiles.push(...userNotebooks);
        });
        const recentUploads = allFiles
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5);

        res.json({
            success: true,
            stats: {
                totalFiles,
                totalSize,
                totalUsers: Object.keys(users).length,
                bySubject,
                recentUploads
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error al obtener estadísticas'
        });
    }
});

// ============================================
// WEBHOOK COMPATIBILITY (Para endpoints antiguos del frontend)
// ============================================

app.post('/webhook/MATICO', async (req, res) => {
    const { accion, action, ...data } = req.body;
    const acc = accion || action;
    
    console.log(`[WEBHOOK] Recibido: ${acc}`);
    
    // Mapear a nuevos endpoints
    switch(acc) {
        case 'login':
            req.url = '/api/auth/login';
            return app._router.handle(req, res);
            
        case 'register':
            req.url = '/api/auth/register';
            return app._router.handle(req, res);
            
        case 'get_progress':
        case 'get_profile':
            return res.redirect(307, `/api/progress/get?email=${data.email || data.user_id}&subject=${data.subject}`);
            
        case 'save_progress':
            req.url = '/api/progress/save';
            return app._router.handle(req, res);
            
        case 'verify_handwriting':
            // El escaneo de cuadernos ya va directo a /api/save-notebook
            return res.json({
                success: true,
                tier: 'plata',
                feedback: 'Cuaderno recibido y guardado',
                xp: 30
            });
            
        default:
            res.json({
                success: false,
                error: 'Acción no implementada',
                received: acc
            });
    }
});

// ============================================
// SERVIR FRONTEND (React/Vite build)
// ============================================

// Archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '..', 'dist')));

// Servir uploads como estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Cualquier otra ruta va al frontend (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// ============================================
// INICIAR SERVIDOR
// ============================================

app.listen(PORT, () => {
    console.log('========================================');
    console.log('🚀 MATICO SERVER INICIADO');
    console.log(`📡 Puerto: ${PORT}`);
    console.log(`📁 Uploads: ${UPLOADS_DIR}`);
    console.log(`📊 Google Sheets: ${sheets ? '✅ Conectado' : '⚠️ No configurado'}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log('========================================');
    console.log('Endpoints disponibles:');
    console.log('  POST /api/auth/login         - Login');
    console.log('  POST /api/auth/register      - Registro');
    console.log('  POST /api/progress/get       - Obtener progreso');
    console.log('  POST /api/progress/save      - Guardar progreso');
    console.log('  POST /api/save-notebook      - Guardar PDF');
    console.log('  GET  /api/list-notebooks     - Listar PDFs');
    console.log('========================================');
});
