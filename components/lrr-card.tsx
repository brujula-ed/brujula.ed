import { Card, CardContent } from "@/components/ui/card";
import type { LRRResult } from "@/lib/lrr";

const SEGMENTS = [
  { key: "recovered", label: "Recuperadas", color: "var(--state-mastered)" },
  { key: "inProgress", label: "En proceso", color: "var(--state-progress)" },
  { key: "noImprovement", label: "Sin mejora", color: "var(--state-gap)" },
  { key: "pending", label: "Sin practicar", color: "var(--state-none-soft)" },
] as const;

export function LRRCard({
  lrr,
  title = "Tasa de recuperación (LRR)",
  extra,
}: {
  lrr: LRRResult;
  title?: string;
  extra?: { studentsWithGaps: number; studentsWithRecovery: number };
}) {
  return (
    <Card>
      <CardContent className="pt-4 flex flex-col gap-4">
        <p className="text-sm font-medium text-center">{title}</p>

        {lrr.identified === 0 ? (
          <p className="text-sm text-muted-foreground text-center">
            Aún no hay brechas identificadas en un diagnóstico.
          </p>
        ) : (
          <>
            <div className="text-center">
              <p className="text-4xl font-semibold leading-tight">
                {lrr.recovered} de {lrr.identified}
              </p>
              <p className="text-sm text-muted-foreground">
                Brechas cerradas · {Math.round((lrr.lrr ?? 0) * 100)} %
              </p>
            </div>

            <div
              className="flex h-3 rounded overflow-hidden bg-muted"
              role="img"
              aria-label={SEGMENTS.map((s) => `${s.label.toLowerCase()} ${lrr[s.key]}`).join(", ")}
            >
              {SEGMENTS.map(
                (s) =>
                  lrr[s.key] > 0 && (
                    <div
                      key={s.key}
                      style={{ width: `${(lrr[s.key] / lrr.identified) * 100}%`, background: s.color }}
                    />
                  )
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {SEGMENTS.map((s) => (
                <span key={s.key} className="flex items-center gap-1.5">
                  <span 
                    className="inline-block w-3 h-3 rounded-sm" 
                    style={{ background: s.color }} 
                    />
                  <span>{s.label}</span>
                  <span>{lrr[s.key]}</span>
                </span>
              ))}
            </div>

            {extra && extra.studentsWithGaps > 0 && (
              <p className="text-xs text-center text-muted-foreground">
                {extra.studentsWithRecovery} de {extra.studentsWithGaps} estudiante(s) con brechas
                cerraron al menos una.
              </p>
            )}
          </>
        )}

        <p className="text-xs text-center text-muted-foreground">
          Brecha = concepto bajo 70 % en el primer diagnóstico. Cerrada = la evaluación más reciente
          (microevaluación o un diagnóstico posterior) llega a 70 % o más. Criterios sujetos a ajuste en el piloto
          (Anexo I, sec. 12).
        </p>
      </CardContent>
    </Card>
  );
}