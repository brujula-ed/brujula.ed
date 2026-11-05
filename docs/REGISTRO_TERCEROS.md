# Registro de componentes de terceros

Fecha de levantamiento: 2026-11-04 (primera versión: 2026-10-19).

Alcance:
- dependencias de `package.json`, tanto `dependencies` como `devDependencies` (no incluye dependencias transitivas);
- fuentes tipográficas;
- obra intelectual ajena incluida en el software;
- servicios externos de los que depende.

Para cada paquete, la versión, la licencia y el autor salen del `package.json` instalado en `node_modules`. Su uso
se comprobó buscando los imports en `app/`, `components/`, `lib/`, `proxy.ts`, `next.config.ts` y `app/globals.css`.

## 1. Dependencias del software (`dependencies`)

| ID | Componente | Versión | Proveedor o autor | Licencia | Uso en el software |
|---|---|---|---|---|---|
| T-001 | @base-ui/react | 1.8.0 | MUI Team | MIT | Primitivas de interfaz (botón, campo de texto, opción, barra de progreso) sobre las que se construyen `components/ui/button.tsx`, `input.tsx`, `radio-group.tsx` y `progress.tsx`. |
| T-002 | @dagrejs/dagre | 3.1.1 | Chris Pettitt | MIT | Calcula la disposición automática de los nodos del mapa de conocimiento en `components/knowledge-map.tsx` y `components/topic-map.tsx`. |
| T-003 | @supabase/ssr | 0.12.7 | Supabase, Inc. | MIT | Crea el cliente de Supabase con la sesión en cookies en `lib/supabase/server.ts`, `lib/supabase/client.ts` y `proxy.ts`. |
| T-004 | @supabase/supabase-js | 2.117.2 | Supabase | MIT | Cliente de Supabase (Auth, Postgres, Storage). Se importa en `lib/supabase/admin.ts` (cliente de servidor) y `app/auth/confirm/route.ts` (tipos de los enlaces de correo); `@supabase/ssr` también lo usa. |
| T-005 | @xyflow/react | 12.12.0 | no verificado (repositorio: github.com/xyflow/xyflow) | MIT | Dibuja el mapa de conocimiento y el mapa de temas, con su hoja de estilos, en `components/knowledge-map.tsx` y `components/topic-map.tsx`. |
| T-006 | class-variance-authority | 0.7.1 | Joe Bell | Apache-2.0 | Define las variantes visuales del botón (`cva`) en `components/ui/button.tsx`. |
| T-007 | cn | 0.4.0 | no verificado (repositorio: github.com/shadcn-ui/cn) | MIT | Función `cn` para combinar clases CSS. Se reexporta en `lib/utils.ts` y se importa en los componentes de `components/ui/` y en otros componentes y páginas. |
| T-008 | lucide-react | 1.48.0 | Eric Fennis | ISC | Íconos de la interfaz, en unas 45 páginas y componentes (por ejemplo, `app/docente/page.tsx`, `app/estudiante/page.tsx` y `components/concept-journey.tsx`). |
| T-009 | mammoth | 1.13.0 | Michael Williamson | BSD-2-Clause | Extrae el texto de los documentos .docx en `lib/extract-text.ts`. |
| T-010 | next | 16.3.7 | no verificado (repositorio: github.com/vercel/next.js) | MIT | Framework de la aplicación: App Router, rutas de `app/api/`, Server Actions, `proxy.ts`, navegación, carga de fuentes (`next/font`) e imagen para compartir (`next/og`). Se configura en `next.config.ts`. |
| T-011 | openai | 7.28.0 | OpenAI | Apache-2.0 | Cliente de la API de OpenAI para embeddings y generación de propuestas que valida el docente. Lo usan las rutas de `app/api/` (`process-document`, `generate-concepts`, `generate-questions`, `generate-concept-cards`, `generate-resources`, `generate-evidence`, `organize-topics`, `find-duplicates`) y `lib/search-material.ts`, `lib/concept-evidence.ts` y `lib/concept-embeddings.ts`. |
| T-012 | pdf-parse | 2.4.5 | Mehmet Kozan | Apache-2.0 | Extrae el texto de los PDF, página por página, en `lib/extract-text.ts`. Se importa de forma perezosa y está declarado en `serverExternalPackages` de `next.config.ts`. |
| T-013 | react | 19.2.8 | no verificado (repositorio: github.com/react/react) | MIT | Biblioteca de interfaz. Sus hooks (`useState`, `useEffect`, etc.) se usan en las páginas de `app/` y en los componentes de `components/`. |
| T-014 | react-dom | 19.2.8 | no verificado (repositorio: github.com/react/react) | MIT | El código no lo importa directamente; Next.js lo usa para mostrar los componentes de React. |
| T-015 | shadcn | 4.21.0 | shadcn | MIT | Hoja de estilos base de los componentes, importada en `app/globals.css` (`shadcn/tailwind.css`). Es también la CLI con la que se generaron los componentes de `components/ui/`. |
| T-016 | tw-animate-css | 1.4.0 | Luca Bosin | MIT | Utilidades de animación para Tailwind, importadas en `app/globals.css`. |
| T-017 | zod | 4.6.5 | Colin McDonnell | MIT | Valida la salida de la IA en las rutas de `app/api/` y en `lib/concept-evidence.ts` y `lib/concept-embeddings.ts`, y los datos del formulario de piloto en `app/actions/pilot-request.ts`. |

## 2. Herramientas de desarrollo (`devDependencies`)

Se usan para escribir, comprobar y compilar el código. No forman parte del software que se ejecuta, salvo lo que
Tailwind genera como CSS.

| ID | Componente | Versión | Proveedor o autor | Licencia | Uso |
|---|---|---|---|---|---|
| T-018 | tailwindcss | 4.3.3 | no verificado (repositorio: github.com/tailwindlabs/tailwindcss) | MIT | Genera el CSS de la interfaz a partir de las clases y de los tokens de `app/globals.css`. |
| T-019 | @tailwindcss/postcss | 4.3.3 | no verificado (repositorio: github.com/tailwindlabs/tailwindcss) | MIT | Conecta Tailwind con la compilación (`postcss.config.mjs`). |
| T-020 | typescript | 5.9.3 | Microsoft Corp. | Apache-2.0 | Lenguaje del proyecto y comprobación de tipos (`tsconfig.json`). |
| T-021 | @types/node | 20.19.43 | no verificado (repositorio: github.com/DefinitelyTyped/DefinitelyTyped) | MIT | Tipos de TypeScript para Node.js. |
| T-022 | @types/react | 19.3.0 | no verificado (repositorio: github.com/DefinitelyTyped/DefinitelyTyped) | MIT | Tipos de TypeScript para React. |
| T-023 | @types/react-dom | 19.3.0 | no verificado (repositorio: github.com/DefinitelyTyped/DefinitelyTyped) | MIT | Tipos de TypeScript para React DOM. |
| T-024 | eslint | 9.39.5 | Nicholas C. Zakas | MIT | Revisión estática del código (`npm run lint`, `eslint.config.mjs`). |
| T-025 | eslint-config-next | 16.3.7 | no verificado (repositorio: github.com/vercel/next.js) | MIT | Reglas de ESLint para Next.js. |
| T-026 | Supabase CLI (`supabase`) | no fijada (se ejecuta con `npx`) | Supabase | MIT (no verificado en el repositorio) | Crea y aplica las migraciones de `supabase/migrations/` y genera `lib/supabase/database.types.ts`. No está en `package.json`. |

## 3. Fuentes tipográficas

Se cargan con `next/font/google` en `app/layout.tsx`. Next.js las descarga al compilar y las sirve desde la propia
aplicación; los archivos de las fuentes no están en el repositorio.

Licencia y autores comprobados el 2026-11-05 en el repositorio oficial de Google Fonts
(`github.com/google/fonts`, archivos `METADATA.pb` y `OFL.txt` de cada fuente).

| ID | Fuente | Autores (diseñadores) | Titular del copyright | Licencia | Uso |
|---|---|---|---|---|---|
| T-027 | Figtree | Erik Kennedy | Copyright 2022 The Figtree Project Authors (github.com/erikdkennedy/figtree) | SIL Open Font License 1.1 | Texto de la interfaz. |
| T-028 | Onest | Dmitri Voloshin, Andrey Kudryavtsev | Copyright 2021 The Onest Project Authors (github.com/googlefonts/onest) | SIL Open Font License 1.1 | Títulos (h1 a h3). |
| T-029 | Geist Mono | Andrés Briganti, Mateo Zaragoza, Guillermo Rauch, Evil Rabbit, José Rago, Facundo Santana | Copyright 2024 The Geist Project Authors (github.com/vercel/geist-font) | SIL Open Font License 1.1 | Códigos de clase y de invitación. |

La OFL 1.1 permite usar las fuentes en software, también comercial; lo que no permite es venderlas por separado.

## 4. Obra intelectual ajena incluida en el software

| ID | Obra | Autores | Licencia o permiso | Uso |
|---|---|---|---|---|
| T-030 | Inventario de Conciencia Metacognitiva (MAI), 52 ítems en español | Instrumento original: Schraw y Dennison (1994). Adaptación al español: González-Cabañes et al., *Psicothema*, 2022, 34(3), 454-462, publicada en https://osf.io/zthdj | **Sin licencia declarada** en el archivo de OSF. El permiso de los autores está pendiente (`docs/PENDIENTES.md`, pendiente 9). | Ítems del cuestionario "¿Cómo aprendes?" (F-08, versión preliminar), en `lib/self-regulation.ts`. El reparto de ítems por escala está también en la función SQL `self_regulation_scores`. La cita está en el propio archivo. |

## 5. Servicios externos

No están dentro del código, pero el software necesita estos servicios para funcionar. Su uso se rige por los
términos de cada proveedor, no por una licencia de software. Las claves de acceso no están en el repositorio.

| ID | Servicio | Proveedor | Uso |
|---|---|---|---|
| T-031 | Supabase | Supabase, Inc. | Autenticación, base de datos Postgres con RLS y pgvector, y almacenamiento de archivos (bucket privado). |
| T-032 | API de OpenAI | OpenAI | Embeddings (`text-embedding-3-small`) y generación de propuestas (conceptos, preguntas, fichas, recursos, temas, citas y duplicados) que el docente valida. |
| T-033 | Resend | Resend | Envío de los correos de confirmación de cuenta y recuperación de contraseña, como SMTP de Supabase. Se configura en el panel de Supabase, no en el código. |
| T-034 | Vercel | Vercel Inc. | Alojamiento y despliegue de la aplicación, y dominio `brujulaed.com`. |
| T-035 | YouTube oEmbed | Google | `lib/link-check.ts` lo consulta para comprobar que existen los videos que se proponen como recursos. |

## Notas

- "no verificado" en la columna de autor significa que el `package.json` del paquete no declara el campo `author`.
  Se indica el repositorio como referencia, no como autor confirmado.
- Que T-015 se usó como CLI para generar `components/ui/` se deduce de la presencia de `components.json`; el
  historial de git no lo registra.
- Los componentes de `components/ui/` (`button`, `card`, `input`, `label`, `progress`, `radio-group`) se generaron
  con esa CLI y luego se ajustaron a la imagen del proyecto.
- En `public/` hay cinco SVG de la plantilla inicial de Next.js (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`,
  `window.svg`). Ninguna pantalla los usa.
- La marca de BRÚJULA.ED (`public/brand/`, `svg/`, `app/icon.svg`) no es de terceros: es obra propia y figura en
  `docs/REGISTRO_PROPIO.md`.
