import { Card, CardContent } from "@/components/ui/card";

// Cifra clave (docs/PRINCIPIOS-DE-DISENO.md 3.9): etiqueta, número grande y una línea de contexto.
// Todo número que se muestra sale de datos reales (sección 7): no usar cifras de ejemplo en pantallas de verdad.
export function StatTile({
  label,
  value,
  context,
  tone = "default",
  children,
}: {
  label: string;
  value: string | number;
  context?: string;
  tone?: "default" | "featured";
  children?: React.ReactNode; // p. ej. accesos directos a lo que cuenta la cifra
}) {
  return (
    <Card tone={tone}>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm font-medium">{label}</p>
        <p className="font-heading text-figure">{value}</p>
        {context && (
          <p className={`text-sm ${tone === "featured" ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
            {context}
          </p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
