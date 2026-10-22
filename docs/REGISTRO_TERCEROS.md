# Registro de componentes de terceros

Fecha de levantamiento: 2026-10-19.

Alcance: dependencias directas declaradas en `dependencies` de `package.json` (no incluye
`devDependencies` ni dependencias transitivas). La versión, la licencia y el autor se tomaron del
`package.json` de cada paquete instalado en `node_modules`. El uso se verificó buscando los imports
en `app/`, `components/`, `lib/`, `proxy.ts`, `next.config.ts` y `app/globals.css`.

| ID | Componente | Versión | Proveedor o autor | Licencia | Uso en el software |
|---|---|---|---|---|---|
| T-001 | @base-ui/react | 1.8.0 | MUI Team | MIT | Primitivas de interfaz (botón, input, radio, barra de progreso) sobre las que se construyen `components/ui/button.tsx`, `input.tsx`, `radio-group.tsx` y `progress.tsx`. |
| T-002 | @dagrejs/dagre | 3.1.1 | Chris Pettitt | MIT | Calcula la disposición automática de los nodos del mapa de conocimiento en `components/knowledge-map.tsx`. |
| T-003 | @supabase/ssr | 0.12.7 | Supabase, Inc. | MIT | Crea el cliente de Supabase con sesión en cookies en `lib/supabase/server.ts`, `lib/supabase/client.ts` y `proxy.ts`. |
| T-004 | @supabase/supabase-js | 2.117.2 | Supabase | MIT | No se importa directamente en el código; es dependencia requerida (peer) de `@supabase/ssr`, que la usa para Auth, Postgres y Storage. |
| T-005 | @xyflow/react | 12.12.0 | no verificado (repositorio: github.com/xyflow/xyflow) | MIT | Renderiza el mapa de conocimiento interactivo y su hoja de estilos en `components/knowledge-map.tsx`. |
| T-006 | class-variance-authority | 0.7.1 | Joe Bell | Apache-2.0 | Define las variantes visuales del botón (`cva`) en `components/ui/button.tsx`. |
| T-007 | cn | 0.4.0 | no verificado (repositorio: github.com/shadcn-ui/cn) | MIT | Función `cn` para combinar clases CSS, reexportada en `lib/utils.ts` e importada en los componentes de `components/ui/`. |
| T-008 | lucide-react | 1.48.0 | Eric Fennis | ISC | No se usa actualmente: el único import está comentado en `app/docente/[subjectId]/page.tsx`. Figura como biblioteca de íconos en `components.json`. |
| T-009 | mammoth | 1.13.0 | Michael Williamson | BSD-2-Clause | Extrae el texto de documentos .docx en `lib/extract-text.ts`. |
| T-010 | next | 16.3.7 | no verificado (repositorio: github.com/vercel/next.js) | MIT | Framework de la aplicación (App Router, rutas de `app/api/`, `proxy.ts`, navegación y fuentes); configurado en `next.config.ts`. |
| T-011 | openai | 7.28.0 | OpenAI | Apache-2.0 | Cliente de la API de OpenAI para embeddings y generación de conceptos y preguntas en `app/api/process-document/route.ts`, `app/api/generate-concepts/route.ts` y `app/api/generate-questions/route.ts`. |
| T-012 | pdf-parse | 2.4.5 | Mehmet Kozan | Apache-2.0 | Extrae el texto de archivos PDF con import perezoso en `lib/extract-text.ts`; declarado en `serverExternalPackages` de `next.config.ts`. |
| T-013 | react | 19.2.8 | no verificado (repositorio: github.com/react/react) | MIT | Biblioteca de interfaz; sus hooks (`useState`, `useEffect`, etc.) se usan en las páginas de `app/` y en los componentes de `components/`. |
| T-014 | react-dom | 19.2.8 | no verificado (repositorio: github.com/react/react) | MIT | No se importa directamente en el código; Next.js lo usa para renderizar los componentes de React. |
| T-015 | shadcn | 4.21.0 | shadcn | MIT | Hoja de estilos base de los componentes importada en `app/globals.css` (`shadcn/tailwind.css`); también es la CLI con la que se generaron los componentes de `components/ui/`. |
| T-016 | tw-animate-css | 1.4.0 | Luca Bosin | MIT | Utilidades de animación para Tailwind importadas en `app/globals.css`. |

## Notas

- "no verificado" en la columna de autor significa que el `package.json` del paquete no declara el
  campo `author`; se indica el repositorio como referencia, no como autor confirmado.
- Que T-015 se haya usado como CLI para generar `components/ui/` se infiere de la presencia de
  `components.json`; no está registrado en el historial.
