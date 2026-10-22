"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  useNodesState,
  type Node,
  type Edge,
  type NodeProps,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { STATE_LABEL, type ConceptState } from "@/lib/concept-state";
import { computeDependents } from "@/lib/knowledge-graph";

export type MapConcept = {
  id: string;
  name: string;
  description: string | null;
  prerequisite_ids: string[];
};

type ConceptNodeData = {
  label: string;
  diameter: number;
  state?: ConceptState;
};
type ConceptNodeType = Node<ConceptNodeData, "concept">;

const NODE_W = 128;
const LABEL_H = 30;

const STATE_STYLE: Record<ConceptState, { border: string; background: string; icon: string }> = {
  sin_evidencia: { border: "var(--state-none)", background: "color-mix(in srgb, var(--state-none) 18%, transparent)", icon: "?" },
  brecha: { border: "var(--state-gap)", background: "color-mix(in srgb, var(--state-gap) 18%, transparent)", icon: "!" },
  en_desarrollo: { border: "var(--state-progress)", background: "color-mix(in srgb, var(--state-progress) 20%, transparent)", icon: "↑" },
  dominado: { border: "var(--state-mastered)", background: "color-mix(in srgb, var(--state-mastered) 20%, transparent)", icon: "✓" },
};

// Cuantos más conceptos abre (directa o indirectamente), más grande el círculo.
const diameterFor = (dependentsCount: number) => Math.min(44 + dependentsCount * 8, 88);

function ConceptNode({ data, selected }: NodeProps<ConceptNodeType>) {
  const colors = data.state ? STATE_STYLE[data.state] : null;
  return (
    <div style={{ width: NODE_W, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        role="img"
        aria-label={`${data.label}${data.state ? `: ${STATE_LABEL[data.state]}` : ""}`}
        style={{
          position: "relative",
          width: data.diameter,
          height: data.diameter,
          borderRadius: "50%",
          border: `3px solid ${colors?.border ?? "var(--border)"}`,
          background: colors?.background ?? "var(--card)",
          color: colors?.border ?? "var(--muted-foreground)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: Math.round(data.diameter * 0.4),
          fontWeight: 600,
          boxShadow: selected ? "0 0 0 4px color-mix(in srgb, var(--ring) 35%, transparent)" : "none",
          cursor: "pointer",
        }}
      >
        <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
        {colors?.icon}
      </div>
      <div
        style={{
          marginTop: 4,
          width: "100%",
          fontSize: 11,
          lineHeight: 1.2,
          textAlign: "center",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { concept: ConceptNode };

function buildLayout(concepts: MapConcept[], states?: Record<string, ConceptState>) {
  const dependents = computeDependents(concepts);
  const ids = new Set(concepts.map((c) => c.id));

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 36, ranksep: 64 });

  const diameters = new Map<string, number>();
  concepts.forEach((c) => {
    const d = diameterFor(dependents.get(c.id)?.size ?? 0);
    diameters.set(c.id, d);
    g.setNode(c.id, { width: NODE_W, height: d + LABEL_H });
  });

  const edges: Edge[] = [];
  const seen = new Set<string>();
  concepts.forEach((c) => {
    c.prerequisite_ids
      .filter((p) => ids.has(p) && p !== c.id)
      .forEach((p) => {
        const id = `${p}->${c.id}`;
        if (seen.has(id)) return;
        seen.add(id);
        g.setEdge(p, c.id);
        edges.push({
          id,
          source: p,
          target: c.id,
          style: { stroke: "var(--state-none)" },
          markerEnd: { type: MarkerType.ArrowClosed, color: "var(--state-none)" },
        });
      });
  });

  dagre.layout(g);

  const nodes: ConceptNodeType[] = concepts.map((c) => {
    const pos = g.node(c.id);
    const d = diameters.get(c.id)!;
    return {
      id: c.id,
      type: "concept",
      position: { x: pos.x - NODE_W / 2, y: pos.y - (d + LABEL_H) / 2 },
      data: {
        label: c.name,
        diameter: d,
        state: states ? (states[c.id] ?? "sin_evidencia") : undefined,
      },
    };
  });

  return { nodes, edges };
}

export function KnowledgeMap({
  concepts,
  states,
}: {
  concepts: MapConcept[];
  states?: Record<string, ConceptState>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const { nodes: initialNodes, edges } = useMemo(() => buildLayout(concepts, states), [concepts, states]);
  const dependents = useMemo(() => computeDependents(concepts), [concepts]);
  const [nodes, setNodes, onNodesChange] = useNodesState<ConceptNodeType>(initialNodes);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  // La selección cambia igual con clic que con teclado (Tab hasta el concepto y Enter o Espacio);
  // onNodeClick solo se dispara con el ratón. React Flow pide que esta función sea estable (useCallback).
  const onSelectionChange = useCallback(({ nodes: selectedNodes }: OnSelectionChangeParams) => {
    setSelectedId(selectedNodes[0]?.id ?? null);
  }, []);

  const selected = concepts.find((c) => c.id === selectedId);
  const requires = selected ? concepts.filter((c) => selected.prerequisite_ids.includes(c.id)) : [];
  const unlocks = selected ? concepts.filter((c) => c.prerequisite_ids.includes(selected.id)) : [];
  const totalOpened = selected ? (dependents.get(selected.id)?.size ?? 0) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div>
        <div className="h-[520px] rounded-lg border">
          <ReactFlow
            key={resetKey}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onSelectionChange={onSelectionChange}
            nodesConnectable={false}
            fitView
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        <div className="flex justify-end mt-2">
          <button
            onClick={() => {
              setNodes(initialNodes);
              setResetKey((k) => k + 1);
            }}
            className="text-xs text-muted-foreground hover:underline"
          >
            Reordenar mapa
          </button>
        </div>
      </div>

      <aside className="rounded-lg border p-4 text-sm flex flex-col gap-4">
        <div>
          <p className="font-medium mb-2">Cómo leer el mapa</p>
          <ul className="text-xs text-muted-foreground list-disc list-inside flex flex-col gap-1">
            <li>Lo de arriba se aprende antes; las flechas apuntan a lo que desbloquea.</li>
            <li>Un círculo más grande abre más conceptos.</li>
            <li>Puedes mover los círculos para explorar.</li>
          </ul>
          {states && (
            <div className="flex flex-col gap-1.5 mt-3">
              {(Object.keys(STATE_STYLE) as ConceptState[]).map((s) => (
                <span key={s} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold"
                    style={{
                      border: `2px solid ${STATE_STYLE[s].border}`,
                      background: STATE_STYLE[s].background,
                      color: STATE_STYLE[s].border,
                    }}
                  >
                    {STATE_STYLE[s].icon}
                  </span>
                  {STATE_LABEL[s]}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* aria-live: los lectores de pantalla leen el detalle al seleccionar un concepto */}
        <div className="border-t pt-4" aria-live="polite">
          {selected ? (
            <>
              <p className="font-medium">{selected.name}</p>
              {states && (
                <p className="text-xs text-muted-foreground mb-2">
                  {STATE_LABEL[states[selected.id] ?? "sin_evidencia"]}
                </p>
              )}
              <p className="text-muted-foreground mb-3">{selected.description}</p>
              <p className="mb-1">
                <span className="font-medium">Necesitas saber antes:</span>{" "}
                {requires.length ? requires.map((c) => c.name).join(", ") : "nada previo en este mapa"}
              </p>
              <p className="mb-1">
                <span className="font-medium">Desbloquea:</span>{" "}
                {unlocks.length ? unlocks.map((c) => c.name).join(", ") : "ningún concepto posterior"}
              </p>
              {totalOpened > unlocks.length && (
                <p className="text-xs text-muted-foreground">Abre {totalOpened} conceptos en total.</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">
              Haz clic en un círculo para ver su detalle (con teclado: Tab hasta el círculo y Enter).
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}