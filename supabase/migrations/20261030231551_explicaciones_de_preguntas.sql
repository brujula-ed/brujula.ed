-- Explicación por opción de cada pregunta (motor de conocimiento, fase 1, docs/MOTOR-DE-CONOCIMIENTO.md 4.4 y 4.5):
-- en la correcta, por qué lo es; en las incorrectas, qué error conceptual lleva a elegirla. Mismo orden que options.
-- La IA la propone y el docente la valida en bloque con la pregunta.
-- Los estudiantes no la ven: no leen questions directamente y get_diagnostic_questions elige sus columnas una por una.
-- Vacía en preguntas creadas antes de este cambio o a mano.

alter table public.questions
  add column explanations jsonb
    check (
      explanations is null
      or (jsonb_typeof(explanations) = 'array' and jsonb_array_length(explanations) = jsonb_array_length(options))
    );
