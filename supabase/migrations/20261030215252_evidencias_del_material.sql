-- Citas del material que respaldan cada concepto (motor de conocimiento, fase 1, docs/MOTOR-DE-CONOCIMIENTO.md 4.2):
-- "Fuente en el material · pág. 12". La IA elige la cita; el código y esta tabla comprueban que exista tal cual en
-- el fragmento. question_id queda vacío por ahora: servirá para las citas de cada pregunta (paso 2d).

create table public.evidence_spans (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references public.concepts(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  -- Si se reprocesa el documento, sus fragmentos se reemplazan y estas citas se borran: hay que volver a buscarlas
  chunk_id uuid not null references public.document_chunks(id) on delete cascade,
  document_id uuid not null references public.subject_documents(id) on delete cascade,
  quote text not null check (char_length(quote) between 20 and 400),
  page_start integer,
  page_end integer,
  section text,
  created_at timestamptz not null default now()
);

create index evidence_spans_concept_id_idx on public.evidence_spans (concept_id);
create index evidence_spans_subject_id_idx on public.evidence_spans (subject_id);

-- Texto comparable: mismas comillas y guiones y espacios simples. Debe coincidir con normalizeForQuote en
-- lib/concept-evidence.ts (cambiarlos juntos).
create or replace function public.normalize_quote_text(t text)
returns text
language sql
immutable
set search_path = public
as $$
  select btrim(regexp_replace(translate(t, '“”«»‘’–—', '""""''''--'), '\s+', ' ', 'g'));
$$;

-- Completa y comprueba cada cita. Ignora lo que mande el navegador en subject_id, documento, páginas y sección:
-- salen del concepto y del fragmento, así que una cita no puede apuntar a otra asignatura ni a otra página.
create or replace function public.set_evidence_span_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ch record;
begin
  select c.subject_id into new.subject_id from concepts c where c.id = new.concept_id;

  select dc.subject_id, dc.document_id, dc.page_start, dc.page_end, dc.section, dc.content
    into ch
    from document_chunks dc
   where dc.id = new.chunk_id;
  if ch.subject_id is null or ch.subject_id is distinct from new.subject_id then
    raise exception 'El fragmento no pertenece a la asignatura del concepto';
  end if;

  if new.question_id is not null and not exists (
    select 1 from questions q where q.id = new.question_id and q.concept_id = new.concept_id
  ) then
    raise exception 'La pregunta no pertenece al concepto';
  end if;

  if position(normalize_quote_text(new.quote) in normalize_quote_text(ch.content)) = 0 then
    raise exception 'La cita no aparece tal cual en el fragmento';
  end if;

  new.document_id := ch.document_id;
  new.page_start := ch.page_start;
  new.page_end := ch.page_end;
  new.section := ch.section;
  return new;
end;
$$;

create trigger evidence_spans_set_fields
  before insert or update on public.evidence_spans
  for each row execute function public.set_evidence_span_fields();

alter table public.evidence_spans enable row level security;

-- Solo el docente dueño de la asignatura. Los estudiantes no leen citas por ahora.
create policy "Docentes ven citas de sus asignaturas" on public.evidence_spans
  for select to authenticated
  using (public.is_subject_owner(subject_id));

create policy "Docentes crean citas en sus asignaturas" on public.evidence_spans
  for insert to authenticated
  with check (public.is_subject_owner(subject_id));

create policy "Docentes eliminan citas de sus asignaturas" on public.evidence_spans
  for delete to authenticated
  using (public.is_subject_owner(subject_id));
