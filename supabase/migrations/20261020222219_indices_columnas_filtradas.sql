-- Índices en las columnas por las que filtran las pantallas, las RPC y las políticas RLS.
-- Sin ellos cada consulta recorre la tabla entera: hoy no se nota, en el piloto sí.
-- Solo añade índices: no cambia datos ni comportamiento. Ya existían (y no se repiten aquí):
-- concepts (subject_id, nombre), diagnostic_answers (attempt_id, ...) y diagnostic_answers (concept_id).

-- Intentos: el estudiante y la RLS filtran por user_id (+ subject_id); el reporte del docente por subject_id
create index if not exists diagnostic_attempts_user_id_subject_id_idx on public.diagnostic_attempts (user_id, subject_id);
create index if not exists diagnostic_attempts_subject_id_idx on public.diagnostic_attempts (subject_id);

-- Preguntas: todas las pantallas filtran por asignatura; las RPC y los borrados en cascada usan concept_id
create index if not exists questions_subject_id_idx on public.questions (subject_id);
create index if not exists questions_concept_id_idx on public.questions (concept_id);

-- Fragmentos: generar conceptos y la RLS filtran por asignatura; reprocesar y borrar un documento, por document_id
create index if not exists document_chunks_subject_id_idx on public.document_chunks (subject_id);
create index if not exists document_chunks_document_id_idx on public.document_chunks (document_id);

-- Documentos de una asignatura
create index if not exists subject_documents_subject_id_idx on public.subject_documents (subject_id);

-- Inscritos de una asignatura (reporte del docente). Por estudiante ya lo cubre (student_id, subject_id)
create index if not exists enrollments_subject_id_idx on public.enrollments (subject_id);

-- Asignaturas de un docente
create index if not exists subjects_teacher_id_idx on public.subjects (teacher_id);
