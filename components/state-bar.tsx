import { STATE_LABEL, type ConceptState } from "@/lib/concept-state";
import { STATE_BG } from "@/components/state-chip";

// Barra de estados: la forma estándar de resumir una asignatura, un concepto o una clase
// (docs/PRINCIPIOS-DE-DISENO.md 3.9). Proporcional, con su leyenda en texto. El ancho de cada tramo se anima al cambiar.
const ORDER: ConceptState[] = ["dominado", "en_desarrollo", "brecha", "sin_evidencia"];

// La barra en una línea de texto, sin los estados en cero: "3 dominado · 1 brecha"
export function stateSummary(counts: Partial<Record<ConceptState, number>>): string {
  return ORDER.filter((s) => counts[s])
    .map((s) => `${counts[s]} ${STATE_LABEL[s].toLowerCase()}`)
    .join(" · ");
}

export function StateBar({
  counts,
  showLegend = true,
}: {
  counts: Partial<Record<ConceptState, number>>;
  showLegend?: boolean;
}) {
  const total = ORDER.reduce((s, k) => s + (counts[k] ?? 0), 0);
  const label = ORDER.map((k) => `${STATE_LABEL[k].toLowerCase()} ${counts[k] ?? 0}`).join(", ");

  return (
    <div className="flex flex-col gap-2">
      <div role="img" aria-label={label} className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {total > 0 &&
          ORDER.map((k) =>
            (counts[k] ?? 0) > 0 ? (
              <div
                key={k}
                className={`${STATE_BG[k]} transition-[width] duration-(--duration-medium) ease-out-soft`}
                style={{ width: `${((counts[k] ?? 0) / total) * 100}%` }}
              />
            ) : null
          )}
      </div>
      {showLegend && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {ORDER.map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`size-2 rounded-full ${STATE_BG[k]}`} />
              {STATE_LABEL[k]} <span className="font-medium text-foreground">{counts[k] ?? 0}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
