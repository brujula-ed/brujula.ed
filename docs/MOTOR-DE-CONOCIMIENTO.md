# brújula.ed · Motor de conocimiento (propuesta para discutir)

Borrador del 30/10/2026. Describe la capa que convierte el material del docente en conocimiento estructurado y las
respuestas del estudiante en un diagnóstico útil. Se diseña junto con el diagnóstico y la recuperación (ver
`docs/PRINCIPIOS-DE-DISENO.md`, sección 8). Nada de esto está decidido: las preguntas abiertas están en la sección 7.

## 1. Para qué

Hoy la app cumple el ciclo del Anexo I (ubicar → diagnosticar → detectar → nivelar → comprobar), pero de forma
genérica:
- la IA ve solo el comienzo del material;
- las preguntas no salen del material;
- una brecha es "menos de 70 % de aciertos";
- la nivelación es leer una descripción.

El motor de conocimiento tiene que lograr que:
1. **El docente vea de dónde sale cada propuesta** (cita y página del material) y valide más rápido y con más
   confianza.
2. **El diagnóstico busque la causa:** si el estudiante falla un concepto, averiguar qué prerrequisito falta, en
   lugar de solo contar aciertos.
3. **El estado de cada concepto diga cuánta evidencia lo respalda,** y no afirme más de lo que sabe.
4. **Cerrar una brecha sea un recorrido real,** con material del curso, práctica con retroalimentación y una
   comprobación que dure.

Era la idea original del proyecto y nunca se implementó: embeddings para relacionar y agrupar conceptos, ciencia de
datos para estimar brechas y su cierre, y búsqueda híbrida sobre todo el material con un "span de evidencia".

## 2. Reglas que lo acotan

- **La IA propone, el docente valida** (`PRINCIPIOS-DE-DISENO.md` 1.1). Temas, relaciones, citas y preguntas son
  propuestas.
- **Determinista y trazable** (1.4). La IA generativa extrae, redacta y propone. Lo que **estima el dominio del
  estudiante** es un algoritmo fijo, documentado y sin IA, que explica su resultado con las respuestas que lo producen.
- **Incertidumbre a la vista y sin bloquear** (Anexo I, sec. 10). Si la evidencia no alcanza, se dice. Una brecha
  nunca impide avanzar.
- **Trazabilidad hasta el material utilizado** (Anexo I, sec. 11): asignatura → unidad → tema → concepto →
  prerrequisito → pregunta → respuesta → resultado → material → recomendación.
- **Organización por unidad y tema** (Anexo I, sec. 4 y 6). Hoy no existe.
- **Proporcionalidad** (Anexo I, sec. 8). Nada de arquitecturas más complejas de lo que el piloto puede validar: el
  motor crece por fases (sección 5).
- **Pocos datos y costo controlado.** Se reutiliza el límite de IA por usuario (`consume_ai_quota`).

## 3. Estado real (verificado en el código)

| Pieza | Hoy | Dónde |
|---|---|---|
| Extracción | Texto entero, sin páginas (aunque `pdf-parse` v2 ya da `pages: [{ num, text }]`) | `lib/extract-text.ts` |
| Troceado | Trozos fijos de 1500 caracteres con espacios aplanados: se pierden títulos, párrafos y página | `lib/chunk-text.ts` |
| Embeddings | Se guardan (`vector(1536)`, índice HNSW) pero **nadie los consulta** | `document_chunks`, migración base |
| Texto completo | No hay índice de texto ni búsqueda por palabras | — |
| Conceptos | La IA recibe solo los **primeros 40 fragmentos** (12 000 caracteres) | `app/api/generate-concepts` |
| Fichas | Igual: primeros 40 fragmentos | `app/api/generate-concept-cards` |
| Preguntas | Solo nombre y descripción del concepto, **sin material**; sin explicación ni dificultad | `app/api/generate-questions` |
| Estructura | Conceptos con `prerequisite_ids`; sin unidades, temas ni embedding de concepto | `concepts` |
| Estado del estudiante | Aciertos ÷ preguntas ≥ 0,7 en el intento más reciente; sin dificultad, grafo ni incertidumbre | `lib/concept-state.ts`, `lib/lrr.ts` |
| Respuestas | Se guarda la opción elegida (`selected_index`): permitiría saber qué error revela cada opción | `diagnostic_answers` |

## 4. Las cinco piezas

### 4.1 Ingesta con estructura

- **Qué:** guardar el material con su forma (página, sección, orden) en lugar de una tira de texto.
- **Cómo:**
  - **PDF:** texto por página, con `pdf-parse` (ya disponible).
  - **Word:** párrafos y títulos (mammoth puede dar HTML con títulos; **a verificar**).
  - **Troceado:** trozos que respetan párrafos y oraciones (unos 800–1200 caracteres, con solapamiento), cada uno con
    página de inicio y fin, sección y posición en el documento.
- **Datos:** columnas nuevas en `document_chunks` (`page_start`, `page_end`, `section`, `position`) y una columna de
  texto completo en español (`tsvector`, con índice GIN).
- **Hecho (30/10/2026):**
  - migración `fragmentos_con_estructura`, `lib/extract-text.ts` y `lib/chunk-text.ts`;
  - se quitan encabezados y pies de página repetidos;
  - probado con un PDF de 55 páginas.
- **Idioma:** por ahora solo español (decisión de Sergio, 30/10/2026). Cuando haya material en inglés, se detecta el
  idioma de cada documento y la búsqueda por palabras usa el análisis de ese idioma.
- **Aporta:** la página y la sección para citar. Es la base de todo lo demás.

### 4.2 Búsqueda híbrida y span de evidencia

- **Qué:** encontrar en todo el material los fragmentos relevantes para un concepto o una pregunta, y citar la
  evidencia exacta.
- **Cómo:** una función SQL que combina la búsqueda vectorial (pgvector, por significado) y la de texto completo (por
  palabras exactas: fórmulas, nombres, términos técnicos). Las dos listas se fusionan por posición (Reciprocal Rank
  Fusion). Solo el docente dueño de la asignatura puede usarla, porque el estudiante no lee fragmentos.
- **Usos:**
  1. **Conceptos sobre todo el material:** se extraen candidatos por sección y luego se unen y deduplican con
     embeddings, en lugar de leer solo el comienzo.
  2. **Fichas, preguntas y nivelación con contexto:** cada concepto recibe los fragmentos que le corresponden.
  3. **Span de evidencia:** cada concepto y cada pregunta guardan su cita (fragmento, página y texto citado). **La cita
     se comprueba literalmente** contra el fragmento: si la IA inventa una cita, se descarta. Es una verificación
     determinista, como la de los enlaces en F-11.
- **Datos:** una tabla de evidencias (a qué pertenece, fragmento, página y cita).
- **Hecho (30/10/2026):**
  - **Búsqueda híbrida:** migración `busqueda_hibrida` y `lib/search-material.ts`.
  - **Conceptos sobre todo el material:** se lee por tramos, se unen los repetidos sin IA, se consolida y se guardan
    solo los prerrequisitos directos (`lib/concept-candidates.ts`).
  - **Citas comprobadas:**
    - migración `evidencias_del_material`, con la tabla `evidence_spans`, y `lib/concept-evidence.ts`;
    - la base vuelve a comprobar cada cita;
    - se ven en la página de conceptos, con el botón "Buscar fuentes".
  - **Probado con un PDF de 60 páginas:** 23 conceptos, todos con cita, y 28 de 28 citas literales. Generar los
    conceptos costó unos 0,01 USD.
- **Hecho (30/10/2026), preguntas con material:**
  - migración `explicaciones_de_preguntas` (`questions.explanations`);
  - cada concepto recibe sus fragmentos;
  - cada pregunta trae una explicación por opción, que se mezcla junto con las opciones, y una cita comprobada
    (`evidence_spans.question_id`);
  - el estudiante no recibe las explicaciones (`get_diagnostic_questions` no las devuelve);
  - probado con 6 conceptos: 24 preguntas con sus 4 explicaciones, 23 con cita literal.
- **Costo de todas las pruebas de la fase 1:** unos 0,03 USD.
- **Pendiente:**
  - elegir o descartar citas al validar (rediseño de la validación);
  - detectar duplicados cercanos, como "Videojuego como discurso" y "Discurso videolúdico" (fase 2);
  - ajustar el prompt de preguntas para que no diga "según el material" (el estudiante quizás no lo leyó);
- **Hecho (30/10/2026), fichas con material:** cada ficha recibe los fragmentos de su concepto. Probado: 6 de 6 fichas
  salieron del material, en 2 llamadas. **Con esto, la fase 1 está completa.**
- **Aporta:**
  - al docente: "Fuente en el material · pág. 12" al validar (la maqueta de validación);
  - al estudiante: material del propio curso, citado, cuando repasa.

### 4.3 Relaciones entre conceptos y temas

- **Qué:** usar los embeddings para proponer una estructura mejor que la lista plana de hoy.
- **Cómo:**
  1. **Embedding de cada concepto** (nombre, descripción y evidencia).
  2. **Duplicados:** conceptos muy cercanos se proponen para fusionar.
  3. **Prerrequisitos candidatos:** se puntúan con señales combinadas: cercanía semántica, orden de aparición en el
     material (lo previo suele aparecer antes) y aparición en los mismos fragmentos. Solo los pares mejor puntuados
     pasan a la IA para que proponga si hay dependencia y en qué sentido. Así se gasta menos y se inventa menos.
  4. **Temas y unidades:** se agrupan conceptos cercanos, respetando el orden y los títulos del material. Lo propone el
     algoritmo; el docente renombra, mueve y valida.
- **Datos:** embedding en `concepts`, tabla de temas o unidades, y sugerencias de relación con su estado (propuesta,
  validada, descartada).
- **Decisiones (30/10/2026):**
  1. **Niveles:** cada concepto pertenece a un **tema**. Los temas se pueden agrupar en **unidades** si el docente
     quiere (como en su programa), pero no es obligatorio.
  2. **Un concepto está en un solo tema.** Si otro tema lo necesita, se ve como prerrequisito.
  3. **Las relaciones entre temas se calculan solas:** si un concepto del tema B necesita uno del tema A, B depende
     de A. Es determinista y siempre coherente con los prerrequisitos validados.
  4. **El campo "Tema" de la asignatura pasa a ser una descripción opcional** ("De qué trata la asignatura"), que sigue
     sirviendo de contexto para la IA y de subtítulo.
- **Hoy:** `subjects.topic` es un único texto obligatorio por asignatura ("Tema" al crearla), que se usa como
  subtítulo y como contexto para la IA. Confunde, porque una asignatura tiene muchos temas. En la fase 2 se decide si
  pasa a ser una descripción opcional o si se quita. El estudiante ya se inscribe a la asignatura entera (código de
  clase); los temas viven dentro de ella.
- **Aporta:**
  - un mapa agrupado por tema (legible con 30 o más conceptos);
  - elegir "asignatura, unidad y tema" (Anexo I);
  - un grafo más fiel, que hace posible el diagnóstico que busca la causa.

### 4.4 Modelo del estudiante (sin IA, con incertidumbre)

- **Qué:** estimar el dominio de cada concepto con la evidencia disponible y decir cuánta hay.
- **Cómo (propuesta por etapas):**
  1. **Estimación con incertidumbre:** cada respuesta suma evidencia a favor o en contra (un modelo
     bayesiano simple, beta-binomial), y la evidencia vieja pesa menos.
     - El estado sale de la estimación **y** de su incertidumbre: "dominado" solo si es alto con suficiente evidencia.
     - Si la evidencia no alcanza, el estado lo dice ("aún poca evidencia"), en lugar de sentenciar con 2 preguntas.
  2. **Diagnóstico que busca la causa:** se parte del tema elegido.
     - Si el estudiante falla un concepto, se preguntan sus prerrequisitos, bajando por el grafo hasta encontrar el
       primero que falla (la brecha raíz).
     - Si acierta, no se gastan preguntas en lo previo.
     - Son 5 a 10 preguntas (Anexo I), elegidas por lo que más informa.
  3. **Errores que revelan:** cada opción incorrecta lleva el error conceptual que representa, propuesto por la IA y
     validado por el docente. La opción elegida, que ya se guarda, dice qué malentendido tiene el estudiante, no solo
     que se equivocó.
  4. **Con datos del piloto:** estimar la dificultad real de cada pregunta (teoría de respuesta al ítem) y modelos
     que consideran el aprendizaje en el tiempo (trazado del conocimiento).
- **Explicación siempre visible:** "Estimado con 4 respuestas: 3 correctas, la última hace 2 días".
- **Datos:** estimaciones por estudiante y concepto (o cálculo al vuelo, como hoy); dificultad y error conceptual por
  pregunta y opción.
- **Aporta:** un diagnóstico que deja de ser "mecánico" y estados que no afirman más de lo que saben.

### 4.5 Cierre de brechas

- **Qué:** que recuperar una brecha sea un recorrido que funcione y que la comprobación dure.
- **Recorrido propuesto para una brecha:**
  1. Por qué importa (ficha validada).
  2. El material del propio curso, citado (4.2).
  3. Un recurso abierto (F-11).
  4. Explicarlo con sus palabras (F-09).
  5. Práctica con retroalimentación por opción: por qué esa respuesta es incorrecta (explicación validada).
  6. Comprobación.
- **Comprobación en dos tiempos:**
  - **Inmediata:** el concepto pasa a "en desarrollo".
  - **Diferida, días después** (repetición espaciada, F-25): recién entonces la brecha se da por cerrada. Recordar
    después de un tiempo es mejor evidencia que acertar justo después de repasar.
- **Aporta:** el LRR mide recuperaciones que duran. Se cruza con F-20 (qué recursos ayudan a cerrar brechas).

## 5. Fases propuestas

Cada fase entrega algo visible y se puede validar antes de seguir.

| Fase | Contenido | Qué se ve | Cambios de datos |
|---|---|---|---|
| 1. Evidencia | Ingesta con páginas (4.1), búsqueda híbrida y citas comprobadas (4.2); conceptos sobre todo el material; preguntas y fichas con material; explicación por opción | "Fuente en el material · pág. N" al validar; preguntas del propio curso | Columnas en `document_chunks`, tabla de evidencias, explicación en preguntas |
| 2. Estructura | Embeddings de conceptos, duplicados, prerrequisitos candidatos y temas (4.3) | Mapa por temas; elegir unidad y tema; sugerencias de relación para validar | Temas, sugerencias, embedding de concepto |
| 3. Diagnóstico | Modelo con incertidumbre y diagnóstico que busca la causa (4.4, etapas 1 a 3); recorrido de cierre (4.5) | El nuevo diagnóstico y la recuperación por concepto | Errores por opción; estimaciones |
| 4. Calibración | Dificultad real de las preguntas, comprobación diferida y qué recursos ayudan (4.4 etapa 4, F-20, F-25) | Estados más precisos; LRR de recuperaciones que duran | Según lo que muestren los datos del piloto |

Antes de presentar la app se piensa borrar la base y empezar de cero (`docs/PENDIENTES.md`, pendiente 11). Si eso se
mantiene, no hace falta migrar ni reprocesar los datos actuales.

## 6. Costos y riesgos

- **Embeddings:** baratos. **Extraer conceptos de todo el material** usa más tokens que hoy, y conviene medirlo con
  un material real antes de la fase 1.
- **Tiempo de proceso:** Vercel Hobby corta las funciones a los 300 s, y un material largo procesado por secciones
  puede pasarse. Quizás haya que procesar por partes con un estado ("procesando 3 de 8 secciones").
- **Calidad de la extracción:** los PDF con fórmulas o escaneados siguen siendo un límite (OCR y fórmulas son trabajo
  futuro).
- **Modelo del estudiante:** sin datos reales sus parámetros son supuestos. Por eso la fase 3 usa un modelo simple y
  explicable, y la calibración espera al piloto.
- **Validación docente:** más propuestas (temas, relaciones, errores por opción) son más trabajo para el docente. El
  diseño de la validación (flujo continuo, `PRINCIPIOS-DE-DISENO.md` 2.4) tiene que absorberlo.

## 7. Decisiones (30/10/2026)

1. **Unidades y temas: híbrido.** El docente los define o, si prefiere, el algoritmo los propone y el docente los
   ajusta y valida.
2. **Umbral de dominio:** 0,7 como referencia, ajustable con el piloto, ahora junto con la incertidumbre (no se declara
   "dominado" con poca evidencia).
3. **Comprobación diferida: necesaria para cerrar una brecha.** Así el cierre es legítimo y no superficial.
   - **Cuándo:** se habilita a los 2 días, se sugiere a los 3 y queda abierta después. Nunca en la misma sesión del
     repaso.
   - **Por qué esos días:** la investigación sobre práctica espaciada (Cepeda et al., 2008) sitúa la mejor separación
     en torno al 10–20 % del tiempo que se quiere retener. Para retener 2 a 4 semanas, eso da unos 2 a 5 días.
   - **Ajuste:** con el piloto.
4. **LRR:** su definición cambia si el modelo lo necesita. Durante el piloto se calcula también la actual, en
   paralelo, para comparar y presentárselo a Adri con muestras.
5. **Errores por opción:** el docente los valida en bloque, con la pregunta.
6. **Entradas al diagnóstico:**
   - **Principal, por tema:** el estudiante elige el tema que va a estudiar, o el docente marca "el tema de esta
     semana". El diagnóstico baja por los prerrequisitos hasta la brecha raíz, en 5 a 10 preguntas.
   - **Por concepto:** desde el mapa ("ponme a prueba en esto").
   - **Ubicación inicial opcional:** unas pocas preguntas sobre los conceptos base al entrar a una asignatura, para
     que el mapa no arranque vacío.
   - **Por qué no un diagnóstico global:** es largo y dice poco de cada concepto.
7. **Costo:** tope absoluto de 5 USD en crédito prepagado de OpenAI. Con las pruebas hasta hoy se gastaron 0,02 USD.
   - Mantener desactivada la recarga automática en la facturación de OpenAI.
   - Medir el gasto de cada fase con material real.
   - La app debe mostrar un mensaje claro cuando se acabe el crédito.
8. **Orden de trabajo:**
   1. Fase 1 por dentro, en pasos chicos que se prueban sin pantallas nuevas: ingesta con páginas → búsqueda
      híbrida → citas comprobadas → preguntas con material y explicación por opción.
   2. Base visual (componentes comunes y navegación), que no depende del motor.
   3. Validación rediseñada, ya con las citas.
   4. Fase 2: temas y relaciones, con el mapa por temas.
   5. Fase 3: diagnóstico nuevo y recorrido de cierre (el rediseño del estudiante).
