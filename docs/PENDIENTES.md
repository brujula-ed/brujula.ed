# BRÚJULA.ED — Estado del trabajo y pendientes

Actualizado: 30/10/2026. Para retomar en una conversación nueva: leer este documento y `CLAUDE.md`.

## Estado al 30/10/2026

- **Hecho:** F-01 a F-04, F-06, F-07 y F-10 (base del MVP); F-05 ficha de concepto (pendiente 7); F-09 recuperación
  activa v1 (pendiente 8); F-08 autorregulación, versión preliminar (pendiente 9); F-11 recursos abiertos
  (pendiente 10). F-12 quedó cubierta por F-11. Imagen corporativa aplicada salvo el encabezado (pendiente 6).
  Landing para universidades en `/` con formulario "Pedir un piloto" (pendiente 12). Dominio `brujulaed.com`
  comprado en Vercel, con correo en Zoho Mail.
- **Siguiente:** rediseño de la app según `docs/PRINCIPIOS-DE-DISENO.md` (pendiente 14). Antes de tocar el
  diagnóstico y la validación: sesión de diseño del motor de conocimiento + diagnóstico (`docs/MOTOR-DE-CONOCIMIENTO.md`,
  por escribir). F-13 quedó pausada a mitad (pendiente 13).
- **Esperando a terceros:** Ilse (encabezado y uso del amarillo de marca, pendiente 6); Adri (fichas con
  conocimiento general y corrección con IA de F-09, pendientes 7 y 8); autores del MAI (permiso y lista de 19 ítems,
  pendiente 9; Sergio guarda el borrador del correo); experto en educación (validar F-08).
- **Antes del piloto:** verificación del rol docente (pendiente 1), aviso de privacidad y consentimiento, diseño
  responsive y pruebas automáticas (ver `docs/ROADMAP.md`, "Requisitos antes de un piloto").
- **Verificación abierta:** documento grande (verificación 3, abajo).

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

### 9. Diagnóstico de autorregulación (F-08) — versión preliminar hecha (25/10/2026)

Hecho (construido con información disponible, para validarlo después con un experto):
- **Instrumento:** Inventario de Conciencia Metacognitiva (MAI; Schraw y Dennison, 1994), ítems adaptados al
  español por González-Cabañes et al. (*Psicothema*, 2022, 34(3), 454-462; https://osf.io/zthdj). Hoy los **52
  ítems**, escala 1–5, dos escalas: conocimiento (17 ítems) y regulación de la cognición (35). Todo en
  `lib/self-regulation.ts`.
- **Estudiante:** `/estudiante/autorregulacion` ("¿Cómo aprendes?", desde "Mis asignaturas"): aviso de qué se
  guarda y quién ve qué, cuestionario, resultado orientativo por escala con sugerencias, responder de nuevo y
  borrar. Puede **compartir su resultado** (no sus respuestas) con el docente de cada asignatura, y dejar de
  compartir.
- **Docente:** resumen de clase en el reporte (solo agregados y solo con 5 o más respuestas) y, en el reporte de
  cada estudiante, su resultado solo si lo compartió.
- **Base de datos** (migraciones `autorregulacion` y `compartir_autorregulacion`, aplicadas): tablas
  `self_regulation_responses` y `self_regulation_shares`; RPC `submit_self_regulation` (valida versión, ítems y
  valores), `self_regulation_class_summary`, `self_regulation_shared_result` y la auxiliar
  `self_regulation_scores` (único lugar de SQL con el reparto ítem → escala).

Pendiente antes de usarlo con estudiantes reales:
- **Permiso de los autores** (Universidad de Oviedo): el archivo de OSF no declara licencia. Enviar el correo a los
  autores (pide permiso y la lista de 19 ítems); el borrador lo guarda Sergio.
- **Versión breve de 19 ítems** (Harrison y Vallin, 2018), la que mejor ajustó en la validación española: falta
  la lista de ítems (en el artículo están en negrita, que se pierde al extraer el texto; el de Harrison y Vallin
  es de pago). Pedirla a los autores. Al cambiarla: `ITEMS` y `INSTRUMENT_VERSION` en `lib/self-regulation.ts`,
  la versión aceptada en `submit_self_regulation` y en las dos RPC, y el reparto en `self_regulation_scores`.
- **Validación del experto:** selección de ítems, tramos (hoy provisionales: < 2,5 / 2,5–3,5 / > 3,5; el
  artículo no da puntos de corte), textos del resultado y sugerencias.
- **Aviso de privacidad formal** (requisito del piloto): son datos de autopercepción.
- Más adelante: unir la autoevaluación de F-09 con este diagnóstico.

### 10. Recursos abiertos curados (F-11) — hecho (25/10/2026)

Hecho:
- **La IA elige los sitios** (no hay lista cerrada): recursos abiertos o de acceso libre y legal, idealmente una
  lectura, un video y un ejercicio por concepto, de sitios distintos (hasta 3). Ruta
  `app/api/generate-resources/route.ts`; el aviso detalla cuántos hay de cada tipo y cuántos se descartaron.
- **Verificación en el servidor** (`lib/link-check.ts`): solo `https`, sin usuario, contraseña ni puerto, nunca una
  IP escrita, y el dominio debe resolver solo a IP públicas, comprobado en cada redirección (máximo 3, 6 s). Final
  200 = verificado. YouTube se verifica con oEmbed (responde 200 aunque el video no exista). OpenStax y Khan
  Academy no se pueden verificar (200 en páginas inexistentes / desafío antibots): se guardan como "sin verificar"
  y el docente debe abrirlos antes de validar. Probado con 15 casos (sitios reales, páginas inventadas, red
  interna).
- **Docente** (página de conceptos, `components/concept-resources.tsx`): validar, descartar y agregar enlaces
  propios (validados al agregarlos, sin verificación). **Estudiante:** "Recursos para repasar" en el panel del
  mapa, solo validados.
- **Base de datos:** tabla `concept_resources` (migración `recursos_curados`; `quitar_sitios_por_asignatura` quitó
  la elección de sitios por asignatura, que fue un malentendido). `source` guarda el dominio o `docente`.

Pendiente:
- **Riesgo residual de DNS rebinding:** un dominio que cambie de IP entre la comprobación y la visita. Lo acotan el
  tiempo límite y que no se lee la respuesta. Para cerrarlo del todo habría que fijar la IP resuelta en la
  conexión.
- **Videos:** la IA suele inventar el identificador de YouTube y esos se descartan. Si siguen saliendo pocos,
  alternativa: proponer canales o listas en lugar de videos sueltos.
- **Licencias:** la IA decide qué es abierto; el docente lo confirma al validar. No se guarda la licencia de cada
  recurso (podría añadirse un campo).
- **F-12** (elección de formato) se da por cubierta con F-11: el estudiante ya elige entre lectura, video y
  ejercicio, y no se guarda una preferencia (decisión en `docs/ROADMAP.md`).
- **Qué recursos ayudan a cerrar brechas** (para F-20, motor de evidencias): registrar qué recursos abre cada
  estudiante y cruzarlo con el LRR. Son datos personales nuevos: requiere aviso de privacidad.

### 11. Cuentas: confirmación de correo y recuperación de contraseña — no iniciado (28/10/2026)

Hoy no hay confirmación de cuenta, recuperación de contraseña ni verificación de correos. En el panel de Supabase
(Authentication → URL Configuration) la Site URL es `http://localhost:3000` y Redirect URLs está vacía.

Plan (decisión de Sergio): activarlo cuando la app esté lista para presentar, y en ese momento borrar la base de
datos para empezar de cero. Entonces:
- Activar "Confirm email" y la recuperación de contraseña (pantalla nueva para elegir la contraseña).
- Site URL = `https://brujulaed.com`; Redirect URLs = `http://localhost:3000/**` y `https://brujulaed.com/**`
  (antes, comprobar que el dominio esté asignado al proyecto en Vercel). Se puede hacer ya, sin esperar al resto.
- Crear una ruta de retorno (p. ej. `/auth/callback`) para que el enlace del correo abra la sesión; sin ella cae
  en la landing (`/`) sin sesión.
- Va junto con la verificación del rol docente (pendiente 1).

### 12. Landing y formulario "Pedir un piloto" — hecho (29/10/2026)

Hecho, según `docs/LANDING-PARA-CODE.md` (vista previa en `docs/landing.html`):
- `/` sin sesión muestra la landing (`components/landing/`); con sesión redirige al panel. `/inicio` la muestra
  siempre. `/login` con sesión redirige a `/`; cerrar sesión lleva a `/login`.
- Animaciones sin librerías (mapa de la portada, rayo de la cabecera según el scroll, aparición al bajar),
  desactivadas con "reducir movimiento".
- Formulario: Server Action `app/actions/pilot-request.ts` (zod y campo trampa) que inserta en `pilot_requests`
  (migración `solicitudes_de_piloto`, aplicada) con `SUPABASE_SERVICE_ROLE_KEY` (`lib/supabase/admin.ts`). Probado:
  un envío crea la fila y la clave publicable no puede leer ni escribir la tabla (401). La fila de prueba se borró.
- Decisiones propias, distintas del documento: anillo de foco verde azulado sobre fondos claros (el amarillo no se
  ve sobre niebla o blanco); errores del formulario en blanco sobre abeto (no rojo ni amarillo); título oculto
  "Para universidades" en la sección docente/estudiante para no saltar de h1 a h3.

Pendiente:
- **Aviso por correo de cada solicitud:** pospuesto por Sergio (29/10/2026). Hoy se revisan en Supabase, Table
  Editor → `pilot_requests`. Opción propuesta: Resend (registros DNS en un subdominio, `RESEND_API_KEY` y
  `PILOT_NOTIFY_TO`, avisar después del insert sin bloquear el envío). Los datos pasarían por un servicio externo:
  mencionarlo en el aviso de privacidad.
- **Sin límite de envíos por IP:** solo validación y campo trampa. El proyecto no tiene mecanismo por IP
  (`consume_ai_quota` es por usuario). Revisar si llega spam.
- **Política de privacidad:** la frase "Usaremos estos datos solo para contactarte." debe enlazarla cuando exista.
- **Registro de datos en desarrollo:** `next dev` escribe en la terminal los argumentos de cada Server Action, con
  los datos del formulario. Se apaga con `logging: { serverFunctions: false }` en `next.config.ts` (sin decidir).
- **`metadataBase`:** sin definir; en Vercel Next usa la dirección de producción. Definirlo con `https://brujulaed.com`
  si las vistas previas al compartir el enlace salen mal.
- **Por probar en producción:** celular de 360 a 430 px sin desplazamiento horizontal, "reducir movimiento" y
  Lighthouse móvil (accesibilidad ≥ 95).
- **Imagen Open Graph** (`app/opengraph-image.tsx`): usa la fuente por defecto de Next, no Onest (habría que guardar
  el archivo de la fuente en el repositorio).

### 13. Ludificación del cierre de brechas (F-13) — pausada (30/10/2026)

Se pausó para repensar la app (pendiente 14). Ninguna pieza usa puntos, rachas ni rankings, y ninguna necesitó
migración.

Hecho:
- `lib/gap-closure.ts`:
  - `newlyRecovered` da las brechas que se cerraron con un intento, usando la misma función del LRR sin ese intento y
    con él, así que coincide con el LRR y el reporte. Solo es correcta con el intento más reciente.
  - `unlockedBy` da los conceptos que se abren al cerrar una brecha: dependientes directos, no dominados, con todos sus
    prerrequisitos dominados.
  - Probado con 6 casos en una copia fuera del proyecto.
- "Tu brújula" en Mi Brújula (`components/gap-compass.tsx`): el rayo se acerca según las brechas cerradas, más la
  lista de brechas cerradas y lo que abrió cada una. **Sin probar con datos reales.**
- Momento de cierre al final del diagnóstico (`components/gap-closure-moment.tsx`): "Cerraste la brecha de X" con el
  rayo cerrándose. **Sin probar con datos reales.**
- La marca (`components/brand-mark.tsx`) pasó de `components/landing/` a `components/` para usarse en la app.

Pendiente:
- Probar Tu brújula y el momento de cierre (diagnóstico → fallar un concepto → acertar la microevaluación).
- Paso 4, marca "Brecha cerrada" en las tarjetas del mapa: pospuesto hasta el rediseño del mapa.
- "Esta semana cerraste N brechas" (decisión del 30/10/2026, en `docs/PRINCIPIOS-DE-DISENO.md`).

### 14. Rediseño de la app — en preparación (30/10/2026)

Motivo (Sergio): la app se ve plana y genérica, desordenada y poco intuitiva, sin prioridad visual ni una línea
estética común. El docente va y vuelve entre páginas en lugar de seguir un proceso continuo; el estudiante solo puede
hacer el diagnóstico global; el diagnóstico y la recuperación son mecánicos y no cumplen su objetivo.

- **Criterio:** `docs/PRINCIPIOS-DE-DISENO.md`, escrito sobre la app real: reglas fijas, organización, lenguaje
  visual, movimiento, responsive, accesibilidad, qué no hacer, temas abiertos y decisiones con su porqué.
- **Referencias:** maquetas de inspiración en `docs/redesign/`, junto con el borrador original de Claude Desktop.
- **Documentos privados:** Anexo I, Vol. 2 y propuestas en `docs/proyecto/`, que está en `.gitignore`.
- **Abierto:**
  - motor de conocimiento + diagnóstico (sesión propia, primero);
  - inicio del estudiante;
  - menú del docente;
  - qué ve el estudiante (porcentajes, nombres de estados).
- **Orden previsto:**
  1. sesión motor + diagnóstico;
  2. navegación y componentes comunes;
  3. flujo docente;
  4. estudiante;
  5. resto.
  Una pantalla o un flujo por entrega, probado en el celular.

## Notas de operación (aprendidas en la auditoría)

- **La app Supabase de GitHub aplica sola las migraciones que llegan a `main`.** Por eso cada migración se
  aplica con `npx supabase db push` (tras dry-run y confirmación) antes de subir su archivo. Al hacer commit,
  añadir archivos por nombre y no subir migraciones aún no aplicadas.
- **Advertencia de lint conocida:** `npm run lint` da 0 errores y 1 advertencia en
  `app/diagnostico/[subjectId]/page.tsx` (el `useEffect` de carga, sin `supabase` en sus dependencias; línea 123
  desde F-13). Es anterior a los
  cambios de octubre e inofensiva; si aparece otra, sí es nueva.
- **Consultas de solo lectura a producción:** `npx supabase db query --linked "select ..."`. No requiere
  Docker (`db dump` sí).
- **Max rows de la Data API = 1000:** cualquier consulta que pueda devolver más filas debe paginarse.
- **Vercel Hobby con Fluid Compute:** máximo 300 s por función. Al pasar a Pro (obligatorio para uso
  comercial) se puede subir `maxDuration` hasta 800 s en `app/api/process-document/route.ts`.
- **Criterios pedagógicos provisionales** (a validar con Adri): selección de preguntas y definición del LRR,
  descritos en `CLAUDE.md` ("Reglas de negocio") y en los comentarios de `lib/question-selection.ts` y
  `lib/lrr.ts`.
