-- =====================================================================
-- MATICO - Senales, OCR permanente y reportes diarios
-- =====================================================================

create table if not exists notebook_ocr_records (
  id bigserial primary key,
  submission_id text unique not null,
  user_id text,
  user_email text,
  subject text,
  session_id text,
  phase text,
  topic text,
  ocr_text text,
  detected_concepts jsonb default '[]'::jsonb,
  missing_concepts jsonb default '[]'::jsonb,
  interpretation_score numeric default 0,
  quiz_ready boolean default false,
  tier text,
  feedback text,
  suggestion text,
  page_count int default 1,
  image_available_until timestamptz,
  public_url text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_notebook_ocr_user_created
  on notebook_ocr_records (user_id, created_at desc);
create index if not exists idx_notebook_ocr_subject_created
  on notebook_ocr_records (subject, created_at desc);

create table if not exists daily_reports (
  report_id text primary key default ('DR-' || substr(md5(random()::text), 1, 12)),
  student_user_id text not null,
  parent_user_id text,
  report_date date not null,
  payload jsonb not null default '{}'::jsonb,
  studied_today boolean default false,
  total_minutes int default 0,
  quiz_total int default 0,
  quiz_correct int default 0,
  quiz_wrong int default 0,
  notebook_count int default 0,
  status text default 'generated',
  sent_push boolean default false,
  sent_email boolean default false,
  sent_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (student_user_id, report_date)
);
create index if not exists idx_daily_reports_student_date
  on daily_reports (student_user_id, report_date desc);
create index if not exists idx_daily_reports_parent_date
  on daily_reports (parent_user_id, report_date desc);

create table if not exists study_alerts (
  alert_id text primary key default ('AL-' || substr(md5(random()::text), 1, 12)),
  student_user_id text not null,
  parent_user_id text,
  subject text,
  alert_type text not null,
  title text not null,
  body text,
  severity text default 'info',
  event_id text,
  report_id text,
  payload jsonb default '{}'::jsonb,
  resolved boolean default false,
  created_at timestamptz default now(),
  resolved_at timestamptz
);
create index if not exists idx_study_alerts_student_created
  on study_alerts (student_user_id, created_at desc);
create index if not exists idx_study_alerts_parent_unresolved
  on study_alerts (parent_user_id, created_at desc) where resolved = false;
create index if not exists idx_study_alerts_event_type
  on study_alerts (event_id, alert_type) where event_id is not null;

alter table notifications add column if not exists priority text default 'normal';
alter table notifications add column if not exists payload jsonb default '{}'::jsonb;
alter table notifications add column if not exists sent_at timestamptz;
alter table notifications add column if not exists scheduled_at timestamptz;
alter table notifications add column if not exists sent_push boolean default false;
alter table notifications add column if not exists sent_email boolean default false;

alter table calendar_events add column if not exists evidence_count int default 0;

-- Mantener updated_at simple para tablas nuevas.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_notebook_ocr_updated_at on notebook_ocr_records;
create trigger trg_notebook_ocr_updated_at
before update on notebook_ocr_records
for each row execute function set_updated_at();

drop trigger if exists trg_daily_reports_updated_at on daily_reports;
create trigger trg_daily_reports_updated_at
before update on daily_reports
for each row execute function set_updated_at();

