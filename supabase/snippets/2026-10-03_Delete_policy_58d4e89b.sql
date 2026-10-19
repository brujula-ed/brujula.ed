-- Snippet: Delete policy
-- id: 58d4e89b-c68c-454f-a364-07c9e656edeb
-- creado: 2026-10-03T04:20:22.319415+00:00 | actualizado: 2026-10-03T04:20:30.01+00:00

create policy "Docentes eliminan sus propias asignaturas"
  on subjects for delete
  using (auth.uid() = teacher_id);