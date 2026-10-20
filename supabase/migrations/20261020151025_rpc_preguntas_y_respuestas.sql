-- M1 (aditiva): el estudiante deja de necesitar acceso directo a "questions" y a insertar en "diagnostic_answers".
-- Estas funciones todavía no las usa nadie; las políticas de acceso directo se borran en una migración posterior,
-- cuando el código nuevo ya esté desplegado.

-- 1) Preguntas validadas de una asignatura, SIN la respuesta correcta.
--    Incluye cuántas veces y cuándo respondió cada una el estudiante, para preferir las nunca respondidas.
create or replace function public.get_diagnostic_questions(p_subject_id uuid)
returns table (
  id uuid,
  concept_id uuid,
  concept_name text,
  concept_description text,
  prompt text,
  options jsonb,
  times_answered integer,
  last_answered_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.id,
    q.concept_id,
    c.name,
    c.description,
    q.prompt,
    q.options,
    coalesce(h.times_answered, 0)::integer,
    h.last_answered_at
  from questions q
  join concepts c on c.id = q.concept_id
  left join (
    select a.question_id, count(*) as times_answered, max(a.created_at) as last_answered_at
    from diagnostic_answers a
    join diagnostic_attempts t on t.id = a.attempt_id
    where t.user_id = auth.uid()
    group by a.question_id
  ) h on h.question_id = q.id::text
  where q.subject_id = p_subject_id
    and q.status = 'validado'
    and c.status = 'validado'
    and (is_enrolled(p_subject_id) or is_subject_owner(p_subject_id));
$$;

-- 2) Guarda una respuesta y decide en la base de datos si es correcta. Devuelve true/false.
--    Si la misma respuesta llega dos veces (reintento), no duplica: devuelve lo ya guardado.
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

  if p_stage not in ('diagnostico', 'microevaluacion') then
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

  -- La microevaluación mide con preguntas nuevas: no puede repetir una del diagnóstico del mismo intento
  if p_stage = 'microevaluacion' and exists (
    select 1 from diagnostic_answers
    where attempt_id = p_attempt_id and question_id = p_question_id::text and stage = 'diagnostico'
  ) then
    raise exception 'La microevaluación debe usar preguntas no vistas en el diagnóstico';
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

revoke execute on function public.get_diagnostic_questions(uuid) from public, anon;
grant execute on function public.get_diagnostic_questions(uuid) to authenticated;

revoke execute on function public.submit_answer(uuid, uuid, text, integer) from public, anon;
grant execute on function public.submit_answer(uuid, uuid, text, integer) to authenticated;
