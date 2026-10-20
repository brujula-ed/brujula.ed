-- 1) Limpieza: intentos hechos con el banco de demostración (preguntas q1 a q6 de lib/data.ts).
-- No son evidencia real del estudiante y cuentan como "completó el diagnóstico" en el reporte.
-- Desde el cambio del punto 8 la demostración ya no se guarda; esto borra lo que quedó de antes.
-- Las respuestas se borran en cascada con su intento.
delete from public.diagnostic_attempts
where id in (
  select attempt_id
  from public.diagnostic_answers
  where question_id in ('q1', 'q2', 'q3', 'q4', 'q5', 'q6')
);

-- 2) Una sola respuesta por intento, pregunta y etapa (evita duplicados por doble clic).
-- El índice que crea la restricción empieza por attempt_id, que es por donde filtran el reporte y la RLS.
alter table public.diagnostic_answers
  add constraint diagnostic_answers_attempt_question_stage_key unique (attempt_id, question_id, stage);
