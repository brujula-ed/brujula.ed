import Link from "next/link";

// Paso 3 de "Contenido": fichas y recursos. Provisional: hoy se generan y validan dentro de cada concepto, en el paso
// Estructura; pasarán a este paso cuando se separen de las tarjetas de concepto.
export function CardsStep({ subjectId }: { subjectId: string }) {
  return (
    <div className="max-w-3xl flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">
        Cada concepto validado puede tener una ficha (por qué importa y para qué le sirve al estudiante) y hasta 3
        recursos abiertos para repasar. Son opcionales: la asignatura puede estar lista sin ellos.
      </p>
      <p>
        Por ahora se generan y se validan en cada concepto, en el paso{" "}
        <Link href={`/docente/${subjectId}?paso=estructura`} className="font-medium text-primary hover:underline">
          Estructura
        </Link>
        .
      </p>
    </div>
  );
}
