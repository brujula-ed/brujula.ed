-- Origen de cada ficha de concepto: "material" (sale del material del docente) o "general" (la IA completó con
-- conocimiento general de la disciplina porque el material no alcanzaba). El docente lo ve al validar, para
-- revisar con más cuidado las de conocimiento general. El estudiante no lo ve.
-- Las fichas que ya existen se generaron pidiendo usar solo el material: quedan como "material".
alter table public.concept_cards
  add column source text not null default 'material' check (source in ('material', 'general'));
