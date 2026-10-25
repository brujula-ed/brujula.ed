-- Ficha de concepto (F-05): por qué importa y una aplicación. La IA la propone y el docente la valida.
-- Va en una tabla aparte y no en columnas de "concepts": la RLS es por fila, así que un estudiante que puede leer
-- un concepto validado también leería su ficha sugerida. Aquí la ficha tiene su propio estado.

create table public.concept_cards (
  concept_id uuid primary key references public.concepts(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  why_it_matters text not null,
  application text not null,
  status text not null default 'sugerido' check (status in ('sugerido', 'validado')),
  created_at timestamptz not null default now()
);

create index concept_cards_subject_id_idx on public.concept_cards (subject_id);

-- La asignatura sale siempre del concepto. Ignora lo que mande el navegador, así nadie puede colgar
-- una ficha de un concepto de otra asignatura. Si el concepto no existe, subject_id queda null y el insert falla.
create or replace function public.set_concept_card_subject_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select c.subject_id into new.subject_id
  from concepts c
  where c.id = new.concept_id;
  return new;
end;
$$;

create trigger concept_cards_set_subject_id
  before insert or update on public.concept_cards
  for each row execute function public.set_concept_card_subject_id();

alter table public.concept_cards enable row level security;

create policy "Docentes ven fichas de sus asignaturas" on public.concept_cards
  for select to authenticated
  using (public.is_subject_owner(subject_id));

create policy "Docentes crean fichas en sus asignaturas" on public.concept_cards
  for insert to authenticated
  with check (public.is_subject_owner(subject_id));

create policy "Docentes actualizan fichas de sus asignaturas" on public.concept_cards
  for update to authenticated
  using (public.is_subject_owner(subject_id))
  with check (public.is_subject_owner(subject_id));

create policy "Docentes eliminan fichas de sus asignaturas" on public.concept_cards
  for delete to authenticated
  using (public.is_subject_owner(subject_id));

-- El estudiante solo ve fichas validadas de conceptos validados de asignaturas en las que está inscrito.
create policy "Estudiantes inscritos ven fichas validadas" on public.concept_cards
  for select to authenticated
  using (
    status = 'validado'
    and public.is_enrolled(subject_id)
    and exists (
      select 1 from public.concepts c
      where c.id = concept_id and c.status = 'validado'
    )
  );
