-- =====================================================================
-- MATICO - Schema inicial Supabase
-- =====================================================================
-- Crea todas las tablas necesarias para migrar desde Google Sheets.
-- Pegar TODO este archivo en Supabase SQL Editor y apretar "Run".
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CATALOGO CURRICULAR
-- ---------------------------------------------------------------------

create table if not exists grades (
  code text primary key,
  label text not null,
  order_index int not null
);

create table if not exists subjects (
  code text primary key,
  label text not null,
  active boolean default true,
  order_index int default 0
);

create table if not exists chapters (
  id text primary key,
  grade text not null references grades(code),
  subject text not null references subjects(code),
  chapter_number int not null,
  title text not null,
  focus text,
  order_index int default 0,
  unique (grade, subject, chapter_number)
);

create table if not exists curriculum_sessions (
  id bigserial primary key,
  grade text not null references grades(code),
  subject text not null references subjects(code),
  session_number int not null,
  chapter_id text references chapters(id),
  focus text,
  unique (grade, subject, session_number)
);
create index if not exists idx_sessions_grade_subject
  on curriculum_sessions (grade, subject);

-- ---------------------------------------------------------------------
-- 2. ASSETS PEDAGOGICOS (imagenes)
-- ---------------------------------------------------------------------

create table if not exists pedagogical_assets (
  asset_id text primary key,
  title text,
  subject text references subjects(code),
  topic_tags text,
  kind text,
  storage_path text not null,
  public_url text,
  mime_type text,
  alt_text text,
  caption text,
  source_type text,
  status text default 'approved',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_assets_subject_status
  on pedagogical_assets (subject, status);

-- ---------------------------------------------------------------------
-- 3. BANCO DE PREGUNTAS
-- ---------------------------------------------------------------------

create table if not exists question_bank (
  question_id text primary key,
  grade text not null references grades(code),
  subject text not null references subjects(code),
  session int not null,
  phase int not null,
  slot int,
  proposal_index int default 1,
  level_name text,
  topic text,
  question text not null,
  options jsonb not null,
  correct_answer text not null,
  explanation text,
  source_mode text,
  active boolean default true,
  prompt_image_asset_id text references pedagogical_assets(asset_id) on delete set null,
  question_visual_role text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_qbank_grade_subject_session_phase_active
  on question_bank (grade, subject, session, phase) where active = true;
create index if not exists idx_qbank_image_asset
  on question_bank (prompt_image_asset_id) where prompt_image_asset_id is not null;

-- ---------------------------------------------------------------------
-- 4. TEORIA LUDICA
-- ---------------------------------------------------------------------

create table if not exists theory_ludica_bank (
  id bigserial primary key,
  grade text not null references grades(code),
  subject text not null references subjects(code),
  session int not null,
  phase int not null,
  topic text,
  theory_markdown text not null,
  source text,
  active boolean default true,
  support_image_asset_id text references pedagogical_assets(asset_id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists idx_theory_grade_subject_session_phase
  on theory_ludica_bank (grade, subject, session, phase) where active = true;

-- ---------------------------------------------------------------------
-- 5. PERFILES DE USUARIO
-- ---------------------------------------------------------------------

create table if not exists profiles (
  user_id uuid primary key default gen_random_uuid(),
  email text unique not null,
  display_name text,
  current_grade text references grades(code) default '1medio',
  is_admin boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 6. PROGRESO
-- ---------------------------------------------------------------------

create table if not exists progress_log (
  id bigserial primary key,
  user_id uuid,
  user_email text,
  grade text references grades(code),
  subject text references subjects(code),
  session int,
  phase int,
  sub_level text,
  level_name text,
  event_type text,
  score numeric,
  xp int,
  topic text,
  total_questions int,
  correct_answers int,
  wrong_answers int,
  wrong_question_details jsonb,
  weakness jsonb,
  improvement_plan jsonb,
  source_mode text,
  batch_index int,
  batch_size int,
  created_at timestamptz default now()
);
create index if not exists idx_progress_user_created
  on progress_log (user_id, created_at desc);
create index if not exists idx_progress_email_created
  on progress_log (user_email, created_at desc);

-- ---------------------------------------------------------------------
-- 7. EXAMENES Y RECORDATORIOS
-- ---------------------------------------------------------------------

create table if not exists exam_reminders (
  event_id text primary key,
  user_id uuid,
  user_email text,
  student_name text,
  student_email text,
  guardian_email text,
  subject text references subjects(code),
  exam_date date,
  title text,
  source text,
  confidence numeric,
  status text,
  sent_d7 boolean default false,
  sent_d2 boolean default false,
  sent_d1 boolean default false,
  last_sent_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 8. PERFIL ADAPTATIVO
-- ---------------------------------------------------------------------

create table if not exists adaptive_profile_log (
  id bigserial primary key,
  user_id uuid,
  user_email text,
  subject text references subjects(code),
  payload jsonb not null,
  created_at timestamptz default now()
);
create index if not exists idx_adaptive_user_subject
  on adaptive_profile_log (user_id, subject, created_at desc);

-- ---------------------------------------------------------------------
-- 9. NOTEBOOKS Y SUBMISSIONS
-- ---------------------------------------------------------------------

create table if not exists notebook_submissions (
  id text primary key,
  user_id uuid,
  user_email text,
  file_name text,
  storage_path text not null,
  mime_type text,
  status text,
  expires_at timestamptz,
  metadata jsonb,
  created_at timestamptz default now()
);

-- =====================================================================
-- SEED INICIAL: cursos y asignaturas
-- =====================================================================

insert into grades (code, label, order_index) values
  ('1medio', '1° Medio', 1),
  ('2medio', '2° Medio', 2),
  ('3medio', '3° Medio', 3),
  ('4medio', '4° Medio', 4)
on conflict (code) do nothing;

insert into subjects (code, label, active, order_index) values
  ('MATEMATICA',          'Matematica',          true, 1),
  ('FISICA',              'Fisica',              true, 2),
  ('QUIMICA',             'Quimica',             true, 3),
  ('BIOLOGIA',            'Biologia',            true, 4),
  ('HISTORIA',            'Historia',            true, 5),
  ('COMPETENCIA_LECTORA', 'Competencia Lectora', true, 6)
on conflict (code) do nothing;

-- =====================================================================
-- LISTO. Las tablas estan creadas y los catalogos basicos cargados.
-- Los capitulos y sesiones se cargan en el paso siguiente desde el
-- moralejaSessionCatalog.js existente.
-- =====================================================================
