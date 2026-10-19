-- Snippet: Untitled query
-- id: 914395c3-a3f8-4412-8973-c7f16cb6dc52
-- creado: 2026-10-13T20:40:00.313119+00:00 | actualizado: 2026-10-13T20:40:00.313119+00:00

alter table diagnostic_attempts add column completed_at timestamp with time zone;

create policy "Los usuarios actualizan sus propios intentos"
  on diagnostic_attempts for update
  using (auth.uid() = user_id);

-- Datos de prueba existentes: se consideran completados si tienen respuestas de diagnóstico
update diagnostic_attempts a
set completed_at = a.created_at
where completed_at is null
  and exists (
    select 1 from diagnostic_answers d
    where d.attempt_id = a.id and d.stage = 'diagnostico'
  );