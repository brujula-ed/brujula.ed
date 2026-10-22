# BRÚJULA.ED — Cronograma y roadmap

Fuente: `BRUJULA_ED_Cronograma.xlsx`. Estados actualizados al 22/10/2026 según el trabajo hecho; verificar ante dudas.

Reglas: la IA propone y el docente valida; estados orientativos (Anexo I, sec. 13); sin contenido pedagógico propio; sin métricas de vanidad.

## Hecho (base del MVP)

- Setup de repositorio, Next.js, Supabase y despliegue en Vercel
- Autenticación con roles (estudiante / docente) y rutas protegidas
- Flujo de diagnóstico: brechas, nivelación, microevaluación y comparación
- Persistencia y trazabilidad de intentos y respuestas
- Asignaturas con código de clase e inscripción de estudiantes
- CRUD de asignaturas (crear, editar, eliminar, copiar código)
- Carga de documentos, extracción de texto y embeddings (pgvector)
- IA propone conceptos y prerrequisitos; validación docente
- IA genera preguntas; validación docente
- Diagnóstico conectado a datos reales, con banco de demostración como respaldo
- Vista de progreso por estudiante para el docente

## Plan por bloques (MVP, 11 semanas)

| Bloque | Semanas | ID | Tarea | Horas | Estado | Notas |
|---|---|---|---|---|---|---|
| Ajustes | Semana 1 |  | Botón «Gestionar» visible en cada asignatura | 1 | Terminado | Surge de las dudas de Adri: la carga estaba escondida |
| Ajustes | Semana 1 |  | Rotación de preguntas entre intentos | 2 | Terminado | `lib/question-selection.ts` prefiere las nunca respondidas. Balancear por concepto más adelante |
| Ajustes | Semana 1 |  | Verificación del rol docente (código de invitación o aprobación) | 4 | No iniciado | Hoy cualquiera puede registrarse como docente |
| Ajustes | Semana 1 |  | Navegación: link a «Mis asignaturas» en el header y salida del diagnóstico | 2 | Terminado |  |
| Bloque A | Semanas 1–2 | F-01 | Mapa de conocimiento interactivo (conceptos y prerrequisitos) | 14 | Terminado | Librería de grafos (React Flow). Los datos ya existen |
| Bloque A | Semanas 1–2 | F-02 | Estado del nodo por estudiante (sin evidencia, brecha, en desarrollo, dominado) | 8 | Terminado | Cuatro estados; el «dorado» del Vol. 2 queda fuera |
| Bloque A | Semanas 1–2 | F-03 | Brecha prioritaria (la que bloquea más conceptos) | 5 | Terminado | Se calcula sobre el grafo, sin IA |
| Bloque A | Semanas 1–2 | F-04 | Próximo desafío (qué hacer ahora) | 5 | Terminado |  |
| Bloque A | Semanas 1–2 | F-06 | Pantalla «Mi Brújula» del estudiante | 14 | Terminado | Reúne F-01 a F-04 |
| Bloque B | Semanas 3–5 | F-07 | Reporte de clase para el docente | 14 | Terminado | Brechas frecuentes, estados y acciones sugeridas |
| Bloque B | Semanas 3–5 | F-08 | Diagnóstico de autorregulación | 14 | No iniciado | Revisar el instrumento con alguien con formación pedagógica |
| Bloque B | Semanas 3–5 | F-09 | Práctica de recuperación activa (explicar con palabras propias) | 6 | No iniciado | Versión 1 sin IA y sin puntaje |
| Bloque B | Semanas 3–5 | F-10 | LRR formalizado por estudiante, concepto y clase | 8 | Terminado | Fórmula según Anexo I, sección 12 |
| Bloque C | Semanas 6–7 | F-05 | Ficha de concepto (por qué importa, aplicación, qué desbloquea) | 14 | No iniciado | La IA propone, el docente valida |
| Bloque C | Semanas 6–7 | F-11 | Recursos abiertos curados por IA | 16 | No iniciado | Verificar que los enlaces existan; el docente aprueba |
| Bloque C | Semanas 6–7 | F-12 | Elección de formato por el estudiante (lectura, video, ejercicio) | 5 | No iniciado | Se ofrece la opción, no se clasifica al estudiante |
| Bloque D | Semanas 8–9 | F-13 | Ludificación del progreso de cierre de brechas | 14 | No iniciado | Sin métricas de vanidad |
| Bloque E | Semanas 10–11 | F-14 | Preparación del modelo de datos (capacidad opcional por concepto) | 5 | No iniciado | Evita rehacer la estructura cuando lleguen las capacidades |
| Bloque E | Semanas 10–11 |  | Pruebas de integración, permisos y corrección de errores | 12 | No iniciado |  |
| Bloque E | Semanas 10–11 |  | Guía de uso para docentes y estudiantes (qué hace cada pantalla) | 4 | No iniciado | Al final, cuando estén todas las funciones. Responde registro del docente, dónde se carga el contenido y de dónde salen las preguntas |
| Bloque E | Semanas 10–11 | F-15 | Piloto con docentes y estudiantes reales | 12 | No iniciado | Requiere docentes y estudiantes dispuestos a probar |
| Bloque E | Semanas 10–11 |  | Ajustes de UX según lo observado en el piloto | 10 | No iniciado |  |

F-01 a F-04, F-06, F-07 y F-10 están terminadas. Ajustes de la semana 1 verificados en el código el 22/10/2026: «Gestionar», rotación de preguntas y navegación están terminados; la verificación del rol docente sigue pendiente y la guía de uso pasó al Bloque E.

## Roadmap por horizonte

Esfuerzo: S = días · M = 1–2 semanas · L = 3–6 semanas · XL = meses o investigación.

| ID | Feature | Horizonte | Esfuerzo | Depende de | Estado |
|---|---|---|---|---|---|
| F-01 | Mapa de conocimiento interactivo | MVP | M | — | Terminado |
| F-02 | Estado del nodo por estudiante (4 estados) | MVP | S–M | F-01 | Terminado |
| F-03 | Brecha prioritaria (sin IA) | MVP | S | F-01 | Terminado |
| F-04 | Próximo desafío | MVP | S | F-03 | Terminado |
| F-05 | Ficha de concepto (importancia, aplicación, qué desbloquea) | MVP | M | F-01 | No iniciado |
| F-06 | Pantalla «Mi Brújula» del estudiante | MVP | M | F-01 a F-04 | Terminado |
| F-07 | Reporte de clase para el docente | MVP | M | F-02 | Terminado |
| F-08 | Diagnóstico de autorregulación | MVP | M | — | No iniciado |
| F-09 | Práctica de recuperación activa | MVP | S | — | No iniciado |
| F-10 | LRR formalizado | MVP | S–M | — | Terminado |
| F-11 | Recursos abiertos curados por IA | MVP | M | F-05 | No iniciado |
| F-12 | Elección de formato por el estudiante | MVP | S | F-11 | No iniciado |
| F-13 | Ludificación del progreso de cierre de brechas | MVP | M | F-02, F-04 | No iniciado |
| F-14 | Preparación del modelo de datos (capacidad opcional) | MVP | S | — | No iniciado |
| F-15 | Piloto con docentes y estudiantes reales | MVP | M | F-06, F-07 | No iniciado |
| F-20 | Motor de evidencias | Corto plazo | M | — | No iniciado |
| F-21 | Capacidades por asignatura | Corto plazo | L | F-02, F-14 | No iniciado |
| F-22 | Administración básica de cursos (periodos, grupos, CSV) | Corto plazo | M | — | No iniciado |
| F-23 | Casos prácticos con rúbrica | Corto plazo | L | F-20 | No iniciado |
| F-24 | Retroalimentación asistida de respuestas abiertas | Corto plazo | L–XL | F-23 | No iniciado |
| F-25 | Repetición espaciada | Corto plazo | M | F-20 | No iniciado |
| F-26 | Reportes exportables y recordatorios | Corto plazo | S–M | F-07 | No iniciado |
| F-30 | Plataforma multi-institución | Mediano plazo | XL | F-22 | No iniciado |
| F-31 | Integración con LMS por LTI 1.3 (Moodle) | Mediano plazo | L–XL | F-30 | No iniciado |
| F-32 | Mapa de capacidades de la carrera | Mediano plazo | XL | F-21, F-30 | No iniciado |
| F-33 | Dashboard de carrera y facultad | Mediano plazo | L | F-30, F-32 | No iniciado |
| F-34 | Simulaciones profesionales | Mediano plazo | XL | F-23 | No iniciado |
| F-35 | Perfil dinámico por capacidad | Mediano plazo | M–L | F-20, F-21 | No iniciado |
| F-40 | Pasaporte de Capacidades Profesionales | Largo plazo | XL | F-32, F-35 | No iniciado |
| F-41 | Indicador compuesto de preparación profesional | Largo plazo | XL | F-40 y validación metodológica | No iniciado |
| F-42 | Evidencias externas (prácticas, pasantías, proyectos) | Largo plazo | L | F-40 | No iniciado |
| F-43 | Perfil compartible con empresas | Largo plazo | XL | F-40, consentimiento y revisión legal | No iniciado |
| F-44 | Inteligencia académica institucional | Largo plazo | XL | F-20, F-30 | No iniciado |
| F-45 | Mapa de Evolución Profesional | Largo plazo | L | F-40 | No iniciado |

## Decisiones tomadas

| Idea | Decisión | Justificación | Reconsiderar |
|---|---|---|---|
| Microservicio NER y bóveda cifrada AES-256 | Pospuesto | El Anexo I no lo exige y el MVP no maneja datos sensibles más allá del inicio de sesión | Si se manejan datos personales adicionales |
| TTFT ≤ 2.0 s | Meta de referencia, no criterio de aceptación | Es una métrica de producto maduro; en un MVP de validación el margen es amplio | Bloque E, si sobra tiempo |
| CRUD manual de conceptos sin IA | Descartado como diseño principal | El Anexo I (5b-c) pide que el sistema procese el documento y el docente valide | Como respaldo si la IA falla |
| Estilos o canales de aprendizaje | Reemplazado | Hay poca evidencia de que adaptar la enseñanza al estilo mejore el aprendizaje; se usa autorregulación (F-08) y elección de formato (F-12) | — |
| Indicador «Preparación profesional %» | Pospuesto (F-41) | Un número compuesto necesita validación metodológica antes de mostrarse | Con datos reales del piloto |
| Tutor de IA avanzado y analítica institucional avanzada | Fuera del MVP (Anexo I, sección 8) | El Anexo los deja para etapas posteriores | Acordar una enmienda con Adri |
| Imagen corporativa (paleta A, aprobada por Ilse el 22/10/2026) | Aplicada como tokens en `app/globals.css` | Cambiar la estética en un solo lugar; pulido por pantalla, responsive y modo oscuro quedan para después de terminar las funciones | Encabezado aún por decidir (ver `docs/PENDIENTES.md`, pendiente 6) |

## Ideas nuevas (reunión de mentoría, 16/10/2026) — sin priorizar

- Instrucciones del docente para la IA: campo de texto por asignatura (≈500 caracteres) que orienta la generación sin sobrescribir las reglas fijas.
- Materias prefacultativas (matemáticas, física, química): requieren resolver fórmulas en la extracción de texto y en las preguntas.
- Foco comercial posible: departamentos de nivelación de universidades (piloto con un curso y el LRR como criterio de éxito).
- Escala de información (muchas materias y temas): agrupar por tema y mostrar una prioridad por materia.
- Si se abre un asistente con IA a estudiantes: cuota diaria por estudiante, `max_tokens`, límite de gasto en OpenAI y verificación de docentes.

## Requisitos antes de un piloto con estudiantes reales

- Aviso de privacidad y consentimiento (más si hay menores).
- Verificación del rol docente.
- Pruebas automáticas y entorno de desarrollo separado.
- Diseño móvil (responsive).
- Política de retención y borrado de datos.
