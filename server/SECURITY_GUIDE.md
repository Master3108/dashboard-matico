# Guía de Integración de Seguridad — Dashboard Matico

## 1. Instalar dependencias

```bash
cd server
npm install jsonwebtoken bcrypt express-rate-limit
```

## 2. Cambios en server/index.js

### 2a. Importar middleware (arriba del archivo, después de las otras importaciones)

```javascript
import {
    generateToken, requireAuth, requireAdmin, requireOwnership,
    generalLimiter, loginLimiter, aiLimiter, uploadLimiter,
    sanitizeBody, validateFields, validateFileUpload,
    getCorsConfig, securityHeaders,
    hashPassword, verifyPassword
} from './middleware/security.js';
```

### 2b. Reemplazar CORS abierto (línea 70)

```javascript
// ANTES (VULNERABLE):
app.use(cors());

// DESPUÉS (SEGURO):
import cors from 'cors';
app.use(cors(getCorsConfig()));
```

### 2c. Agregar middleware global (después de cors, antes de rutas)

```javascript
app.use(securityHeaders);
app.use(generalLimiter);
app.use(sanitizeBody);
```

### 2d. Proteger el LOGIN con rate limit + JWT (en webhook/MATICO, acción 'login')

```javascript
// ANTES (VULNERABLE):
if (user && user.pass === password) {
    return res.json({
        success: true,
        user_id: user.token,
        name: user.nombre || 'Estudiante',
        ...
    });
}

// DESPUÉS (SEGURO):
const passOk = await verifyPassword(password, user.pass);
if (user && passOk) {
    const jwtToken = generateToken(user);
    return res.json({
        success: true,
        user_id: user.token,
        name: user.nombre || 'Estudiante',
        role: user.role || 'estudiante',
        jwt: jwtToken,   // <-- el frontend guarda esto
        ...
    });
}
```

### 2e. Proteger el REGISTER con hash de contraseña

```javascript
// ANTES (VULNERABLE):
await upsertRuntimeUser({ token: newToken, pass: password, ... });

// DESPUÉS (SEGURO):
const hashedPass = await hashPassword(password);
await upsertRuntimeUser({ token: newToken, pass: hashedPass, ... });
```

### 2f. Proteger rutas con requireAuth

```javascript
// Rutas que CUALQUIER usuario autenticado puede usar:
app.get('/api/profile', requireAuth, requireOwnership(), async (req, res) => { ... });
app.get('/api/notifications', requireAuth, async (req, res) => { ... });
app.get('/api/calendar/events', requireAuth, async (req, res) => { ... });
app.post('/api/calendar/events', requireAuth, async (req, res) => { ... });
app.post('/api/study-sessions/start', requireAuth, async (req, res) => { ... });
app.get('/api/study-sessions', requireAuth, requireOwnership(), async (req, res) => { ... });
app.get('/api/progress/child', requireAuth, async (req, res) => { ... });
app.post('/api/agent/chat', requireAuth, aiLimiter, async (req, res) => { ... });
app.post('/api/agent/tts', requireAuth, aiLimiter, async (req, res) => { ... });
app.post('/api/agent/stt', requireAuth, aiLimiter, upload.single('audio'), async (req, res) => { ... });

// Rutas de Oracle (IA) — auth + rate limit:
app.post('/api/oracle/exam-from-notebook/intake', requireAuth, aiLimiter, async (req, res) => { ... });
app.post('/api/oracle/exam-from-notebook/generate', requireAuth, aiLimiter, async (req, res) => { ... });
app.post('/api/oracle/exam-from-notebook/generate-batch', requireAuth, aiLimiter, async (req, res) => { ... });

// Uploads — auth + rate limit + validación de archivo:
app.post('/api/oracle/upload-question-image', requireAuth, uploadLimiter, upload.single('image'), validateFileUpload(), async (req, res) => { ... });
app.post('/api/capture/upload', requireAuth, uploadLimiter, upload.single('image'), validateFileUpload(), async (req, res) => { ... });
app.post('/api/notebook/submissions', requireAuth, uploadLimiter, async (req, res) => { ... });

// Rutas ADMIN (verificación desde JWT, no desde body.email):
app.post('/api/admin/link-child', requireAdmin, async (req, res) => { ... });
app.post('/api/admin/migrate-sheets-to-supabase', requireAdmin, async (req, res) => { ... });
// Y dentro del webhook/MATICO, todas las acciones admin usan requireAdmin
```

### 2g. Webhook MATICO — auth selectiva

El webhook es especial porque maneja login/register (sin auth) Y acciones autenticadas.
Solución: separar login del resto:

```javascript
// Login y register NO requieren auth (pero sí rate limit)
app.post('/webhook/MATICO/auth', loginLimiter, async (req, res) => {
    // Mover aquí solo las acciones login y register
});

// Todo lo demás requiere auth
app.post('/webhook/MATICO', requireAuth, async (req, res) => {
    // Todas las demás acciones
    // Para admin actions, verificar req.user.email en vez de body.email
});
```

### 2h. Reemplazar isAdminEmail(body.email) por verificación JWT

```javascript
// ANTES (VULNERABLE — cualquiera envía tu email):
if (!isAdminEmail(body.email)) {
    return res.status(403).json({ ... });
}

// DESPUÉS (SEGURO — email viene del JWT verificado):
const adminEmails = ['joseantonio.olguinr@gmail.com'];
if (!adminEmails.includes(req.user.email?.toLowerCase())) {
    return res.status(403).json({ ... });
}
```

### 2i. Eliminar endpoint peligroso

```javascript
// ELIMINAR COMPLETAMENTE:
// app.post('/api/study-sessions/init-table', ...)
// Las migraciones de BD se hacen manualmente, nunca por API pública
```

## 3. Cambios en el FRONTEND (src/App.jsx)

### 3a. Guardar JWT después del login

```javascript
// En la función de login, guardar el JWT:
const loginResponse = await fetch('/webhook/MATICO', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', email, password })
});
const data = await loginResponse.json();
if (data.success) {
    localStorage.setItem('matico_jwt', data.jwt);  // <-- NUEVO
    localStorage.setItem('matico_user_id', data.user_id);
    // ...
}
```

### 3b. Enviar JWT en todas las peticiones

```javascript
// Helper para fetch autenticado:
function authFetch(url, options = {}) {
    const jwt = localStorage.getItem('matico_jwt');
    return fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': jwt ? `Bearer ${jwt}` : '',
            ...(options.headers || {})
        }
    });
}

// Uso:
const res = await authFetch('/api/profile?user_id=' + userId);
const res = await authFetch('/api/calendar/events', {
    method: 'POST',
    body: JSON.stringify({ ... })
});
```

## 4. Variables de entorno nuevas (server/.env)

```
JWT_SECRET=genera-un-string-aleatorio-largo-aqui-min-32-chars
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080,https://tu-dominio.cl
ADMIN_EMAILS=joseantonio.olguinr@gmail.com
```

## 5. Docker — no correr como root

En `server/Dockerfile`, agregar antes del CMD:

```dockerfile
USER node
```

## 6. Nginx — security headers

En `nginx.conf`, dentro del block `server {}`:

```nginx
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

## 7. Uploads — servir con protección

Reemplazar el static simple por un middleware que valide propiedad:

```javascript
// ANTES:
app.use('/uploads', express.static(LOCAL_UPLOADS_DIR));

// DESPUÉS:
app.use('/uploads', requireAuth, (req, res, next) => {
    // Solo servir si el archivo pertenece al usuario o es admin
    // O usar URLs firmadas con expiración
    express.static(LOCAL_UPLOADS_DIR)(req, res, next);
});
```

## Prioridad de implementación

1. **URGENTE**: JWT + bcrypt + CORS restrictivo
2. **ALTA**: Rate limiting en IA y login + validación uploads
3. **MEDIA**: Security headers + Docker USER + eliminar init-table
4. **BAJA**: URLs firmadas para uploads, CSP refinado
