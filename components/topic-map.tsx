"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  type Edge,
  type Node,
  type NodeProps,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { Button } from "@/components/ui/button";
import { StateBar } from "@/components/state-bar";
import { STATE_LABEL, type ConceptState } from "@/lib/concept-state";

// Nivel 1 del mapa (docs/MOTOR-DE-CONOCIMIENTO.md 4.3): una tarjeta por tema, ordenadas por lo que hay que estudiar
// antes (relaciones entre temas calculadas desde los prerrequisitos), no por el orden del material.

export type TopicGroup = {
  id: string;
  name: string;
  description: string | null;
  status?: string; // solo el docente lo ve: validado o propuesto por la IA
  concepts: { id: string; name: string }[];
};

type TopicNodeData = {
  name: string;
  count: number;
  status?: string;
  counts?: Partial<Record<ConceptState, number>>; // solo con estados (estudiante)
};
type TopicNodeType = Node<TopicNodeData, "topic">;

const NODE_W = 232;
const NODE_H = 112;

function TopicNode({ data, selected }: NodeProps<TopicNodeType>) {
  return (
    <div
      role="img"
      aria-label={`Tema ${data.name}, ${data.count} conceptos`}
      style={{ width: NODE_W, height: NODE_H }}
      className={`box-border flex cursor-pointer flex-col justify-between gap-2 rounded-card border-2 bg-card p-3 shadow-rest transition-shadow duration-(--duration-instant) ${
        selected ? "border-primary shadow-raised" : "border-border"
      }`}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <p className="line-clamp-2 font-heading text-sm font-semibold leading-snug">{data.name}</p>
      {data.counts ? (
        <StateBar counts={data.counts} showLegend={false} />
      ) : (
        <p className="text-xs text-muted-foreground">
          {data.count} conceptos
          {data.status && ` · ${data.status === "validado" ? "Validado" : "Propuesto por la IA"}`}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { topic: TopicNode };

export function TopicMap({
  groups,
  needs,
  states,
  onOpen,
}: {
  groups: TopicGroup[];
  needs: Map<string, string[]>; // tema → temas que necesita (directos)
  states?: Record<string, ConceptState>;
  onOpen: (topicId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 64 });
    groups.forEach((t) => g.setNode(t.id, { width: NODE_W, height: NODE_H }));
    const edgeList: Edge[] = [];
    for (const t of groups) {
      for (const n of needs.get(t.id) ?? []) {
        if (!groups.some((o) => o.id === n)) continue;
        g.setEdge(n, t.id);
        edgeList.push({
          id: `${n}->${t.id}`,
          source: n,
          target: t.id,
          type: "smoothstep",
          style: { stroke: "var(--primary)" },
          markerEnd: { type: MarkerType.ArrowClosed, color: "var(--primary)" },
        });
      }
    }
    dagre.layout(g);

    const nodeList: TopicNodeType[] = groups.map((t) => {
      const pos = g.node(t.id);
      const counts: Partial<Record<ConceptState, number>> = {};
      if (states) for (const c of t.concepts) counts[states[c.id] ?? "sin_evidencia"] = (counts[states[c.id] ?? "sin_evidencia"] ?? 0) + 1;
      return {
        id: t.id,
        type: "topic",
        position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
        data: { name: t.name, count: t.concepts.length, status: t.status, counts: states ? counts : undefined },
      };
    });
    return { nodes: nodeList, edges: edgeList };
  }, [groups, needs, states]);

  // Igual que el mapa de conceptos: la selección cambia con clic o con teclado (Tab y Enter)
  const onSelectionChange = useCallback(({ nodes: selectedNodes }: OnSelectionChangeParams) => {
    setSelectedId(selectedNodes[0]?.id ?? null);
  }, []);

  const selected = groups.find((t) => t.id === selectedId);
  const nameOf = new Map(groups.map((t) => [t.id, t.name]));
  const selectedNeeds = selected ? (needs.get(selected.id) ?? []).map((id) => nameOf.get(id)).filter(Boolean) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="h-[520px] rounded-card border bg-card">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onSelectionChange={onSelectionChange}
          onNodeDoubleClick={(_, node) => onOpen(node.id)}
          nodesConnectable={false}
          nodesDraggable={false}
          fitView
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <aside className="flex flex-col gap-4 rounded-card border bg-card p-4 text-sm">
        <div>
          <p className="mb-2 font-medium">Cómo leer el mapa</p>
          <ul className="flex list-inside list-disc flex-col gap-1 text-xs text-muted-foreground">
            <li>Cada tarjeta es un tema. Lo de arriba conviene estudiarlo antes; las flechas van hacia lo que viene después.</li>
            <li>Elige un tema para ver su detalle, y entra para ver sus conceptos (o haz doble clic).</li>
          </ul>
        </div>

        {/* aria-live: los lectores de pantalla leen el detalle al seleccionar un tema */}
        <div className="border-t pt-4" aria-live="polite">
          {selected ? (
            <div className="flex flex-col gap-3">
              <div>
                <p className="font-medium">{selected.name}</p>
                {selected.description && <p className="mt-1 text-muted-foreground">{selected.description}</p>}
              </div>
              <p>
                <span className="font-medium">Conviene estudiar antes:</span>{" "}
                {selectedNeeds.length ? selectedNeeds.join(", ") : "ningún otro tema"}
              </p>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">{selected.concepts.length} conceptos</p>
                <ul className="flex flex-col gap-1">
                  {selected.concepts.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2">
                      <span>{c.name}</span>
                      {states && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {STATE_LABEL[states[c.id] ?? "sin_evidencia"]}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <Button onClick={() => onOpen(selected.id)}>Ver sus conceptos</Button>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Haz clic en un tema para ver su detalle (con teclado: Tab hasta el tema y Enter).
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
