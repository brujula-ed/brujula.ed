-- Corrige unidades_y_temas: una sola función revisaba conceptos y temas, y PL/pgSQL resuelve new.topic_id aunque el
-- disparador sea de topics (que no tiene esa columna), así que crear un tema fallaba. Ahora es una función por tabla.

drop trigger concepts_check_topic on public.concepts;
drop trigger topics_check_unit on public.topics;
drop function public.check_same_subject_topic();

-- Un concepto solo puede ir en un tema de su misma asignatura
create or replace function public.check_concept_topic_subject()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.topic_id is not null and not exists (
    select 1 from topics t where t.id = new.topic_id and t.subject_id = new.subject_id
  ) then
    raise exception 'El tema no pertenece a la asignatura del concepto';
  end if;
  return new;
end;
$$;

-- Un tema solo puede ir en una unidad de su misma asignatura
create or replace function public.check_topic_unit_subject()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.unit_id is not null and not exists (
    select 1 from units u where u.id = new.unit_id and u.subject_id = new.subject_id
  ) then
    raise exception 'La unidad no pertenece a la asignatura del tema';
  end if;
  return new;
end;
$$;

create trigger concepts_check_topic
  before insert or update of topic_id, subject_id on public.concepts
  for each row execute function public.check_concept_topic_subject();

create trigger topics_check_unit
  before insert or update of unit_id, subject_id on public.topics
  for each row execute function public.check_topic_unit_subject();
