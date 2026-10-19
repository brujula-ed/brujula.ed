-- Los estudiantes inscritos podían descargar los documentos originales que sube el docente.
-- Ninguna pantalla lo usa: solo el docente dueño de la asignatura debe ver sus archivos.
drop policy if exists "Estudiantes inscritos ven documentos de su asignatura" on storage.objects;
