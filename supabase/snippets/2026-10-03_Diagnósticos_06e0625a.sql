-- Snippet: Diagnósticos
-- id: 06e0625a-2aa0-4543-bb0a-4f09b84e1010
-- creado: 2026-10-03T01:48:47.607102+00:00 | actualizado: 2026-10-03T03:50:16.256+00:00

create table diagnostic_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  subject text not null,
  topic text not null,
  created_at timestamp with time zone default now()
);

create table diagnostic_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references diagnostic_attempts on delete cascade not null,
  stage text not null check (stage in ('diagnostico', 'microevaluacion')),
  question_id text not null,
  concept text not null,
  selected_index int not null,
  correct_index int not null,
  is_correct boolean not null,
  created_at timestamp with time zone default now()
);

alter table diagnostic_attempts enable row level security;
alter table diagnostic_answers enable row level security;

create policy "Los usuarios ven sus propios intentos"
  on diagnostic_attempts for select
  using (auth.uid() = user_id);

create policy "Los usuarios crean sus propios intentos"
  on diagnostic_attempts for insert
  with check (auth.uid() = user_id);

create policy "Los usuarios ven sus propias respuestas"
  on diagnostic_answers for select
  using (exists (select 1 from diagnostic_attempts where id = attempt_id and user_id = auth.uid()));

create policy "Los usuarios crean sus propias respuestas"
  on diagnostic_answers for insert
  with check (exists (select 1 from diagnostic_attempts where id = attempt_id and user_id = auth.uid()));