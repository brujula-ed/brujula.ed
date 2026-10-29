-- Solicitudes "Pedir un piloto" de la landing (docs/LANDING-PARA-CODE.md, sección 5). Datos personales de contacto.
-- Entran solo desde el servidor (Server Action con la clave service_role, que salta la RLS) y se revisan desde el
-- panel de Supabase. status: 'nuevo' al llegar; los demás valores se decidirán al revisarlas.
create table public.pilot_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 120),
  university text not null check (char_length(university) between 2 and 160),
  email text not null check (char_length(email) between 5 and 200),
  message text check (char_length(message) <= 2000),
  status text not null default 'nuevo'
);

-- RLS sin políticas y sin permisos para anon ni authenticated: nadie puede leer ni escribir desde el navegador.
alter table public.pilot_requests enable row level security;
revoke all on table public.pilot_requests from anon, authenticated;
