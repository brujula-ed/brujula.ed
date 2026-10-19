-- Snippet: Untitled query
-- id: 867b491d-8e47-4b0e-a6af-db84c41c1914
-- creado: 2026-10-03T05:12:44.441236+00:00 | actualizado: 2026-10-03T05:12:44.441236+00:00

create or replace function public.find_subject_id_by_code(input_code text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from subjects where class_code = input_code;
$$;