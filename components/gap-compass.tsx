import { BrandMark } from "@/components/brand-mark";
import type { ConceptState } from "@/lib/concept-state";
import { unlockedBy } from "@/lib/gap-closure";
import type { GraphConcept } from "@/lib/knowledge-graph";
import type { LRRResult } from "@/lib/lrr";

// "Tu brújula" (F-13) con el LRR del estudiante: el rayo amarillo de la marca se acerca con cada brecha cerrada y se
// une cuando están todas. Sale del LRR (cerradas / identificadas): sin puntos ni rankings. Mostrar solo si hay
// brechas identificadas. En Mis asignaturas recibe el total de todas (sin concepts ni states): ahí no se listan las
// cerradas, que cada asignatura muestra en su propia brújula.
export function GapCompass({
  lrr,
  concepts,
  states,
}: {
  lrr: LRRResult;
  concepts?: GraphConcept[];
  states?: Record<string, ConceptState>;
}) {
  const missing = lrr.identified - lrr.recovered;
  const gap = 16 * (missing / lrr.identified); // 16 = marca normal, 0 = rayo unido
  const closed = concepts && states ? lrr.gaps.filter((g) => g.status === "recuperada") : [];
  const open = lrr.noImprovement + lrr.pending;

  const message =
    lrr.recovered === 0
      ? "Cada brecha que cierres acerca el rayo amarillo."
      : missing === 0
        ? "Cerraste todas tus brechas: tu brújula está completa."
        : `Te ${missing === 1 ? "falta 1 brecha" : `faltan ${missing} brechas`} para completarla.`;

  return (
    <section aria-labelledby="compass-title" className="flex flex-col gap-4 rounded-card bg-card p-5 shadow-rest">
      <h2 id="compass-title" className="text-subsection">Tu brújula</h2>

      <div className="flex items-center gap-4">
        <BrandMark size={64} tone="on-light" gap={gap} />
        <div className="flex flex-col gap-1">
          <p className="text-section">
            {lrr.recovered} de {lrr.identified}
          </p>
          <p className="text-sm text-muted-foreground">brechas cerradas · {message}</p>
        </div>
      </div>

      {(lrr.inProgress > 0 || open > 0) && (
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {lrr.inProgress > 0 && (
            <li>
              {lrr.inProgress === 1 ? "1 espera" : `${lrr.inProgress} esperan`} la comprobación final.
            </li>
          )}
          {open > 0 && <li>{open === 1 ? "1 sigue abierta" : `${open} siguen abiertas`}.</li>}
        </ul>
      )}

      {closed.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-xs font-medium text-muted-foreground">Brechas cerradas</p>
          <ul className="flex flex-col gap-2">
            {closed.map((g) => {
              const opened = unlockedBy(concepts!, states!, g.conceptId);
              return (
                <li key={g.conceptId} className="text-sm">
                  <span className="font-medium">{g.concept}</span>
                  {opened.length > 0 && (
                    <span className="text-muted-foreground">
                      {" "}
                      · Ahora puedes seguir con {opened.map((c) => c.name).join(", ")}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">¿Cuándo se cierra una brecha?</summary>
        <p className="mt-2">
          Una brecha es un concepto bajo 70 % en tu primer diagnóstico. Se cierra cuando superas la comprobación y, días
          después, la comprobación final: recordarlo con el tiempo demuestra que lo aprendiste. Criterios sujetos a
          ajuste en el piloto.
        </p>
      </details>
    </section>
  );
}
