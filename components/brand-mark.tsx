// Marca de brújula.ed dibujada en línea (mismos trazos que public/brand/), para poder mover el rayo que falta.
// gap = separación del rayo amarillo respecto de la rosa, en unidades del viewBox de 100:
// 16 es la marca normal; 0 es la brecha cerrada (el rayo pasa al color base).

export const RAYS = [
  "M43.54 54.68 Q45.09 29.08 45.19 8.25 Q49.62 28.60 56.46 53.32 Z",
  "M50.00 48.00 Q69.80 51.90 86.00 54.00 Q69.80 56.10 50.00 60.00 Z",
  "M56.00 54.00 Q52.10 74.90 50.00 92.00 Q47.90 74.90 44.00 54.00 Z",
  "M50.00 59.50 Q31.30 55.92 16.00 54.00 Q31.30 52.08 50.00 48.50 Z",
  "M53.54 50.46 Q61.35 62.87 68.38 72.38 Q58.87 65.35 46.46 57.54 Z",
  "M53.54 57.54 Q41.13 65.35 31.62 72.38 Q38.65 62.87 46.46 50.46 Z",
  "M46.46 57.54 Q39.43 45.90 33.03 37.03 Q41.90 43.43 53.54 50.46 Z",
];
const MISSING_RAY = "M-5.5 0 Q-1.9 -16.5 0 -30 Q1.9 -16.5 5.5 0 Z";

export function BrandMark({
  size,
  tone,
  gap = 16,
}: {
  size: number;
  tone: "on-dark" | "on-light";
  gap?: number;
}) {
  const base = tone === "on-dark" ? "fill-white" : "fill-primary";
  const closed = gap < 0.5;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="shrink-0">
      {RAYS.map((d) => (
        <path key={d} d={d} className={base} />
      ))}
      <path
        d={MISSING_RAY}
        transform={`translate(50 54) rotate(42) translate(0 -${gap.toFixed(2)})`}
        className={`transition-[fill] duration-500 ${closed ? base : "fill-brand-ray"}`}
      />
    </svg>
  );
}

// "brújula" en blanco y ".ed" en amarillo; siempre en minúsculas.
export function BrandWord({ className = "" }: { className?: string }) {
  return (
    <span className={`font-heading font-bold leading-none tracking-[-0.04em] ${className}`}>
      <span className="text-white">brújula</span>
      <span className="text-brand-ray">.ed</span>
    </span>
  );
}
