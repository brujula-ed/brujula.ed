-- Unidades y temas dentro de la asignatura (motor de conocimiento, fase 2, docs/MOTOR-DE-CONOCIMIENTO.md 4.3).
-- Decisiones del 30/10/2026: cada concepto está en un solo tema; los temas se pueden agrupar en unidades (opcional);
-- las relaciones entre temas se calculan desde los prerrequisitos de sus conceptos (no se guardan).
-- El estudiante se inscribe a la asignatura entera: los temas viven dentro de ella.

-- 1. La descripción de la asignatura reemplaza al campo "Tema" (un único texto obligatorio que confundía).
--    Compatible con el código desplegado: se copia y "topic" queda opcional. Cuando Vercel tenga el código nuevo,
--    una migración aparte borra subjects.topic (docs/PENDIENTES.md).
alter table public.subjects add column description text;
update public.subjects set description = topic where description is null;
alter table public.subjects alter column topic drop not null;
-- Columna heredada de los intentos (pendiente 2 de docs/PENDIENTES.md): se llenaba con el tema de la asignatura
alter table public.diagnostic_attempts alter column topic drop not null;

-- 2. Unidades (opcionales): agrupan temas, como en el programa de la asignatura. Las crea el docente.
create table public.units (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index units_subject_id_idx on public.units (subject_id);
create unique index units_subject_name_unique on public.units (subject_id, lower(trim(name)));

-- 3. Temas: los propone la IA o los crea el docente; el estudiante solo ve los validados.
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text,
  position integer not null default 0,
  status text not null default 'sugerido' check (status in ('sugerido', 'validado')),
  created_at timestamptz not null default now()
);
create index topics_subject_id_idx on public.topics (subject_id);
create unique index topics_subject_name_unique on public.topics (subject_id, lower(trim(name)));

-- 4. Tema de cada concepto. Si se borra el tema, el concepto queda sin tema (no se borra).
alter table public.concepts add column topic_id uuid references public.topics(id) on delete set null;
create index concepts_topic_id_idx on public.concepts (topic_id);

-- Un concepto solo puede ir en un tema de su misma asignatura, y un tema solo en una unidad de su asignatura.
create or replace function public.check_same_subject_topic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'concepts' and new.topic_id is not null and not exists (
    select 1 from topics t where t.id = new.topic_id and t.subject_id = new.subject_id
  ) then
    raise exception 'El tema no pertenece a la asignatura del concepto';
  end if;
  if tg_table_name = 'topics' and new.unit_id is not null and not exists (
    select 1 from units u where u.id = new.unit_id and u.subject_id = new.subject_id
  ) then
    raise exception 'La unidad no pertenece a la asignatura del tema';
  end if;
  return new;
end;
$$;

create trigger concepts_check_topic
  before insert or update of topic_id, subject_id on public.concepts
  for each row execute function public.check_same_subject_topic();

create trigger topics_check_unit
  before insert or update of unit_id, subject_id on public.topics
  for each row execute function public.check_same_subject_topic();

-- 5. Seguridad: las mismas reglas que los conceptos. El docente dueño hace todo; el estudiante inscrito lee.
alter table public.units enable row level security;
alter table public.topics enable row level security;

create policy "Docentes ven unidades de sus asignaturas" on public.units
  for select to authenticated using (public.is_subject_owner(subject_id));
create policy "Docentes crean unidades en sus asignaturas" on public.units
  for insert to authenticated with check (public.is_subject_owner(subject_id));
create policy "Docentes actualizan unidades de sus asignaturas" on public.units
  for update to authenticated
  using (public.is_subject_owner(subject_id)) with check (public.is_subject_owner(subject_id));
create policy "Docentes eliminan unidades de sus asignaturas" on public.units
  for delete to authenticated using (public.is_subject_owner(subject_id));
create policy "Estudiantes inscritos ven unidades" on public.units
  for select to authenticated using (public.is_enrolled(subject_id));

create policy "Docentes ven temas de sus asignaturas" on public.topics
  for select to authenticated using (public.is_subject_owner(subject_id));
create policy "Docentes crean temas en sus asignaturas" on public.topics
  for insert to authenticated with check (public.is_subject_owner(subject_id));
create policy "Docentes actualizan temas de sus asignaturas" on public.topics
  for update to authenticated
  using (public.is_subject_owner(subject_id)) with check (public.is_subject_owner(subject_id));
create policy "Docentes eliminan temas de sus asignaturas" on public.topics
  for delete to authenticated using (public.is_subject_owner(subject_id));
create policy "Estudiantes inscritos ven temas validados" on public.topics
  for select to authenticated using (status = 'validado' and public.is_enrolled(subject_id));
