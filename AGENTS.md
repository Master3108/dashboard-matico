<claude-mem-context>
# Memory Context

# [dashboard-matico] recent context, 2026-05-08 8:11pm GMT-4

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 44 obs (23,279t read) | 893,864t work | 97% savings

### May 7, 2026
1 5:21p 🔵 User Request: Load Matías Olguín's Full History into Apoderado Platform
### May 8, 2026
3 9:13a 🟣 Matico Educational Platform — Comprehensive Feature Specification for Child Study Monitoring
4 9:14a 🔵 Matico Dashboard Project Structure Identified on Windows Dev Machine
5 9:15a 🔵 Matico App.jsx Contains Full Curriculum Catalog for Matemática, Química, and Lenguaje (45+ Sessions Each)
6 " 🔵 ParentDashboard Component — Full Implementation with Study Sessions, Events, Progress, and Matico Agent
7 " 🔵 EvidenceIntake Already Supports Up to 10 Images — DEFAULT_MAX_EVIDENCE = 10
8 " 🔵 CuadernoMission — Notebook Scanner with Adobe Scan Processing, OCR Analysis, and 80% Threshold Gate for Quiz Unlock
9 " 🔵 OracleNotebookExamBuilder — 2-Step AI Exam Generator from Notebook Photos with Batch Streaming
10 " 🔵 Supabase Schema — 12 Tables Covering Full Educational Platform Including notebook_submissions with expires_at
11 " 🔵 Full Component Inventory of src/ — All Major Feature Modules Confirmed Present
12 9:25a 🟣 Matico Platform — Comprehensive Educational Monitoring Feature Roadmap
13 1:02p 🔵 Subject Card UI Changes Only Applied to Chemistry, Not All Subjects
14 " 🔴 Calendar Rows Now Enriched with Source Labels and Normalized Subjects Across All Subjects
15 " 🔴 Calendar/Reminder/Study Items No Longer Incorrectly Return a Score
16 1:11p ⚖️ Calendar Reminder Logic Refined: Remove Event-Source Flag, Focus on 2-Day Advance Notice
17 1:24p ⚖️ Parent Dashboard Redesign Requirements Defined
18 " 🔵 ParentDashboard Architecture and Daily Report System Mapped
19 1:28p 🟣 Matico Platform – Comprehensive Student Monitoring Feature Set Specification
20 1:29p 🟣 ParentDashboard – Summary Tab Filter Engine with Santiago Timezone Support
21 3:03p 🟣 Matico Platform — Comprehensive Child Study Monitoring Feature Specification
22 3:04p 🔵 ParentDashboard.jsx — Core Computation Logic for Matico Dashboard
23 3:06p 🔵 ParentDashboard.jsx — Study Time Stats, Weekly View, and History Filtering Logic (lines 500–575)
24 3:07p 🔴 Removed Duplicate pendingEvents Calculation — Now Uses futurePendingEvents Only
25 " 🟣 Stats Grid Overhauled — Today's Session Status and Score Replace XP/Quiz Count Cards
26 " 🟣 New "Resumen Filtrable" Section Added to Resumen Tab
27 " 🟣 2-Day Test Warning Highlight Added to Upcoming Events List
28 3:15p 🟣 Matico Platform — Comprehensive Feature Roadmap for Child Study Monitoring
29 5:01p 🔵 Screenshot/Gallery Upload UI Strings Located in CuadernoMission and EvidenceIntake
30 " 🔵 CuadernoMission Uses Native Screen Capture Bridge with Full Permission/Error Handling
31 " 🔵 Screenshot Capture Button Gated by isNativePlatform — Web vs Native Split Logic
32 " 🔵 Native Capture Session Full Flow: startNativeSession → Overlay → Finalized Event → Auto-Import
33 5:02p 🟣 Added "Capturar otra pantalla" Button in PDF Preview State
34 " 🔵 apply_patch Failed Due to Indentation Mismatch in CuadernoMission.jsx
35 6:00p ✅ UI Cleanup: Rename "Subir Varias Páginas" and Remove Redundant Button
36 6:02p 🟣 PDF Download Button Moved Inline Per-Page in CuadernoMission
37 6:13p 🟣 Matico Platform – Comprehensive Educational Monitoring Feature Roadmap
38 6:33p 🔵 Quiz Phase System Architecture in dashboard-matico
S12 Fix: Biología sesión completada (nivel crítico experto PAES) sigue mostrando "Sesión 6 en progreso" / "Siguiente Nivel: Crítico | 30/45" (May 8, 6:34 PM)
39 7:06p 🔵 Completed PAES Biology Course Still Shows Session 6 as Pending
S13 Diagnóstico y corrección del bug: el dashboard del apoderado mostraba MATEMÁTICA como "última sesión real" aunque el estudiante hubiera completado Biología (May 8, 7:07 PM)
S14 Probar el sitio https://srv1048418.hstgr.cloud/ como joseantonio.olguinr@gmail.com y diagnosticar por qué el Panel Apoderado muestra MATEMATICA como última sesión real en lugar de BIOLOGIA (May 8, 7:20 PM)
S15 Diagnóstico y fix del Panel Apoderado mostrando MATEMATICA como última sesión real — deploy pendiente en Hostinger y orientación sobre curl en PowerShell (May 8, 7:39 PM)
S16 Fix del Panel Apoderado (última sesión real mostraba MATEMATICA en lugar de BIOLOGIA) — orientación sobre puertos del servidor local y acceso a la API (May 8, 7:39 PM)
S17 Fix duplicate study sessions bug in ParentDashboard summary — MATEMATICA showing instead of BIOLOGIA as "última sesión real" (May 8, 7:40 PM)
S18 Consolidate multi-phase quiz sessions in ParentDashboard and show session start time + wrong answer count for Matias's completed 45-question session (May 8, 7:48 PM)
40 7:53p 🟣 Study Session Data Entry: Matias Full Completion with Incorrect Answers + Start Timestamp
41 7:54p 🟣 ParentDashboard: Phase Aggregation + Session Start Time + Wrong Answer Display
S19 Fix all ParentDashboard summary cards to use consolidated phase-aggregated results instead of raw per-phase history items, and add "Último resultado" detail card to "Pruebas y quizzes" section (May 8, 7:54 PM)
42 7:57p 🔴 Summary Stats Now Use Aggregated Phase Items Instead of Raw History Items
S20 Fix: study alerts (stale_subject) were replacing the real last study session in the ParentDashboard activity summary (May 8, 7:59 PM)
43 8:05p 🔵 API /parent/student-history Returns study_alert Items Mixed With Activity Feed
44 " 🔴 ParentDashboard Filtered Out study_alert Items From Activity Summary
45 8:08p 🔵 Historical Progress Items Contain migrated_from_sheets and autofix_phases Source Modes
S21 User asked "¿qué pasó?" — investigated whether student TK-XSN7QNOJ4 had started Competencia Lectora; confirmed it was a stale-subject alert, not real activity (May 8, 8:08 PM)
**Investigated**: Queried /api/study-sessions (from 2026-02-01) and /api/parent/student-history (limit=120) for student TK-XSN7QNOJ4. Examined the full session list including both native app_entry sessions and derived sessions going back to March 2026. Confirmed that "COMPETENCIA_LECTORA: sin estudio reciente" was a study_alert (source: study_alert, type: stale_subject), NOT a real study session. Also confirmed the study sessions endpoint returns both raw app_entry sessions and derived aggregated sessions synthesized from progress events.

**Learned**: The /api/study-sessions endpoint returns two types of sessions: (1) native app_entry sessions with session_id (e.g. SS-E2EA8B5F5AC2) tracking actual Mático app usage with minute-by-minute milestones, and (2) derived sessions with id format "derived-{date}|{SUBJECT}-s{n}" that are synthesized from progress events (phase completions, etc.) for subjects without native session tracking. Derived sessions cover BIOLOGIA, LENGUAJE, HISTORIA, QUIMICA, FISICA going back to March 2026. The stale_subject alerts appear in the history API with today's timestamp, making them look like real recent activity — this was the root bug.

**Completed**: Fixed ParentDashboard.jsx to exclude study_alert source and stale_subject/alert/study_alert types from both summaryHistoryActivityItems and summaryHasTodayActivity logic. Built and verified. Committed as a037052 ("fix: no usar alertas como ultima sesion real") and pushed to GitHub Master3108/dashboard-matico main branch. Confirmed with user that the real last session remains BIOLOGIA Embriología y Biogeografía (44/45 correctas, 35 min), not any alert.

**Next Steps**: Deploy the fix to production: ssh root@72.60.245.87 "cd /var/www/dashboard-matico && git pull origin main && docker compose down && docker compose up --build -d" — then hard refresh to verify the dashboard shows BIOLOGIA as the last real session.


Access 894k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>