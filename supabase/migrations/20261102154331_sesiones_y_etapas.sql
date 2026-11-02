-- Fase 3 del motor, entrega 2 (docs/DISENO-DEL-ESTUDIANTE.md 3 y 4): práctica y comprobaciones.
-- Aditiva y compatible con el código desplegado: los intentos actuales quedan como kind = 'diagnostico' y
-- submit_answer sigue aceptando las etapas de hoy.

-- 1) Los intentos pasan a ser sesiones de trabajo: el diagnóstico de siempre, el de un tema o el trabajo sobre un
--    concepto (práctica y comprobaciones). Todas las respuestas siguen en diagnostic_answers: una sola fuente de evidencia.
alter table public.diagnostic_attempts
  add column kind text not null default 'diagnostico' check (kind in ('diagnostico', 'tema', 'concepto')),
  add column topic_id uuid references public.topics(id) on delete set null,
  add column concept_id uuid references public.concepts(id) on delete set null;

-- El tema y el concepto de una sesión deben ser de su misma asignatura (el estudiante crea sus propias sesiones)
create or replace function public.check_attempt_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.topic_id is not null and not exists (
    select 1 from topics where id = new.topic_id and subject_id = new.subject_id
  ) then
    raise exception 'El tema no es de esta asignatura';
  end if;
  if new.concept_id is not null and not exists (
    select 1 from concepts where id = new.concept_id and subject_id = new.subject_id
  ) then
    raise exception 'El concepto no es de esta asignatura';
  end if;
  return new;
end;
$$;

create trigger check_attempt_scope
  before insert or update of subject_id, topic_id, concept_id on public.diagnostic_attempts
  for each row execute function public.check_attempt_scope();

-- 2) Etapas nuevas. "practica" no cuenta como evidencia del estado (lib/concept-state.ts).
alter table public.diagnostic_answers drop constraint diagnostic_answers_stage_check;
alter table public.diagnostic_answers
  add constraint diagnostic_answers_stage_check
  check (stage in ('diagnostico', 'microevaluacion', 'comprobacion', 'comprobacion_diferida', 'practica'));

-- 3) submit_answer acepta las etapas que miden. La práctica tiene su propia función (devuelve la explicación).
create or replace function public.submit_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_stage text,
  p_selected_index integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt diagnostic_attempts%rowtype;
  v_question questions%rowtype;
  v_concept_name text;
  v_is_correct boolean;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if p_stage not in ('diagnostico', 'microevaluacion', 'comprobacion', 'comprobacion_diferida') then
    raise exception 'Etapa no válida';
  end if;

  select * into v_attempt
  from diagnostic_attempts
  where id = p_attempt_id and user_id = auth.uid();
  if not found then
    raise exception 'Intento no válido';
  end if;

  -- Sin esto, cualquiera podría crear un intento en otra asignatura y usar la función para descubrir respuestas
  if not (is_enrolled(v_attempt.subject_id) or is_subject_owner(v_attempt.subject_id)) then
    raise exception 'No estás inscrito en esta asignatura';
  end if;

  select * into v_question
  from questions
  where id = p_question_id and subject_id = v_attempt.subject_id and status = 'validado';
  if not found then
    raise exception 'Pregunta no válida';
  end if;

  if p_selected_index < 0 or p_selected_index >= jsonb_array_length(v_question.options) then
    raise exception 'Opción no válida';
  end if;

  -- Las comprobaciones miden con preguntas nuevas: no pueden repetir una ya respondida en la misma sesión
  if p_stage <> 'diagnostico' and exists (
    select 1 from diagnostic_answers
    where attempt_id = p_attempt_id and question_id = p_question_id::text and stage <> p_stage
  ) then
    raise exception 'La comprobación debe usar preguntas no vistas en esta sesión';
  end if;

  -- La comprobación diferida exige una comprobación del mismo concepto de al menos 2 días antes
  -- (docs/MOTOR-DE-CONOCIMIENTO.md, decisión 3). Que la haya superado lo decide lib/concept-state.ts.
  if p_stage = 'comprobacion_diferida' and not exists (
    select 1
    from diagnostic_answers a
    join diagnostic_attempts t on t.id = a.attempt_id
    where t.user_id = auth.uid()
      and a.concept_id = v_question.concept_id
      and a.stage in ('comprobacion', 'microevaluacion')
      and a.created_at <= now() - interval '2 days'
  ) then
    raise exception 'La comprobación diferida se habilita 2 días después de la primera comprobación';
  end if;

  select name into v_concept_name from concepts where id = v_question.concept_id;
  v_is_correct := p_selected_index = v_question.correct_index;

  -- concept_id lo rellena el trigger set_answer_concept_id
  insert into diagnostic_answers (attempt_id, stage, question_id, concept, selected_index, correct_index, is_correct)
  values (p_attempt_id, p_stage, p_question_id::text, v_concept_name, p_selected_index, v_question.correct_index, v_is_correct)
  on conflict (attempt_id, question_id, stage) do nothing;

  select a.is_correct into v_is_correct
  from diagnostic_answers a
  where a.attempt_id = p_attempt_id and a.question_id = p_question_id::text and a.stage = p_stage;

  return v_is_correct;
end;
$$;

-- 4) Práctica: corrige y devuelve la explicación de la opción elegida y la de la correcta. Solo con preguntas que el
--    estudiante ya respondió en una medición, para no revelar la respuesta de las que aún pueden salir en una
--    comprobación.
create or replace function public.submit_practice_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_selected_index integer
)
returns table (
  is_correct boolean,
  correct_index integer,
  selected_explanation text,
  correct_explanation text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt diagnostic_attempts%rowtype;
  v_question questions%rowtype;
  v_concept_name text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select * into v_attempt
  from diagnostic_attempts
  where id = p_attempt_id and user_id = auth.uid();
  if not found then
    raise exception 'Intento no válido';
  end if;

  if not (is_enrolled(v_attempt.subject_id) or is_subject_owner(v_attempt.subject_id)) then
    raise exception 'No estás inscrito en esta asignatura';
  end if;

  select * into v_question
  from questions
  where id = p_question_id and subject_id = v_attempt.subject_id and status = 'validado';
  if not found then
    raise exception 'Pregunta no válida';
  end if;

  if p_selected_index < 0 or p_selected_index >= jsonb_array_length(v_question.options) then
    raise exception 'Opción no válida';
  end if;

  if not exists (
    select 1
    from diagnostic_answers a
    join diagnostic_attempts t on t.id = a.attempt_id
    where t.user_id = auth.uid()
      and a.question_id = p_question_id::text
      and a.stage <> 'practica'
  ) then
    raise exception 'Solo se practica con preguntas que ya respondiste';
  end if;

  select name into v_concept_name from concepts where id = v_question.concept_id;

  insert into diagnostic_answers (attempt_id, stage, question_id, concept, selected_index, correct_index, is_correct)
  values (p_attempt_id, 'practica', p_question_id::text, v_concept_name, p_selected_index, v_question.correct_index,
          p_selected_index = v_question.correct_index)
  on conflict (attempt_id, question_id, stage) do nothing;

  return query select
    p_selected_index = v_question.correct_index,
    v_question.correct_index,
    v_question.explanations ->> p_selected_index,
    v_question.explanations ->> v_question.correct_index;
end;
$$;

-- 5) Revisar las respuestas de una sesión terminada, con la respuesta correcta y la explicación de cada opción.
--    Solo las del propio estudiante y solo de etapas que miden (la práctica ya mostró su explicación).
create or replace function public.get_answer_review(p_attempt_id uuid)
returns table (
  question_id uuid,
  concept_id uuid,
  stage text,
  prompt text,
  options jsonb,
  selected_index integer,
  correct_index integer,
  is_correct boolean,
  explanations jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q.concept_id, a.stage, q.prompt, q.options, a.selected_index, a.correct_index, a.is_correct, q.explanations
  from diagnostic_attempts t
  join diagnostic_answers a on a.attempt_id = t.id and a.stage <> 'practica'
  join questions q on q.id::text = a.question_id
  where t.id = p_attempt_id
    and t.user_id = auth.uid()
    and t.completed_at is not null
  order by a.created_at;
$$;

revoke execute on function public.submit_practice_answer(uuid, uuid, integer) from public, anon;
grant execute on function public.submit_practice_answer(uuid, uuid, integer) to authenticated;

revoke execute on function public.get_answer_review(uuid) from public, anon;
grant execute on function public.get_answer_review(uuid) to authenticated;
