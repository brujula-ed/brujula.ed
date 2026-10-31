// Fuente en el material de un concepto o de una pregunta: las citas comprobadas con su página (o su sección, en Word).
// Se muestran en la columna de contexto de las mesas de Estructura y Preguntas.

export type Evidence = { quote: string; page_start: number | null; page_end: number | null; section: string | null };

// Página o sección de una cita, para mostrar debajo
export function evidenceLocation(e: Evidence): string {
  if (e.page_start !== null) {
    return e.page_end !== null && e.page_end !== e.page_start
      ? `págs. ${e.page_start}–${e.page_end}`
      : `pág. ${e.page_start}`;
  }
  return e.section ?? "";
}

// Las citas, o el texto de `empty` si no hay ninguna
export function EvidenceQuotes({ evidence, empty }: { evidence: Evidence[]; empty: string }) {
  if (evidence.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="flex flex-col gap-3">
      {evidence.map((e) => (
        <figure key={e.quote} className="flex flex-col gap-1">
          <blockquote className="rounded-r-control border-l-2 border-primary bg-secondary/60 px-3 py-2 text-sm">
            «{e.quote}»
          </blockquote>
          {evidenceLocation(e) && <figcaption className="text-xs text-muted-foreground">{evidenceLocation(e)}</figcaption>}
        </figure>
      ))}
    </div>
  );
}
