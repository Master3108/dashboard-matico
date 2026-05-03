-- =====================================================================
-- MATICO - Migración: Extender profiles para compatibilidad legacy
-- =====================================================================
-- El código legacy (Google Sheets) usaba: token, pass, mail, nombre,
-- celular, region, comuna, correo_apoderado.
--
-- Cambios:
-- 1. user_id pasa de uuid a text (para soportar tokens TK-xxx)
-- 2. Se agregan columnas faltantes
-- =====================================================================

-- Cambiar user_id de uuid a text para soportar tokens legacy TK-xxx
-- NOTA: Si la tabla ya tiene datos con uuid, esto los preserva como text.
alter table profiles
  alter column user_id type text using user_id::text,
  alter column user_id set default ('TK-' || substr(md5(random()::text), 1, 9));

-- Agregar columnas legacy faltantes
alter table profiles add column if not exists password_hash text default '';
alter table profiles add column if not exists phone text default '';
alter table profiles add column if not exists region text default '';
alter table profiles add column if not exists commune text default '';
alter table profiles add column if not exists guardian_email text default '';

-- También actualizar las FK en progress_log y otras tablas que referencian user_id como uuid
-- progress_log.user_id es uuid sin FK constraint, así que solo cambiamos tipo
alter table progress_log alter column user_id type text using user_id::text;
alter table adaptive_profile_log alter column user_id type text using user_id::text;
alter table exam_reminders alter column user_id type text using user_id::text;
alter table notebook_submissions alter column user_id type text using user_id::text;

-- =====================================================================
-- LISTO. Ahora profiles acepta tokens TK-xxx y tiene todos los campos.
-- =====================================================================
