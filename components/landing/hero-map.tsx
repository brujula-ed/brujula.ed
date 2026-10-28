import { BrandMark } from "@/components/landing/brand-mark";
import { FOCUS_ON_LIGHT } from "@/components/landing/styles";

// Ejemplo ilustrativo del mapa (no son datos reales). Cada estado se dice también con texto.
type NodeState = "mastered" | "progress" | "gap" | "none";
type MapFrame = {
  title: string;
  button: string;
  gap: number;
  nodes: { name: string; state: NodeState; label: string }[];
};

const STATE_BG: Record<NodeState, string> = {
  mastered: "bg-state-mastered",
  progress: "bg-state-progress",
  gap: "bg-state-gap",
  none: "bg-state-none",
};

export const BEFORE: MapFrame = {
  title: "Antes de Derivadas, repasa Funciones",
  button: "Repasar Funciones",
  gap: 16,
  nodes: [
    { name: "Álgebra", state: "mastered", label: "Dominado" },
    { name: "Límites", state: "mastered", label: "Dominado" },
    { name: "Funciones", state: "gap", label: "Brecha" },
    { name: "Derivadas", state: "none", label: "Sin evidencia" },
  ],
};

export const AFTER: MapFrame = {
  title: "Brecha cerrada. Sigue con Derivadas",
  button: "Practicar Derivadas",
  gap: 0,
  nodes: [
    { name: "Álgebra", state: "mastered", label: "Dominado" },
    { name: "Límites", state: "mastered", label: "Dominado" },
    { name: "Funciones", state: "mastered", label: "Recuperada" },
    { name: "Derivadas", state: "progress", label: "En desarrollo" },
  ],
};

export function HeroMap() {
  const frame = BEFORE;

  return (
    <figure
      aria-label="Ejemplo del mapa de conocimiento"
      className="flex min-w-0 flex-col gap-[18px] rounded-[28px] border border-border bg-card p-[26px] shadow-[0_24px_60px] shadow-foreground/12"
    >
      <div className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
        <span className="flex items-center gap-2 font-heading text-base font-bold text-foreground">
          <BrandMark size={26} tone="on-light" gap={frame.gap} />
          Mapa de conocimiento
        </span>
        <span>Cálculo I · ejemplo</span>
      </div>

      <p className="min-h-[52px] font-heading text-[21px] font-bold leading-[1.2] tracking-[-0.02em] min-[561px]:min-h-[58px] min-[561px]:text-2xl">
        {frame.title}
      </p>

      <div className="flex items-start justify-center rounded-[18px] bg-background px-1 py-[22px] min-[561px]:px-2">
        {frame.nodes.map((node, i) => (
          <div key={node.name} className="contents">
            {i > 0 && (
              <span
                aria-hidden="true"
                className="mt-[17px] h-[3px] w-[4%] min-w-2 flex-none rounded-sm bg-muted-foreground/40 min-[561px]:mt-5 min-[561px]:min-w-3.5"
              />
            )}
            <div className="flex w-1/4 min-w-0 flex-col items-center gap-1.5 text-center">
              <span className={`block size-[38px] rounded-full min-[561px]:size-11 ${STATE_BG[node.state]}`} />
              <span className="font-heading text-xs font-bold min-[561px]:text-sm">{node.name}</span>
              <span className="text-[11px] leading-tight text-muted-foreground min-[561px]:text-xs">
                {node.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3.5">
        <p className="flex-[1_1_200px] text-sm text-muted-foreground">
          Los estados son orientativos, no son calificaciones.
        </p>
        <a
          href="#como"
          className={`inline-flex min-h-[46px] items-center rounded-[14px] bg-primary px-5 font-bold leading-none text-primary-foreground ${FOCUS_ON_LIGHT}`}
        >
          {frame.button}
        </a>
      </div>
    </figure>
  );
}
