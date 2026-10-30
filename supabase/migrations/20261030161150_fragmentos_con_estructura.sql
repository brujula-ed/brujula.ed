-- Fragmentos con estructura (motor de conocimiento, fase 1, docs/MOTOR-DE-CONOCIMIENTO.md 4.1): de qué página y
-- sección viene cada fragmento y en qué orden está, para citar la evidencia ("pág. 12") y buscar por palabras.
-- La tabla se vació el 30/10/2026, así que position puede ser obligatoria sin convertir datos.

alter table public.document_chunks
  add column page_start integer, -- vacío en Word (no tiene páginas)
  add column page_end integer,
  add column section text,       -- título más cercano, cuando se detecta (hoy solo en Word)
  add column position integer not null, -- orden dentro del documento: 0, 1, 2…
  -- Texto preparado para la búsqueda en español; Postgres lo calcula solo al guardar
  add column content_tsv tsvector generated always as (to_tsvector('spanish', content)) stored;

create index document_chunks_content_tsv_idx on public.document_chunks using gin (content_tsv);
create index document_chunks_document_id_position_idx on public.document_chunks (document_id, position);
