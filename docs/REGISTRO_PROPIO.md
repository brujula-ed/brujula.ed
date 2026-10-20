# Registro de componentes propios

Fecha de levantamiento: 2026-10-19.

Alcance: módulos y algoritmos desarrollados para Brújula.ed. Los autores y la evidencia se tomaron
del historial de git del repositorio (`git log --follow` por archivo). Al momento del levantamiento
el historial tiene 21 commits, desde `cd96d1f` (2026-09-29, «Initial commit»), y un único autor
registrado: Sergio Ríos <sergioriosu@gmail.com>.

En "Evidencia" se indica, por archivo, el primer commit que lo incluye (hash, fecha y mensaje) y el
número de commits que lo han modificado.

| ID | Componente | Ubicación en el proyecto | Autor o autores | Evidencia |
|---|---|---|---|---|
| P-001 | Cálculo de estados de aprendizaje por concepto (`sin_evidencia`, `brecha`, `en_desarrollo`, `dominado`; umbral de dominio 0.7) | `lib/concept-state.ts` | Sergio Ríos | `6577c3e` (2026-10-13, «Mapa interactivo con prioridades + error de pdf parse atendido»); 1 commit. |
| P-002 | Algoritmo del grafo de conocimiento: dependientes de cada concepto, brecha prioritaria y próximo desafío | `lib/knowledge-graph.ts` | Sergio Ríos | `6577c3e` (2026-10-13, «Mapa interactivo con prioridades + error de pdf parse atendido»); 1 commit. |
| P-003 | Cálculo del LRR (Learning Recovery Rate) por estudiante, concepto y clase | `lib/lrr.ts` | Sergio Ríos | `49a4dd0` (2026-10-15, «Reporte visual del LRR en docente y estudiante»); 1 commit. |
| P-004 | Mapa de conocimiento interactivo (nodos por estado, disposición automática del grafo) | `components/knowledge-map.tsx` | Sergio Ríos | `d474d72` (2026-10-13, «Mapa de conocimiento interactivo»); 2 commits. |
| P-005 | Vista "Mi Brújula" del estudiante: mapa, brecha prioritaria, próximo desafío y LRR | `app/estudiante/[subjectId]/page.tsx`, `components/next-steps.tsx`, `components/lrr-card.tsx` | Sergio Ríos | `page.tsx`: `d474d72` (2026-10-13, «Mapa de conocimiento interactivo»), 3 commits; `next-steps.tsx`: `6577c3e` (2026-10-13), 1 commit; `lrr-card.tsx`: `49a4dd0` (2026-10-15), 2 commits. |
| P-006 | Flujo de diagnóstico y microevaluación (mezcla de preguntas, registro de respuestas por etapa, cierre del intento) | `app/diagnostico/[subjectId]/page.tsx`, `app/diagnostico/layout.tsx` | Sergio Ríos | `page.tsx`: `d321b33` (2026-10-03, «CRUD básico + vinculación estudiante docente»), 7 commits; `layout.tsx`: `f20d1e4` (2026-10-02, «Persistencia de intentos/ respuestas + protección de rutas»), 1 commit. |
| P-007 | Ruta de procesamiento de documentos: extracción de texto, troceado y embeddings | `app/api/process-document/route.ts`, `components/process-document-button.tsx`, `components/upload-document-form.tsx` | Sergio Ríos | `route.ts`: `8dc8a8e` (2026-10-05, «Extracción de texto y troceado de documentos»), 3 commits; `process-document-button.tsx`: `8dc8a8e`, 1 commit; `upload-document-form.tsx`: `8dc8a8e`, 1 commit. |
| P-008 | Extracción de texto de PDF y .docx | `lib/extract-text.ts` | Sergio Ríos | `8dc8a8e` (2026-10-05, «Extracción de texto y troceado de documentos»); 2 commits. |
| P-009 | Troceado de texto con solapamiento (1500 caracteres, solapamiento de 200) | `lib/chunk-text.ts` | Sergio Ríos | `8dc8a8e` (2026-10-05, «Extracción de texto y troceado de documentos»); 1 commit. |
| P-010 | Ruta de generación de conceptos y prerrequisitos con IA (propuesta para validación docente) | `app/api/generate-concepts/route.ts`, `components/generate-concepts-button.tsx` | Sergio Ríos | `route.ts`: `25d4540` (2026-10-05, «Sugerencia de IA listo»), 3 commits; botón: `25d4540`, 2 commits. |
| P-011 | Ruta de generación de preguntas con IA (propuesta para validación docente) | `app/api/generate-questions/route.ts`, `components/generate-questions-button.tsx` | Sergio Ríos | `route.ts`: `c379bc4` (2026-10-05, «Preguntas generadas por IA»), 2 commits; botón: `c379bc4`, 3 commits. |
| P-012 | Flujo de validación docente de conceptos y preguntas | `app/docente/[subjectId]/conceptos/page.tsx`, `app/docente/[subjectId]/preguntas/page.tsx`, `components/concept-card.tsx`, `components/question-card.tsx` | Sergio Ríos | `conceptos/page.tsx`: `25d4540` (2026-10-05), 4 commits; `preguntas/page.tsx`: `c379bc4` (2026-10-05), 1 commit; `concept-card.tsx`: `25d4540`, 1 commit; `question-card.tsx`: `c379bc4`, 1 commit. |
| P-013 | Reporte del docente por clase y por estudiante | `app/docente/[subjectId]/reporte/page.tsx`, `app/docente/[subjectId]/reporte/[studentId]/page.tsx` | Sergio Ríos | Ambos: `aef9aac` (2026-10-13, «Reporte para el docente»), 2 commits cada uno. |
| P-014 | Gestión de asignaturas e inscripción por código de clase | `lib/class-code.ts`, `components/create-subject-form.tsx`, `components/join-subject-form.tsx`, `components/subject-card.tsx`, `components/delete-subject-button.tsx`, `app/docente/page.tsx`, `app/docente/[subjectId]/page.tsx`, `components/delete-document-button.tsx` | Sergio Ríos | `class-code.ts`, `join-subject-form.tsx`, `delete-subject-button.tsx`: `d321b33` (2026-10-03, «CRUD básico + vinculación estudiante docente»), 1 commit cada uno; `create-subject-form.tsx`: `d321b33`, 2 commits; `subject-card.tsx`: `d321b33`, 4 commits; `app/docente/page.tsx`: `b58f08d` (2026-09-30, «Auth ready, differienciates user type»), 3 commits; `app/docente/[subjectId]/page.tsx`: `8dc8a8e` (2026-10-05), 6 commits; `delete-document-button.tsx`: `b2e0fc8` (2026-10-15, «PDF Parse fix + minor fixes»), 1 commit. |
| P-015 | Autenticación, registro por rol y protección de rutas | `middleware.ts`, `app/login/page.tsx`, `app/registro/page.tsx`, `app/estudiante/page.tsx` | Sergio Ríos | `middleware.ts`: `ad151d3` (2026-09-29, «Dummy page ready»), 2 commits; `login/page.tsx`: `ad151d3`, 3 commits; `registro/page.tsx`: `ad151d3`, 2 commits; `app/estudiante/page.tsx`: `b58f08d` (2026-09-30), 5 commits. |
| P-016 | Esquema de base de datos, políticas RLS y funciones `security definer` | `supabase/migrations/20261019154359_remote_schema.sql`, `supabase/snippets/` | Sergio Ríos | `a8696d9` (2026-10-19, «Versión del esquema de Supabase»); 1 commit. Los SQL se escribieron antes en el SQL Editor de Supabase (snippets fechados entre 2026-09-30 y 2026-10-13); esas fechas provienen de Supabase, no de git. |
| P-017 | Datos de respaldo del diagnóstico (asignatura, preguntas y contenido de nivelación de ejemplo) | `lib/data.ts` | Sergio Ríos | `ad151d3` (2026-09-29, «Dummy page ready»); 1 commit. |

## Notas

- Git registra quién hizo cada commit, no cómo se escribió el código. Este registro no distingue
  entre código escrito a mano y código escrito con asistencia de herramientas.
- Quedan fuera de este registro, por no ser desarrollos originales:
  - `components/ui/`: componentes generados con la CLI de shadcn (ver `docs/REGISTRO_TERCEROS.md`, T-015).
  - `lib/supabase/client.ts` y `lib/supabase/server.ts`: inicialización de clientes según el patrón de `@supabase/ssr`.
  - `lib/utils.ts`: reexporta la función `cn` del paquete `cn`.
  - Archivos de configuración (`next.config.ts`, `supabase/config.toml`, etc.) y `app/layout.tsx`, `app/page.tsx`, `app/globals.css`.
- El número de commits de P-016 es 1 porque el esquema se incorporó al repositorio en un solo commit;
  su historia previa está en Supabase.
