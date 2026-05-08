<claude-mem-context>
# Memory Context

# [dashboard-matico] recent context, 2026-05-08 1:11pm GMT-4

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 14 obs (7,114t read) | 585,114t work | 99% savings

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
S1 Matico Platform — Architectural decisions for daily 20:00 alert channel and Obsidian-style dashboard view for child study monitoring system (May 8, 9:25 AM)
13 1:02p 🔵 Subject Card UI Changes Only Applied to Chemistry, Not All Subjects
14 " 🔴 Calendar Rows Now Enriched with Source Labels and Normalized Subjects Across All Subjects
15 " 🔴 Calendar/Reminder/Study Items No Longer Incorrectly Return a Score
S2 Fix subject card enrichment to apply to ALL subjects, not just química — dashboard-matico antecedentes display (May 8, 1:03 PM)
**Investigated**: The issue was that calendar/event rows were being mapped without subject normalization and without source classification metadata, while quiz/prep rows already had enrichment via `describePrepSource`. The root cause of only química being affected was likely that a previous partial fix targeted a single hardcoded subject or component instance rather than the shared mapping logic.

**Learned**: - Calendar rows previously used raw `row.subject` without passing through `normalizeSubject()`, which caused subject inconsistency across the dashboard.
    - The `getHistoryScore` function in ParentDashboard would fall through to `item.score` for calendar/reminder/study events, causing misleading score display (e.g., showing `0`).
    - External source detection can be done via regex on concatenated title+description+subject fields to identify books, guides, oracle entries, and reading materials.
    - Pending events (`status === 'pendiente'`) need explicit `incomplete_reason` text to explain no quiz result is yet associated.

**Completed**: - Added `describeCalendarSource(row)` function to `server/index.js` that classifies calendar events as external (libro/guía/cuaderno/oráculo/etc.) or generic calendar events, with human-readable labels.
    - Updated all calendar row mappings in `server/index.js` to: use `normalizeSubject()` on subject field, include `score: null`, `score_percent: null`, `incomplete_reason`, and a `metadata` object with `source_label`, `is_external_source`, and `incomplete_reason`.
    - Fixed `getHistoryScore` in `src/components/ParentDashboard.jsx` to return `null` for `calendar`, `reminder`, and `study` source types — preventing false score display.
    - Validated `server/index.js` syntax with `node --check` (exit code 0).
    - Production build completed successfully via `npm run build` (Vite, 2596 modules, 9.4s). One chunk size warning noted (index-COsroRAA.js at 1,071 kB) but build succeeded.

**Next Steps**: Deploy to production server via git push + SSH docker compose rebuild:
    `git add -A && git commit -m "feat: completar antecedentes con origen externo y estados pendientes" && git push origin main`
    then SSH to `root@72.60.245.87` to pull and rebuild the docker container at `/var/www/dashboard-matico`.


Access 585k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>