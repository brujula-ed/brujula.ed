-- Snippet: Bucket policies
-- id: dc2c4723-6a11-4dec-9c23-d1928dcdb024
-- creado: 2026-10-05T03:10:05.698072+00:00 | actualizado: 2026-10-05T03:10:29.586+00:00

create policy "Docentes suben documentos a sus asignaturas"
  on storage.objects for insert
  with check (
    bucket_id = 'course-documents'
    and public.is_subject_owner((storage.foldername(name))[1]::uuid)
  );

create policy "Docentes ven documentos de sus asignaturas"
  on storage.objects for select
  using (
    bucket_id = 'course-documents'
    and public.is_subject_owner((storage.foldername(name))[1]::uuid)
  );

create policy "Estudiantes inscritos ven documentos de su asignatura"
  on storage.objects for select
  using (
    bucket_id = 'course-documents'
    and public.is_enrolled((storage.foldername(name))[1]::uuid)
  );