-- Recursos abiertos curados (F-11). La IA propone enlaces de los sitios que el docente eligió para la asignatura,
-- el servidor comprueba que existan (lib/link-check.ts) y el docente los aprueba. El docente también puede
-- agregar enlaces propios. El estudiante solo ve recursos validados de conceptos validados.

-- 1) Sitios permitidos por asignatura: ids del catálogo de lib/resource-sources.ts.
--    Por defecto todos menos PhET (DEFAULT_SOURCES). El dueño ya puede actualizar su asignatura.
alter table public.subjects
  add column resource_sources text[] not null default array['wikipedia', 'openstax', 'mit_ocw', 'khan', 'youtube'];

-- 2) Recursos por concepto
create table public.concept_resources (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references public.concepts(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  url text not null check (url ~ '^https://'),
  kind text not null check (kind in ('lectura', 'video', 'ejercicio')),
  source text not null, -- id del catálogo, o 'docente' si lo agregó el docente
  added_by text not null check (added_by in ('ia', 'docente')),
  -- Cómo se comprobó el enlace: 'verificado' (el servidor vio que existe), 'no_verificable' (sitio del catálogo
  -- que no se puede comprobar: el docente debe abrirlo antes de validar) o 'docente' (lo agregó el docente)
  link_check text not null check (link_check in ('verificado', 'no_verificable', 'docente')),
  status text not null default 'sugerido' check (status in ('sugerido', 'validado')),
  created_at timestamptz not null default now(),
  unique (concept_id, url)
);

create index concept_resources_subject_id_idx on public.concept_resources (subject_id);

-- La asignatura sale siempre del concepto (mismo trigger que concept_cards: solo usa concept_id y subject_id)
create trigger concept_resources_set_subject_id
  before insert or update on public.concept_resources
  for each row execute function public.set_concept_card_subject_id();

alter table public.concept_resources enable row level security;

create policy "Docentes ven recursos de sus asignaturas" on public.concept_resources
  for select to authenticated
  using (public.is_subject_owner(subject_id));

create policy "Docentes crean recursos en sus asignaturas" on public.concept_resources
  for insert to authenticated
  with check (public.is_subject_owner(subject_id));

create policy "Docentes actualizan recursos de sus asignaturas" on public.concept_resources
  for update to authenticated
  using (public.is_subject_owner(subject_id))
  with check (public.is_subject_owner(subject_id));

create policy "Docentes eliminan recursos de sus asignaturas" on public.concept_resources
  for delete to authenticated
  using (public.is_subject_owner(subject_id));

create policy "Estudiantes inscritos ven recursos validados" on public.concept_resources
  for select to authenticated
  using (
    status = 'validado'
    and public.is_enrolled(subject_id)
    and exists (
      select 1 from public.concepts c
      where c.id = concept_id and c.status = 'validado'
    )
  );
