-- Búsqueda híbrida en el material de una asignatura (motor de conocimiento, fase 1, docs/MOTOR-DE-CONOCIMIENTO.md 4.2).
-- Une dos búsquedas y fusiona sus listas por posición (Reciprocal Rank Fusion, constante 60):
--   · por significado: distancia coseno entre embeddings (encuentra ideas aunque cambien las palabras);
--   · por palabras: texto completo en español (encuentra términos exactos: nombres, fórmulas, siglas).
-- En la búsqueda por palabras basta con que aparezca una de las palabras de la consulta (OR), y el orden premia a
-- los fragmentos que tienen más.
-- security invoker: se aplica la RLS de document_chunks, así que solo el docente dueño de la asignatura obtiene
-- resultados (los estudiantes no leen fragmentos).

create or replace function public.search_chunks(
  p_subject_id uuid,
  p_query text,
  p_query_embedding text, -- vector como texto "[0.1,0.2,...]", igual que al guardar
  p_limit integer default 8
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  page_start integer,
  page_end integer,
  section text,
  "position" integer,
  score double precision
)
language sql
stable
security invoker
set search_path = public
as $$
  with q as (
    select
      p_query_embedding::vector as emb,
      -- plainto_tsquery une las palabras con AND; se cambia a OR para no exigir que estén todas
      nullif(replace(plainto_tsquery('spanish', p_query)::text, '&', '|'), '')::tsquery as words
  ),
  semantic as (
    select c.id, row_number() over (order by c.embedding <=> q.emb) as rank
    from document_chunks c, q
    where c.subject_id = p_subject_id and c.embedding is not null
    order by c.embedding <=> q.emb
    limit 40
  ),
  lexical as (
    select c.id, row_number() over (order by ts_rank_cd(c.content_tsv, q.words) desc) as rank
    from document_chunks c, q
    where c.subject_id = p_subject_id and q.words is not null and c.content_tsv @@ q.words
    order by ts_rank_cd(c.content_tsv, q.words) desc
    limit 40
  ),
  fused as (
    select coalesce(s.id, l.id) as id,
           coalesce(1.0 / (60 + s.rank), 0) + coalesce(1.0 / (60 + l.rank), 0) as score
    from semantic s
    full outer join lexical l on l.id = s.id
  )
  select c.id, c.document_id, c.content, c.page_start, c.page_end, c.section, c."position", f.score
  from fused f
  join document_chunks c on c.id = f.id
  order by f.score desc
  limit p_limit;
$$;

revoke execute on function public.search_chunks(uuid, text, text, integer) from public, anon;
grant execute on function public.search_chunks(uuid, text, text, integer) to authenticated;
