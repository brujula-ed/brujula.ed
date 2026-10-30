import { Card, CardContent } from "@/components/ui/card";
import { BrandMark } from "@/components/brand-mark";
import type { ConceptState } from "@/lib/concept-state";
import { unlockedBy } from "@/lib/gap-closure";
import type { GraphConcept } from "@/lib/knowledge-graph";
import type { LRRResult } from "@/lib/lrr";

// "Tu brújula" (F-13): el rayo amarillo de la marca se acerca con cada brecha cerrada y se une cuando están todas.
// Sale del LRR (recuperadas / identificadas): sin puntos ni rankings. Mostrar solo si hay brechas identificadas.
export function GapCompass({
  lrr,
  concepts,
  states,
}: {
  lrr: LRRResult;
  concepts: GraphConcept[];
  states: Record<string, ConceptState>;
}) {
  const missing = lrr.identified - lrr.recovered;
  const gap = 16 * (missing / lrr.identified); // 16 = marca normal, 0 = rayo unido
  const closed = lrr.gaps.filter((g) => g.status === "recuperada");

  const message =
    lrr.recovered === 0
      ? "Cada brecha que cierres acerca el rayo amarillo. Empieza por tu brecha prioritaria."
      : missing === 0
        ? "Cerraste todas tus brechas: tu brújula está completa."
        : `Te ${missing === 1 ? "falta 1 brecha" : `faltan ${missing} brechas`} para completar tu brújula.`;

  return (
    <Card>
      <CardContent className="pt-4 flex flex-col gap-4">
        <p className="text-sm font-medium text-center">Tu brújula</p>

        <div className="flex items-center gap-4">
          <BrandMark size={64} tone="on-light" gap={gap} />
          <p className="text-sm">{message}</p>
        </div>

        {closed.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Brechas cerradas</p>
            <ul className="flex flex-col gap-2">
              {closed.map((g) => {
                const opened = unlockedBy(concepts, states, g.conceptId);
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
      </CardContent>
    </Card>
  );
}
