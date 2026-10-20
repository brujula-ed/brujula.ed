-- Las respuestas pasan a apuntar al concepto por id. Hasta ahora solo guardaban su nombre (columna "concept"),
-- y renombrar un concepto desconectaba todo su historial. "concept" se conserva como el nombre histórico.

-- 1) Columna nueva. Si se borra el concepto, la respuesta se conserva sin concepto (deja de contar, no se pierde).
alter table public.diagnostic_answers
  add column concept_id uuid references public.concepts(id) on delete set null;

create index diagnostic_answers_concept_id_idx on public.diagnostic_answers (concept_id);

-- 2) Relleno exacto: el concepto de la pregunta respondida (no depende del nombre).
--    question_id es text; se compara como texto para no fallar con valores que no sean uuid.
update public.diagnostic_answers a
set concept_id = q.concept_id
from public.questions q
where a.concept_id is null
  and q.id::text = a.question_id;

-- 3) Relleno por nombre para respuestas de preguntas ya descartadas, solo si en la asignatura
--    hay exactamente un concepto con ese nombre. Si hay cero o varios, queda sin concepto.
update public.diagnostic_answers a
set concept_id = c.id
from public.diagnostic_attempts t
join public.concepts c on c.subject_id = t.subject_id
where a.concept_id is null
  and t.id = a.attempt_id
  and c.name = a.concept
  and (
    select count(*) from public.concepts c2
    where c2.subject_id = t.subject_id and c2.name = a.concept
  ) = 1;

-- 4) Respuestas nuevas: la base de datos pone concept_id a partir de la pregunta.
--    Ignora lo que mande el navegador, así nadie puede asignar una respuesta a otro concepto.
create or replace function public.set_answer_concept_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select q.concept_id into new.concept_id
  from questions q
  where q.id::text = new.question_id;
  return new;
end;
$$;

create trigger diagnostic_answers_set_concept_id
  before insert on public.diagnostic_answers
  for each row execute function public.set_answer_concept_id();
