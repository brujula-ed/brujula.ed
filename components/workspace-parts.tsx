import { Check } from "lucide-react";
import { cn } from "cn";

// Piezas comunes de las mesas de trabajo de la asignatura (Estructura y Preguntas, docs/PRINCIPIOS-DE-DISENO.md 5.10)

// Un elemento de la lista de la izquierda. A la derecha, ✓ si está validado o "Revisar" si no; `badge` lo reemplaza
// cuando la mesa necesita otra marca (p. ej. "2 de 4" en Preguntas).
export function ListItem({
  selected,
  validated,
  badge,
  onClick,
  className,
  children,
}: {
  selected: boolean;
  validated: boolean;
  badge?: React.ReactNode;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-control border px-3 py-2 text-left text-sm transition-colors duration-(--duration-instant)",
        selected ? "border-primary bg-card shadow-rest" : "border-transparent hover:bg-card",
        className
      )}
    >
      <span className="min-w-0">{children}</span>
      {badge ??
        (validated ? (
          <Check aria-label="Validado" className="size-4 shrink-0 text-primary" />
        ) : (
          <span className="shrink-0 rounded-full border border-dashed border-primary/50 px-2 py-0.5 text-xs font-medium text-primary">
            Revisar
          </span>
        ))}
    </button>
  );
}

// Tarjeta de la columna de contexto (derecha)
export function ContextCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-card bg-card p-4 shadow-rest">
      <h3 className="text-eyebrow text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}
