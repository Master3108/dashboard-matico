-- =====================================================================
-- MATICO - Tablas faltantes
-- =====================================================================
-- Crea las 5 tablas que faltaban del schema inicial:
--   1. users               (hoja Usuarios)
--   2. quiz_results        (hoja quiz_results)
--   3. study_sessions      (hoja study_sessions)
--   4. session_progress    (hoja session_progress)
--   5. question_bank_builds (hoja QuestionBankBuilds)
-- Pegar TODO en Supabase SQL Editor y apretar Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. USUARIOS (auth legacy basada en token)
-- ---------------------------------------------------------------------
-- Replica exacta de la hoja Usuarios para mantener compatibilidad.
-- A futuro migraremos a Supabase Auth, pero por ahora dejamos esto.

create table if not exists users (
  token text primary key,                       -- ej. 'TK-AB12CD34E'
  pass text,                                    -- hash de la contrasena
  created timestamptz default now(),
  mail text unique,
  nombre text,
  celular text,
  region text,
  comuna text,
  correo_apoderado text,
  -- campos adicionales que existen en runtime (xp, etc.)
  xp int default 0,
  current_grade text references grades(code) default '1medio',
  is_admin boolean default false
);
create index if not exists idx_users_mail on users (lower(mail));

-- ---------------------------------------------------------------------
-- 2. QUIZ_RESULTS
-- ---------------------------------------------------------------------

create table if not exists quiz_results (
  id text primary key,                          -- timestamp millis
  user_id text references users(token) on delete set null,
  user_email text,
  subject text references subjects(code),
  topic text,
  score numeric,
  correct_answers int,
  created_at timestamptz default now()
);
create index if not exists idx_quiz_results_user_created
  on quiz_results (user_id, created_at desc);
create index if not exists idx_quiz_results_email_created
  on quiz_results (user_email, created_at desc);

-- ---------------------------------------------------------------------
-- 3. STUDY_SESSIONS
-- ---------------------------------------------------------------------

create table if not exists study_sessions (
  id text primary key,                          -- timestamp millis
  user_id text references users(token) on delete set null,
  user_email text,
  subject text references subjects(code),
  session_number int,
  status text,                                  -- 'completed' | 'in_progress' | etc.
  completed_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_study_sessions_user_subject
  on study_sessions (user_id, subject);
create index if not exists idx_study_sessions_email_subject
  on study_sessions (user_email, subject);

-- ---------------------------------------------------------------------
-- 4. SESSION_PROGRESS
-- ---------------------------------------------------------------------
-- Una fila por (usuario, asignatura) que se ACTUALIZA con el progreso.
-- En la hoja se hacian append, pero en DB es mas eficiente upsert.

create table if not exists session_progress (
  id bigserial primary key,
  user_id text references users(token) on delete set null,
  user_email text not null,
  subject text references subjects(code) not null,
  next_session int default 1,
  last_completed_session int default 0,
  current_session_in_progress int default 1,
  current_phase int default 1,
  total_score numeric default 0,
  total_xp int default 0,
  updated_at timestamptz default now(),
  unique (user_email, subject)
);
create index if not exists idx_session_progress_email
  on session_progress (user_email);

-- ---------------------------------------------------------------------
-- 5. QUESTION_BANK_BUILDS
-- ---------------------------------------------------------------------
-- Historial de cuando se generaron preguntas en lote (auditoria).

create table if not exists question_bank_builds (
  id bigserial primary key,
  build_id text,
  subject text references subjects(code),
  from_session int,
  to_session int,
  total_phases int,
  slots_per_phase int,
  proposals_per_slot int,
  total_expected int,
  total_inserted int,
  status text,                                  -- 'OK' | 'PARTIAL' | 'DRY_RUN'
  notes text,
  created_at timestamptz default now()
);
create index if not exists idx_qbb_subject_created
  on question_bank_builds (subject, created_at desc);

-- =====================================================================
-- LISTO. Las 5 tablas que faltaban estan creadas.
-- Ya tenemos las 12 tablas equivalentes a las 12 hojas de Sheets.
-- =====================================================================
