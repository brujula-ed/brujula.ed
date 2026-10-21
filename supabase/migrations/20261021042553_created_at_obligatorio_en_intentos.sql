-- created_at de los intentos siempre tiene valor (default now()), pero la columna admitía null.
-- El LRR y los estados ordenan los intentos por esta fecha, así que se hace obligatoria y los tipos
-- generados (lib/supabase/database.types.ts) la describen como string. Antes de crearla se comprobó
-- que ninguno de los 61 intentos la tiene vacía.
alter table public.diagnostic_attempts
  alter column created_at set not null;
