-- Snippet: Untitled query
-- id: dd758e54-c923-4271-8d99-35a70bd57702
-- creado: 2026-10-03T05:12:41.418323+00:00 | actualizado: 2026-10-03T05:12:41.418323+00:00

create policy "Docentes actualizan sus propias asignaturas"
  on subjects for update
  using (auth.uid() = teacher_id);