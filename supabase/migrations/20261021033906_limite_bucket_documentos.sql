-- Defensa final del bucket de documentos: máximo 10 MB y solo los tipos que el sistema sabe leer
-- (PDF y Word .docx, ver lib/extract-text.ts). Mismo límite que el formulario de subida y process-document.
-- Debe aplicarse DESPUÉS de desplegar el formulario que manda el tipo de archivo explícito: sin eso,
-- un .docx que el navegador no reconoce se subiría sin tipo y el bucket lo rechazaría.
update storage.buckets
set
  file_size_limit = 10485760, -- 10 MB en bytes
  allowed_mime_types = array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
where id = 'course-documents';
