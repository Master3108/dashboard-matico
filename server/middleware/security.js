/**
 * MIDDLEWARE DE SEGURIDAD — Dashboard Matico
 * 
 * 1. JWT auth          2. Rate limiting
 * 3. Input sanitization 4. File upload validation (magic bytes)
 * 5. CORS restrictivo   6. Security headers
 * 7. Password hashing (bcrypt)
 */

import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import bcryptPkg from 'bcrypt';
const bcrypt = bcryptPkg;

// ========== 1. JWT AUTH ==========

const JWT_SECRET = process.env.JWT_SECRET || 'CAMBIA-ESTE-SECRET-EN-PRODUCCION';

export function generateToken(user) {
    return jwt.sign(
        {
            user_id: user.token,
            email: user.email || user.mail,
            role: user.role || 'estudiante',
            name: user.nombre || 'Estudiante'
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

export function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Token requerido' });
    }
    try {
        req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        next();
    } catch (err) {
        const msg = err.name === 'TokenExpiredError' ? 'Token expirado' : 'Token inválido';
        return res.status(401).json({ success: false, error: msg });
    }
}

export function requireAdmin(req, res, next) {
    requireAuth(req, res, () => {
        const adminEmails = [
            'joseantonio.olguinr@gmail.com',
            (process.env.GMAIL_USER || '').toLowerCase(),
            ...(process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
        ];
        if (!adminEmails.includes(req.user.email?.toLowerCase())) {
            return res.status(403).json({ success: false, error: 'Solo admin' });
        }
        next();
    });
}

export function requireOwnership(paramName = 'user_id') {
    return (req, res, next) => {
        const requestedId = req.params[paramName] || req.query[paramName] || req.body?.[paramName];
        if (!requestedId) {
            req.body = req.body || {};
            req.body.user_id = req.user.user_id;
            return next();
        }
        const adminEmails = ['joseantonio.olguinr@gmail.com', (process.env.GMAIL_USER || '').toLowerCase()];
        if (adminEmails.includes(req.user.email?.toLowerCase())) return next();
        if (requestedId !== req.user.user_id) {
            return res.status(403).json({ success: false, error: 'No puedes acceder a datos de otro usuario' });
        }
        next();
    };
}

// ========== 2. RATE LIMITING ==========

export const generalLimiter = rateLimit({
    windowMs: 60_000, max: 100,
    message: { success: false, error: 'Demasiados requests. Espera un momento.' },
    standardHeaders: true, legacyHeaders: false
});

export const loginLimiter = rateLimit({
    windowMs: 15 * 60_000, max: 10,
    message: { success: false, error: 'Demasiados intentos de login. Espera 15 min.' },
    standardHeaders: true, legacyHeaders: false
});

export const aiLimiter = rateLimit({
    windowMs: 60_000, max: 20,
    message: { success: false, error: 'Límite de IA alcanzado. Espera un momento.' },
    standardHeaders: true, legacyHeaders: false
});

export const uploadLimiter = rateLimit({
    windowMs: 3600_000, max: 30,
    message: { success: false, error: 'Demasiados uploads.' },
    standardHeaders: true, legacyHeaders: false
});

// ========== 3. INPUT SANITIZATION ==========

export function sanitizeString(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

function deepSanitize(obj) {
    if (typeof obj === 'string') return sanitizeString(obj);
    if (Array.isArray(obj)) return obj.map(deepSanitize);
    if (obj && typeof obj === 'object') {
        const clean = {};
        for (const [k, v] of Object.entries(obj)) {
            // No sanitizar campos base64
            clean[k] = (k === 'image' || k === 'image_base64' || k === 'photo' || k === 'photos') ? v : deepSanitize(v);
        }
        return clean;
    }
    return obj;
}

export function sanitizeBody(req, res, next) {
    if (req.body && typeof req.body === 'object') req.body = deepSanitize(req.body);
    next();
}

export function isValidUserId(id) { return typeof id === 'string' && /^TK-[A-Z0-9]{6,12}$/i.test(id); }
export function isValidEmail(email) { return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254; }
export function isValidSubject(subject) {
    return ['MATEMATICA','COMPETENCIA_LECTORA','FISICA','QUIMICA','BIOLOGIA','HISTORIA','LENGUAJE'].includes(String(subject).toUpperCase());
}

export function validateFields(schema) {
    return (req, res, next) => {
        const errors = [];
        const data = { ...req.body, ...req.query, ...req.params };
        for (const [field, type] of Object.entries(schema)) {
            const val = data[field];
            if (val === undefined || val === null || val === '') continue;
            if (type === 'email' && !isValidEmail(val)) errors.push(`${field}: email inválido`);
            if (type === 'userId' && !isValidUserId(val)) errors.push(`${field}: formato TK-XXX esperado`);
            if (type === 'subject' && !isValidSubject(val)) errors.push(`${field}: materia no válida`);
            if (type === 'number' && isNaN(Number(val))) errors.push(`${field}: debe ser número`);
            if (type === 'string' && (typeof val !== 'string' || val.length > 5000)) errors.push(`${field}: texto inválido o muy largo`);
        }
        if (errors.length) return res.status(400).json({ success: false, errors });
        next();
    };
}

// ========== 4. FILE UPLOAD VALIDATION ==========

const MAGIC = {
    'image/jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
    'image/png':  [Buffer.from([0x89, 0x50, 0x4E, 0x47])],
    'image/webp': [Buffer.from('RIFF')],
    'application/pdf': [Buffer.from('%PDF')]
};

export function validateFileUpload(allowedTypes = ['image/jpeg', 'image/png', 'image/webp']) {
    return (req, res, next) => {
        if (!req.file) return next();
        const { mimetype, buffer, size } = req.file;
        if (!allowedTypes.includes(mimetype)) {
            return res.status(400).json({ success: false, error: `Tipo no permitido: ${mimetype}` });
        }
        if (buffer && MAGIC[mimetype]) {
            const ok = MAGIC[mimetype].some(m => { for (let i = 0; i < m.length; i++) if (buffer[i] !== m[i]) return false; return true; });
            if (!ok) return res.status(400).json({ success: false, error: 'Contenido no coincide con tipo declarado' });
        }
        if (size > 10 * 1024 * 1024) return res.status(400).json({ success: false, error: 'Max 10MB por archivo' });
        next();
    };
}

// ========== 5. CORS ==========

export function getCorsConfig() {
    const origins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
    if (!origins.length) origins.push('http://localhost:5173', 'http://localhost:8080');
    return {
        origin(origin, cb) {
            if (!origin) return cb(null, true); // mobile/server
            if (origins.some(o => origin === o || origin.endsWith(o.replace('https://', '.').replace('http://', '.')))) return cb(null, true);
            cb(new Error(`CORS bloqueado: ${origin}`));
        },
        credentials: true,
        methods: ['GET','POST','PUT','PATCH','DELETE'],
        allowedHeaders: ['Content-Type','Authorization']
    };
}

// ========== 6. SECURITY HEADERS ==========

export function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
}

// ========== 7. PASSWORD HASHING ==========

export async function hashPassword(plain) { return bcrypt.hash(plain, 12); }
export async function verifyPassword(plain, hashed) {
    if (!hashed.startsWith('$2b$') && !hashed.startsWith('$2a$')) return plain === hashed; // legacy plaintext
    return bcrypt.compare(plain, hashed);
}
