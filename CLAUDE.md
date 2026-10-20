@AGENTS.md

# BRÚJULA.ED — contexto para Claude Code

## Qué es
Aplicación web de apoyo al aprendizaje. El docente sube material de su curso; la IA **propone**
conceptos, prerrequisitos y preguntas; el docente **valida**. El estudiante hace un diagnóstico que
detecta brechas de conocimiento, ve un mapa de conocimiento y recibe un siguiente paso sugerido.

## Principios (no negociables)
- **La IA propone, el docente valida.** Nada generado por IA llega al estudiante sin validación.
- Los estados de aprendizaje son **orientativos**: no son diagnósticos clínicos ni calificaciones.
- Preferir métodos con evidencia (autorregulación del aprendizaje, recuperación activa). No usar "estilos de aprendizaje".
- Ludificar el cierre de brechas, nunca métricas de vanidad.
- No crear contenido pedagógico propio: solo recursos abiertos curados.
- La lógica de estados, prioridades y métricas es **determinista (sin IA)** y trazable hasta las respuestas.
- Métrica principal del MVP: **LRR (Learning Recovery Rate)** = brechas recuperadas / brechas identificadas.

## Cómo trabajamos (importante)
- Quien desarrolla es una sola persona, a medio tiempo, y quiere **entender** cada cambio.
- Antes de editar: explica qué vas a cambiar, en qué archivo y por qué. Después, muestra el diff.
- Cambios pequeños: un archivo o una función por vez. No refactorices por tu cuenta.
- **No tomes decisiones de arquitectura sin consultar.** Propón alternativas con su costo.
- Antes de dar algo por terminado, corre `npm run build` y `npm run lint`. Un push con build roto deja
  viva la versión anterior en Vercel sin avisar.
- Si algo es una suposición, dilo. No inventes nombres de tablas ni columnas: léelos del código o de `supabase/migrations/`.
- Cambios de esquema: migración nueva con `npx supabase migration new <nombre>`, ensayo con
  `npx supabase db push --dry-run` y push real **solo con confirmación explícita** (no hay entorno de
  desarrollo: cada push cambia producción).
- Idioma: español. Textos de la interfaz en español claro, tuteo.

## Stack
- Next.js 16 (App Router, Turbopack), TypeScript, Tailwind, shadcn/ui.
- Supabase: Auth, Postgres con RLS, Storage (bucket privado), pgvector.
- OpenAI: embeddings `text-embedding-3-small` (1536); generación con salida `json_object`.
- React Flow (`@xyflow/react`) + `@dagrejs/dagre` para el mapa de conocimiento.
- Despliegue: GitHub → Vercel. Las variables de entorno deben existir también en Vercel.
- Extracción de texto: `pdf-parse` v2 (imports perezosos + `serverExternalPackages` en `next.config.ts`) y `mammoth` para .docx.

## Estructura (verificar contra el repo)
- `app/page.tsx` redirige según el rol; `app/login` y `app/registro` para la autenticación.
- `app/docente/page.tsx` lista y creación de asignaturas.
- `app/docente/[subjectId]/page.tsx` documentos de la asignatura (subir, procesar, eliminar) y accesos a lo demás.
- `app/docente/[subjectId]/conceptos`, `/preguntas`, `/reporte` y `/reporte/[studentId]`: validación y reportes.
- `app/estudiante/page.tsx` asignaturas del estudiante (unirse con código de clase).
- `app/estudiante/[subjectId]` "Mi Brújula": mapa, brecha prioritaria, próximo desafío, LRR.
- `app/diagnostico/[subjectId]/page.tsx` diagnóstico, nivelación y microevaluación en una sola página (por etapas).
- `app/api/` `process-document`, `generate-concepts`, `generate-questions` (server-side).
- `components/` componentes propios; `components/ui/` los de shadcn.
- `lib/concept-state.ts` estados por concepto (umbral de dominio 0.7).
- `lib/knowledge-graph.ts` dependientes, brecha prioritaria, próximo desafío.
- `lib/lrr.ts` cálculo del LRR (por estudiante, concepto y clase).
- `lib/extract-text.ts`, `lib/chunk-text.ts` extracción y fragmentación de documentos.
- `lib/data.ts` banco de preguntas de demostración; `lib/class-code.ts` códigos de clase.
- `lib/supabase/` clientes de servidor y cliente.
- `middleware.ts` refresca la sesión de Supabase (en Next 16 la convención se llama `proxy`).
- `supabase/migrations/` esquema y políticas RLS (fuente de verdad); `supabase/snippets/` historial de consultas.

## Datos
Esquema completo en `supabase/migrations/` (cada cambio de esquema va como migración nueva).
Tablas principales: `profiles` (rol), `subjects` (con código de clase), `enrollments`, `subject_documents`,
`document_chunks` (con embedding), `concepts` (`prerequisite_ids`, `status`), `questions` (`status`),
`diagnostic_attempts` (`completed_at`), `diagnostic_answers` (`stage`: `diagnostico` | `microevaluacion`,
`concept`, `is_correct`).
- Solo se usan conceptos y preguntas con `status = 'validado'`.
- Seguridad: RLS en todas las tablas. Para evitar recursión usar funciones `security definer` con `set search_path = public`.
- Las respuestas se vinculan al concepto por **`concept_id`**, que un trigger rellena desde la pregunta (no lo
  manda el navegador). La columna `concept` guarda el nombre que tenía al responder, solo como historial.
  Estados y LRR emparejan siempre por id, así que renombrar un concepto no rompe su historial.

## Reglas de negocio ya implementadas
- Estados: `sin_evidencia`, `brecha`, `en_desarrollo`, `dominado`. Dominado si exactitud ≥ 0.7.
- LRR: brecha = concepto < 0.7 en el **primer** diagnóstico; recuperada = la evidencia **más reciente**
  posterior (microevaluación, o diagnóstico de un intento posterior) ≥ 0.7; las pendientes cuentan en el
  denominador. Los criterios se afinarán en el piloto.
- Selección de preguntas (`lib/question-selection.ts`, provisional): diagnóstico con la mitad de las validadas
  de cada concepto (máx. 2; 1 si solo hay una); microevaluación con hasta 2 no vistas en el intento; se
  prefieren las nunca respondidas. Sin preguntas nuevas, la brecha queda pendiente. La IA genera 4 por concepto.
- Los estudiantes no leen `questions` ni insertan respuestas directamente: usan las RPC
  `get_diagnostic_questions` (sin `correct_index`) y `submit_answer` (corrige en la base de datos).
- Las opciones de las preguntas se mezclan en código (la IA tendía a poner la correcta primera).

## Trampas conocidas
- Entorno Windows/PowerShell: borrar `.next` con `Remove-Item -Recurse -Force .next`.
- PDFs escaneados (sin texto) no generan conceptos: devolver mensaje claro; el OCR es trabajo futuro.
- Tras cambiar el esquema de Supabase: `NOTIFY pgrst, 'reload schema';`.
- El cliente de OpenAI debe instanciarse dentro de los handlers, no al importar el módulo.
- Hay una advertencia de hidratación en `Progress` (aria-valuetext). Es inofensiva.

## Deuda técnica reconocida (no ocultar; priorizar con el desarrollador)
Sin pruebas ni CI · sin entorno de desarrollo separado · sin validación de esquema de la salida de la IA ·
sin rate limiting · autorregistro de docentes sin verificación · sin recuperación por similitud (los
embeddings se guardan pero aún no se consultan) · diseño no responsive para móvil.

## Pendiente (orden previsto)
Autodiagnóstico de autorregulación → práctica de recuperación activa → ficha de concepto y recursos
curados → ludificación del cierre de brechas → campo de capacidades, pruebas, piloto y responsive.

## Seguridad
- Nunca escribir claves en el código ni en este archivo. `OPENAI_API_KEY` solo en servidor.
- Antes de cada commit revisar que `.env.local` no esté incluido (el repositorio es público).

   Estado y plan del proyecto: @docs/ROADMAP.md

No asumas nada, siempre pregunta si te falta información