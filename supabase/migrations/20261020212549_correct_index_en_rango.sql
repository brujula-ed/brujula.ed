-- Defensa en la base de datos: una pregunta solo se guarda si sus opciones son una lista y correct_index
-- apunta a una opción que existe. Complementa la validación con zod de generate-questions y protege también
-- las ediciones del docente. Antes de crearla se comprobó que ninguna de las 121 preguntas la incumple.
-- Se usa CASE porque Postgres no garantiza el orden de evaluación de un AND: así jsonb_array_length
-- solo se calcula cuando options ya es una lista.
alter table public.questions
  add constraint questions_correct_index_en_rango check (
    case
      when jsonb_typeof(options) = 'array'
        then correct_index >= 0 and correct_index < jsonb_array_length(options)
      else false
    end
  );
