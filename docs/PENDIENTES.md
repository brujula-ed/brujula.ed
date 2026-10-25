# BRÚJULA.ED — Pendientes de la auditoría de deuda técnica

Actualizado: 24/10/2026. Para retomar en una conversación nueva: leer este documento y `CLAUDE.md`.

## Contexto

Entre el 19 y el 21/10/2026 se hizo una auditoría de deuda técnica (seguridad, errores, salida de la IA,
consultas, tipos, accesibilidad) y se ejecutó su plan en fases. Las fases 0 a 4 están hechas, salvo lo que
se lista abajo. El orden de trabajo y las reglas (migraciones, commits) están en `CLAUDE.md`, sección
"Cómo trabajamos".

### Qué quedó hecho (resumen)

- Esquema versionado en `supabase/migrations/` (línea base + 11 migraciones, todas aplicadas en producción).
- Límite de IA: `ai_usage` + `consume_ai_quota` (30 llamadas por usuario cada 24 h) en las 3 rutas de IA.
- Diagnóstico: corrección en la base de datos (RPC `submit_answer`), preguntas sin `correct_index`
  (RPC `get_diagnostic_questions`), selección en `lib/question-selection.ts`, microevaluación con preguntas
  nuevas, manejo de errores, sin doble clic, la demostración no se guarda.
- Respuestas vinculadas por `concept_id` (renombrar un concepto ya no rompe su historial).
- LRR: recuperada = evidencia más reciente posterior (microevaluación o diagnóstico posterior) ≥ 0.7.
- Salida de la IA validada con zod; preguntas completan hasta 4 por concepto; conceptos solo nuevos;
  nombres únicos por asignatura; regla `correct_index` en rango.
- Índices en columnas filtradas; reporte de clase paginado; documentos en tandas de 100 con límite de 10 MB
  (formulario, servidor y bucket, solo PDF y .docx).
- Tipos generados (`lib/supabase/database.types.ts`) en los dos clientes.
- Accesibilidad: mapa usable con teclado, etiquetas, foco en el diagnóstico, mensajes anunciados.
- `middleware.ts` pasó a `proxy.ts`; rutas de IA validan uuid y no exponen errores internos.

## Verificaciones pendientes tras el último despliegue

Cosas que no se pudieron probar desde el código; conviene comprobarlas en producción:

1. **Iniciar sesión, navegar y cerrar sesión** siguen funcionando con `proxy.ts` (ahora corre en Node.js).
   Verificado por Sergio el 22/10/2026.
2. **Procesar un documento**: el embedding ahora se envía como texto (`JSON.stringify`) en
   `app/api/process-document/route.ts`. Verificado el 22/10/2026: el último .docx procesado tiene 2
   fragmentos, todos con embedding.
3. **Documento grande** (PDF de 40+ páginas con texto, más de 100 fragmentos): probar el procesamiento por
   tandas y la limpieza de fragmentos anteriores al reprocesar. **Abierto, a investigar:** Sergio procesó un
   PDF grande (esperaba ~30 fragmentos), no lo borró, y se generaron unos 30 conceptos y sus preguntas. Pero
   la consulta a producción del 22/10/2026 (`subject_documents` + `document_chunks`) muestra 13 documentos y
   ninguno con más de 4 fragmentos. Falta averiguar dónde están ese documento y sus fragmentos.

## Pendientes

### 1. Seguridad: el usuario puede cambiarse el rol a docente (hallazgo 17) — aplazado

- **Qué pasa:** la política "Los usuarios actualizan su propio perfil" de `profiles` permite actualizar
  cualquier columna, incluida `role` (`GRANT UPDATE` sobre toda la tabla). Desde el navegador, un estudiante
  puede ejecutar `update profiles set role = 'docente' where id = <su id>`. Además, `handle_new_user` copia el
  rol que llega del formulario de registro (`app/registro/page.tsx`), así que cualquiera puede registrarse
  como docente.
- **Por qué importa:** la RLS nunca mira el rol (las escrituras se controlan por dueño de la asignatura), pero
  el rol decide qué pantallas ve cada uno, y cualquier usuario puede crear asignaturas y gastar cupo de IA.
- **Decisión tomada:** se resuelve junto con el ajuste "Verificación del rol docente" del roadmap. Hoy solo
  usa la app el desarrollador.
- **Cómo resolverlo:** migración que quite a `authenticated` el permiso de actualizar `role` (permiso por
  columna o trigger), que `handle_new_user` cree siempre `estudiante`, y un camino controlado para asignar
  `docente` (código de invitación o aprobación). Después, comprobar también el rol en las 3 rutas de IA
  (hoy solo comprueban dueño de la asignatura) y quitar el selector de rol del registro.
- **Requisito:** está en "Requisitos antes de un piloto" del roadmap.

### 2. Esquema: detalles del hallazgo 20

- **Intentos sin comprobar inscripción:** las políticas de `diagnostic_attempts` solo exigen
  `auth.uid() = user_id`; cualquiera puede crear intentos en cualquier asignatura. Sin efecto visible hoy
  (los reportes filtran por inscritos y `submit_answer` exige inscripción). Arreglo: añadir
  `is_enrolled(subject_id)` al `WITH CHECK` de insert y update.
- **Inscripciones sin borrado:** `enrollments` no tiene política DELETE; ni el docente puede quitar a un
  estudiante ni el estudiante salir. Es funcionalidad nueva (necesita pantalla), no solo una política.
- **Columnas heredadas:** `diagnostic_attempts.subject` y `.topic` (texto) repiten datos de la asignatura.
  Inofensivas. Quitarlas exige cambiar el insert del diagnóstico y una migración.

### 3. Rendimiento antes del piloto

- **Políticas con `(select auth.uid())`:** recomendación de rendimiento de Supabase (evalúa `auth.uid()` una
  vez por consulta, no por fila). Implica recrear muchas políticas; no compensa con los volúmenes actuales.
- **Intentos del reporte de clase:** la consulta de `diagnostic_attempts` en
  `app/docente/[subjectId]/reporte/page.tsx` no está paginada (las respuestas sí). Solo importa si una clase
  supera 1000 diagnósticos completados. Mismo patrón con `.range()` que las respuestas.

### 4. Refactor de código duplicado (hallazgo 15) — opcional

`CLAUDE.md` pide no refactorizar sin decisión del desarrollador. Lo duplicado:

- `accuracy` y los tipos `Attempt`/`Answer` en `lib/lrr.ts` y `lib/concept-state.ts`.
- Umbral 0.7 escrito a mano en `app/diagnostico/[subjectId]/page.tsx` (existen `LRR_THRESHOLD` y
  `MASTERY_THRESHOLD`) y "70 %" en `components/lrr-card.tsx`.
- Carga de intentos y respuestas repetida en `app/estudiante/[subjectId]/page.tsx`,
  `app/docente/[subjectId]/reporte/page.tsx` y `app/docente/[subjectId]/reporte/[studentId]/page.tsx`.
- Bloque del límite de IA (`consume_ai_quota` + respuestas 500/429) repetido en las 3 rutas de `app/api/`.

### 5. Documentos del proyecto por actualizar — hecho (22/10/2026)

- **`docs/ROADMAP.md`:** "Ajustes" de la semana 1 verificados en el código. «Gestionar», rotación de preguntas
  y navegación pasaron a "Terminado"; la guía de uso pasó al Bloque E.
- **`docs/REGISTRO_TERCEROS.md`:** `middleware.ts` cambiado por `proxy.ts`. (`docs/REGISTRO_PROPIO.md` lo
  sigue mencionando a propósito: ahí se refiere al historial de commits.)

### 6. Imagen corporativa — en curso (22/10/2026)

Guía: `docs/IMAGEN-CORPORATIVA.md` (paleta A, aprobada por Ilse Rivera). Commit "Nueva imagen parte 1" (pasos 1
a 4 de la guía): paleta y tipografías (Figtree texto, Onest títulos h1–h3, Geist Mono en códigos de clase) en
`app/globals.css` y `app/layout.tsx`; colores de estado centralizados en tokens `--state-*` (con
`--state-none-soft` para el gris claro del reporte y del LRR); errores con `text-destructive`; anillo de
selección del mapa con `--ring`.

Commit "Cambio de imagen parte 2":
- Paso 5: SVG de la marca en `public/brand/`, favicon `app/icon.svg` (se borró `app/favicon.ico`, el de Next por
  defecto) y título de pestaña `brújula.ed`.
- Mapa de conocimiento y su panel lateral con fondo blanco (`bg-card`) en `components/knowledge-map.tsx`.
- Encabezado (`components/header.tsx`) **a medio decidir**. A Sergio no le convencieron: blanco (logo en color),
  fondo abeto y fondo verde azulado. Estado actual (publicado): fondo `bg-primary`, logo
  `brujula-ed_marca-sobre-verde.svg` (variante nueva creada aquí: igual a la de abeto pero sin el fondo),
  "brújula" y enlaces en blanco, ".ed" en amarillo.

Por decidir:
- Diseño final del encabezado (probar otra opción).
- ".ed" en amarillo: rompe la regla de marca (amarillo solo en la marca y el cierre de brecha) y sobre verde
  azulado tiene contraste ≈ 3,4:1 (no cumple AA). Consultar con Ilse.
- Avisar a Ilse de la variante `brujula-ed_marca-sobre-verde.svg` si se conserva (no está en `svg/`).
- Carpeta `svg/` de la raíz (originales de la marca, ya en el commit): borrarla o conservarla; está duplicada
  en `public/brand/`.
- Si el encabezado queda oscuro, cambiar `bg-foreground`/`bg-primary` por tokens con nombre propio
  (p. ej. `--header`).

### 7. Mapa de conocimiento y ficha de concepto (F-05) — hecho, con ajustes pendientes (24/10/2026)

Hecho:
- **Mapa** (`components/knowledge-map.tsx`, commits "Interactividad del Mapa eliminado" y "Cambio visual de
  mapas"): nodos no arrastrables y sin botón "Reordenar" (pedido de la socia); tarjetas de tamaño uniforme con
  "Abre N"; flechas en ángulo y sin las redundantes (`computeMapEdges` en `lib/knowledge-graph.ts`; el panel sigue
  listando todos los prerrequisitos); al elegir un concepto se resalta su ruta y se atenúa el resto.
- **Ficha de concepto (F-05)**: tabla `concept_cards` (migraciones `fichas_de_concepto` y `origen_de_fichas`,
  aplicadas en producción), ruta `app/api/generate-concept-cards/route.ts`, validación en la página de conceptos
  (`components/concept-ficha.tsx`, `components/generate-cards-button.tsx`) y fichas validadas en el panel del mapa
  del estudiante ("Por qué importa" y "Para qué te sirve").
- La IA usa el material del docente, el mapa de conceptos validados (qué necesita y qué desbloquea cada uno) y,
  si el material no alcanza, conocimiento general de la disciplina. Cada ficha guarda su origen (`source`:
  `material` | `general`); el docente lo ve, el estudiante no.

Pendiente:
- **Ajuste fino del prompt de "Para qué te sirve"** (al final, junto con el resto del pulido): las respuestas
  mejoraron, pero aún pueden ser más útiles. Hoy pide la aplicación general en la vida cotidiana o en la carrera
  del estudiante, con un caso reconocible fuera del aula.
- **Acordar con Adri** que las fichas puedan usar conocimiento general (marcado por origen). Flexibiliza el
  principio "no crear contenido pedagógico propio"; está registrado en `docs/ROADMAP.md` (Decisiones tomadas).
- **Prueba de seguridad con una cuenta de estudiante**, si no se hizo: una ficha sugerida no debe aparecer en Mi
  Brújula; una validada sí.
- **Contexto de las fichas con embeddings**: hoy reciben los primeros 40 fragmentos del material; con pgvector
  se podrían dar los más relevantes para cada concepto (los embeddings se guardan pero no se consultan).
- **Prompt de `app/api/generate-concepts`**: pedir solo prerrequisitos directos, para que el grafo llegue limpio.
- **Ficha en el reporte por estudiante** (`app/docente/[subjectId]/reporte/[studentId]/page.tsx`).
- **Relaciones con nombre** entre conceptos ("es un tipo de", "se usa para"): reconsiderar tras usar el mapa y
  las fichas. Exige cambio de esquema.
- **Opinión de la socia** sobre el mapa rediseñado.

### 8. Práctica de recuperación activa (F-09) — v1 hecha (24/10/2026)

Hecho: desde el panel del mapa en Mi Brújula, "Explica con tus palabras" abre
`app/estudiante/[subjectId]/practicar/[conceptId]/page.tsx` (`components/retrieval-practice.tsx`). El estudiante
escribe de memoria sin ver la referencia, después la compara con la descripción y la ficha validada, y se
autoevalúa ("Lo expliqué bien" / "A medias" / "Me costó"). Siguiente paso determinista: comprobar con preguntas
(diagnóstico enfocado, solo si hay preguntas validadas) o practicar otra vez. Sin IA, sin puntaje y sin guardar
nada; no afecta estados ni LRR.

Pendiente (decisiones tomadas para v1, a revisar):
- **Corrección con IA de la explicación** → F-24. Hoy no: haría que la IA le hable al estudiante sin validación
  docente (primer principio) y faltan las protecciones del roadmap (cuota por estudiante, `max_tokens`, límite de
  gasto, verificación de docentes). Decidir con Adri.
- **Guardar explicaciones y autoevaluaciones**: permitiría ver el historial propio o mostrarlo al docente, y la
  autoevaluación podría alimentar F-08 (autorregulación). Requiere tabla nueva y, si lo ve el docente, aviso de
  privacidad (requisito antes del piloto).

## Notas de operación (aprendidas en la auditoría)

- **La app Supabase de GitHub aplica sola las migraciones que llegan a `main`.** Por eso cada migración se
  aplica con `npx supabase db push` (tras dry-run y confirmación) antes de subir su archivo. Al hacer commit,
  añadir archivos por nombre y no subir migraciones aún no aplicadas.
- **Consultas de solo lectura a producción:** `npx supabase db query --linked "select ..."`. No requiere
  Docker (`db dump` sí).
- **Max rows de la Data API = 1000:** cualquier consulta que pueda devolver más filas debe paginarse.
- **Vercel Hobby con Fluid Compute:** máximo 300 s por función. Al pasar a Pro (obligatorio para uso
  comercial) se puede subir `maxDuration` hasta 800 s en `app/api/process-document/route.ts`.
- **Criterios pedagógicos provisionales** (a validar con Adri): selección de preguntas y definición del LRR,
  descritos en `CLAUDE.md` ("Reglas de negocio") y en los comentarios de `lib/question-selection.ts` y
  `lib/lrr.ts`.
