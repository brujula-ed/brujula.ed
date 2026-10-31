import { STATE_LABEL, type ConceptState } from "@/lib/concept-state";

// Color de cada estado de conocimiento (tokens --state-*). Solo para estados, nunca para otra cosa
// (docs/PRINCIPIOS-DE-DISENO.md 3.4).
export const STATE_BG: Record<ConceptState, string> = {
  dominado: "bg-state-mastered",
  en_desarrollo: "bg-state-progress",
  brecha: "bg-state-gap",
  sin_evidencia: "bg-state-none",
};

// Estado de un concepto: punto de color + nombre del estado. El texto va en color de lectura (el rojo o el ámbar como
// texto no alcanzan el contraste mínimo sobre blanco), así que el estado nunca depende solo del color.
export function StateChip({ state, className = "" }: { state: ConceptState; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground ${className}`}
    >
      <span aria-hidden="true" className={`size-2 rounded-full ${STATE_BG[state]}`} />
      {STATE_LABEL[state]}
    </span>
  );
}
