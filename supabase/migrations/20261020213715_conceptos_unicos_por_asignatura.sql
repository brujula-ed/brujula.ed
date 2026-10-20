-- Un concepto por nombre en cada asignatura (sin distinguir mayúsculas ni espacios en los extremos).
-- Antes de crear la regla se limpian los duplicados existentes. Al escribir esta migración había 2, ambos en la
-- misma asignatura: en cada par, un concepto validado con 4 preguntas y una copia sugerida sin preguntas ni respuestas.
-- Todo va en un único bloque DO: Postgres lo ejecuta como una sola sentencia, así que si algo falla
-- no queda nada aplicado a medias.
do $$
declare
  duplicados uuid[];
begin
  -- 1) Copias a borrar: sugeridas, con el mismo nombre que otro concepto de su asignatura,
  --    sin preguntas ni respuestas.
  select coalesce(array_agg(c.id), '{}') into duplicados
  from public.concepts c
  where c.status = 'sugerido'
    and exists (
      select 1 from public.concepts otro
      where otro.subject_id = c.subject_id
        and otro.id <> c.id
        and lower(trim(otro.name)) = lower(trim(c.name))
    )
    and not exists (select 1 from public.questions q where q.concept_id = c.id)
    and not exists (select 1 from public.diagnostic_answers a where a.concept_id = c.id);

  raise notice 'Conceptos duplicados a borrar: %', array_length(duplicados, 1);

  -- 2) Que nadie las siga teniendo como prerrequisito.
  update public.concepts
  set prerequisite_ids = array(select p from unnest(prerequisite_ids) as p where p <> all (duplicados))
  where prerequisite_ids && duplicados;

  delete from public.concepts where id = any (duplicados);

  -- 3) La regla. Si quedara algún duplicado que no cumple las condiciones de arriba, esto falla
  --    y el bloque entero se deshace.
  execute 'create unique index concepts_subject_name_unique on public.concepts (subject_id, lower(trim(name)))';
end
$$;
