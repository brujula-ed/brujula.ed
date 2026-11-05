# BRÚJULA.ED

Aplicación web de apoyo al aprendizaje. El docente sube el material de su curso; la inteligencia artificial propone
conceptos, prerrequisitos, preguntas, fichas y recursos abiertos, y el docente los valida. El estudiante hace un
diagnóstico por tema, ve su mapa de conocimiento y sigue una ruta de nivelación para cerrar sus brechas.

- **Aplicación en funcionamiento:** https://www.brujulaed.com
- **Autor:** Sergio Ríos
- **Documentación:**
  - [Manual técnico](docs/MANUAL-TECNICO.md): arquitectura, motor de conocimiento, modelo de datos y seguridad;
  - [Manual de usuario](docs/MANUAL-DE-USUARIO.md): uso para docentes y estudiantes;
  - [Componentes propios](docs/REGISTRO_PROPIO.md) y [componentes de terceros](docs/REGISTRO_TERCEROS.md).

## Tecnologías

Next.js 16 (App Router), React 19, TypeScript y Tailwind CSS v4. Supabase (autenticación, Postgres con seguridad por
fila, pgvector y almacenamiento). OpenAI (embeddings y generación). Resend para los correos y Vercel para publicar.

## Requisitos

- Node.js 20.9 o superior;
- un proyecto de Supabase con la extensión pgvector;
- una clave de la API de OpenAI;
- opcional: una cuenta de Vercel para publicar.

## Instalación

1. Instalar las dependencias:
   ```bash
   npm install
   ```
2. Crear el archivo `.env.local` en la raíz con estas cuatro variables (no se incluye en el repositorio):

   | Variable | Para qué |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Dirección del proyecto de Supabase |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publicable de Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor: formulario "Pedir un piloto" |
   | `OPENAI_API_KEY` | Solo servidor: rutas de `app/api/` |

3. Crear la base de datos aplicando las migraciones de `supabase/migrations/`:
   ```bash
   npx supabase link --project-ref <proyecto>
   npx supabase db push
   ```
4. En el panel de Supabase:
   - activar la confirmación de correo;
   - poner la contraseña mínima en 8 caracteres;
   - configurar la Site URL y las URL de redirección;
   - pegar las plantillas de `supabase/templates/`.
5. Arrancar la aplicación:
   ```bash
   npm run dev                      # desarrollo, en http://localhost:3000
   npm run build && npm run start   # producción
   ```
6. Crear un código de docente desde el SQL Editor de Supabase y registrarse con él:
   ```sql
   select create_teacher_invite('nota');
   ```

Los detalles están en el [manual técnico](docs/MANUAL-TECNICO.md), sección 8.

## Verificar una copia comprimida

Cada copia comprimida del código (`.zip`) viene acompañada de un archivo `.sha256.txt` con su huella SHA-256. Para
comprobar que la copia no cambió, calcula la huella y compárala con la del archivo:

```powershell
# Windows (PowerShell)
Get-FileHash -Algorithm SHA256 brujula-ed-codigo-AAAA-MM-DD.zip
```

```bash
# macOS o Linux
sha256sum brujula-ed-codigo-AAAA-MM-DD.zip
```

Si las dos huellas son iguales, la copia está intacta. La copia no incluye `.env.local` (claves), `node_modules` ni
la carpeta de compilación: se recrean con los pasos de instalación.
