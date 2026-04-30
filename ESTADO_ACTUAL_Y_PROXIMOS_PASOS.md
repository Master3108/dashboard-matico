# MATICO — Estado del proyecto y próximos pasos

> **Documento de traspaso para retomar en otra compu.**
> Última actualización: 2026-04-27
> Usuario: jose (joseantonio.olguinr@gmail.com)

---

## 1. CONTEXTO RÁPIDO

**Matico** es tu plataforma educativa chilena (Chile, enseñanza media).
Estamos **migrando la base de datos de Google Sheets a Supabase**, porque
Google Sheets se quedó chico para la cantidad de preguntas, imágenes y
usuarios.

**Estado actual:** estamos en plena **Fase 1 (Setup de la base de datos)**.
Ya creamos las tablas, falta cargar el catálogo curricular.

---

## 2. INFORMACIÓN CLAVE (para no olvidar)

| Cosa | Valor |
|------|-------|
| Supabase project URL | https://supabase.com/dashboard/project/birzlkaehtslkjyehgfs |
| VPS Hostinger | 72.60.245.87 — https://srv1048418.hstgr.cloud/ |
| Email admin | joseantonio.olguinr@gmail.com |
| Google Sheets actual | https://docs.google.com/spreadsheets/d/1l1GLMXh8_Uo_O7XJOY7ZJxh1TER2hxrXTOsc_EcByHo |
| Carpeta del proyecto en tu compu | `C:\Users\Usuario\.gemini\antigravity\scratch\dashboard-matico` |

---

## 3. DÓNDE ESTAMOS PARADOS HOY

### ✅ HECHO

1. **`01_schema.sql` ejecutado en Supabase**
   Crea 12 tablas base: grades, subjects, chapters, curriculum_sessions,
   pedagogical_assets, question_bank, theory_ludica_bank, profiles,
   progress_log, exam_reminders, adaptive_profile_log, notebook_submissions.
   Más el seed inicial de los 4 cursos (1°-4° medio) y las 6 asignaturas.

2. **`02_missing_tables.sql` ejecutado en Supabase**
   Crea 5 tablas que faltaban: users (Usuarios), quiz_results,
   study_sessions, session_progress, question_bank_builds.

3. **Verificado en Table Editor:** las 17 tablas existen con badge
   "UNRESTRICTED" (RLS desactivado por ahora — está bien, lo activamos
   más adelante).

### ⏳ PENDIENTE INMEDIATO (esto es lo que tenés que hacer cuando vuelvas)

**PASO 3: Ejecutar `03_seed_curriculum.sql`**

Archivo: `C:\Users\Usuario\.gemini\antigravity\scratch\dashboard-matico\supabase\03_seed_curriculum.sql`

**Carga:**
- 51 capítulos (Matemática 14, Física 5, Química 10, Biología 12, Comp. Lectora 5, **Historia 5**)
- 276 sesiones (46 × 6 asignaturas)
- **Historia incluida:** estructura armada con Bases Curriculares Mineduc 2019 (ver sección 5)

**Cómo:**
1. Abrir Supabase → SQL Editor
2. Ctrl+A → Delete (limpiar)
3. Abrir el archivo `03_seed_curriculum.sql` con Bloc de notas
4. Ctrl+A → Ctrl+C → pegar en Supabase
5. Click en **Run** (verde, abajo a la derecha)
6. Esperar "Success. No rows returned"
7. Verificar en Table Editor:
   - tabla `chapters` → 46 rows
   - tabla `curriculum_sessions` → 230 rows
8. Mandarle screenshot a Claude para confirmar y seguir

⚠️ **No debería salir el cartel naranja de RLS** porque solo se hacen
INSERTs en tablas que ya existen.

---

## 4. PLAN COMPLETO DE MIGRACIÓN (5 fases)

### Fase 1 — Setup de la BD ⏳ EN CURSO
- [x] Crear schema (01_schema.sql)
- [x] Crear tablas faltantes (02_missing_tables.sql)
- [ ] **← acá estamos: cargar catálogo curricular completo (03_seed_curriculum.sql) — incluye las 6 asignaturas (Mat, Fis, Qui, Bio, Lec, His)**

### Fase 2 — Capa de acceso a datos (DAL)
Crear archivos JS que reemplazan las llamadas a Google Sheets:
- `server/db/supabaseClient.js` — cliente único
- `server/db/questionBank.js`
- `server/db/pedagogicalAssets.js`
- `server/db/theoryBank.js`
- `server/db/users.js`
- `server/db/quizResults.js`
- etc.

### Fase 3 — Migración de datos
Script que copia TODO de Google Sheets → Supabase (una sola vez).
Incluye subir las imágenes de `/quiz-assets` al **Supabase Storage**.

### Fase 4 — Cutover
Reemplazar cada llamada a `sheets.spreadsheets.values.get/append/update`
en `server/index.js` por la equivalente del DAL.

### Fase 5 — Limpieza
- Quitar `SPREADSHEET_ID` y credenciales de Google Sheets
- Cambiar nginx para servir imágenes desde Supabase Storage
- (Opcional) Activar RLS con políticas adecuadas

---

## 5. EL TEMA DE HISTORIA ⚠️ (parcialmente resuelto)

**Estado:** la estructura de Historia 1° medio **YA está incluida** en
`03_seed_curriculum.sql` siguiendo las **Bases Curriculares Mineduc
2019** (Historia, Geografía y Ciencias Sociales).

**5 capítulos creados** (`his_1m_*`):
1. Crisis del orden liberal: entreguerras y Chile primera mitad s.XX (sesiones 1-10)
2. Guerra Fría, descolonización y América Latina (sesiones 11-20)
3. Quiebre democrático y dictadura militar en Chile 1973-1990 (sesiones 21-28)
4. Recuperación de la democracia y desafíos del Chile actual (sesiones 29-37)
5. Geografía, territorio, sociedad y economía del Chile actual (sesiones 38-46)

### Lo que SIGUE pendiente para Historia

⚠️ **El backend todavía no sabe usar esa estructura.** El archivo
`server/moralejaSessionCatalog.js` tiene SESSION_MAPs solo para 5
asignaturas — Historia falla y devuelve `null`. Hay que crear:

1. `server/moralejaHistoria.js` (con CHAPTERS array igual que las otras)
2. Agregar `HISTORY_SESSION_MAP` en `moralejaSessionCatalog.js`
3. Agregar `else if (normalizedSubject.includes('HISTORIA'))` en la
   función `resolveMoralejaSessionReference`

Eso se hace como parte de la **Fase 2 (DAL)**.

### Si después subís el PDF Mineduc

Si conseguís el libro oficial Mineduc Historia 1° medio, lo subís al
chat y ajustamos los títulos/focus de los 5 capítulos para que coincidan
**exactamente** con la edición del libro (los temas son los mismos, pero
puede haber matices en cómo el libro los agrupa).

---

## 6. INVENTARIO DE ARCHIVOS IMPORTANTES

### Carpeta `supabase/` (creada en este proyecto)

| Archivo | Estado | Propósito |
|---------|--------|-----------|
| `01_schema.sql` | ✅ Ejecutado | Crea las 12 tablas base + seed de cursos/asignaturas |
| `02_missing_tables.sql` | ✅ Ejecutado | Crea las 5 tablas que faltaban |
| `03_seed_curriculum.sql` | ⏳ Pendiente | Carga 46 capítulos + 230 sesiones |
| `04_seed_historia.sql` | ❌ No creado | Pendiente: requiere definir Historia primero |

### Archivos del backend que importan

| Archivo | Qué tiene |
|---------|-----------|
| `server/index.js` | Backend principal — 57 referencias a Google Sheets que hay que reemplazar (Fase 4) |
| `server/moralejaSessionCatalog.js` | Mapea sesión → capítulo para 5 asignaturas (NO Historia) |
| `server/moralejaMatematica.js` | 14 capítulos de Matemática |
| `server/moralejaFisica.js` | 5 capítulos de Física |
| `server/moralejaQuimica.js` | 10 capítulos de Química |
| `server/moralejaBiologia.js` | 12 capítulos de Biología |
| `server/moralejaCompetenciaLectora.js` | 5 capítulos de Comp. Lectora |
| `server/curriculumCatalog.js` | Catálogo dinámico (ahora vive en `server/data/curriculum_catalog.json`) |
| `apply_attach_images_existing.py` | Patch que agrega imágenes a preguntas existentes (necesita V2 — ver sección 8) |

---

## 7. MAPEO HOJAS GOOGLE → TABLAS SUPABASE

| Hoja en Google Sheets | Tabla en Supabase |
|----------------------|-------------------|
| Usuarios | users |
| QuestionBank | question_bank |
| TheoryLudicaBank | theory_ludica_bank |
| PedagogicalImageBank | pedagogical_assets |
| ExamReminderBank | exam_reminders |
| progress_log | progress_log |
| profiles | profiles |
| quiz_results | quiz_results |
| study_sessions | study_sessions |
| session_progress | session_progress |
| adaptive_profile_log | adaptive_profile_log |
| QuestionBankBuilds | question_bank_builds |
| (no en Sheets — JSON local) | notebook_submissions |
| (derivada nueva) | grades |
| (derivada nueva) | subjects |
| (derivada nueva) | chapters |
| (derivada nueva) | curriculum_sessions |

Total: 12 hojas → 17 tablas (5 extras son tablas catálogo nuevas).

---

## 8. TRABAJO POSTERIOR (después de migrar)

### Imágenes en QuestionBank

Ya tenés implementado `add_images_to_existing_phase_questions` pero
con una **limitación importante**:

> **Problema actual:** Solo agrega la imagen a la pregunta existente
> sin modificar la pregunta. Así que la imagen queda decorativa, no
> integrada al razonamiento.

**Lo que vos querés (correcto):** la imagen debe servir para responder
la pregunta, y la pregunta debe adaptarse a la imagen (acoplamiento
mutuo).

**Plan:** crear `apply_attach_images_existing_v2.py` que además de la
imagen, **reescriba la pregunta + opciones + respuesta correcta** para
que tenga sentido con la imagen.

### Generación de contenido pendiente

Lo que hay que hacer una vez migrado a Supabase:

1. **Retrofit imágenes en FISICA 1° medio** (preguntas ya existen, sin imágenes)
2. **Retrofit imágenes en MATEMATICA 1° medio** (preguntas ya existen, sin imágenes)
3. **Generar preguntas + imágenes en BIOLOGIA 1° medio** (NO existen preguntas)
4. **Generar preguntas + imágenes en QUIMICA 1° medio** (NO existen preguntas)
5. **Crear `moralejaHistoria.js`** (ver sección 5)
6. **Generar preguntas + imágenes en HISTORIA 1° medio** (depende del paso 5)
7. **Escalar a 2°, 3°, 4° medio** — requiere armar SESSION_MAPs por curso

### Roles de imagen (decisión de diseño ya tomada)

- `required_for_interpretation` — imagen es CRÍTICA (puntaje IA 9-10)
- `supporting` — imagen ayuda pero no es esencial (puntaje 6-8)
- `none` — no necesita imagen (puntaje 0-5)

Máximo **6 preguntas con imagen por fase**, IA elige las más idóneas.

---

## 9. CÓMO RETOMAR LA CONVERSACIÓN EN OTRA COMPU

Cuando estés en la otra computadora:

1. **Abrir esta carpeta** del proyecto:
   `C:\Users\Usuario\.gemini\antigravity\scratch\dashboard-matico`
   (o transferirla con OneDrive/Drive/USB si la otra compu no la tiene)

2. **Abrir Cowork mode / Claude** y decirle:
   > "Hola Claude, estoy retomando el proyecto Matico. Leé el archivo
   > `ESTADO_ACTUAL_Y_PROXIMOS_PASOS.md` en la raíz del proyecto y
   > seguimos desde donde quedamos."

3. **Próxima acción concreta:** ejecutar `03_seed_curriculum.sql` en
   Supabase (sección 3 de este doc tiene los pasos exactos).

4. **Acceso a Supabase:** entrar con tu cuenta a
   https://supabase.com/dashboard/project/birzlkaehtslkjyehgfs

---

## 10. DECISIONES IMPORTANTES YA TOMADAS

(Para no volver a discutir)

- ✅ **Base de datos:** Supabase (no MySQL)
- ✅ **RLS:** desactivado por ahora, se activa al final
- ✅ **Auth:** seguimos con sistema actual basado en token
  (tabla `users`), migración a Supabase Auth queda para después
- ✅ **Storage de imágenes:** Supabase Storage (no se queda en VPS)
- ✅ **IDs de capítulos:** prefijados por asignatura+grado para evitar
  colisiones futuras (`mat_1m_`, `fis_1m_`, etc.)
- ✅ **Imágenes:** integración mutua pregunta↔imagen, no decorativas
- ✅ **Máximo:** 6 preguntas con imagen por fase

---

## 11. TAREA EN CURSO (Task #9)

> Agregar imágenes a preguntas EXISTENTES en QuestionBank

Estado: pausada por la migración a Supabase. Se retoma después de
Fase 4 (cutover).

---

**FIN DEL DOCUMENTO**

Si Claude en la otra compu necesita más contexto del que hay acá, los
detalles técnicos completos están en los comentarios de los archivos
SQL en `supabase/` y en el código de `server/`.
