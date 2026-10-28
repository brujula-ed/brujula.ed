# Landing page de brújula.ed: instrucciones para Code

Documento de trabajo para implementar la landing en el proyecto (Next.js 16, Tailwind v4, shadcn/ui `base-nova`, Supabase). Va junto con dos archivos de referencia:

- `landing.html`: vista previa funcional del diseño aprobado por Sergio (escritorio y celular, con animaciones). Es la referencia visual y de comportamiento. No copiarla tal cual: reimplementar con componentes de React y con los tokens del proyecto.
- `IMAGEN-CORPORATIVA.md`: tokens de color y tipografías (paleta A). La landing debe usar esos tokens, no colores escritos a mano.

Si algo de este documento choca con lo que hay hoy en el código, no asumir: revisar el código, decidir lo más simple y dejar una nota breve de lo que se cambió.

## 1. Decisiones ya tomadas

1. **La landing vive en `/`.** El inicio de sesión pasa a `/login`.
2. **Quien ya tiene sesión no ve la landing.** Si entra a `/`, se redirige a su panel (decisión explícita de Sergio: "no sería pesado entrar siempre a la landing").
3. **Enlaces directos.** Los enlaces o códigos QR que un docente comparte con sus estudiantes llevan directo a `/login` o al curso, nunca a la landing.
4. **El formulario "Pedir un piloto" guarda cada solicitud en Supabase** (tabla nueva, sin acceso desde el navegador) y no depende de ningún servicio nuevo.
5. **Público de la landing: universidades** (docentes y facultades). No usar "colegio", "aula" ni "curso escolar" en los textos.
6. **Hospedaje: Vercel Hobby por ahora.** Hobby es para uso no comercial; cuando se cobre hay que pasar a Pro. Fuera del alcance de esta tarea.

## 2. Rutas y redirecciones

| Ruta | Comportamiento |
|---|---|
| `/` | Sin sesión: muestra la landing. Con sesión: redirige al panel del rol (docente o estudiante), con la lógica de redirección que la app ya use después del login. |
| `/login` | Pantalla de inicio de sesión actual. Con sesión activa, redirige al panel. |
| `/inicio` (opcional) | Muestra siempre la landing, aunque haya sesión. Útil para que un docente se la enseñe a un colega. Hacerlo solo si cuesta poco; en esa vista el botón "Iniciar sesión" pasa a "Ir a mi panel". |

Notas de implementación:

- Comprobar la sesión en el servidor con `supabase.auth.getUser()` (no `getSession()`), en el componente de `app/page.tsx` o en `proxy.ts` (en Next 16 el antiguo `middleware` se llama `proxy`; usar el que el proyecto ya tenga).
- Al comprobar en el servidor, `/` deja de ser estática. Es aceptable para este tamaño de proyecto. No añadir lógica de sesión en el cliente para decidir la redirección: provoca un parpadeo de la landing antes de redirigir.
- Revisar que no se cree un bucle entre `/`, `/login` y el panel. Probar los cuatro casos: docente con sesión, estudiante con sesión, sin sesión, y sesión caducada.
- Revisar todos los lugares que hoy mandan a `/` esperando que sea el login (redirecciones tras cerrar sesión, tras error de autenticación, enlaces del correo de Supabase, `NEXT_PUBLIC_SITE_URL` y las URL de redirección permitidas en el panel de Supabase). Cerrar sesión debe llevar a `/login`, no a la landing.

## 3. Estructura de la página

Una sola página, scroll vertical, ancho máximo de contenido 1280 px con 24 px de margen lateral. Secciones en este orden (textos finales, en español neutro con tuteo):

**Cabecera fija** (fondo verde azulado `--primary` con ligera transparencia y desenfoque, sombra al bajar)
- Izquierda: marca (SVG) + nombre `brújula.ed`: "brújula" en blanco y ".ed" en `--brand-ray` (amarillo). Siempre en minúsculas, Onest 700, tracking -0.04em.
- Derecha, enlaces en blanco: "Cómo funciona" (#como), "Para universidades" (#universidades), "Contacto" (#contacto), "Iniciar sesión" (/login), y botón amarillo "Pedir un piloto" (#contacto).
- En celular: se ocultan los tres enlaces internos y "Iniciar sesión" desde 560 px hacia abajo; quedan la marca y el botón. Añadir un enlace "Iniciar sesión" accesible en el pie y en el formulario para que no se pierda en celular.

**1. Portada**
- Etiqueta: "Para universidades"
- Título: "Aprende" / "con rumbo" (dos líneas)
- Texto: "Una herramienta asistida por IA que muestra qué base le falta a cada estudiante y cuál es su siguiente paso. La IA propone; el docente valida."
- Botones: "Pedir un piloto" (primario) y "Ver cómo funciona" (contorno).
- A la derecha, tarjeta con el mapa de conocimiento animado (ver sección 4).

**2. El problema**
- Etiqueta "El problema". Título: "Las brechas llegan al siguiente curso sin que nadie las vea".
- Tres tarjetas:
  - "Brechas invisibles": "Un estudiante llega a un curso avanzado sin la base del anterior, y el vacío aparece recién en los exámenes."
  - "Diagnóstico a mano": "Preparar y corregir evaluaciones diagnósticas consume horas que el docente no tiene."
  - "Un solo ritmo": "El curso avanza para todos igual, aunque cada estudiante necesite repasar algo distinto."

**3. Cómo funciona** (`id="como"`)
- Título: "Del material del docente al siguiente paso". Cuatro tarjetas numeradas (es una secuencia real) unidas por una línea que se dibuja al entrar:
  1. "El docente sube su material": "Apuntes, guías o presentaciones de su asignatura."
  2. "La IA propone": "Conceptos, prerrequisitos y preguntas de diagnóstico."
  3. "El docente valida": "Corrige y aprueba. La decisión pedagógica sigue siendo suya."
  4. "El estudiante avanza": "Recibe su diagnóstico, su mapa y el siguiente paso."

**4. Para el docente / para el estudiante** (`id="universidades"`)
- Panel oscuro (abeto): "Para el docente". Título: "Menos tiempo diagnosticando, más tiempo enseñando". Texto: "Sube lo que ya tiene, revisa lo que propone la IA y ve en un mapa dónde está cada estudiante. Siempre decide el docente."
- Panel verde azulado: "Para el estudiante". Título: "Saber qué repasar antes de avanzar". Texto: "Un diagnóstico corto, un mapa claro y un siguiente paso concreto. Sin puntos ni rankings: lo que cuenta es cerrar la brecha."

**5. Nuestros compromisos**
- Título: "Una herramienta de apoyo, no de calificación". Tres tarjetas:
  - "La IA propone, el docente decide": "Nada llega a los estudiantes sin que el docente lo valide."
  - "Estados orientativos": "El mapa orienta el repaso. No son notas ni diagnósticos clínicos."
  - "Premiamos cerrar brechas": "No hay rankings ni puntos de vanidad: se reconoce lo que el estudiante recupera."

**6. Contacto** (`id="contacto"`, fondo verde azulado)
- Etiqueta "Pedir un piloto". Título: "Probemos brújula.ed en una de tus asignaturas". Texto: "Cuéntanos tu universidad y la asignatura. Te escribimos para coordinar un piloto y resolver tus dudas."
- Formulario (sección 5) sobre una tarjeta abeto, botón amarillo "Pedir información".

**Pie**
- Marca + nombre, "Aprende con rumbo", y "correo@brujulaed.com · La Paz, Bolivia · © 2026" (provisional hasta tener correo y dominio reales), enlace a "Iniciar sesión".

No inventar cifras, testimonios ni logos de universidades. Cuando existan capturas reales de la app o universidades que hayan probado el piloto, se añaden en una sección nueva.

## 4. Animaciones

Pocas, con sentido. Todas se desactivan con `prefers-reduced-motion: reduce` (en ese caso la página se muestra quieta y en su estado final). Sin librerías de animación: CSS más un poco de TypeScript en un componente cliente.

1. **Mapa de la portada** (componente cliente aislado): bucle de ~11 s sobre cuatro nodos (Álgebra, Límites, Funciones, Derivadas).
   - 0,25 s: aparecen los nodos de uno en uno (380 ms entre cada uno), con las líneas que los unen.
   - 2 s: el nodo "Funciones" (rojo, "Brecha") late con un halo suave.
   - 4,2 s: pasa a verde ("Recuperada"), "Derivadas" pasa a ámbar ("En desarrollo"), el título cambia a "Brecha cerrada. Sigue con Derivadas", el botón a "Practicar Derivadas", y el rayo amarillo de la marca de la tarjeta se cierra (900 ms, ease-out).
   - 10,5 s: se desvanece todo y vuelve a empezar.
   - Colores de estado: usar los tokens `--state-mastered`, `--state-progress`, `--state-gap`, `--state-none`. Cada estado también se dice con texto (no depender solo del color).
2. **El rayo de la cabecera**: la separación del rayo amarillo respecto a la rosa va de 16 a 0 (unidades del viewBox de 100) según el progreso de scroll, y al llegar a 0 pasa al color base. Fórmula de la referencia: `gap = 16 * (1 - min(1, progreso / 0.97))`, con `progreso = scrollY / (alturaDocumento - alturaVentana)`. Escuchar `scroll` con `passive: true`.
3. **Aparición al bajar**: cada bloque con `opacity 0 → 1` y `translateY(22px) → 0` en 700 ms, con 90 ms de retraso entre tarjetas vecinas. Usar `IntersectionObserver` (umbral 0.12). Importante: lo que ya es visible al cargar no se oculta nunca, y nada queda invisible si el observador falla.
4. **Detalles**: botones y tarjetas se elevan 2 y 4 px al pasar el mouse; la cabecera gana sombra al bajar más de 8 px; la línea de los pasos se dibuja de izquierda a derecha al entrar en pantalla.

## 5. Formulario "Pedir un piloto" y tabla en Supabase

Campos: nombre, universidad y carrera, correo, mensaje (opcional), y un campo oculto trampa contra spam (honeypot). Los `id` de los campos deben ser estables.

**Tabla nueva `pilot_requests`:**

```sql
create table public.pilot_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 120),
  university text not null check (char_length(university) between 2 and 160),
  email text not null check (char_length(email) between 5 and 200),
  message text check (char_length(message) <= 2000),
  status text not null default 'nuevo'
);

alter table public.pilot_requests enable row level security;
-- Sin políticas para anon ni authenticated: nadie puede leer ni escribir desde el navegador.
```

**Cómo se guarda:**
- Con una Server Action o un Route Handler que valida los datos (por ejemplo con Zod) y inserta usando la clave `service_role` desde el servidor. Esa clave nunca va con el prefijo `NEXT_PUBLIC_` ni llega al navegador.
- Rechazar en silencio (respondiendo como éxito) si el campo trampa viene lleno.
- Limitar el ritmo por IP (por ejemplo, 5 envíos por hora) con el mecanismo más simple que ya tenga el proyecto; si no hay ninguno, empezar solo con la validación y el campo trampa, y dejar una nota.
- Mensajes de la interfaz: éxito "Gracias. Te escribimos pronto."; error de validación junto a cada campo ("Escribe un correo válido."); error del servidor "No pudimos enviar tu solicitud. Intenta de nuevo en unos minutos." Anunciar el resultado con `role="status"`.
- Las solicitudes se revisan por ahora desde el panel de Supabase (tabla `pilot_requests`). Aviso por correo: opcional, solo si Sergio lo confirma, con un servicio de correo transaccional (por ejemplo Resend), configurado con variable de entorno del servidor.
- No guardar ni registrar en logs el contenido del mensaje más de lo necesario. Los datos son personales: dejar una línea bajo el formulario enlazando a una política de privacidad cuando exista ("Usaremos estos datos solo para contactarte.").

## 6. Diseño y accesibilidad

- Tokens: colores y fuentes del documento `IMAGEN-CORPORATIVA.md` (Onest para títulos, Figtree para texto). Añadir a los tokens, si hace falta, `--brand-ray` ya definido. No usar el amarillo como color de texto sobre fondo claro.
- Botón primario: `--primary` con texto blanco. Botón amarillo solo sobre fondos oscuros o verde azulado.
- Adaptable a celular desde el primer día (hoy la app no lo es; la landing sí debe serlo): una columna bajo 960 px, tarjetas apiladas bajo 560 px, sin desplazamiento horizontal, márgenes de al menos 16 px, zonas táctiles de al menos 44 px.
- Foco visible en todos los enlaces y controles (anillo de 3 px amarillo), contraste mínimo 4,5:1 en textos, estructura de encabezados h1 > h2 > h3 sin saltos, `alt` o `aria-hidden` en los SVG decorativos, etiquetas asociadas a cada campo.
- Marca y logo: usar los SVG de `public/brand/` (ver `IMAGEN-CORPORATIVA.md`). El nombre siempre en minúsculas.
- Metadatos: `<title>` "brújula.ed · Aprende con rumbo", descripción de 150 caracteres como máximo, y etiqueta Open Graph con la marca sobre fondo abeto (1200 × 630). Favicon según `IMAGEN-CORPORATIVA.md`.

## 7. Orden de trabajo sugerido

1. Crear la ruta `/login` y mover allí el inicio de sesión actual; ajustar redirecciones (sección 2).
2. Construir la landing estática con los textos y tokens (secciones 3 y 6), sin animaciones ni formulario funcional.
3. Añadir animaciones (sección 4).
4. Crear la tabla y el envío del formulario (sección 5).
5. Redirección de `/` según la sesión, `/inicio` opcional y revisión de enlaces directos.
6. Pruebas.

Hacer un commit por paso para poder volver atrás.

## 8. Qué probar al terminar

- Sin sesión: `/` muestra la landing; "Iniciar sesión" lleva a `/login`.
- Docente con sesión: `/` redirige a su panel. Estudiante con sesión: igual, a su panel. Sesión caducada: muestra la landing. Sin bucles de redirección.
- Cerrar sesión lleva a `/login`.
- Enlaces compartidos a cursos o QR existentes siguen funcionando y no pasan por la landing.
- Formulario: envío correcto crea una fila; correo inválido muestra error; campo trampa lleno no crea fila; desde el navegador no se puede leer ni escribir la tabla (probar con la clave anónima).
- Celular de 360 a 430 px de ancho: sin desplazamiento horizontal y sin textos cortados.
- Con "reducir movimiento" activado: la página no se mueve y se ve completa.
- `npm run build` sin errores y Lighthouse (móvil) con accesibilidad de 95 o más.
- Los textos de la landing no contienen "colegio", "aula" ni cifras inventadas.
