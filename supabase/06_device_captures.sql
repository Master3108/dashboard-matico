-- =====================================================================
-- MATICO - Captura remota celular -> computador
-- =====================================================================
-- Soporta el flujo donde el PC solicita una foto/captura y el celular,
-- conectado con el mismo user_id, la envia automaticamente al modulo activo.

create table if not exists device_captures (
  capture_id text primary key default ('CAP-' || substr(md5(random()::text), 1, 12)),
  user_id text not null,
  student_id text,
  token text not null unique,
  status text not null default 'waiting',
  context text default 'general',
  context_data jsonb default '{}'::jsonb,
  requested_from text default 'pc',
  captured_from text,
  image_url text,
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  completed_at timestamptz
);

create index if not exists idx_device_captures_user_status_created
  on device_captures (user_id, status, created_at desc);

create index if not exists idx_device_captures_token
  on device_captures (token);

create index if not exists idx_device_captures_expires_waiting
  on device_captures (expires_at)
  where status = 'waiting';

