# brújula.ed · Principios de diseño y guía para rediseñar la app

Para usar con Code. No es una especificación de pantallas: es el criterio con el que Sergio y Code deciden cada cambio de diseño y de navegación. Las maquetas de referencia están en el lienzo de diseño (versiones 20 a 23): panel del docente, validación de la IA, vista del estudiante y versión móvil. Son ejemplos de aplicar estos principios, no un molde a copiar.

Identidad, colores y tipografías: ver `IMAGEN-CORPORATIVA.md` (no se repiten aquí).

---

## 1. Principios de producto (no se negocian)

Salen del producto, no del gusto. Si un cambio los rompe, no se hace.

1. **El docente decide.** La IA propone; nada llega al estudiante sin validación del docente. La interfaz debe dejar claro quién propuso qué ("Propuesto por la IA") y dónde se aprueba.
2. **Orientar, no calificar.** Los estados (dominado, en desarrollo, brecha, sin evidencia) orientan el estudio. No usar notas, porcentajes de aprobación ni rankings entre estudiantes. Donde se muestre un estado, que se entienda que no es una calificación.
3. **Cerrar brechas, no sumar puntos.** La ludificación premia cerrar brechas (el rayo que falta pasa a color base), no la cantidad de actividad. Sin puntos por tiempo en pantalla, sin tablas de posiciones.
4. **Transparencia con la IA y los datos.** Mostrar de dónde sale cada propuesta (fuente en el material, página) y qué datos se usan. Minimización de datos.

## 2. Principios de diseño

1. **Una pantalla, una acción principal.** Cada pantalla tiene un botón que importa más que los demás (en el estudiante, "Empezar" en el siguiente paso; en el docente, "Validar"). Una sola acción primaria visible a la vez; el resto es secundario.
2. **Dime qué sigue.** Antes de listar datos, decir qué hacer ahora ("Tienes 14 conceptos por validar", "Tu siguiente paso"). Los datos apoyan la decisión; no sustituyen el mensaje.
3. **Se entiende de un vistazo.** Jerarquía clara: título, cifra o estado, detalle. Usar la barra de estados (verde, ámbar, rojo, gris) para resumir un curso antes que una tabla.
4. **El color significa algo.** Verde azulado = acción y marca. Amarillo = solo el rayo y lo que cierra una brecha. Verde, ámbar, rojo y gris = solo estados de conocimiento. No usar el rojo para errores de interfaz si compite con "brecha" (usar otro tratamiento: texto + ícono).
5. **Menos clics para lo repetido.** Lo que el docente hace decenas de veces (validar conceptos) se hace en un flujo continuo: lista, detalle y acciones en la misma vista, sin volver atrás.
6. **Nada escondido que importe.** Lo que bloquea el avance (pendientes de validación, brecha prerrequisito) se ve sin tener que buscarlo. Los contadores viven en la navegación.
7. **Consistente antes que original.** Mismos componentes, mismo orden de acciones (Descartar, Editar, Aceptar), mismas etiquetas de estado en toda la app.
8. **Lenguaje universitario y claro.** Universidad, asignatura, cátedra, estudiante, docente. Evitar "colegio", "aula", "curso escolar" y jerga técnica de IA en pantalla.

## 3. Principios de navegación

La navegación es parte del diseño, no un añadido. Decidirla primero.

1. **Pocos destinos, siempre visibles.** Estudiante: 4 (Ruta, Mapa, Cursos, Logros). Docente: 4 a 7 (Inicio, Cursos, Materiales, Validación, Mapas, Estudiantes, Ajustes). Si un destino se usa poco, va en "Más" o en Ajustes.
2. **Orden por frecuencia, no por estructura de datos.** Lo que se hace a diario va arriba o a la izquierda.
3. **El usuario siempre sabe dónde está.** Estado activo claro en el menú y migas de pan en rutas profundas (Curso > Material > Validación).
4. **Volver sin perderse.** Cada vista de detalle tiene una salida obvia (flecha atrás en móvil, miga en escritorio) y conserva filtros y posición de la lista.
5. **Entrada directa según el rol.** Quien ya tiene sesión entra a su panel (estudiante: Mi ruta; docente: Inicio). La landing queda en `/inicio` para quien quiera verla (`noindex`).
6. **Una sola app, dos formatos.** Mismo conjunto de rutas y componentes en escritorio y móvil; solo cambia la disposición (sección 4).

## 4. Responsive: reglas

La app es una sola; no se construye una versión móvil aparte. Se diseña pensando primero en el estudiante en celular y se amplía hacia escritorio.

- **Enfoque:** diseñar y probar primero ancho móvil (360 a 390 px), luego `md:` (≥768) y `lg:` (≥1024). Con Tailwind v4: clases base para móvil y prefijos `md:`/`lg:` para ampliar.
- **Navegación:** móvil = barra inferior fija (4 destinos, insignia para pendientes); `md:` en adelante = barra lateral. Es el mismo menú, definido una sola vez.
- **Disposición:** una columna en móvil; dos en tablet; tres en escritorio. Las tarjetas se apilan; las cifras clave pasan a 2 por fila.
- **Acciones:** botones principales de ancho completo en móvil; barra de acciones fija abajo en flujos largos (validación). Zonas táctiles ≥ 44 px.
- **Tablas densas:** en móvil, tarjetas por fila. No hay scroll horizontal en la pantalla (sí puede haberlo dentro de una tabla muy ancha, indicado).
- **Texto:** mínimo 14 px en cuerpo; 16 px en campos de formulario (evita el zoom automático en iOS).
- **El mapa de conocimiento** es la pieza difícil:
  - Móvil: grafo simple con zoom y arrastre táctil, filtros por estado, detalle del concepto en una hoja inferior con una sola acción.
  - Alternativa acompañante: lista agrupada por estado, mientras el grafo se afina. No reemplaza al mapa.
  - Probar con mapas de más de 30 conceptos y dispositivos de gama media.
- **Validación del docente:** en móvil, un concepto por pantalla con acciones fijas abajo; la lista de conceptos y el mapa pasan a pestañas o cajón. En escritorio, tres columnas.

**Orden de trabajo sugerido:** 1) Navegación y estructura (barra inferior/lateral), 2) vista del estudiante, 3) validación del docente, 4) panel del docente, 5) resto de pantallas. En cada paso, probar en un celular real.

## 5. Cómo aplicar esto a cada pantalla (lista de preguntas)

Antes de cambiar una pantalla, responder:

1. ¿Cuál es la acción principal? ¿Se ve sin hacer scroll en móvil?
2. ¿Qué le dice la pantalla al usuario que haga ahora?
3. ¿Qué datos sobran? Quitar lo que no apoya una decisión.
4. ¿Rompe alguno de los principios de producto (sección 1)? Si sí, no se hace.
5. ¿Qué cambia entre móvil y escritorio, y cabe en las reglas de la sección 4?
6. ¿Usa los tokens y componentes existentes, o hay que crear uno nuevo? Preferir lo existente.
7. ¿Cómo se ve con 0 datos, con muchos datos y con un error?

## 6. Accesibilidad y calidad (mínimos)

- Contraste suficiente en texto y estados; los estados nunca dependen solo del color (añadir texto o ícono).
- Foco visible y navegación con teclado en escritorio.
- Etiquetas y `aria-label` en íconos y botones solo-ícono.
- Estados de carga y vacío en cada lista; mensajes de error comprensibles.
- Centralizar colores de estado en un solo lugar (hoy están repetidos en 3 archivos).

## 7. Qué no hacer

- No crear una app o rutas separadas "para móvil".
- No añadir puntos, rankings ni notas.
- No mostrar al estudiante contenido sin validar por el docente.
- No usar amarillo como color decorativo general.
- No sumar secciones al menú sin quitar otra.
- No cambiar muchas pantallas a la vez: una pantalla o un flujo por vez, probado en móvil.

## 8. Decisiones que quedan para Sergio y Code

Estos principios dan el criterio; estos puntos se deciden mirando la app real:

- Lista final de destinos del menú del docente y del estudiante.
- Qué pantallas actuales se fusionan, se quitan o se renombran.
- Si el mapa móvil usa grafo, lista o ambos desde el inicio.
- Qué métricas (LRR, brechas, pendientes) van en el inicio de cada rol.
- Orden y alcance de las entregas (una pantalla por vez).

Referencias de maqueta: lienzo "BRÚJULA.ED — Direcciones de marca", versiones 20 (panel docente), 21 (validación de la IA), 22 (vista del estudiante) y 23 (versión móvil). Los datos que muestran son de ejemplo.
