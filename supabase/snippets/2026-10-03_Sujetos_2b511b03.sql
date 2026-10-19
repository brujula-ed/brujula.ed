-- Snippet: Sujetos
-- id: 2b511b03-e8a2-4127-acce-5a087cd40db2
-- creado: 2026-10-03T03:16:03.225054+00:00 | actualizado: 2026-10-03T03:50:11.631+00:00

create table subjects (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references auth.users on delete cascade not null,
  name text not null,
  topic text not null,
  class_code text unique not null,
  created_at timestamp with time zone default now()
);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references auth.users on delete cascade not null,
  subject_id uuid references subjects on delete cascade not null,
  created_at timestamp with time zone default now(),
  unique(student_id, subject_id)
);

alter table diagnostic_attempts add column subject_id uuid references subjects on delete cascade;

alter table subjects enable row level security;
alter table enrollments enable row level security;

create policy "Docentes ven sus propias asignaturas"
  on subjects for select
  using (auth.uid() = teacher_id);

create policy "Docentes crean sus propias asignaturas"
  on subjects for insert
  with check (auth.uid() = teacher_id);

create policy "Estudiantes inscritos ven la asignatura"
  on subjects for select
  using (exists (select 1 from enrollments where subject_id = subjects.id and student_id = auth.uid()));

create policy "Estudiantes ven sus propias inscripciones"
  on enrollments for select
  using (auth.uid() = student_id);

create policy "Estudiantes se inscriben ellos mismos"
  on enrollments for insert
  with check (auth.uid() = student_id);

create policy "Docentes ven inscripciones de sus asignaturas"
  on enrollments for select
  using (exists (select 1 from subjects where id = subject_id and teacher_id = auth.uid()));