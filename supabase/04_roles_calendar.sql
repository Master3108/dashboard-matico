-- =====================================================================
-- MATICO - Migración: Roles (apoderado/estudiante) + Calendario
-- =====================================================================

-- 1. Agregar rol y vínculo padre-hijo a profiles
-- =====================================================================
alter table profiles add column if not exists role text default 'estudiante';
alter table profiles add column if not exists parent_user_id text;

-- Índice para buscar hijos de un apoderado
create index if not exists idx_profiles_parent
  on profiles (parent_user_id) where parent_user_id is not null;

-- 2. Configurar cuentas de prueba
-- =====================================================================
-- Jose = apoderado
update profiles
  set role = 'apoderado'
  where email = 'joseantonio.olguinr@gmail.com';

-- Matías = estudiante, hijo de Jose
update profiles
  set role = 'estudiante',
      parent_user_id = (select user_id from profiles where email = 'joseantonio.olguinr@gmail.com' limit 1),
      guardian_email = 'joseantonio.olguinr@gmail.com'
  where email = 'molguin2@westonacademyvg.cl';

-- 3. Tabla de eventos del calendario
-- =====================================================================
create table if not exists calendar_events (
  event_id text primary key default ('EVT-' || substr(md5(random()::text), 1, 10)),

  -- Quién crea y a quién pertenece
  created_by text not null,                    -- user_id del creador (apoderado o estudiante)
  student_user_id text not null,               -- user_id del estudiante

  -- Tipo y contenido
  event_type text not null default 'estudio',  -- estudio, prueba, tarea, repaso, otro
  title text not null,
  description text,
  subject text,                                -- MATEMATICA, LENGUAJE, etc.
  session_number int,                          -- sesión curricular asociada (opcional)

  -- Fecha y hora
  event_date date not null,
  start_time time,                             -- hora inicio (ej: 17:00)
  end_time time,                               -- hora fin (ej: 18:00)
  all_day boolean default false,

  -- Recurrencia
  recurrence text default 'none',              -- none, daily, weekly, monthly
  recurrence_end date,

  -- Evidencias adjuntas (fotos del cuaderno, pruebas, etc.)
  evidences jsonb default '[]'::jsonb,         -- [{image_base64, mime_type, source_type}]

  -- Resultado (se llena después del evento)
  status text default 'pendiente',             -- pendiente, en_progreso, completado, cancelado
  result_score numeric,                        -- nota o % si aplica
  result_details jsonb,                        -- detalles del resultado (quiz stats, etc.)

  -- Notificaciones
  notify_guardian boolean default true,
  notify_student boolean default true,
  reminder_minutes int default 15,             -- minutos antes para avisar
  alarm_sound boolean default true,            -- sonar como despertador

  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Índices para consultas frecuentes
create index if not exists idx_calendar_student_date
  on calendar_events (student_user_id, event_date desc);
create index if not exists idx_calendar_created_by
  on calendar_events (created_by, event_date desc);
create index if not exists idx_calendar_status
  on calendar_events (status) where status = 'pendiente';

-- 4. Tabla de notificaciones
-- =====================================================================
create table if not exists notifications (
  notif_id text primary key default ('NTF-' || substr(md5(random()::text), 1, 10)),
  user_id text not null,                       -- a quién va dirigida
  event_id text references calendar_events(event_id) on delete cascade,

  type text not null default 'reminder',       -- reminder, result, alert, info
  title text not null,
  body text,

  read boolean default false,
  sent_push boolean default false,             -- si se envió push notification
  sent_email boolean default false,            -- si se envió email

  scheduled_at timestamptz,                    -- cuándo debe enviarse
  sent_at timestamptz,                         -- cuándo se envió
  created_at timestamptz default now()
);

create index if not exists idx_notifications_user_unread
  on notifications (user_id, created_at desc) where read = false;

-- 5. Tokens de push notification (para Firebase)
-- =====================================================================
alter table profiles add column if not exists fcm_token text;
alter table profiles add column if not exists fcm_token_updated_at timestamptz;

-- =====================================================================
-- LISTO. Ahora profiles tiene roles, calendario y notificaciones.
-- =====================================================================
