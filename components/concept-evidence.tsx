// Fuente en el material de un concepto (versión mínima, hasta el rediseño de la validación): las citas comprobadas
// con su página, o un aviso si no hay ninguna (puede ser que el concepto no salga del material).

export type Evidence = { quote: string; page_start: number | null; page_end: number | null; section: string | null };

function where(e: Evidence): string {
  if (e.page_start !== null) {
    return e.page_end !== null && e.page_end !== e.page_start
      ? `págs. ${e.page_start}–${e.page_end}`
      : `pág. ${e.page_start}`;
  }
  return e.section ?? "";
}

export function ConceptEvidence({ evidence }: { evidence: Evidence[] }) {
  if (evidence.length === 0) {
    return <p className="text-xs text-muted-foreground mb-3">Sin fuente en el material.</p>;
  }
  return (
    <div className="mb-3 flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">Fuente en el material</p>
      {evidence.map((e) => (
        <blockquote key={e.quote} className="border-l-2 border-border pl-3 text-xs text-muted-foreground">
          «{e.quote}»{where(e) && <span className="whitespace-nowrap"> · {where(e)}</span>}
        </blockquote>
      ))}
    </div>
  );
}
