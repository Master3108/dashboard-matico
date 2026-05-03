# Dashboard Matico — Guía de Desarrollo

## Qué es
Plataforma educativa de aprendizaje metacognitivo. Los estudiantes interactúan con quizzes, capturan evidencias de su cuaderno, y generan pruebas interactivas con IA.

## Stack Tecnológico

### Frontend
- React 18.2 + Vite + Tailwind CSS
- Recharts (gráficos), KaTeX (matemáticas), jsPDF (PDFs)
- Lucide React (iconos), canvas-confetti (animaciones)
- Capacitor (bridge nativo para Android APK)

### Backend
- Node.js + Express (server/index.js)
- Supabase (base de datos)
- OpenAI SDK (generación de preguntas IA)
- Multer (uploads), Nodemailer (emails), node-cron (tareas programadas)
- Google APIs (Sheets legacy)

### Mobile
- Capacitor para Android
- Plugin nativo Java para captura de pantalla con overlay UI
- Gradle para builds de APK

## Estructura de Archivos Clave

```
src/
  App.jsx                          — Componente principal (~6600 líneas), orquesta todo
  components/
    EvidenceIntake.jsx             — Componente universal de subida de imágenes (cámara, galería, screen capture, captura nativa)
    ExamCaptureModal.jsx           — Modal "Crear prueba" (usa OracleNotebookExamBuilder internamente)
    OracleNotebookExamBuilder.jsx  — Flujo: subir fotos → analizar cuaderno → detectar tema → generar preguntas quiz
    InteractiveQuiz.jsx            — Quiz interactivo con progreso
    CuadernoMission.jsx            — Misiones de cuaderno con auto-envío
    QuestionBankManager.jsx        — Gestión de banco de preguntas
    MiniLesson.jsx                 — Mini lecciones
    LoginPage.jsx                  — Login
    MathRenderer.jsx               — Renderizado KaTeX
    LivesDisplay.jsx               — Sistema de vidas
  mobile/
    screenCaptureBridge.js         — Bridge JS ↔ plugin nativo Android para captura de pantalla
server/
  index.js                         — API Express (endpoints /api/oracle/*, /api/exams/*, /webhook/*)
  Dockerfile                       — Node 18-Alpine
docker-compose.yml                 — Frontend (port 8080) + Server (port 3001)
Dockerfile                         — Frontend: Vite build → Nginx Alpine
nginx.conf                         — Proxy /api/ y /webhook/ al server, SPA fallback
```

## Módulos del Estudiante

1. **Quizzes** — Evaluación interactiva con seguimiento de progreso
2. **Oracle Notebook** — Sube fotos del cuaderno → IA analiza → genera prueba
3. **Evidencias** — Captura y envío de evidencias (fotos, screenshots)
4. **CuadernoMission** — Misiones basadas en cuaderno con auto-envío

## Flujo Oracle (generación de pruebas desde fotos)
1. Estudiante sube hasta 10 fotos (EvidenceIntake)
2. POST `/api/oracle/exam-from-notebook/intake` → IA analiza, detecta tema, retorna draft_id
3. Estudiante confirma/edita tema detectado
4. POST `/api/oracle/exam-from-notebook/generate` → genera primera tanda de preguntas
5. Tandas adicionales via `/api/oracle/exam-from-notebook/generate-batch` (background, no bloquea UI)
6. `onExamReady` → inicia quiz interactivo con las preguntas generadas

## API Endpoints Principales
- `/api/oracle/exam-from-notebook/intake` — Analiza fotos del cuaderno
- `/api/oracle/exam-from-notebook/generate` — Genera primera tanda de preguntas
- `/api/oracle/exam-from-notebook/generate-batch` — Tandas siguientes
- `/api/exams/intake` — OCR de pruebas (legacy, ya no usado por ExamCaptureModal)
- `/api/exams/list` — Lista eventos de examen
- `/api/exams/confirm` — Confirma evento de examen
- `/webhook/` — Webhooks de n8n/IA con timeout largo (300s)

## Deploy — Producción

### Infraestructura
- **VPS Hostinger**: root@72.60.245.87
- **Ruta en VPS**: /var/www/dashboard-matico
- **Repo GitHub**: https://github.com/Master3108/dashboard-matico.git (branch: main)
- **Docker Compose**: frontend (Nginx, port 8080→80) + server (Node, port 3001)
- **Volumes**: server tiene /data y /uploads persistentes

### Proceso de Deploy (desde Windows PowerShell)

```powershell
# 1. Commit y push
cd "C:\Users\josea\Desktop\proyectos\.gemini\antigravity\scratch\dashboard-matico"
git add .
git commit -m "descripción del cambio"
git push origin main

# 2. SSH al VPS y rebuild
ssh root@72.60.245.87
cd /var/www/dashboard-matico
git pull origin main
docker compose down
docker compose up --build -d
docker compose ps
exit
```

### Deploy con script (alternativa)
```powershell
.\scripts\deploy-all.ps1 -Branch "main" -CommitMessage "descripción del cambio"
```

### Nginx Config
- Max body: 25MB
- SPA fallback a /index.html
- Proxy: /api/, /webhook/, /webhook-test/, /uploads/ → server:3001
- Timeouts largos (300s) para procesamiento IA
- Gzip habilitado

## Notas Técnicas Importantes

### EvidenceIntake — Subida múltiple de imágenes
- Usa `itemsRef` (useRef) para evitar stale closures en callbacks async
- `handleFileUpload` y `handleNativeCameraCapture` procesan archivos secuencialmente con `for...of` + `await` (NO forEach)
- Cada `addAsset` lee de `itemsRef.current` para ver el estado actualizado
- Soporta: cámara nativa (APK), galería (multiple), clipboard paste, screen capture (web), captura nativa Android (overlay)

### ExamCaptureModal — "Crear prueba"
- Es un wrapper modal sobre OracleNotebookExamBuilder
- Recibe `onExamReady` que llama a `startOracleNotebookExam` en App.jsx
- Al generar preguntas, cierra el modal y arranca el quiz interactivo

### App.jsx
- Archivo monolítico (~6600 líneas), orquesta todo el estado global
- `startOracleNotebookExam()` (línea ~4109): recibe payload de OracleNotebookExamBuilder, normaliza preguntas, configura prepExam, y arranca InteractiveQuiz
- `USER_ID` viene de `currentUser.user_id` (login)
- `currentSubject` controla la materia activa (MATEMATICA, LENGUAJE, FISICA, etc.)

### Git Remote
- Configurado como HTTPS: https://github.com/Master3108/dashboard-matico.git
- Requiere Personal Access Token de GitHub como contraseña (no SSH key)

## Variables de Entorno (server/.env)
- OpenAI API keys (modelos fast/thinking/vision)
- Gemini, DeepSeek (proveedores alternativos IA)
- Supabase URL + keys
- Puerto: 3001
- Ver server/.env.example para lista completa
