-- Posibles duplicados que la IA confirmó (motor de conocimiento, fase 2, docs/MOTOR-DE-CONOCIMIENTO.md 4.3).
-- Calibración del 31/10/2026: con conceptos de una misma disciplina, el parecido por embeddings no separa duplicados de
-- conceptos relacionados (la pareja duplicada dio 0,738 y parejas distintas 0,73). Por eso los embeddings eligen las
-- parejas más parecidas y la IA juzga cuáles son el mismo concepto. Se guardan para no llamar a la IA al abrir la página.
-- El docente decide: descarta o edita uno, o marca "No son el mismo" (concept_pair_dismissals).

create table public.concept_duplicate_candidates (
  concept_a uuid not null references public.concepts(id) on delete cascade,
  concept_b uuid not null references public.concepts(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  reason text not null check (char_length(reason) <= 300),
  similarity double precision not null,
  created_at timestamptz not null default now(),
  primary key (concept_a, concept_b),
  check (concept_a < concept_b)
);

create index concept_duplicate_candidates_subject_id_idx on public.concept_duplicate_candidates (subject_id);

-- La asignatura sale de los conceptos (los dos de la misma), igual que en concept_pair_dismissals
create trigger concept_duplicate_candidates_set_subject
  before insert on public.concept_duplicate_candidates
  for each row execute function public.set_pair_dismissal_subject();

alter table public.concept_duplicate_candidates enable row level security;

create policy "Docentes ven sus posibles duplicados" on public.concept_duplicate_candidates
  for select to authenticated using (public.is_subject_owner(subject_id));
create policy "Docentes guardan posibles duplicados" on public.concept_duplicate_candidates
  for insert to authenticated with check (public.is_subject_owner(subject_id));
create policy "Docentes borran posibles duplicados" on public.concept_duplicate_candidates
  for delete to authenticated using (public.is_subject_owner(subject_id));
