import { BrandMark } from "@/components/brand-mark";

// Estado vacío (docs/PRINCIPIOS-DE-DISENO.md 6.6): dice qué hacer, no solo que no hay nada. Lleva la marca con el
// rayo separado: todavía falta algo por recorrer.
export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-card/60 px-6 py-10 text-center">
      <BrandMark size={48} tone="on-light" />
      <h2 className="text-subsection">{title}</h2>
      {text && <p className="max-w-md text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
