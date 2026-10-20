-- Límite de uso de la IA por usuario: cada llamada a OpenAI desde las rutas de API queda registrada aquí.
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  route text not null,
  created_at timestamptz not null default now()
);

create index ai_usage_user_id_created_at_idx on public.ai_usage (user_id, created_at);

-- RLS sin políticas: nadie la lee ni la escribe directamente; solo la función de abajo.
alter table public.ai_usage enable row level security;

-- Devuelve false si el usuario ya hizo 30 llamadas en las últimas 24 horas; si no, registra la llamada y devuelve true.
-- El límite está aquí (y no como parámetro) para que no se pueda cambiar desde el navegador.
create or replace function public.consume_ai_quota(p_route text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  limite constant integer := 30;
  usadas integer;
begin
  if auth.uid() is null then
    return false;
  end if;

  select count(*) into usadas
  from ai_usage
  where user_id = auth.uid()
    and created_at > now() - interval '24 hours';

  if usadas >= limite then
    return false;
  end if;

  insert into ai_usage (user_id, route) values (auth.uid(), p_route);
  return true;
end;
$$;

revoke execute on function public.consume_ai_quota(text) from public, anon;
grant execute on function public.consume_ai_quota(text) to authenticated;
