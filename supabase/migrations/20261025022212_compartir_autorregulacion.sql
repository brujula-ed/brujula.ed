-- F-08: el estudiante puede compartir su resultado de autorregulación con el docente de cada asignatura, una por
-- una y de forma reversible. El docente ve solo las dos medias (conocimiento y regulación), nunca las respuestas.

-- 1) Medias por escala de unas respuestas. Único lugar de SQL con el reparto ítem → escala; el mismo reparto está
--    en lib/self-regulation.ts (si cambia allí, cambiarlo aquí). Las claves ya vienen validadas por
--    submit_self_regulation, así que la conversión a número es segura.
create or replace function public.self_regulation_scores(p_answers jsonb, out knowledge numeric, out regulation numeric)
language sql
immutable
set search_path = public
as $$
  select
    avg(v.value::text::numeric) filter (
      where v.key::integer = any (array[5, 10, 12, 16, 17, 20, 32, 46, 3, 14, 27, 33, 15, 18, 26, 29, 35])
    ),
    avg(v.value::text::numeric) filter (
      where not (v.key::integer = any (array[5, 10, 12, 16, 17, 20, 32, 46, 3, 14, 27, 33, 15, 18, 26, 29, 35]))
    )
  from jsonb_each(p_answers) v;
$$;

-- Solo la usan las funciones de abajo (que corren como su dueño)
revoke execute on function public.self_regulation_scores(jsonb) from public, anon, authenticated;

-- 2) El resumen de clase pasa a usar la función anterior. Mismo resultado que antes.
create or replace function public.self_regulation_class_summary(p_subject_id uuid)
returns table (
  respondents integer,
  knowledge_avg numeric,
  regulation_avg numeric,
  knowledge_low integer,
  knowledge_mid integer,
  knowledge_high integer,
  regulation_low integer,
  regulation_mid integer,
  regulation_high integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  min_group constant integer := 5;
begin
  if not is_subject_owner(p_subject_id) then
    raise exception 'No autorizado';
  end if;

  return query
  with latest as (
    select distinct on (r.user_id) r.user_id, r.answers
    from self_regulation_responses r
    join enrollments en on en.student_id = r.user_id and en.subject_id = p_subject_id
    where r.instrument_version = 'mai-52-es-preliminar-1'
    order by r.user_id, r.created_at desc
  ),
  scores as (
    select s.knowledge as kn, s.regulation as reg
    from latest l
    cross join lateral self_regulation_scores(l.answers) s
  ),
  agg as (
    select
      count(*)::integer as n,
      avg(kn) as kn_avg,
      avg(reg) as reg_avg,
      (count(*) filter (where kn < 2.5))::integer as kn_low,
      (count(*) filter (where kn >= 2.5 and kn <= 3.5))::integer as kn_mid,
      (count(*) filter (where kn > 3.5))::integer as kn_high,
      (count(*) filter (where reg < 2.5))::integer as reg_low,
      (count(*) filter (where reg >= 2.5 and reg <= 3.5))::integer as reg_mid,
      (count(*) filter (where reg > 3.5))::integer as reg_high
    from scores
  )
  select
    a.n,
    case when a.n >= min_group then round(a.kn_avg, 2) end,
    case when a.n >= min_group then round(a.reg_avg, 2) end,
    case when a.n >= min_group then a.kn_low end,
    case when a.n >= min_group then a.kn_mid end,
    case when a.n >= min_group then a.kn_high end,
    case when a.n >= min_group then a.reg_low end,
    case when a.n >= min_group then a.reg_mid end,
    case when a.n >= min_group then a.reg_high end
  from agg a;
end;
$$;

-- 3) Permisos para compartir: uno por estudiante y asignatura. Solo los gestiona el propio estudiante.
create table public.self_regulation_shares (
  student_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, subject_id)
);

create index self_regulation_shares_subject_id_idx on public.self_regulation_shares (subject_id);

alter table public.self_regulation_shares enable row level security;

create policy "Cada estudiante ve con quién comparte" on public.self_regulation_shares
  for select to authenticated
  using (student_id = auth.uid());

create policy "Cada estudiante comparte con sus asignaturas" on public.self_regulation_shares
  for insert to authenticated
  with check (student_id = auth.uid() and public.is_enrolled(subject_id));

create policy "Cada estudiante deja de compartir" on public.self_regulation_shares
  for delete to authenticated
  using (student_id = auth.uid());

-- 4) Resultado compartido de un estudiante, para el docente dueño de la asignatura. Solo si el estudiante compartió
--    con esa asignatura y sigue inscrito. Devuelve las dos medias y la fecha de la respuesta más reciente; si no hay
--    permiso o respuesta, no devuelve filas (sin distinguir un caso del otro).
create or replace function public.self_regulation_shared_result(p_subject_id uuid, p_student_id uuid)
returns table (knowledge_avg numeric, regulation_avg numeric, answered_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_subject_owner(p_subject_id) then
    raise exception 'No autorizado';
  end if;

  return query
  select round(s.knowledge, 2), round(s.regulation, 2), r.created_at
  from self_regulation_responses r
  cross join lateral self_regulation_scores(r.answers) s
  where r.user_id = p_student_id
    and r.instrument_version = 'mai-52-es-preliminar-1'
    and exists (
      select 1 from self_regulation_shares sh
      where sh.student_id = p_student_id and sh.subject_id = p_subject_id
    )
    and exists (
      select 1 from enrollments en
      where en.student_id = p_student_id and en.subject_id = p_subject_id
    )
  order by r.created_at desc
  limit 1;
end;
$$;

revoke execute on function public.self_regulation_shared_result(uuid, uuid) from public, anon;
grant execute on function public.self_regulation_shared_result(uuid, uuid) to authenticated;
