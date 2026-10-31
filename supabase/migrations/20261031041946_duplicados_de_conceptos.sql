-- Posibles duplicados entre conceptos de una asignatura (motor de conocimiento, fase 2, docs/MOTOR-DE-CONOCIMIENTO.md
-- 4.3), versión simple: se avisa y el docente descarta o edita uno. Fusionar con historial queda para más adelante.

-- 1. Significado de cada concepto: embedding de "nombre: descripción". Se calcula al generar y con "Buscar duplicados".
alter table public.concepts add column embedding public.vector(1536);

-- Si cambian el nombre o la descripción, el embedding ya no vale: se vacía para recalcularlo.
-- Solo salta cuando el UPDATE toca esas columnas (guardar el embedding no lo vacía).
create or replace function public.clear_concept_embedding()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.name is distinct from old.name or new.description is distinct from old.description then
    new.embedding := null;
  end if;
  return new;
end;
$$;

create trigger concepts_clear_embedding
  before update of name, description on public.concepts
  for each row execute function public.clear_concept_embedding();

-- 2. Parejas que el docente marcó como "No son el mismo": el aviso no vuelve a salir.
create table public.concept_pair_dismissals (
  concept_a uuid not null references public.concepts(id) on delete cascade,
  concept_b uuid not null references public.concepts(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (concept_a, concept_b),
  check (concept_a < concept_b)
);

-- La asignatura sale de los conceptos (los dos de la misma), no de lo que mande el navegador
create or replace function public.set_pair_dismissal_subject()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select c.subject_id into new.subject_id from concepts c where c.id = new.concept_a;
  if not exists (select 1 from concepts c where c.id = new.concept_b and c.subject_id = new.subject_id) then
    raise exception 'Los dos conceptos deben ser de la misma asignatura';
  end if;
  return new;
end;
$$;

create trigger concept_pair_dismissals_set_subject
  before insert on public.concept_pair_dismissals
  for each row execute function public.set_pair_dismissal_subject();

alter table public.concept_pair_dismissals enable row level security;

create policy "Docentes ven sus parejas descartadas" on public.concept_pair_dismissals
  for select to authenticated using (public.is_subject_owner(subject_id));
create policy "Docentes descartan parejas en sus asignaturas" on public.concept_pair_dismissals
  for insert to authenticated with check (public.is_subject_owner(subject_id));
create policy "Docentes quitan parejas descartadas" on public.concept_pair_dismissals
  for delete to authenticated using (public.is_subject_owner(subject_id));

-- 3. Parejas de conceptos de la asignatura que se parecen al menos p_min_similarity (coseno, de 0 a 1), sin las
--    descartadas. security invoker: se aplica la RLS de concepts, así que solo el docente dueño ve las suyas.
create or replace function public.similar_concepts(p_subject_id uuid, p_min_similarity double precision)
returns table (concept_a uuid, concept_b uuid, similarity double precision)
language sql
stable
security invoker
set search_path = public
as $$
  select c1.id, c2.id, 1 - (c1.embedding <=> c2.embedding)
  from concepts c1
  join concepts c2 on c2.subject_id = c1.subject_id and c1.id < c2.id
  where c1.subject_id = p_subject_id
    and c1.embedding is not null
    and c2.embedding is not null
    and 1 - (c1.embedding <=> c2.embedding) >= p_min_similarity
    and not exists (
      select 1 from concept_pair_dismissals d where d.concept_a = c1.id and d.concept_b = c2.id
    )
  order by 3 desc
  limit 30;
$$;

revoke execute on function public.similar_concepts(uuid, double precision) from public, anon;
grant execute on function public.similar_concepts(uuid, double precision) to authenticated;
