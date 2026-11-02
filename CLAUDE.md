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
- La integración de GitHub de Supabase aplica las migraciones que llegan a `main`. Por eso, cada migración se
  aplica con `db push` (con confirmación) **antes** de subir su archivo; las que deben ir después del despliegue
  esperan a que Vercel termine.
- Tras aplicar una migración, regenerar los tipos:
  `npx supabase gen types typescript --linked --schema public > lib/supabase/database.types.ts`.
- Idioma: español. Textos de la interfaz en español claro, tuteo.

## Stack
- Next.js 16 (App Router, Turbopack), TypeScript, Tailwind v4, shadcn/ui (`base-nova`).
- Imagen corporativa (`docs/IMAGEN-CORPORATIVA.md`): colores como tokens en `app/globals.css` (paleta de marca y
  estados `--state-*`); no escribir colores a mano en los componentes. Tipografías Figtree (texto) y Onest (títulos),
  cargadas en `app/layout.tsx`. Archivos de la marca en `public/brand/`.
- Supabase: Auth, Postgres con RLS, Storage (bucket privado), pgvector.
- OpenAI: embeddings `text-embedding-3-small` (1536); generación con salida `json_object`.
- React Flow (`@xyflow/react`) + `@dagrejs/dagre` para el mapa de conocimiento.
- Despliegue: GitHub → Vercel. Las variables de entorno deben existir también en Vercel.
- Extracción de texto: `pdf-parse` v2 (imports perezosos + `serverExternalPackages` en `next.config.ts`) y `mammoth` para .docx.

## Estructura (verificar contra el repo)
- `app/page.tsx`: sin sesión muestra la landing para universidades; con sesión redirige al panel según el rol.
  `app/inicio` muestra siempre la landing ("Ir a mi panel" si hay sesión). Landing en `components/landing/`
  (textos y diseño según `docs/LANDING-PARA-CODE.md` y `docs/landing.html`); `components/header-gate.tsx` oculta la
  cabecera de la app en `/` e `/inicio`.
- `app/login` (con sesión redirige a `/`, en `app/login/layout.tsx`) y `app/registro` para la autenticación. Cerrar
  sesión lleva a `/login`, no a la landing. Los enlaces que se comparten con estudiantes van a `/login`.
- `app/actions/pilot-request.ts` envío del formulario "Pedir un piloto" (zod, campo trampa `sitio_web`).
- `app/docente/page.tsx` lista y creación de asignaturas.
- `app/docente/[subjectId]/page.tsx` documentos de la asignatura (subir, procesar, eliminar) y accesos a lo demás.
- `app/docente/[subjectId]/conceptos`, `/preguntas`, `/reporte` y `/reporte/[studentId]`: validación y reportes.
- `app/estudiante/page.tsx` "Mis asignaturas", la principal del estudiante: "Por dónde seguir" (asignatura sugerida),
  Tu brújula con las brechas de todas, una tarjeta por asignatura (barra de estados y siguiente paso) y unirse con código.
- `app/estudiante/[subjectId]` "Mi Brújula": siguiente paso (`lib/next-step.ts`, `components/next-step-card.tsx`), brechas
  cerradas esta semana, temas (`components/topic-list.tsx`, con el mapa aparte) y Tu brújula con el LRR.
- `app/estudiante/[subjectId]/concepto/[conceptId]` página del concepto: recorrido de 5 pasos, práctica y comprobaciones
  (`components/concept-journey.tsx`, `components/concept-quiz.tsx`; `/practicar` redirige aquí).
- `app/diagnostico/[subjectId]/tema/[topicId]` diagnóstico adaptativo de un tema (`lib/topic-diagnosis.ts`).
- `app/estudiante/autorregulacion` cuestionario "¿Cómo aprendes?" (F-08, preliminar; `components/self-regulation-questionnaire.tsx`).
- `lib/self-regulation.ts` instrumento de autorregulación (MAI en español), medias, tramos provisionales y sugerencias.
- `app/diagnostico/[subjectId]/page.tsx` diagnóstico global anterior (diagnóstico, nivelación y microevaluación). Sin
  enlaces desde la entrega 6; la entrega 7 (ubicación inicial) decide si se reutiliza.
- `app/api/` `process-document`, `generate-concepts`, `generate-questions`, `generate-concept-cards`, `generate-resources`,
  `generate-evidence` (server-side).
- Motor de conocimiento (`docs/MOTOR-DE-CONOCIMIENTO.md`, fase 1):
  - `lib/search-material.ts` es la búsqueda híbrida (función SQL `search_chunks`: embeddings + texto en español,
    fusionados), solo para el docente dueño.
  - `lib/concept-candidates.ts` arma los tramos y une los candidatos repetidos cuando se generan conceptos sobre todo
    el material.
  - `lib/concept-evidence.ts` busca y comprueba las citas del material.
  - Conceptos, preguntas y fichas reciben los fragmentos relevantes de cada concepto (ya no "los primeros 40").
- `lib/resource-sources.ts` sitios conocidos (nombre, si se pueden verificar); `lib/link-check.ts` verificación de enlaces con protección contra visitar la red interna.
- `components/` componentes propios; `components/ui/` los de shadcn.
- `lib/concept-state.ts` estados por concepto (umbral de dominio 0.7).
- `lib/knowledge-graph.ts` dependientes, prerrequisitos, flechas del mapa (sin las redundantes), brecha prioritaria, próximo desafío.
- `components/knowledge-map.tsx` mapa en dos niveles (React Flow + dagre): temas (`components/topic-map.tsx`) y, al
  entrar en uno, sus conceptos con los prerrequisitos de otros temas como tarjetas tenues; sin temas, un solo nivel.
  `components/concept-ficha.tsx` validación de fichas.
- Temas (fase 2 del motor):
  - `app/api/organize-topics` y `lib/topic-organization.ts`, para organizar en temas;
  - `components/topic-group.tsx`, `components/new-topic-form.tsx` y `components/organize-topics-button.tsx`, en
    Estructura de conceptos;
  - en `lib/knowledge-graph.ts`, `computeTopicDependencies` (qué tema necesita a cuál) y `learningOrder`
    (prerrequisitos primero);
  - `lib/concept-embeddings.ts` y `app/api/find-duplicates`, para los posibles duplicados: los embeddings eligen las
    parejas y la IA juzga, y el docente decide.
- Base visual: tokens en `app/globals.css`, `components/ui` ajustados y las piezas `page-header`, `state-bar`,
  `stat-tile`, `state-chip`, `empty-state` y `action-bar`; muestrario en `/estilos`, solo en desarrollo.
- `lib/lrr.ts` cálculo del LRR (por estudiante, concepto y clase).
- `lib/extract-text.ts`, `lib/chunk-text.ts` extracción por página (PDF) o por título (Word), sin encabezados ni pies
  repetidos, y fragmentación por oraciones con página, sección y orden.
- `lib/data.ts` banco de preguntas de demostración; `lib/class-code.ts` códigos de clase.
- `lib/supabase/` clientes de servidor y cliente; `admin.ts` cliente con `service_role` (salta la RLS; solo servidor,
  hoy solo para `pilot_requests`).
- `proxy.ts` refresca la sesión de Supabase en cada petición (en Next 16 sustituye a `middleware.ts`; corre en Node.js).
- `supabase/migrations/` esquema y políticas RLS (fuente de verdad); `supabase/snippets/` historial de consultas.

## Datos
Esquema completo en `supabase/migrations/` (cada cambio de esquema va como migración nueva).
Tablas principales: `profiles` (rol), `subjects` (con código de clase y `description` opcional), `topics` (temas de la asignatura: `position`, `status`, `unit_id` opcional; el estudiante solo lee los
validados), `units` (agrupan temas, opcionales), `enrollments`, `subject_documents`,
`document_chunks` (con embedding, `page_start`/`page_end`, `section`, `position` y `content_tsv` en español),
`concepts` (`prerequisite_ids`, `status`, `topic_id`: un concepto en un solo tema de su asignatura; `embedding`, que se
vacía al cambiar nombre o descripción: nunca hacer `select("*")` de conceptos), `concept_duplicate_candidates` y
`concept_pair_dismissals` (posibles duplicados que confirmó la IA y parejas que el docente marcó como distintas),
`questions` (`status`, `explanations`: una por opción, que el estudiante
no recibe), `evidence_spans` (citas del material de cada concepto o pregunta, con su página; un trigger comprueba
que la cita esté tal cual en el fragmento; solo las ve el docente),
`diagnostic_attempts` (`completed_at`), `diagnostic_answers` (`stage`: `diagnostico` | `microevaluacion`,
`concept`, `is_correct`), `concept_cards` (ficha de concepto: `why_it_matters`, `application`, `source`:
`material` | `general`, `status`; un trigger pone `subject_id` desde el concepto; el estudiante solo lee fichas
validadas de conceptos validados), `self_regulation_responses` (respuestas al cuestionario de autorregulación; el
estudiante lee y borra las suyas, entran solo por la RPC `submit_self_regulation`) y `self_regulation_shares`
(con qué asignaturas comparte el estudiante su resultado), `concept_resources` (recursos abiertos por concepto:
`title`, `url` https, `kind`: `lectura` | `video` | `ejercicio`, `source` = dominio o `docente`, `added_by`,
`link_check`: `verificado` | `no_verificable` | `docente`, `status`; mismas reglas de acceso que las fichas),
`pilot_requests` (solicitudes de piloto de la landing: `name`, `university`, `email`, `message`, `status` =
`nuevo`; RLS sin políticas y sin permisos para `anon` ni `authenticated`: entran solo por la Server Action con
`service_role` y se revisan en el panel de Supabase).
- Recursos: el servidor solo visita enlaces con `checkLink` de `lib/link-check.ts` (https, dominio con IP públicas,
  comprobado en cada redirección). No hacer `fetch` a URLs de la IA o del usuario por otro camino.
- Autorregulación: el docente nunca lee respuestas individuales. Ve un resumen de clase
  (`self_regulation_class_summary`, solo con 5 o más respuestas) y el resultado de un estudiante solo si lo compartió
  (`self_regulation_shared_result`). El reparto ítem → escala está en `lib/self-regulation.ts` y en la función SQL
  `self_regulation_scores`: cambiarlos juntos.
- Solo se usan conceptos y preguntas con `status = 'validado'`.
- Seguridad: RLS en todas las tablas. Para evitar recursión usar funciones `security definer` con `set search_path = public`.
- Las respuestas se vinculan al concepto por **`concept_id`**, que un trigger rellena desde la pregunta (no lo
  manda el navegador). La columna `concept` guarda el nombre que tenía al responder, solo como historial.
  Estados y LRR emparejan siempre por id, así que renombrar un concepto no rompe su historial.

## Reglas de negocio ya implementadas
- Estados: `sin_evidencia`, `brecha`, `en_desarrollo`, `dominado` (`lib/concept-state.ts`, modelo de la fase 3 en
  `docs/DISENO-DEL-ESTUDIANTE.md` 3.1). Aciertos ponderados (las respuestas pierden la mitad del peso cada 30 días; la
  práctica no cuenta) frente al umbral 0.7. Dominado exige 3 respuestas y, si fue brecha, la comprobación diferida;
  superar una comprobación estando en brecha hace que el estado se calcule desde ella.
- LRR (fase 3, acordado con Adri el 02/11/2026): brecha = concepto < 0.7 en el **primer** diagnóstico; cerrada =
  el modelo la da por dominada, lo que exige superar la **comprobación final** (diferida, 2 días después); las
  pendientes cuentan en el denominador. La definición anterior (evidencia más reciente ≥ 0.7) se calcula en paralelo
  durante el piloto (`computeStudentGapsLegacy`, línea en la pestaña Estudiantes).
- Selección de preguntas (`lib/question-selection.ts`, provisional): diagnóstico con la mitad de las validadas
  de cada concepto (máx. 2; 1 si solo hay una); microevaluación con hasta 2 no vistas en el intento; se
  prefieren las nunca respondidas. Sin preguntas nuevas, la brecha queda pendiente. La IA genera 6 por concepto (desde la fase 3; antes 4).
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
sin rate limiting · autorregistro de docentes sin verificación · diseño no responsive para móvil.

## Pendiente (orden previsto)
Rediseño de la app (`docs/PRINCIPIOS-DE-DISENO.md`, `docs/PENDIENTES.md` pendiente 14), en este orden:
1. motor de conocimiento, fase 1 (hecha el 30/10/2026);
2. base visual, solo tokens y componentes (no dependen de cómo se organizan los datos);
3. motor, fase 2: unidades y temas dentro de la asignatura, relaciones y duplicados (sesión de diseño propia);
4. navegación y validación rediseñadas, ya con temas y citas;
5. motor, fase 3 (diagnóstico por tema y recorrido de cierre).

La fase 2 va antes de rediseñar pantallas para que cada una se rehaga una sola vez (decisión del 30/10/2026).

F-13 (ludificación) quedó pausada a mitad (pendiente 13). Después: capacidades, pruebas, piloto. La elección de
formato (F-12) quedó cubierta por F-11 (ver Decisiones tomadas en el roadmap). Ya hechos, con ajustes pendientes en `docs/PENDIENTES.md`: ficha de concepto (F-05, pendiente 7),
recuperación activa (F-09 v1, pendiente 8), autorregulación (F-08 preliminar, pendiente 9: permiso de autores y
experto), recursos curados (F-11, pendiente 10) y landing con formulario de piloto (pendiente 12).

## Seguridad
- Nunca escribir claves en el código ni en este archivo. `OPENAI_API_KEY` y `SUPABASE_SERVICE_ROLE_KEY` solo en
  servidor (sin prefijo `NEXT_PUBLIC_`); las dos deben existir también en Vercel.
- Antes de cada commit revisar que `.env.local` no esté incluido (el repositorio es público).
- `docs/proyecto/` (Anexo I, Vol. 2 y propuestas) es privado: está en `.gitignore` y no se sube. Se puede leer y
  citar por sección ("Anexo I, sec. 11"), pero no copiar su texto en documentos del repositorio.

   Estado y plan del proyecto: @docs/ROADMAP.md
   Pendientes de la auditoría de deuda técnica (oct. 2026) y verificaciones tras el último despliegue: @docs/PENDIENTES.md

No asumas nada, siempre pregunta si te falta información