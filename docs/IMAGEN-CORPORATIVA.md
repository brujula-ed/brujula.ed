# Imagen corporativa de BRÚJULA.ED: implementación en la app

Documento para Claude Code. La imagen corporativa (paleta A) fue aprobada por Ilse Rivera el 22/10/2026. Esto describe cómo llevarla a la app (Next.js 16, Tailwind v4, shadcn/ui `base-nova`) con el menor cambio posible.

## Alcance

- Hacer ahora: cambiar los tokens de color y las tipografías en un solo lugar. Es un cambio pequeño y evita refactorizar después.
- Opcional, hacer ahora: logo en la cabecera y favicon.
- Dejar para después de terminar las funciones: pulido pantalla por pantalla, diseño responsive, modo oscuro.
- No tocar: lógica de negocio, LRR, estructura de componentes, `.dark` en `globals.css`.

## Identidad en una línea

Marca: rosa de ocho rayos asimétrica. Siete rayos en el color base y el octavo, separado, en amarillo (el rayo que falta, la brecha). Nombre en minúsculas: `brújula.ed`. Lema: "Aprende con rumbo".

## Paleta (paleta A)

| Nombre | Hex | Uso |
|---|---|---|
| Verde azulado | `#17757B` | Color primario: rayos de la marca, botones, enlaces, ".ed" del nombre |
| Abeto | `#0B2E33` | Texto principal y fondos oscuros |
| Niebla | `#EFF8F8` | Fondo de página |
| Menta | `#CDE9E6` | Superficies, hover, bloques secundarios |
| Amarillo | `#FFC93C` | Solo el rayo que falta y el momento en que se cierra una brecha |

Tipografías: **Onest** (nombre, títulos, 500/600/700) y **Figtree** (texto de lectura).

Contraste: texto blanco sobre `#17757B` ≈ 5,4:1 (cumple AA). El amarillo no se usa nunca como color de texto sobre fondo claro.

## Paso 1: `app/globals.css`

Reemplazar los valores dentro de `:root` (hoy son los grises neutral de shadcn en oklch; los hex funcionan igual en Tailwind v4). No modificar `.dark`.

```css
:root {
  --radius: 0.625rem;

  /* Superficies y texto */
  --background: #EFF8F8;            /* niebla */
  --foreground: #0B2E33;            /* abeto */
  --card: #FFFFFF;
  --card-foreground: #0B2E33;
  --popover: #FFFFFF;
  --popover-foreground: #0B2E33;

  /* Marca */
  --primary: #17757B;               /* verde azulado */
  --primary-foreground: #FFFFFF;
  --secondary: #CDE9E6;             /* menta */
  --secondary-foreground: #0B2E33;
  --muted: #E4F1EF;
  --muted-foreground: #4A6B6D;
  --accent: #CDE9E6;                /* en shadcn es el color de hover, NO el amarillo de marca */
  --accent-foreground: #0B2E33;
  --destructive: #C62828;           /* errores de formulario; no es el estado "brecha" */

  --border: #CFE3E0;
  --input: #CFE3E0;
  --ring: #17757B;

  --chart-1: #17757B;
  --chart-2: #3AA597;
  --chart-3: #9ED8CF;
  --chart-4: #0B2E33;
  --chart-5: #FFC93C;

  /* Rayo que falta: solo marca y cierre de brecha */
  --brand-ray: #FFC93C;

  /* Estados de aprendizaje (valores actuales, ahora centralizados) */
  --state-mastered: #16a34a;
  --state-progress: #f59e0b;
  --state-gap: #ef4444;
  --state-none: #9ca3af;
}
```

Dentro de `@theme inline`, agregar estas líneas (para tener clases como `bg-state-gap` o `text-brand-ray`) y cambiar las dos fuentes:

```css
  --color-brand-ray: var(--brand-ray);
  --color-state-mastered: var(--state-mastered);
  --color-state-progress: var(--state-progress);
  --color-state-gap: var(--state-gap);
  --color-state-none: var(--state-none);

  --font-sans: var(--font-figtree);
  --font-heading: var(--font-onest);
```

Nota: no asignar el amarillo a `--accent`. En shadcn `--accent` pinta el hover de menús y botones ghost.

## Paso 2: `app/layout.tsx`

```tsx
import { Figtree, Onest } from "next/font/google";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
```

- En el `className` del `<html>`, reemplazar las variables de Geist por `${figtree.variable} ${onest.variable}`.
- En el `<body>`, usar `font-sans antialiased`.
- Geist Mono se puede conservar solo si se usa en algún lugar; si no, quitarla.
- Los títulos que quieran Onest deben usar la clase `font-heading` (o el estilo base de `h1`–`h3` si ya apunta a `--font-heading`).

## Paso 3: centralizar los colores de estado

Hoy los cuatro estados están escritos a mano en tres archivos. Cambiarlos a las variables:

| Archivo | Cambio |
|---|---|
| `components/knowledge-map.tsx` (líneas ~40-43, ~127-128) | Hex de estado a `var(--state-*)`. Fondos al 18-20 %: `color-mix(in srgb, var(--state-gap) 18%, transparent)`. Flechas `#9ca3af` a `var(--state-none)` |
| `app/docente/[subjectId]/reporte/page.tsx` (líneas ~11-14) | Hex de estado a `var(--state-*)` |
| `components/lrr-card.tsx` (líneas ~5-8) | Verde, ámbar, rojo y gris a `var(--state-mastered)`, `var(--state-progress)`, `var(--state-gap)`, `var(--state-none)` |

Mapeo: `dominado` = `--state-mastered`, `en_desarrollo` = `--state-progress`, `brecha` = `--state-gap`, `sin_evidencia` = `--state-none`.

Colores de estado: los valores NO cambian con la marca; solo se centralizan. Los iconos de texto (`?`, `!`, `↑`, `✓`) se mantienen.

Clases de paleta fija (28 en 11 archivos):

- `text-red-500` (errores) pasa a `text-destructive`.
- `text-blue-600` (enlace del login) pasa a `text-primary`.
- Verde y ámbar de "validado" y "pendiente": se dejan como están por ahora.

## Paso 4 (opcional, ahora): logo y favicon

Archivos entregados por Sergio (SVG con colores hex directos, sin variables):

- `brujula-ed_marca-color.svg`: marca sobre fondo claro.
- `brujula-ed_marca-sobre-abeto.svg`: marca para fondo oscuro.
- `brujula-ed_marca-un-solo-color.svg`: un solo color.
- `brujula-ed_marca-16px.svg`: versión para tamaños chicos (favicon).
- `brujula-ed_icono-app.svg`: ícono de aplicación.

Sugerencia:

- Copiarlos a `public/brand/`.
- En `components/header.tsx`: marca de 28-32 px a la izquierda del nombre, con el nombre como texto (no imagen): `brújula` en `text-foreground` y `.ed` en `text-primary`, fuente `font-heading`, peso 700, `letter-spacing: -0.04em`, siempre en minúsculas.
- Favicon: usar `brujula-ed_marca-16px.svg` como `app/icon.svg` (Next.js lo detecta solo) y `brujula-ed_icono-app.svg` como base del ícono de la aplicación.

## Reglas de uso de marca (para no romperla después)

- El nombre siempre en minúsculas: `brújula.ed`. Nunca `BRÚJULA.ED` en la interfaz.
- El rayo amarillo solo va en la marca y en el momento visual de "brecha que se cierra". No usarlo como color de botones, textos ni estados.
- No usar el amarillo `#FFC93C` para el estado "en desarrollo" (ese es `--state-progress`, ámbar `#f59e0b`).
- Los estados de aprendizaje son orientativos: no son calificaciones. La ludificación premia el cierre de brechas, no métricas de vanidad.

## Pendientes de decisión (sin urgencia)

1. El amarillo de marca (`#FFC93C`) y el ámbar del estado "en desarrollo" (`#f59e0b`) son parecidos. Como están en tokens distintos, si se quiere separarlos más es cambiar una línea.
2. El verde de "dominado" (`#16a34a`) y el verde azulado de marca (`#17757B`) conviven en el mapa. Revisar visualmente en pantalla; el estado va en el borde y con icono, así que no depende solo del color.
3. Responsive para móvil: sigue siendo deuda técnica, requisito antes del piloto.
4. Modo oscuro: los tokens `.dark` existen pero nada los activa. Si se activa, hay que redefinirlos con esta paleta.

## Verificación

1. `npm run build` sin errores.
2. Abrir login, panel docente, diagnóstico y mapa: botones y fondos deben verse en verde azulado y niebla sin tocar más archivos.
3. Revisar que los cuatro colores de estado del mapa, del reporte y de la tarjeta LRR se vean igual que antes.
4. Revisar contraste de texto blanco sobre botones primarios (debe ser ≥ 4,5:1).
