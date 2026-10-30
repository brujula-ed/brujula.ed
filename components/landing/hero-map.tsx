"use client";

import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { FOCUS_ON_LIGHT, LIFT } from "@/components/landing/styles";
import { usePrefersReducedMotion } from "@/components/landing/use-landing-motion";

// Ejemplo ilustrativo del mapa (no son datos reales). Cada estado se dice también con texto.
type NodeState = "mastered" | "progress" | "gap" | "none";
type MapFrame = {
  title: string;
  button: string;
  nodes: { name: string; state: NodeState; label: string }[];
};

const STATE_BG: Record<NodeState, string> = {
  mastered: "bg-state-mastered",
  progress: "bg-state-progress",
  gap: "bg-state-gap",
  none: "bg-state-none",
};

const BEFORE: MapFrame = {
  title: "Antes de Derivadas, repasa Funciones",
  button: "Repasar Funciones",
  nodes: [
    { name: "Álgebra", state: "mastered", label: "Dominado" },
    { name: "Límites", state: "mastered", label: "Dominado" },
    { name: "Funciones", state: "gap", label: "Brecha" },
    { name: "Derivadas", state: "none", label: "Sin evidencia" },
  ],
};

const AFTER: MapFrame = {
  title: "Brecha cerrada. Sigue con Derivadas",
  button: "Practicar Derivadas",
  nodes: [
    { name: "Álgebra", state: "mastered", label: "Dominado" },
    { name: "Límites", state: "mastered", label: "Dominado" },
    { name: "Funciones", state: "mastered", label: "Recuperada" },
    { name: "Derivadas", state: "progress", label: "En desarrollo" },
  ],
};

const GAP_INDEX = 2; // Funciones

// Bucle de ~11 s (docs/LANDING-PARA-CODE.md, 4.1). Con "reducir movimiento" se muestra quieto en el estado final.
export function HeroMap() {
  const reduce = usePrefersReducedMotion();
  const [shown, setShown] = useState(BEFORE.nodes.length); // nodos visibles; al cargar, todos
  const [pulse, setPulse] = useState(false);
  const [closed, setClosed] = useState(false);
  const [title, setTitle] = useState(BEFORE.title);
  const [titleFaded, setTitleFaded] = useState(false);
  const [gap, setGap] = useState(16);

  useEffect(() => {
    if (reduce) return;
    const timers: number[] = [];
    let raf = 0;
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));

    // El rayo de la tarjeta se cierra en 900 ms con salida suave.
    function closeRay() {
      let t0: number | null = null;
      const step = (ts: number) => {
        t0 ??= ts;
        const k = Math.min(1, (ts - t0) / 900);
        setGap(16 * Math.pow(1 - k, 3));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }

    function cycle() {
      timers.length = 0; // los anteriores ya se ejecutaron
      setShown(0);
      setPulse(false);
      setClosed(false);
      setTitle(BEFORE.title);
      setGap(16);
      BEFORE.nodes.forEach((_, i) => at(250 + i * 380, () => setShown(i + 1)));
      at(2000, () => setPulse(true));
      at(4200, () => {
        setPulse(false);
        setClosed(true);
        setTitleFaded(true);
        closeRay();
      });
      at(4500, () => {
        setTitle(AFTER.title);
        setTitleFaded(false);
      });
      at(10500, () => setShown(0));
      at(11300, cycle);
    }

    at(0, cycle);
    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
    };
  }, [reduce]);

  const frame = reduce || closed ? AFTER : BEFORE;
  const visible = reduce ? frame.nodes.length : shown;

  return (
    <figure
      aria-label="Ejemplo del mapa de conocimiento"
      className="flex min-w-0 flex-col gap-[18px] rounded-[28px] border border-border bg-card p-[26px] shadow-[0_24px_60px] shadow-foreground/12"
    >
      <div className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
        <span className="flex items-center gap-2 font-heading text-base font-bold text-foreground">
          <BrandMark size={26} tone="on-light" gap={reduce ? 0 : gap} />
          Mapa de conocimiento
        </span>
        <span>Cálculo I · ejemplo</span>
      </div>

      <p
        className={`min-h-[52px] font-heading text-[21px] font-bold leading-[1.2] tracking-[-0.02em] transition-opacity duration-350 min-[561px]:min-h-[58px] min-[561px]:text-2xl ${
          titleFaded ? "opacity-0" : "opacity-100"
        }`}
      >
        {reduce ? AFTER.title : title}
      </p>

      <div className="flex items-start justify-center rounded-[18px] bg-background px-1 py-[22px] min-[561px]:px-2">
        {frame.nodes.map((node, i) => (
          <div key={node.name} className="contents">
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`mt-[17px] h-[3px] w-[4%] min-w-2 flex-none origin-left rounded-sm bg-muted-foreground/40 transition-transform duration-600 min-[561px]:mt-5 min-[561px]:min-w-3.5 ${
                  i < visible ? "scale-x-100" : "scale-x-0"
                }`}
              />
            )}
            <div
              className={`flex w-1/4 min-w-0 flex-col items-center gap-1.5 text-center transition-[opacity,translate,scale] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${
                i < visible ? "opacity-100" : "translate-y-2.5 scale-70 opacity-0"
              }`}
            >
              <span
                className={`block size-[38px] rounded-full transition-colors duration-600 min-[561px]:size-11 ${
                  STATE_BG[node.state]
                } ${pulse && i === GAP_INDEX ? "animate-gap-pulse" : ""}`}
              />
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
          className={`inline-flex min-h-[46px] items-center rounded-[14px] bg-primary px-5 font-bold leading-none text-primary-foreground ${LIFT} ${FOCUS_ON_LIGHT}`}
        >
          {frame.button}
        </a>
      </div>
    </figure>
  );
}
