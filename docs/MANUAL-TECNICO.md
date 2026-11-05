# BRÚJULA.ED · Manual técnico

Versión del 2026-11-05 · Aplicación en funcionamiento: https://www.brujulaed.com

- **Diseño original de la arquitectura y la aplicación:** Sergio Ríos e Ilse Adriana Rivera.
- **Desarrollo:** Sergio Ríos.

Este manual describe la arquitectura, los algoritmos, el modelo de datos y la seguridad de BRÚJULA.ED, y explica
cómo instalarla. El uso de cada pantalla está en `docs/MANUAL-DE-USUARIO.md`.

## 1. Qué es BRÚJULA.ED

BRÚJULA.ED es una aplicación web de apoyo al aprendizaje universitario. Funciona así:
- **El docente** sube el material de su asignatura. La inteligencia artificial (IA) **propone** a partir de ese
  material los conceptos, sus prerrequisitos, los temas, las preguntas, las fichas y los recursos abiertos. El docente
  **valida** cada propuesta.
- **El estudiante** hace un diagnóstico por tema que busca la causa de sus dificultades, la *brecha raíz*. Ve un mapa
  de conocimiento con el estado de cada concepto y recibe un siguiente paso. Para cerrar cada brecha sigue una ruta de
  nivelación con comprobación inmediata y comprobación diferida.
- **El docente** ve en el reporte de clase las brechas frecuentes, los estados y el LRR (*Learning Recovery Rate*).

Principios de diseño que condicionan la arquitectura:
1. **La IA propone, el docente valida.** Nada generado por IA llega al estudiante sin validación del docente. En la base
   de datos, cada concepto, tema, pregunta, ficha y recurso tiene un estado (`status`). Las reglas de acceso solo dejan
   que el estudiante lea lo que está `validado`.
2. **Determinismo y trazabilidad.** La IA solo extrae, redacta y propone. Los estados del estudiante, el diagnóstico,
   las prioridades y el LRR se calculan con algoritmos fijos, sin IA, y cada resultado se puede rastrear hasta las
   respuestas que lo producen.
3. **Estados orientativos.** Los estados de aprendizaje no son calificaciones ni diagnósticos clínicos.
4. **Métodos con evidencia:** práctica de recuperación, práctica espaciada (comprobación diferida) y autorregulación
   del aprendizaje. No se usan "estilos de aprendizaje".
5. **Sin contenido pedagógico propio.** Se usan el material del docente y recursos abiertos de terceros, curados.

## 2. Arquitectura general

```
                    Navegador (docente o estudiante)
                                 │  HTTPS
                                 ▼
 ┌───────────────────────── Vercel ─────────────────────────────┐
 │  Next.js 16 (App Router)                                     │
 │  • Páginas con renderizado en el servidor y en el cliente    │
 │  • proxy.ts: refresca la sesión en cada petición             │
 │  • Rutas app/api/*: procesar material y generar propuestas   │
 │  • Server Action: formulario "Pedir un piloto"               │
 │  • lib/*: algoritmos deterministas (estados, grafo, LRR)     │
 └──────┬───────────────────────────────┬───────────────────────┘
        │ Auth, SQL (RLS), Storage      │ Embeddings y generación (solo servidor)
        ▼                               ▼
 ┌──────────────── Supabase ───────┐   ┌──── OpenAI API ────┐
 │ Auth (correo y contraseña)      │   │ text-embedding-    │
 │ Postgres + RLS + pgvector       │   │ 3-small (1536)     │
 │ Funciones RPC (security definer)│   │ Modelo generativo  │
 │ Storage (bucket privado)        │   │ con salida JSON    │
 └──────┬──────────────────────────┘   └────────────────────┘
        │ SMTP
        ▼
     Resend (correos de confirmación y recuperación)
```

- **Navegador → Supabase:** el navegador consulta la base directamente con la clave publicable. Lo que puede leer o
  escribir lo deciden las políticas de seguridad por fila (RLS) y las funciones RPC.
- **Servidor → OpenAI:** solo el servidor llama a OpenAI, desde las rutas de `app/api/`. La clave nunca llega al
  navegador.
- **Servidor → Supabase con `service_role`:** solo en el formulario de piloto de la página pública, que no tiene
  sesión (`lib/supabase/admin.ts`).

## 3. Stack y estructura del código

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Interfaz | Tailwind CSS v4, componentes shadcn/ui (`base-nova`) sobre Base UI, íconos Lucide |
| Mapa de conocimiento | React Flow (`@xyflow/react`) y dagre (`@dagrejs/dagre`) para la disposición |
| Datos y cuentas | Supabase: Auth, Postgres con RLS, pgvector, Storage |
| IA | OpenAI: embeddings `text-embedding-3-small` (1536 dimensiones) y generación con salida `json_object`, validada con zod |
| Extracción de texto | `pdf-parse` v2 (PDF) y `mammoth` (.docx) |
| Correo | Resend, como SMTP de Supabase |
| Despliegue | GitHub → Vercel; dominio `brujulaed.com` |

Estructura de carpetas:

| Carpeta o archivo | Contenido |
|---|---|
| `app/` | Páginas y rutas. `docente/`, `estudiante/`, `diagnostico/` (pantallas de foco), cuentas (`login`, `registro`, `recuperar`, `nueva-contrasena`, `auth/confirm`), landing (`page.tsx`, `inicio`) |
| `app/api/` | Rutas del servidor que usan IA: `process-document`, `generate-concepts`, `generate-questions`, `generate-concept-cards`, `generate-resources`, `generate-evidence`, `organize-topics`, `find-duplicates` |
| `app/actions/` | Server Action del formulario de piloto |
| `lib/` | Lógica: estados, grafo, LRR, diagnóstico por tema, siguiente paso, búsqueda, citas, extracción, fragmentación, verificación de enlaces, autorregulación |
| `components/` | Componentes de la interfaz; `components/ui/` son los de shadcn |
| `supabase/migrations/` | Esquema, políticas RLS y funciones SQL: es la fuente de verdad de la base de datos |
| `supabase/templates/` | Plantillas de los correos de cuenta |
| `proxy.ts` | Refresca la sesión de Supabase en cada petición (en Next.js 16 reemplaza a `middleware.ts`) |
| `docs/` | Documentación de diseño, registros de componentes y estos manuales |

## 4. Motor de conocimiento: del material del docente a la estructura

### 4.1 Carga y fragmentación

1. El docente sube archivos PDF o .docx de hasta 10 MB. Se guardan en un bucket privado de Supabase Storage.
2. `app/api/process-document` lo procesa en el servidor:
   - **Extracción** (`lib/extract-text.ts`): página por página en PDF y por títulos en Word. Se quitan los encabezados y
     pies de página que se repiten.
   - **Fragmentación** (`lib/chunk-text.ts`): fragmentos de unos 1200 caracteres, armados oración por oración, con
     200 caracteres de arrastre del fragmento anterior. Cada fragmento guarda página de inicio y fin, sección y
     posición. Un título nuevo siempre empieza un fragmento.
   - **Embeddings:** cada fragmento recibe un vector de 1536 dimensiones. Se guarda en `document_chunks`, junto con
     una columna de texto completo en español (`content_tsv`).
3. Un PDF escaneado, sin texto, no se puede procesar: la app lo avisa. El reconocimiento óptico de caracteres (OCR)
   queda como trabajo futuro.

### 4.2 Búsqueda híbrida

La función SQL `search_chunks` (`lib/search-material.ts`) combina dos búsquedas sobre el material:
- **por significado:** similitud de vectores con pgvector;
- **por palabras:** texto completo en español, que encuentra términos técnicos, nombres y fórmulas.

Las dos listas se fusionan por posición (*Reciprocal Rank Fusion*). Solo el docente dueño de la asignatura puede
usarla. Así, cada concepto, pregunta o ficha recibe los fragmentos que le corresponden, y no solo el comienzo del
material.

### 4.3 Propuestas de la IA

| Propuesta | Ruta | Cómo funciona |
|---|---|---|
| Conceptos y prerrequisitos | `generate-concepts` | Recorre el material por tramos (`lib/concept-candidates.ts`), une sin IA los candidatos repetidos, consolida y guarda solo los prerrequisitos directos. |
| Temas | `organize-topics` | La IA agrupa los conceptos. El código comprueba que cada concepto quede en un solo tema y ordena los temas según el material. |
| Posibles duplicados | `find-duplicates` | Los embeddings de los conceptos eligen las 10 parejas más parecidas, la IA juzga cuáles son el mismo concepto y el docente decide. |
| Preguntas | `generate-questions` | 6 preguntas de opción múltiple por concepto, con una explicación por opción, a partir de los fragmentos del concepto. El código mezcla las opciones, porque la IA tendía a poner primero la correcta. |
| Citas del material | `generate-evidence` | Para cada concepto y pregunta, una cita textual con su página. |
| Fichas de concepto | `generate-concept-cards` | "Por qué importa" y "Para qué te sirve", marcadas según su origen: material del docente o conocimiento general. |
| Recursos abiertos | `generate-resources` | Lectura, video y ejercicio de acceso libre, con sus enlaces verificados en el servidor (sección 7). |

Reglas comunes:
- Toda salida de la IA se valida contra un esquema con zod. Lo que no cumple se descarta.
- Todo se guarda como `sugerido`; el docente valida, edita o descarta.
- Al editar prerrequisitos, el sistema rechaza los cambios que formarían un ciclo en el grafo.

### 4.4 Citas comprobadas

Cada cita guarda el fragmento, la página y el texto citado (`evidence_spans`):
- **El código** comprueba que la cita aparezca literalmente en el fragmento.
- **Un disparador en la base** lo vuelve a comprobar (`set_evidence_span_fields`, con normalización de espacios y
  comillas).

Una cita inventada por la IA no se guarda. El docente ve "Fuente en el material · pág. N" al validar. El estudiante no
ve las citas.

## 5. Modelo del estudiante (determinista, sin IA)

### 5.1 Estado de cada concepto (`lib/concept-state.ts`)

| Estado | Condición |
|---|---|
| Sin evidencia | Ninguna respuesta medida. |
| Brecha | Estimación por debajo de 0,7. Con menos de 3 respuestas se muestra "poca evidencia". |
| En desarrollo | Estimación de 0,7 o más, sin confirmar: poca evidencia, o venía de una brecha y le falta la comprobación diferida. |
| Dominado | Estimación de 0,7 o más, con al menos 3 respuestas y, si fue brecha, con la comprobación diferida superada. |

- **Estimación:** aciertos ponderados sobre respuestas. Cada respuesta pierde la mitad de su peso cada 30 días.
- **Qué cuenta:** las respuestas de diagnósticos y comprobaciones. La práctica no cuenta, porque muestra la
  explicación.
- **Salida de una brecha:** al superar una comprobación estando en brecha, el estado se calcula desde esa
  comprobación.
- **Explicación visible:** cuántas respuestas hay, cuántas correctas y cuándo fue la última.

### 5.2 Grafo de conocimiento (`lib/knowledge-graph.ts`)

- Prerrequisitos y dependientes de cada concepto.
- Dependencias entre temas, calculadas a partir de los prerrequisitos.
- Orden de aprendizaje: los prerrequisitos van primero.
- Flechas del mapa sin las redundantes.
- **Brecha prioritaria:** la brecha que bloquea más conceptos.

### 5.3 Diagnóstico adaptativo por tema (`lib/topic-diagnosis.ts`)

Busca la brecha raíz en 5 a 10 preguntas:
1. Empieza por los conceptos "de arriba" del tema, los que ningún otro concepto del tema necesita.
2. Si el estudiante acierta, no se gastan preguntas en los prerrequisitos de ese concepto.
3. Si falla, recibe una segunda pregunta del mismo concepto. Si queda por debajo del umbral, el diagnóstico baja a los
   prerrequisitos directos.
4. Si la búsqueda termina antes de 5 preguntas, sigue con los conceptos del tema que no se preguntaron.
5. **Brecha raíz:** un concepto en brecha cuyos prerrequisitos no están en brecha.

El estudiante no recibe el índice de la respuesta correcta. Las preguntas llegan por la RPC
`get_diagnostic_questions` y cada respuesta se corrige en la base con `submit_answer`. Las preguntas que nunca se
respondieron tienen prioridad (`lib/question-selection.ts`).

### 5.4 Ruta de nivelación (página del concepto)

Para cerrar una brecha, el estudiante sigue seis pasos. Se recomienda un orden, pero ninguno bloquea a otro:
1. **Qué es:** la descripción validada del concepto.
2. **Por qué importa y para qué te sirve:** la ficha validada.
3. **Un recurso abierto:** lectura, video o ejercicio.
4. **Explícalo con tus palabras:** práctica de recuperación, en la que el estudiante se autoevalúa.
5. **Practica:** preguntas que ya vio, con la explicación de cada opción (`submit_practice_answer`).
6. **Comprueba:**
   - **inmediata:** 2 preguntas nuevas; si las supera, el concepto pasa a "en desarrollo";
   - **diferida o final:** se habilita 2 días después y la base la rechaza si llega antes; si la supera, la brecha
     queda cerrada.

### 5.5 Siguiente paso (`lib/next-step.ts`)

Se calcula una sola acción, la primera que corresponda en este orden:
1. una comprobación final que ya toca;
2. una brecha que se practicó y todavía no se comprobó;
3. la brecha prioritaria;
4. un concepto en desarrollo con poca evidencia;
5. el siguiente tema sin evidencia;
6. repasar.

### 5.6 LRR (`lib/lrr.ts`)

**LRR = brechas cerradas ÷ brechas identificadas**, por estudiante, por concepto y por clase.
- **Brecha identificada:** un concepto por debajo de 0,7 en el primer diagnóstico.
- **Brecha cerrada:** el modelo la da por dominada, lo que exige superar la comprobación diferida.
- Las brechas pendientes cuentan en el denominador.

Durante el piloto se calcula en paralelo la definición anterior (`computeStudentGapsLegacy`) para comparar las dos.

### 5.7 Autorregulación (`lib/self-regulation.ts`)

Es un cuestionario de 52 ítems con dos escalas, conocimiento y regulación de la cognición. Calcula las medias, asigna
tramos provisionales y da sugerencias. Los ítems son de terceros: ver `docs/REGISTRO_TERCEROS.md`, T-030.

Reglas de privacidad:
- el docente nunca ve las respuestas individuales;
- ve un resumen de la clase solo cuando hay 5 o más respuestas;
- ve el resultado de un estudiante solo si ese estudiante decide compartirlo.

## 6. Modelo de datos

El esquema completo está en `supabase/migrations/`, que tiene 30 migraciones. Las tablas principales son:

| Tabla | Contenido |
|---|---|
| `profiles` | Rol de cada usuario (`estudiante` o `docente`) y nombre |
| `subjects` | Asignaturas, con su código de clase y una descripción opcional |
| `units`, `topics` | Unidades (opcionales) y temas de la asignatura, con posición y estado |
| `enrollments` | Inscripción de cada estudiante en cada asignatura |
| `subject_documents`, `document_chunks` | Documentos subidos y sus fragmentos, con embedding, páginas, sección y texto completo |
| `concepts` | Conceptos, con `prerequisite_ids`, `topic_id`, `status` y embedding |
| `concept_duplicate_candidates`, `concept_pair_dismissals` | Posibles duplicados y parejas que el docente marcó como distintas |
| `questions` | Preguntas de opción múltiple con su explicación por opción y su estado |
| `evidence_spans` | Citas del material, con página, de cada concepto o pregunta |
| `concept_cards`, `concept_resources` | Fichas de concepto y recursos abiertos, con su origen y estado |
| `diagnostic_attempts`, `diagnostic_answers` | Sesiones (diagnóstico, tema o concepto) y respuestas, con su etapa (`diagnostico`, `practica`, `comprobacion`, `comprobacion_diferida`, entre otras) |
| `self_regulation_responses`, `self_regulation_shares` | Respuestas al cuestionario y con qué asignaturas se comparte el resultado |
| `teacher_invites` | Códigos de invitación de docente, uno por docente |
| `ai_usage` | Registro de llamadas a la IA, para la cuota |
| `pilot_requests` | Solicitudes de piloto de la página pública |

Las respuestas se vinculan al concepto por su identificador (`concept_id`), que un disparador copia desde la pregunta.
Así, si se renombra un concepto, su historial no se pierde.

## 7. Seguridad

- **RLS en todas las tablas.** El estudiante solo lee lo validado de las asignaturas en las que está inscrito. El
  docente solo gestiona sus propias asignaturas. Las funciones auxiliares (`is_enrolled`, `is_subject_owner`,
  `is_teacher`) son `security definer` con `search_path` fijo.
- **Diagnóstico corregido en la base:** el estudiante no lee la tabla `questions` ni inserta respuestas directamente.
  Usa `get_diagnostic_questions` (sin la respuesta correcta) y `submit_answer`, que corrige la respuesta y exige
  inscripción.
- **Roles:**
  - toda cuenta nueva es de estudiante;
  - una cuenta es de docente solo si se registra con un código de invitación válido y sin usar, que se gasta en la
    misma operación;
  - los usuarios solo pueden cambiar su nombre en `profiles`, no su rol;
  - solo los docentes crean asignaturas.
- **Claves:** `OPENAI_API_KEY` y `SUPABASE_SERVICE_ROLE_KEY` existen solo en el servidor. Nunca están en el
  repositorio.
- **Cuota de IA:** 30 llamadas por usuario cada 24 horas (`consume_ai_quota`). Además, las rutas de IA validan los
  identificadores, exigen que el usuario sea dueño de la asignatura y no muestran errores internos.
- **Enlaces de recursos** (`lib/link-check.ts`): el servidor solo visita direcciones `https` sin usuario ni puerto,
  cuyo dominio resuelva únicamente a IP públicas. Lo comprueba en cada redirección, con un máximo de 3 redirecciones y
  6 segundos. Así se evita que el servidor sirva para visitar la red interna.
- **Cuentas:** la cuenta se confirma por correo y la contraseña se recupera con un enlace (`token_hash` + `verifyOtp`).
  La contraseña tiene al menos 8 caracteres.
- **Formulario público:** validación con zod y un campo trampa contra robots. La tabla no tiene permisos para los
  usuarios de la app.

## 8. Instalación y despliegue

**Requisitos:**
- Node.js 20.9 o superior;
- un proyecto de Supabase con la extensión pgvector;
- una clave de la API de OpenAI;
- opcional: una cuenta de Vercel para publicar.

**Variables de entorno** (archivo `.env.local`, que no se incluye en el repositorio):

| Variable | Dónde se usa |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Dirección del proyecto de Supabase (navegador y servidor) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publicable de Supabase (navegador y servidor) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor: formulario de piloto |
| `OPENAI_API_KEY` | Solo servidor: rutas de `app/api/` |

**Pasos:**
1. `npm install`
2. Crear la base de datos: `npx supabase link --project-ref <proyecto>` y después `npx supabase db push`, que aplica
   las migraciones de `supabase/migrations/`.
3. En el panel de Supabase:
   - activar la confirmación de correo;
   - poner la contraseña mínima en 8 caracteres;
   - configurar la Site URL y las URL de redirección;
   - pegar las plantillas de `supabase/templates/`;
   - opcional: configurar un SMTP propio.
4. `npm run build` y luego `npm run start`. Para desarrollo, `npm run dev` en http://localhost:3000.
5. Crear un código de docente desde el SQL Editor de Supabase con `select create_teacher_invite('nota');`. Después,
   registrarse con ese código.

**Publicación:** el repositorio se conecta a Vercel. Las cuatro variables de entorno deben existir también allí.
Cada push a `main` despliega una versión nueva.

## 9. Limitaciones conocidas

- No hay pruebas automáticas ni integración continua. Los algoritmos de `lib/` se probaron con casos simulados fuera
  del proyecto.
- No hay un entorno de desarrollo separado de producción.
- Los parámetros del modelo del estudiante son provisionales y se calibran con el piloto: umbral de 0,7, 30 días, 3
  respuestas y 2 días para la comprobación final.
- No se procesan PDF escaneados (sin OCR) ni fórmulas complejas.
- El cuestionario de autorregulación es preliminar: falta el permiso de los autores de los ítems y la validación de un
  experto.
- El diseño está pensado primero para el celular en las pantallas del estudiante, y para la computadora en las del
  docente.
