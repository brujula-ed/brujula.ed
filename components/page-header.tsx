import Link from "next/link";
import { ChevronRight } from "lucide-react";

// Esqueleto de página común (docs/PRINCIPIOS-DE-DISENO.md 3.3): migas (en rutas profundas) → título → una línea de
// "qué sigue" → acción principal. Un h1 por página.
export type Crumb = { label: string; href?: string };

export function PageHeader({
  title,
  next,
  action,
  crumbs,
}: {
  title: string;
  next?: React.ReactNode; // qué hacer ahora ("Tienes 14 conceptos por validar")
  action?: React.ReactNode; // la acción principal de la pantalla
  crumbs?: Crumb[];
}) {
  return (
    <header className="mb-8 flex flex-col gap-3">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Migas de pan">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            {crumbs.map((c, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight aria-hidden="true" className="size-3.5" />}
                {c.href ? (
                  <Link href={c.href} className="rounded-sm hover:text-foreground hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="font-medium text-foreground">
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-title text-balance">{title}</h1>
          {next && <p className="text-base text-muted-foreground">{next}</p>}
        </div>
        {action && <div className="shrink-0 [&>*]:w-full md:[&>*]:w-auto">{action}</div>}
      </div>
    </header>
  );
}
