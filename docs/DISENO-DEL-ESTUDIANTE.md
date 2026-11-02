# brújula.ed · Diseño del estudiante (motor, fase 3)

Sesión de diseño del 02/11/2026. Junta el rediseño de las pantallas del estudiante con la fase 3 del motor de
conocimiento: modelo del estudiante, diagnóstico que busca la causa y recorrido para cerrar una brecha. Parte de lo ya
decidido en `docs/MOTOR-DE-CONOCIMIENTO.md` (sección 7) y resuelve los temas abiertos de
`docs/PRINCIPIOS-DE-DISENO.md` (sección 8) que tocan al estudiante.

Lo marcado **(provisional)** es una propuesta técnica que se ajusta con el piloto o con Adri.

## 1. Decisiones de esta sesión

| Tema | Decisión | Por qué |
|---|---|---|
| Navegación | Sin menú, como el docente: Mis asignaturas → asignatura → concepto. Con una sola asignatura entra directo a ella. Arriba, solo la marca, "Mis asignaturas" y la cuenta | El trabajo del estudiante ocurre dentro de una asignatura; destinos globales ("Mi mapa", "Logros") repetirían lo que ya está en ella |
| Nombres de los estados | Los mismos 4 que ve el docente (Sin evidencia, Brecha, En desarrollo, Dominado), con "poca evidencia" cuando haga falta. Sin porcentajes en pantalla | Docente y estudiante hablan igual; "cerrar brechas" es el centro del producto. Los porcentajes parecen notas (regla 1.2) |
| Cita del material para el estudiante | **Después.** En esta fase el recorrido usa ficha, recursos, explicar y practicar | Se decide junto con si el estudiante accede al material del docente (hoy no accede) |
| Explicación de cada respuesta | En la práctica, después de cada respuesta. El diagnóstico y las comprobaciones miden sin explicar; al terminar un diagnóstico se pueden revisar las respuestas con su explicación | Explicar durante una medición cambia lo que mide la pregunta siguiente |

Ya decidido antes (`docs/MOTOR-DE-CONOCIMIENTO.md`, sección 7) y que este diseño respeta:
- diagnóstico principal por tema, que baja por los prerrequisitos hasta la brecha raíz, en 5 a 10 preguntas;
- "ponme a prueba" por concepto, desde el mapa;
- ubicación inicial opcional;
- comprobación diferida necesaria para cerrar una brecha: se habilita a los 2 días, se sugiere a los 3;
- umbral de dominio 0,7, con incertidumbre;
- el LRR puede cambiar de definición y la actual se calcula en paralelo durante el piloto.

## 2. Pantallas

### 2.1 Mis asignaturas (`/estudiante`)

La página principal del estudiante (rediseñada a pedido de Sergio, 02/11/2026). En orden:
1. **Por dónde seguir:** la única tarjeta destacada; sugiere una asignatura. Primero, una con una comprobación final
   que ya toca; después, la de más brechas abiertas; después, la que tiene algo nuevo que probar; al final, la que solo
   pide repasar.
2. **Tu brújula** con el total de brechas cerradas de todas las asignaturas (las cerradas, con lo que abrieron, se ven
   en la brújula de cada asignatura).
3. **Una tarjeta por asignatura:** barra de estados de toda la asignatura, su siguiente paso y las brechas cerradas.
4. "Unirme a una asignatura" con el código de clase y "¿Cómo aprendes?" (F-08) como acceso secundario.

Con una sola asignatura también se llega aquí (decisión de Sergio: todos ven la misma pantalla al iniciar sesión).

### 2.2 Asignatura: Mi Brújula (`/estudiante/[asignatura]`)

En orden:
1. **Tu siguiente paso:** la única acción destacada de la pantalla (tarjeta verde azulado con el botón en amarillo,
   regla del amarillo de la sección 9 de los principios). Dice qué hacer y por qué, en una línea.
2. **Esta semana cerraste N brechas** (o nada, si no cerró ninguna; sin días ni rachas).
3. **Tus temas:** lista en orden de aprendizaje, cada tema con su barra de estados; al abrirlo, sus conceptos (cada
   uno lleva a su página) y "Ponme a prueba en este tema". "Ver como mapa" abre el mapa de dos niveles (decisión de
   Sergio: en el celular, lista primero y mapa aparte).
4. **Tu brújula** (F-13) con el LRR: brechas cerradas de las identificadas, cuántas esperan la final, cuáles se
   cerraron y lo que abrió cada una (decisión de Sergio: una sola sección en vez de la tarjeta del LRR aparte).

### 2.3 Concepto (`/estudiante/[asignatura]/concepto/[concepto]`, nueva)

La unidad de trabajo (principio 2.1).
- **Arriba:** nombre, estado y de dónde sale ("Estimado con 4 respuestas: 3 correctas, la última hace 2 días"). Qué
  necesita y qué abre.
- **Recorrido para cerrar la brecha** (también sirve para repasar un concepto sin brecha):
  1. qué es: la descripción validada del concepto, lo primero (agregado a pedido de Sergio, 02/11/2026);
  2. por qué importa y para qué te sirve (ficha validada);
  3. un recurso abierto (F-11);
  4. explícalo con tus palabras (F-09, la práctica que ya existe);
  5. practica: preguntas con la explicación de cada respuesta;
  6. comprueba: la comprobación inmediata y, días después, la diferida.
- Los pasos no se bloquean entre sí (Anexo I, sec. 10): se recomienda el orden, pero se puede ir directo a comprobar.
- La acción principal cambia según el momento: "Empieza el repaso", "Comprueba ahora" o "Vuelve el jueves para la
  comprobación final".

### 2.4 Diagnóstico de un tema (`/diagnostico/[asignatura]?tema=`, pantalla de foco)

- Sin encabezado de la app; solo salir y el avance ("pregunta 4 · como máximo 10").
- Una pregunta por pantalla, sin explicación al responder.
- **Al terminar:** estados del tema (sin porcentajes), la brecha raíz ("Tu brecha está en X: empieza por ahí", que
  lleva a su página) y "Revisar mis respuestas", con la explicación de cada una.
- El diagnóstico global actual desaparece como entrada principal. La ubicación inicial (pocas preguntas de los
  conceptos base) queda como opción al entrar por primera vez a una asignatura.

## 3. Lógica (determinista, sin IA)

### 3.1 Estado de cada concepto (provisional)

- **Qué cuenta como evidencia:** las respuestas de diagnósticos y comprobaciones. La práctica no cuenta: reutiliza
  preguntas ya vistas y muestra la explicación.
- **Estimación:** aciertos sobre respuestas, cada una con su peso; las respuestas pierden la mitad de su peso cada 30
  días. (Se probó partir de "una a favor y una en contra", pero un solo acierto daba 0,67 = brecha; la incertidumbre la
  marca "poca evidencia".)
- **Evidencia suficiente:** al menos 3 respuestas, contadas sin peso (con peso, 3 respuestas de hoy serían "poca
  evidencia" mañana).
- **Salir de una brecha:** si está en brecha y supera una comprobación (2 de 2), el estado se calcula desde esa
  comprobación: lo de antes del repaso ya no describe lo que sabe. Sin esto, 2 fallos y una comprobación de 2 de 2
  darían 4 de 6 = 0,67, y seguiría en brecha. El diagnóstico no reinicia nada.
- **Estados:**
  - **Sin evidencia:** ninguna respuesta.
  - **Brecha:** estimación bajo 0,7. Con menos de 3 respuestas se muestra "poca evidencia".
  - **En desarrollo:** estimación de 0,7 o más, pero sin confirmar: poca evidencia, o era una brecha y falta la
    comprobación diferida.
  - **Dominado:** estimación de 0,7 o más, con evidencia suficiente y, si fue brecha, con la comprobación diferida
    superada.
- **Explicación siempre visible:** cuántas respuestas, cuántas correctas y cuándo fue la última.
- Docente y estudiante ven los mismos estados: el modelo reemplaza a `lib/concept-state.ts` en toda la app.

### 3.2 Diagnóstico de un tema (provisional)

1. Se empieza por los conceptos del tema de los que no depende ningún otro del tema (los "de arriba"), con 1 pregunta
   cada uno.
2. **Acierta:** no se gastan preguntas en sus prerrequisitos.
3. **Falla:** una segunda pregunta del mismo concepto para descartar un descuido. Si queda bajo 0,7 (1 de 2 o 0 de 2),
   se baja a sus prerrequisitos directos (también los de otros temas, un nivel). Es el mismo criterio que el estado.
4. **Sin preguntas:** un concepto que no tiene no se puede medir; se pasa a sus prerrequisitos del tema.
5. **Mínimo:** si la búsqueda termina antes de 5 preguntas, sigue con los conceptos del tema que no se preguntaron, en
   orden de aprendizaje. Sin esto, a quien sabe todo se le hacía una sola pregunta.
6. **Brecha raíz:** un concepto con brecha cuyos prerrequisitos no la tienen (o que no tiene prerrequisitos).
7. Se termina a las 10 preguntas o cuando no queda nada por explorar. Con temas chicos pueden ser menos de 5.
8. Las preguntas se eligen como hoy: primero las nunca respondidas.

Implementado en `lib/topic-diagnosis.ts`, probado con 9 estudiantes simulados fuera del proyecto.

### 3.3 Cerrar una brecha (provisional)

- **Comprobación inmediata:** 2 preguntas no vistas (o las respondidas hace más tiempo). Si se superan, el concepto
  pasa a "en desarrollo".
- **Comprobación diferida:** se habilita 2 días después de superar la inmediata y se sugiere a los 3. Si se supera, la
  brecha queda **cerrada** (momento de cierre de F-13). Si no, vuelve a brecha y se puede repetir el recorrido.
- **LRR nuevo:** brechas cerradas con la comprobación diferida ÷ brechas identificadas (un concepto que entró en
  brecha con evidencia de un diagnóstico). La definición actual se sigue calculando en paralelo para compararlas con
  Adri.

### 3.4 Siguiente paso (por orden)

1. Una comprobación diferida que ya toca.
2. Una comprobación inmediata pendiente (hizo el repaso, falta comprobar).
3. La brecha prioritaria: la raíz que más conceptos bloquea.
4. El siguiente tema sin evidencia, en orden de aprendizaje.
5. Todo al día: repasar lo que lleva más tiempo sin comprobar.

### 3.5 Banco de preguntas (provisional)

- La IA genera **6 preguntas por concepto** (hoy 4). El mínimo para "lista para estudiantes" sigue en 2 validadas.
- **Práctica:** solo con preguntas que el estudiante ya respondió en una medición. Así la práctica no revela la
  respuesta de preguntas que todavía pueden salir en una comprobación.
- **Comprobaciones:** preguntas no vistas o, si no quedan, las respondidas hace más tiempo.
- **Si no hay preguntas suficientes**, se dice ("tu docente aún no tiene más preguntas de este concepto"); nada se
  inventa.

## 4. Datos

- `diagnostic_answers.stage` suma `practica`, `comprobacion` y `comprobacion_diferida`. Hoy acepta solo `diagnostico` y
  `microevaluacion`; las respuestas viejas se siguen leyendo. Migración nueva.
- **RPC de práctica:** corrige y devuelve la explicación de la opción elegida y de la correcta, solo para preguntas que
  el estudiante ya respondió.
- **Preguntas:** `get_diagnostic_questions` (todas las de la asignatura, sin `correct_index`); se filtran por concepto o
  tema en la app.
- **Revisar respuestas:** `get_answer_review`, solo de sesiones propias y terminadas.
- **Estados y siguiente paso:** se calculan al vuelo desde las respuestas, como hoy; no hay tabla de estimaciones.
- **Sesiones:** `diagnostic_attempts` con `kind` (`diagnostico` | `tema` | `concepto`) y `topic_id` o `concept_id`.
  La comprobación diferida se acepta en la base solo 2 días después de una comprobación del mismo concepto.

## 5. Entregas (una por vez, cada una probada en el celular)

1. **Modelo del estudiante** (`lib/concept-state.ts`), sin pantallas nuevas. Toda la app pasa a usarlo; el LRR actual
   no cambia. Hecha el 02/11/2026, probada con 15 casos fuera del proyecto.
2. **Banco y RPC:** migración `sesiones_y_etapas` (intentos como sesiones, etapas nuevas, `submit_practice_answer`,
   `get_answer_review`) y 6 preguntas por concepto. Hecha el 02/11/2026. No hizo falta una RPC para pedir preguntas por
   concepto o tema: `get_diagnostic_questions` ya devuelve todas las de la asignatura y se filtran en la app.
3. **Página del concepto** con el recorrido (ficha, recurso, explicar, practicar y comprobación inmediata). Hecha el
   02/11/2026: `app/estudiante/[subjectId]/concepto/[conceptId]`, `components/concept-journey.tsx` y
   `components/concept-quiz.tsx`. Lista de pasos con el recomendado abierto (decisión de Sergio); "Explícalo" dentro de
   la página (`/practicar` redirige). Se adelantó de la entrega 5 la comprobación final: cuando ya toca, el botón la
   ofrece y guarda `comprobacion_diferida`.
4. **Diagnóstico de un tema** (adaptativo), con su resultado y la revisión de respuestas. Hecha el 02/11/2026:
   `app/diagnostico/[subjectId]/tema/[topicId]`, `components/topic-diagnostic.tsx`, `lib/topic-diagnosis.ts` y piezas
   comunes en `components/quiz-parts.tsx`. Sin el encabezado de la app en `/diagnostico/`. Entrada provisional en Mi
   Brújula ("Ponte a prueba por tema") hasta la entrega 6.
5. **Momento de cierre** y LRR nuevo (la comprobación diferida ya se ofrece desde la entrega 3). Hecha el
   02/11/2026: `computeStudentGaps` en `lib/lrr.ts` usa la definición nueva (acordada con Adri) en toda la app; la
   anterior queda como `computeStudentGapsLegacy` y se muestra en una línea de la pestaña Estudiantes. Para comparar,
   la anterior cuenta las comprobaciones como la microevaluación que reemplazan. El momento de cierre
   (`components/gap-closure-moment.tsx`) aparece al superar la comprobación final. Probado con 9 casos fuera del
   proyecto.
6. **Mi Brújula y Mis asignaturas** rediseñadas, con el siguiente paso. Hecha el 02/11/2026: `lib/next-step.ts`
   (probado con 12 casos fuera del proyecto), `components/next-step-card.tsx`, `components/topic-list.tsx`,
   `components/map-disclosure.tsx` y `recoveredSince` en `lib/gap-closure.ts`. Decisiones de Sergio sobre el orden de
   3.4: "hizo el repaso" = practicó preguntas del concepto (la explicación no se guarda), y los conceptos en desarrollo
   con poca evidencia van entre la brecha prioritaria y el tema sin evidencia. Con todo al día y una final pendiente,
   dice cuándo volver. Mis asignaturas sugiere una asignatura y suma las brechas de todas (2.1); no hay entrada directa
   con una sola asignatura. Se borraron `components/next-steps.tsx`, `components/lrr-card.tsx` y
   `computeNextChallenge`. El diagnóstico global se queda sin enlaces hasta la entrega 7.
7. **Ubicación inicial** opcional.

## 6. Abierto

- Cita del material para el estudiante (decidido: después).
- Etiqueta de "error conceptual" por opción (etapa 3 del modelo): por ahora se usan las explicaciones por opción que
  ya valida el docente. Se reconsidera con datos del piloto.
- "Tema de esta semana" marcado por el docente: después de la entrega 6, si el piloto lo pide.
- Parámetros del modelo (30 días, 3 respuestas, 2 preguntas por comprobación): se calibran con el piloto.
