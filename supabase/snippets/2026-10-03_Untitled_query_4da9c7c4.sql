-- Snippet: Untitled query
-- id: 4da9c7c4-b46e-49ca-a216-02cac00186d6
-- creado: 2026-10-03T04:16:18.289337+00:00 | actualizado: 2026-10-03T04:16:18.289337+00:00

-- Quitamos las políticas que causan el ciclo
drop policy if exists "Estudiantes inscritos ven la asignatura" on subjects;
drop policy if exists "Docentes ven inscripciones de sus asignaturas" on enrollments;

-- Funciones que verifican sin disparar RLS de nuevo
create or replace function public.is_enrolled(target_subject_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from enrollments
    where subject_id = target_subject_id and student_id = auth.uid()
  );
$$;

create or replace function public.is_subject_owner(target_subject_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from subjects
    where id = target_subject_id and teacher_id = auth.uid()
  );
$$;

-- Recreamos las políticas usando las funciones, sin el ciclo
create policy "Estudiantes inscritos ven la asignatura"
  on subjects for select
  using (public.is_enrolled(id));

create policy "Docentes ven inscripciones de sus asignaturas"
  on enrollments for select
  using (public.is_subject_owner(subject_id));