import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "cn";
import type { SetupStep, StepId } from "@/lib/subject-setup";

// Navegación de la página de la asignatura (docs/PRINCIPIOS-DE-DISENO.md 2.10): pestañas "Contenido" y "Estudiantes"
// y, en Contenido, el recorrido de 5 pasos con su estado. Todo con enlaces (?vista= y ?paso=), sin estado en el cliente.
export type View = "contenido" | "estudiantes";

export function SubjectTabs({ subjectId, view }: { subjectId: string; view: View }) {
  const tabs: { id: View; label: string; href: string }[] = [
    { id: "contenido", label: "Contenido", href: `/docente/${subjectId}?vista=contenido` },
    { id: "estudiantes", label: "Estudiantes", href: `/docente/${subjectId}?vista=estudiantes` },
  ];
  return (
    <nav aria-label="Secciones de la asignatura" className="mb-6 flex gap-1 border-b border-border">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={view === t.id ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors duration-(--duration-instant)",
            view === t.id
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function SetupStepsNav({
  subjectId,
  steps,
  selected,
  current,
}: {
  subjectId: string;
  steps: SetupStep[];
  selected: StepId;
  current: StepId | null; // el primer paso obligatorio que falta
}) {
  return (
    <nav aria-label="Pasos para preparar la asignatura" className="mb-8">
      <ol className="grid grid-cols-5 gap-2">
        {steps.map((s, i) => {
          const isSelected = s.id === selected;
          return (
            <li key={s.id}>
              <Link
                href={`/docente/${subjectId}?paso=${s.id}`}
                aria-current={isSelected ? "step" : undefined}
                className={cn(
                  "flex h-full flex-col gap-1.5 rounded-control border p-2 transition-colors duration-(--duration-instant) md:p-3",
                  isSelected ? "border-primary bg-secondary" : "border-border bg-card hover:border-primary/40"
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      s.done
                        ? "bg-primary text-primary-foreground"
                        : s.id === current
                          ? "border-2 border-primary text-primary"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {s.done ? <Check aria-hidden="true" className="size-3.5" /> : i + 1}
                  </span>
                  {/* En el celular solo cabe el número; el nombre del paso elegido va debajo de la barra */}
                  <span className="hidden text-sm font-semibold md:inline">{shortLabel(s)}</span>
                </span>
                <span className="hidden text-xs text-muted-foreground md:block">
                  {s.done ? "Hecho" : s.id === current ? "Paso actual" : s.required ? "Pendiente" : "Opcional"}
                </span>
                {/* Lo mismo para lectores de pantalla en el celular, donde el texto de arriba está oculto */}
                <span className="sr-only md:hidden">
                  {shortLabel(s)}: {s.done ? "hecho" : s.required ? "pendiente" : "opcional"}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Nombre corto para la barra; el largo ("Estructura: conceptos y temas") va en el título del paso
export function shortLabel(s: SetupStep): string {
  return s.id === "estructura" ? "Estructura" : s.label;
}
