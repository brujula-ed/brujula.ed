import { Check } from "lucide-react";

// Estado de revisión de una propuesta de la IA (concepto, tema, pregunta): validada por el docente o por revisar. No es
// un estado de conocimiento, así que no usa los colores --state-* (docs/PRINCIPIOS-DE-DISENO.md 3.4).
// validatedLabel cambia el texto para las palabras en femenino ("Validada" para una pregunta).
export function ReviewChip({
  validated,
  validatedLabel = "Validado",
  className = "",
}: {
  validated: boolean;
  validatedLabel?: string;
  className?: string;
}) {
  return validated ? (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground ${className}`}
    >
      <Check aria-hidden="true" className="size-3" />
      {validatedLabel}
    </span>
  ) : (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-primary/50 px-2.5 py-0.5 text-xs font-medium text-primary ${className}`}
    >
      Por revisar
    </span>
  );
}
