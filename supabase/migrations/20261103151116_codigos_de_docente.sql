-- Verificación del rol docente (docs/PENDIENTES.md, pendiente 1). Se llega a docente solo con un código de invitación,
-- uno por docente, que Sergio crea desde el SQL Editor del panel con create_teacher_invite('a quién se lo da').
-- Antes, handle_new_user copiaba el rol que mandaba el formulario y cada usuario podía cambiarse el rol en profiles.

-- 1. Códigos de invitación. RLS sin políticas y sin permisos para anon ni authenticated (como pilot_requests): solo se
--    leen desde el panel y solo los tocan las funciones de abajo. used_at marca el código como usado; used_by queda en
--    null si se borra la cuenta, pero el código sigue usado.
create table public.teacher_invites (
  code text primary key check (code ~ '^DOC-[A-Z0-9]{5}-[A-Z0-9]{5}$'),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz
);

alter table public.teacher_invites enable row level security;
revoke all on table public.teacher_invites from anon, authenticated;

-- 2. Nadie se cambia el rol: los usuarios solo pueden actualizar su nombre (la política de UPDATE sigue limitando a su
--    propia fila).
revoke update on table public.profiles from anon, authenticated;
grant update (full_name) on table public.profiles to authenticated;

-- 3. Cuentas nuevas: estudiante, salvo que traigan un código válido y sin usar, que se gasta en la misma operación (dos
--    registros no pueden usar el mismo). Un código inválido o usado impide crear la cuenta: la pantalla de registro lo
--    comprueba antes con check_teacher_code, así que esto solo salta si otro lo usó justo antes.
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  v_code text := upper(trim(new.raw_user_meta_data->>'teacher_code'));
  v_role public.user_role := 'estudiante';
begin
  if v_code is not null and v_code <> '' then
    update public.teacher_invites
      set used_by = new.id, used_at = now()
      where code = v_code and used_at is null;
    if not found then
      raise exception 'invalid_teacher_code';
    end if;
    v_role := 'docente';
  end if;

  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', v_role);
  return new;
end;
$function$;

-- 4. ¿El usuario actual es docente? Para las políticas (security definer: lee profiles sin pasar por su RLS).
create or replace function public.is_teacher()
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $function$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'docente');
$function$;

revoke execute on function public.is_teacher() from public, anon;
grant execute on function public.is_teacher() to authenticated;

-- Solo los docentes crean asignaturas. Las rutas de IA exigen ser dueño de la asignatura, así que también quedan
-- solo para docentes.
drop policy "Docentes crean sus propias asignaturas" on public.subjects;
create policy "Docentes crean sus propias asignaturas" on public.subjects
  for insert
  to public
  with check ((auth.uid() = teacher_id) and public.is_teacher());

-- 5. Para avisar en el registro antes de crear la cuenta. Solo dice sí o no; los códigos tienen 50 bits al azar, así que
--    no se pueden adivinar probando.
create or replace function public.check_teacher_code(p_code text)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $function$
  select exists (
    select 1 from public.teacher_invites where code = upper(trim(p_code)) and used_at is null
  );
$function$;

revoke execute on function public.check_teacher_code(text) from public;
grant execute on function public.check_teacher_code(text) to anon, authenticated;

-- 6. Crear un código desde el SQL Editor: select create_teacher_invite('Ana Pérez, UMSA');
--    Formato DOC-XXXXX-XXXXX con letras y números sin los que se confunden (0/O, 1/I). Los bytes salen de
--    gen_random_uuid (aleatorio criptográfico); se saltan los que llevan la versión y la variante del uuid.
create or replace function public.create_teacher_invite(p_note text)
  returns text
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 caracteres: 5 bits por byte, sin sesgo
  v_bytes bytea;
  v_chars text;
  v_code text;
  i int;
begin
  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_chars := '';
    foreach i in array array[0, 1, 2, 3, 4, 5, 10, 11, 12, 13] loop
      v_chars := v_chars || substr(v_alphabet, get_byte(v_bytes, i) % 32 + 1, 1);
    end loop;
    v_code := 'DOC-' || substr(v_chars, 1, 5) || '-' || substr(v_chars, 6, 5);
    exit when not exists (select 1 from public.teacher_invites where code = v_code);
  end loop;

  insert into public.teacher_invites (code, note) values (v_code, p_note);
  return v_code;
end;
$function$;

revoke execute on function public.create_teacher_invite(text) from public, anon, authenticated;
