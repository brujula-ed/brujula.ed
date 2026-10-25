-- Diagnóstico de autorregulación (F-08), VERSIÓN PRELIMINAR. Instrumento: MAI adaptado al español
-- (González-Cabañes et al., Psicothema 2022; ítems en https://osf.io/zthdj). Detalle en lib/self-regulation.ts.
-- Un cuestionario por estudiante (no por asignatura). Datos de autopercepción: el estudiante ve y borra los suyos;
-- el docente nunca lee respuestas individuales, solo un resumen de su clase y solo con 5 o más respuestas.

create table public.self_regulation_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  instrument_version text not null,
  answers jsonb not null, -- id del ítem (texto) → respuesta de 1 a 5
  created_at timestamptz not null default now()
);

create index self_regulation_responses_user_id_created_at_idx
  on public.self_regulation_responses (user_id, created_at desc);

alter table public.self_regulation_responses enable row level security;

create policy "Cada usuario ve sus respuestas de autorregulación" on public.self_regulation_responses
  for select to authenticated
  using (user_id = auth.uid());

create policy "Cada usuario borra sus respuestas de autorregulación" on public.self_regulation_responses
  for delete to authenticated
  using (user_id = auth.uid());

-- Sin políticas de insert ni update: las respuestas entran solo por submit_self_regulation.

-- Guarda las respuestas de quien llama. Valida la versión y que vengan exactamente los ítems 1..N con un entero
-- de 1 a 5 cada uno. Al cambiar de instrumento (p. ej. la versión breve de 19 ítems), añadir su versión aquí.
create or replace function public.submit_self_regulation(p_version text, p_answers jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  expected integer;
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;

  if p_version = 'mai-52-es-preliminar-1' then
    expected := 52;
  else
    raise exception 'Versión de instrumento desconocida';
  end if;

  if jsonb_typeof(p_answers) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(p_answers)) <> expected then
    raise exception 'Respuestas incompletas';
  end if;

  -- CASE garantiza el orden: solo convierte la clave a número si es numérica
  if exists (
    select 1 from jsonb_each(p_answers) e
    where case
      when e.key ~ '^[0-9]{1,2}$' and e.value::text ~ '^[1-5]$' then e.key::integer not between 1 and expected
      else true
    end
  ) then
    raise exception 'Respuestas inválidas';
  end if;

  insert into self_regulation_responses (user_id, instrument_version, answers)
  values (auth.uid(), p_version, p_answers)
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.submit_self_regulation(text, jsonb) from public, anon;
grant execute on function public.submit_self_regulation(text, jsonb) to authenticated;

-- Resumen de la clase para el docente dueño de la asignatura: respuesta más reciente de cada estudiante inscrito,
-- solo agregados. Con menos de 5 respuestas devuelve únicamente cuántas hay (para no identificar a nadie).
-- El reparto ítem → escala y los tramos (< 2,5 / 2,5–3,5 / > 3,5, provisionales) son los de lib/self-regulation.ts.
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
  knowledge_ids integer[] := array[5, 10, 12, 16, 17, 20, 32, 46, 3, 14, 27, 33, 15, 18, 26, 29, 35];
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
    select
      l.user_id,
      avg(v.value::text::numeric) filter (where v.key::integer = any (knowledge_ids)) as kn,
      avg(v.value::text::numeric) filter (where not (v.key::integer = any (knowledge_ids))) as reg
    from latest l, jsonb_each(l.answers) v
    group by l.user_id
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

revoke execute on function public.self_regulation_class_summary(uuid) from public, anon;
grant execute on function public.self_regulation_class_summary(uuid) to authenticated;
