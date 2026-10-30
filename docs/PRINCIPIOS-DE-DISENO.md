# brújula.ed · Principios de diseño

Criterio con el que Sergio y Code deciden cada cambio de diseño, navegación y movimiento de la app. Se escribió sobre
la app real (octubre de 2026). Las maquetas de `docs/redesign/` son inspiración, no un molde; el borrador original
de Claude Desktop está en `docs/redesign/PRINCIPIOS-DE-DISENO (Claude Desktop).md`.

Identidad, colores y tipografías: `docs/IMAGEN-CORPORATIVA.md`.

**Cómo se usa:** las reglas de la sección 1 no se cambian. Todo lo demás se puede ajustar si hay un motivo; cada
cambio se anota en la sección 9 con su porqué.

---

## 1. Reglas fijas del producto

1. **La IA propone, el docente valida.** Nada generado por IA llega al estudiante sin validación. La interfaz deja
   claro qué propuso la IA ("Propuesto por la IA") y dónde se aprueba.
2. **Orientar, no calificar ni etiquetar.** Los estados (dominado, en desarrollo, brecha, sin evidencia) describen un
   concepto, nunca a la persona, y no son notas.
3. **Cerrar brechas, no sumar actividad.** Lo que se reconoce es cerrar una brecha. Sin puntos, rachas, rankings ni
   premios por tiempo en pantalla.
4. **Determinista y trazable.** Estados, prioridades y métricas se calculan sin IA, y cualquier cifra que se muestra se
   puede rastrear hasta las respuestas que la producen.
5. **Transparencia y pocos datos.** Se muestra de dónde sale cada propuesta (material de origen) y qué datos se usan.
   Se guarda solo lo necesario.
6. **Recursos abiertos y métodos con evidencia.** No se crea contenido pedagógico propio: recursos abiertos curados
   (las fichas con conocimiento general son la excepción registrada en `docs/ROADMAP.md`). Recuperación activa y
   autorregulación; no "estilos de aprendizaje".

## 2. Organización y recorridos

1. **El concepto es la unidad de trabajo del estudiante.** Diagnosticar, repasar y comprobar se puede hacer concepto
   por concepto, entrando desde el mapa o desde su siguiente paso. El diagnóstico de toda la asignatura es una entrada
   más (para ubicarse al empezar o volver a medir), no el único camino.
   *Por qué:* hoy el estudiante solo puede hacer el diagnóstico global y no puede trabajar una brecha concreta.
2. **Dime qué sigue.** Antes de mostrar datos, cada pantalla dice qué hacer ahora ("Tienes 14 conceptos por validar",
   "Tu siguiente paso"). Los datos apoyan esa decisión; no la sustituyen.
3. **Una pantalla, una acción principal.** Un solo botón destaca; lo demás es secundario.
4. **El docente avanza, no vuelve.** Cada asignatura muestra en qué paso está (material → conceptos → preguntas →
   fichas y recursos → estudiantes) y cuál sigue. Generar con IA y validar ocurren en el mismo lugar, y al terminar un
   paso la pantalla ofrece el siguiente. "Volver" es una salida, no el camino normal.
   *Por qué:* hoy la página de la asignatura es un centro con enlaces a páginas separadas, y cada tarea obliga a
   regresar para seguir.
5. **"Lista para estudiantes" es una meta visible.** El docente ve cuándo su asignatura ya sirve a los estudiantes y
   qué le falta. El criterio exacto (cuántas preguntas por concepto, por ejemplo) se define con el diagnóstico (sección 8).
6. **Nada escondido que importe.** Lo que bloquea el avance (validaciones pendientes, una brecha que es prerrequisito)
   se ve sin buscarlo; los pendientes llevan contador en la navegación.
7. **Siempre se sabe dónde se está.** Destino activo marcado en el menú, migas de pan en rutas profundas, y volver
   conserva filtros y posición de la lista.
8. **Entrada según la sesión.** Sin sesión, `/` es la landing; con sesión, cada rol entra a su panel; `/inicio` muestra
   la landing siempre (sin indexar). Los enlaces que se comparten con estudiantes van a `/login`.
9. **Lenguaje universitario y claro.** Asignatura, docente, estudiante; tuteo; sin jerga técnica de IA en pantalla y sin
   "colegio", "aula" ni "curso escolar".

## 3. Lenguaje visual

Problema de partida: todo es blanco con borde gris y casi todos los títulos tienen el mismo tamaño, así que nada
destaca. Las reglas de esta sección dan planos, jerarquía y un carácter propio.

1. **Cuatro superficies, cada una con su papel.**
   | Superficie | Token | Para qué |
   |---|---|---|
   | Fondo | `--background` (niebla) | El lienzo de la página |
   | Tarjeta | `--card` (blanco) + sombra suave | Contenido agrupado |
   | Destacada | `--primary` (verde azulado) | Lo que sigue: una por pantalla como máximo |
   | Profunda | `--foreground` (abeto) | Navegación y bloques de contraste |
   *Por qué:* con planos distintos el ojo encuentra primero lo importante, sin depender de leer.
2. **Jerarquía tipográfica real.** Títulos en Onest y texto en Figtree:
   | Nivel | Tamaño | Uso |
   |---|---|---|
   | Portada | 40–48 px, 700 | Saludo o título de un inicio |
   | Título de página (h1) | 30–32 px, 700 | Uno por página |
   | Sección (h2) | 22–24 px, 600 | Bloques de la página |
   | Subsección (h3) | 18 px, 600 | Títulos de tarjeta |
   | Cifra clave | 40 px o más, 700 | El número que resume una tarjeta |
   | Cuerpo | 16 px | Texto |
   | Secundario | 14 px | Apoyo; nunca menos de 14 px |
   | Etiqueta | 12–13 px, mayúsculas, espaciada | Encima de títulos ("TU SIGUIENTE PASO") |
   Los títulos llevan interletrado negativo (−0,02 a −0,04 em), como la marca.
3. **Esqueleto de página común.** Migas (si la ruta es profunda) → título → una línea de "qué sigue" → acción
   principal → contenido. Tres anchos según el tipo de pantalla:
   - **Lectura o flujo** (diagnóstico, práctica, formularios): hasta 720 px. Se lee sin mover los ojos de lado a lado.
   - **Panel** (inicios, asignatura, reportes): hasta 1280 px, en rejilla.
   - **Trabajo** (validación, mapa): todo el ancho, en columnas.
   Márgenes laterales de al menos 16 px en el celular y de 24 a 32 px en escritorio.
4. **El color se elige por su función, no por gusto.**
   - **Verde azulado:** acción y marca (botón principal, enlaces, selección, tarjeta destacada).
   - **Abeto:** estructura (navegación, bloques de contraste, texto).
   - **Niebla y menta:** fondos y superficies suaves (menta para chips, hover y selección).
   - **Amarillo:** el rayo, el cierre de una brecha y la acción principal sobre fondo abeto o verde azulado. Nunca
     sobre fondo claro, nunca como texto en claro, nunca de adorno.
   - **Verde, ámbar, rojo y gris:** solo los cuatro estados de conocimiento, siempre con su texto.
   - **Rojo de error** (`--destructive`): solo para errores de la interfaz, siempre con ícono y texto.
   - **Insignias de pendientes:** blanco o menta sobre oscuro y verde azulado sobre claro (no amarillo).
5. **Botones con jerarquía y orden fijos.**
   - **Principal:** relleno verde azulado, o amarillo sobre fondo oscuro. Uno por pantalla.
   - **Secundario:** contorno.
   - **Terciario:** texto.
   - **Destructivo** (borrar algo de verdad): texto o contorno en rojo de error, con confirmación. "Descartar" una
     propuesta de la IA no es destructivo: va como secundario.
   - **Orden en grupos:** Descartar, Editar, Aceptar, con la acción principal siempre a la derecha (abajo en el celular).
   - Altura mínima de 44 px.
6. **Formas y sombras comunes.** Radios: 12 px en controles, 20 px en tarjetas, 28 px en paneles y tarjetas destacadas.
   Dos sombras: reposo (suave) y elevada (al pasar el mouse o al arrastrar), teñidas de abeto, no grises.
7. **Íconos de `lucide-react`.** 20 px en la navegación y 16 px junto al texto. Acompañan a una palabra; si un botón
   es solo ícono, lleva `aria-label`. Sin emojis.
8. **La marca como motivo, no como adorno.** El rayo comunica el cierre de brechas (Tu brújula, momento de cierre,
   estados vacíos). La rosa grande y recortada puede ir de fondo en la tarjeta destacada.
9. **Resúmenes visuales comunes.**
   - **Barra de estados:** cuatro colores en proporción, con su leyenda en texto. Es la forma estándar de resumir una
     asignatura, un concepto o una clase.
   - **Cifra clave:** número grande, etiqueta y una línea de contexto.
   - **Mapa:** sigue con tarjetas de concepto; se mejora su aspecto (estado visible con color y texto, nombre, "Abre N").
10. **Componentes en un solo lugar.** El estilo de base se ajusta en `components/ui` (botón, tarjeta, insignia, campo),
    y las piezas propias viven en `components/`: encabezado de página, barra de estados, cifra clave, chip de estado,
    estado vacío y barra de acciones fija (celular), además de la marca (`components/brand-mark.tsx`). Antes de crear un
    componente, buscar si ya existe. La landing conserva sus propios cortes de pantalla (560 y 960 px).

## 4. Movimiento

Expresivo, pero cada animación responde a una de cuatro preguntas. Si no responde a ninguna, no se anima.

| Propósito | Pregunta que responde |
|---|---|
| Continuidad | ¿De dónde viene lo que estoy viendo? |
| Foco | ¿Dónde tengo que mirar ahora? |
| Cambio de estado | ¿Qué cambió por lo que hice? |
| Logro | ¿Cerré una brecha? |

1. **Elemento compartido (continuidad).** Lo que se toca se convierte en lo que se abre:
   - la tarjeta de una asignatura se transforma en el encabezado de su página;
   - la tarjeta de un concepto en el mapa, en el encabezado de su página de trabajo;
   - "Tu siguiente paso", en la pantalla donde se hace.
   Al volver, el camino se recorre al revés.
2. **Dirección (continuidad).** Avanzar en un recorrido (el siguiente paso de la asignatura, el siguiente concepto por
   validar) desliza hacia la izquierda, y volver, hacia la derecha. Entre destinos del menú, que son hermanos y no
   pasos, se usa un fundido sin dirección.
3. **La carga se revela (foco).** El esqueleto de la página ocupa ya el lugar del contenido y lo deja aparecer con un
   fundido, sin saltos. Al abrir un panel, sus bloques pueden entrar escalonados (como mucho 6, con 40 ms entre
   cada uno), solo en la primera carga.
4. **Cambio de estado.**
   - Un concepto que cambia de estado pasa de color con una transición y una pulsación breve.
   - La barra de estados crece desde su valor anterior.
   - Una cifra clave cuenta desde su valor anterior solo si cambió por una acción del usuario, nunca al cargar.
   - Al validar, la tarjeta aceptada sale de la lista, la siguiente ocupa su lugar y el contador del menú baja.
5. **Logro: el cierre de una brecha.** Es el único momento de celebración: el rayo amarillo se une a la rosa (900 ms),
   con un brillo breve y el mensaje de lo que se abrió. Sin confeti ni efectos genéricos. Se reconoce el objetivo
   (regla 1.3), no la actividad.
6. **Microinteracciones (foco).**
   - Al pasar el mouse, los botones se elevan 2 px y las tarjetas 4 px.
   - Al tocar, se hunden levemente.
   - Al elegir un concepto en el mapa, la vista se desplaza para centrarlo y su ruta se dibuja.
7. **Duraciones y curvas comunes**, como tokens en `app/globals.css`:
   | Ritmo | Duración | Para |
   |---|---|---|
   | Inmediato | 100–150 ms | Mouse encima, pulsar, foco |
   | Corto | 200–250 ms | Aparecer o desaparecer elementos, cambios de estado |
   | Medio | 300–400 ms | Cambio de página y elemento compartido |
   | Logro | 900 ms | Cierre de brecha (el único largo) |
   Curva por defecto: salida suave (`cubic-bezier(0.2, 0.8, 0.2, 1)`); al salir de pantalla, aceleración breve. El
   rebote se reserva para el logro.
8. **Reglas de oficio.**
   - **Nunca bloquear:** la animación no retrasa al usuario y ningún cambio de página pasa de 400 ms.
   - **Un movimiento a la vez** en el foco de atención.
   - **Rendimiento:** se animan posición visual y opacidad, no tamaños de diseño.
   - **"Reducir movimiento":** los desplazamientos pasan a fundidos breves o desaparecen, y el estado final se ve
     siempre. El logro se muestra quieto, con su mensaje.
   - **Sin soporte del navegador:** la app funciona igual, solo que sin animar.
9. **Técnica.**
   - **Entre páginas:** `<ViewTransition>` de React, que Next 16 activa al navegar. Los elementos compartidos llevan un
     nombre único (p. ej. `asignatura-<id>`), y la dirección se marca con `transitionTypes` en `<Link>`. Guía:
     `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`. El botón "atrás" del navegador no lleva
     dirección, pero el elemento compartido sí se anima.
   - **Dentro de una página:** CSS (transiciones de Tailwind y animaciones en `app/globals.css`) y, si hace falta, un
     poco de TypeScript, como el cierre de brecha.
   - **Sin librerías de animación.**

## 5. Responsive

Hoy la app no es responsive (es un requisito antes del piloto). No habrá una pasada aparte: cada pantalla se vuelve
responsive cuando se rediseña.

1. **Una sola app.** Mismas rutas y componentes en celular y escritorio; solo cambia la disposición.
2. **Por dónde se empieza:**
   - Lo del estudiante se diseña primero para el celular (360 a 390 px) y se amplía hacia escritorio.
   - Lo del docente se diseña para escritorio, pero validar y revisar pendientes tienen que funcionar bien en el
     celular.
3. **Cortes de pantalla.** Clases base para el celular, `md:` (768 px) y `lg:` (1024 px). La landing conserva los
   suyos (560 y 960 px).
4. **Navegación.** Un solo menú, definido una vez: barra inferior fija en el celular (con insignias de pendientes) y
   barra lateral o superior desde `md:` (se decide con el menú de cada rol, sección 8).
5. **Disposición.** Una columna en el celular, dos en tableta y tres en escritorio. Las cifras clave van de a dos por
   fila en el celular.
6. **Acciones.**
   - En el celular, la acción principal ocupa todo el ancho.
   - En flujos largos (validar, diagnosticar), una barra de acciones queda fija abajo.
   - Zonas táctiles de al menos 44 px.
7. **Tablas.** En el celular se convierten en tarjetas, una por fila. La pantalla nunca se desplaza de lado (una
   tabla muy ancha sí puede, dentro de su caja y avisándolo).
8. **Texto.** 14 px como mínimo y 16 px en los campos de formulario (evita el zoom automático en iPhone).
9. **El mapa en el celular.**
   - El lienzo se acerca y se desplaza con los dedos; los nodos no se arrastran (decisión del 24/10/2026).
   - Hay filtros por estado, y el detalle del concepto se abre en una hoja inferior con una sola acción.
   - Una lista agrupada por estado (y por tema, cuando exista) acompaña al mapa, sin reemplazarlo.
   - Se prueba con más de 30 conceptos y en un teléfono de gama media.
10. **La validación en el celular.** Un concepto por pantalla, con las acciones fijas abajo; la lista y el mapa pasan
    a pestañas. En escritorio, tres columnas (lista, detalle y contexto).

## 6. Accesibilidad y calidad

1. **Contraste.** 4,5:1 en el texto y 3:1 en los elementos gráficos. Un estado nunca depende solo del color: lleva
   texto o ícono.
2. **Foco visible.** Anillo de 3 px: amarillo sobre fondo oscuro y verde azulado sobre fondo claro (como en la landing).
3. **Teclado.** Todo se puede hacer con el teclado y en un orden lógico, incluido el mapa.
4. **Nombres y etiquetas.**
   - Cada campo tiene su etiqueta, y su error va asociado al campo.
   - Los botones que son solo ícono llevan `aria-label`.
   - Los cambios importantes (una brecha cerrada, algo guardado, un error) se anuncian con `role="status"`.
5. **Estructura.** Un `h1` por página y h1 > h2 > h3 sin saltos.
6. **Carga, vacío y error en cada lista.** El estado vacío dice qué hacer ("Sube tu primer material"). El error dice
   qué pasó y qué hacer, sin jerga técnica.
7. **Movimiento.** Se respeta "reducir movimiento" (sección 4).
8. **Colores solo desde tokens.** Todavía quedan colores escritos a mano en 6 componentes (el diagnóstico, las
   tarjetas de pregunta, los recursos y otros); se limpian al rediseñar cada uno.
9. **Antes de dar una pantalla por terminada:**
   - `npm run build` y `npm run lint` pasan;
   - se probó en un celular real y con el teclado;
   - se vio con 0 datos, con muchos datos y con un error;
   - Lighthouse da 95 o más en accesibilidad.
10. **Preguntas antes de cambiar una pantalla.**
    - ¿Cuál es la acción principal, y se ve sin desplazarse en el celular?
    - ¿Qué le dice la pantalla al usuario que haga ahora?
    - ¿Qué datos sobran?
    - ¿Rompe alguna regla fija (sección 1)?
    - ¿Usa los componentes que ya existen?

## 7. Qué no hacer

- Crear una app o rutas aparte "para el celular".
- Poner puntos, rachas, rankings o notas.
- Mostrar al estudiante algo que el docente no validó.
- Mostrar cifras o duraciones sin datos detrás (p. ej. "10 min"): todo número en pantalla sale de datos reales.
- Usar el amarillo de adorno o sobre fondo claro, o los colores de estado para otra cosa.
- Agregar un destino al menú sin quitar otro.
- Animar por adornar o hacer esperar al usuario por una animación.
- Duplicar un componente que ya existe.
- Adaptar la enseñanza a "estilos de aprendizaje".
- Cambiar muchas pantallas a la vez: una pantalla o un flujo por entrega, probado en el celular.

## 8. Abierto

**Diagnóstico y recuperación (prioridad máxima, sesión propia antes de tocar su código).** Críticas de Sergio
(30/10/2026): es un solo proceso global; no se puede entrar a una sección ni revisar concepto por concepto; parece un
proceso genérico, mecánico, que no diagnostica de verdad ni ayuda a cerrar brechas, que es el objetivo más importante.
Lo que se ve en el código actual (`app/diagnostico/[subjectId]/page.tsx`, `lib/question-selection.ts`):
- La "nivelación" muestra solo la descripción del concepto; no usa fichas, recursos ni práctica.
- Con 2 preguntas por concepto y umbral 0,7, una brecha solo se cierra acertando las dos.
- Al terminar se muestran porcentajes por concepto, que se parecen a una nota (regla 1.2).
- No hay retroalimentación por respuesta (por qué una opción es incorrecta).

**Motor de conocimiento (se diseña junto con el diagnóstico).** La idea original, nunca implementada: usar los
embeddings (pgvector) para relacionar y agrupar conceptos, un modelo de datos para estimar brechas y su cierre, y
búsqueda híbrida (vectorial + texto) sobre todo el material para citar la evidencia de cada propuesta. Hoy los
embeddings se guardan pero no se consultan, la IA ve solo el inicio del material y las preguntas no usan el material.
El Anexo I pide además organizar por unidad y tema, comunicar incertidumbre y trazar hasta el material utilizado
(sec. 4, 10 y 11). Propuesta en `docs/MOTOR-DE-CONOCIMIENTO.md`.

**Inicio del estudiante:** por asignatura (su ruta en una asignatura, con selector) o general (lo que le toca en todas).
Se decide con el piloto.

**Menú del docente:** asignatura como centro (recorrido por pasos) o secciones globales (Materiales, Validación,
Estudiantes con filtro por asignatura). Se decide al empezar el panel docente, mirando la app real.

**Lo que ve el estudiante:** si ve porcentajes o solo estados y conteos; cómo se nombran los estados sin etiquetarlo.

**Transparencia de las propuestas:** mostrar la cita y la página del material de donde sale cada concepto exige
guardarlas al procesar el documento (hoy no se guardan).

## 9. Decisiones y su porqué

| Fecha | Decisión | Por qué |
|---|---|---|
| 30/10/2026 | El amarillo también marca la acción principal, solo sobre abeto o verde azulado | Da un foco claro a la acción que importa sin perder su sentido: sigue sin usarse sobre fondos claros ni como decoración |
| 30/10/2026 | "Esta semana" muestra las brechas cerradas, no los días de práctica | Contar días premia la actividad (regla 1.3); contar brechas cerradas premia el objetivo |
| 30/10/2026 | En la interfaz se dice "asignatura" | Es el término universitario preciso y el que ya usa la app |
| 30/10/2026 | El mapa sigue con tarjetas, mejorando su aspecto | Se leen con más de 30 conceptos y muestran estado y "Abre N" en texto; fue un pedido de la socia (24/10/2026) |
| 30/10/2026 | Los errores de la interfaz usan su propio rojo, siempre con ícono y texto | Es lo que el usuario reconoce como error; el ícono y el texto evitan confundirlo con el estado "brecha" |
| 30/10/2026 | Movimiento expresivo, siempre con propósito | La app se siente plana; el movimiento debe conectar pantallas y estados, no decorar |
| 30/10/2026 | El lenguaje visual vive en `components/ui` (ajustado) y pocas piezas propias | Un solo lugar para cambiar el estilo, sin una capa nueva que mantener |
| 30/10/2026 | Movimiento con `<ViewTransition>` y CSS, sin librerías de animación (el Vol. 2 citaba Framer Motion) | Cubren los patrones de la sección 4 sin una dependencia más; si algún patrón no se pudiera hacer así, se reconsidera |
