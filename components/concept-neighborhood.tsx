"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "cn";

type Node = { id: string; name: string; status: string; topic_id: string | null };
type Line = { d: string };

const MAX_PER_SIDE = 6;

// Mini mapa de la mesa de Estructura: el concepto al centro, arriba lo que necesita y abajo lo que abre (solo
// relaciones directas). Los nodos son HTML para que los nombres largos se lean enteros; las líneas se dibujan encima
// midiendo dónde quedó cada nodo, y se recalculan si cambia el ancho. Pulsar un nodo lo lleva al centro de la mesa.
export function ConceptNeighborhood({
  concept,
  prereqs,
  opens,
  topicNames,
  onSelect,
}: {
  concept: Node;
  prereqs: Node[];
  opens: Node[];
  topicNames: Map<string, string>;
  onSelect: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const center = useRef<HTMLDivElement>(null);
  const top = useRef<(HTMLButtonElement | null)[]>([]);
  const bottom = useRef<(HTMLButtonElement | null)[]>([]);
  const [lines, setLines] = useState<Line[]>([]);

  const shownTop = prereqs.slice(0, MAX_PER_SIDE);
  const shownBottom = opens.slice(0, MAX_PER_SIDE);

  useLayoutEffect(() => {
    const container = box.current;
    const mid = center.current;
    if (!container || !mid) return;

    function measure() {
      const base = container!.getBoundingClientRect();
      const c = mid!.getBoundingClientRect();
      const cx = c.left + c.width / 2 - base.left;
      const next: Line[] = [];
      // Curva vertical suave entre dos puntos
      const curve = (x1: number, y1: number, x2: number, y2: number) => {
        const my = (y1 + y2) / 2;
        return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
      };
      for (const el of top.current.slice(0, shownTop.length)) {
        if (!el) continue;
        const r = el.getBoundingClientRect();
        next.push({ d: curve(r.left + r.width / 2 - base.left, r.bottom - base.top, cx, c.top - base.top) });
      }
      for (const el of bottom.current.slice(0, shownBottom.length)) {
        if (!el) continue;
        const r = el.getBoundingClientRect();
        next.push({ d: curve(cx, c.bottom - base.top, r.left + r.width / 2 - base.left, r.top - base.top) });
      }
      setLines(next);
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [concept.id, prereqs, opens, shownTop.length, shownBottom.length]);

  const otherTopic = (n: Node) =>
    n.topic_id && n.topic_id !== concept.topic_id ? topicNames.get(n.topic_id) : undefined;

  return (
    <div ref={box} className="relative flex flex-col items-center gap-8 py-1">
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible">
        {lines.map((l, i) => (
          <path key={i} d={l.d} fill="none" className="stroke-border" strokeWidth={1.5} />
        ))}
      </svg>

      <Side
        label="Necesita"
        nodes={shownTop}
        hidden={prereqs.length - shownTop.length}
        empty="Ningún prerrequisito"
        refs={top}
        otherTopic={otherTopic}
        onSelect={onSelect}
      />

      <div
        ref={center}
        className="relative z-10 max-w-full rounded-control bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground shadow-raised"
      >
        {concept.name}
      </div>

      <Side
        label="Abre"
        nodes={shownBottom}
        hidden={opens.length - shownBottom.length}
        empty="Ningún concepto depende de este"
        refs={bottom}
        otherTopic={otherTopic}
        onSelect={onSelect}
        labelBelow
      />
    </div>
  );
}

function Side({
  label,
  nodes,
  hidden,
  empty,
  refs,
  otherTopic,
  onSelect,
  labelBelow = false,
}: {
  label: string;
  nodes: Node[];
  hidden: number;
  empty: string;
  refs: React.RefObject<(HTMLButtonElement | null)[]>;
  otherTopic: (n: Node) => string | undefined;
  onSelect: (id: string) => void;
  labelBelow?: boolean;
}) {
  const caption = <p className="text-eyebrow text-muted-foreground">{label}</p>;
  return (
    <div className="relative z-10 flex w-full flex-col items-center gap-2">
      {!labelBelow && caption}
      {nodes.length === 0 ? (
        <p className="rounded-control border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-wrap justify-center gap-2">
          {nodes.map((n, i) => {
            const topic = otherTopic(n);
            return (
              <li key={n.id}>
                <button
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  onClick={() => onSelect(n.id)}
                  className={cn(
                    "flex max-w-[16rem] flex-col items-start rounded-control bg-card px-2.5 py-1.5 text-left text-xs transition-colors duration-(--duration-instant) hover:border-primary hover:bg-secondary",
                    n.status === "validado" ? "border border-border" : "border border-dashed border-primary/60"
                  )}
                >
                  <span className="flex items-center gap-1 font-medium">
                    {n.status === "validado" && <Check aria-label="Validado" className="size-3 shrink-0 text-primary" />}
                    {n.name}
                  </span>
                  {topic && <span className="text-muted-foreground">De: {topic}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {hidden > 0 && <p className="text-xs text-muted-foreground">y {hidden} más</p>}
      {labelBelow && caption}
    </div>
  );
}
