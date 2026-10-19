-- Snippet: Profiles
-- id: 1be86cbe-acb9-4381-b69e-9bf1cedbb78e
-- creado: 2026-09-30T02:13:29.236889+00:00 | actualizado: 2026-10-03T01:46:05.31+00:00

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'estudiante')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();