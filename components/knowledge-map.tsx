"use client";

import { useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Position,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export type MapConcept = {
  id: string;
  name: string;
  description: string | null;
  prerequisite_ids: string[];
};

const NODE_W = 180;
const NODE_H = 56;
const X_GAP = 90;
const Y_GAP = 36;

// Profundidad de cada concepto = camino más largo de prerrequisitos hasta él.
// Si la IA generó un ciclo (A requiere B y B requiere A), se corta para no romper el mapa.
function computeDepths(concepts: MapConcept[]) {
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const depth = new Map<string, number>();
  const visiting = new Set<string>();

  function visit(id: string): number {
    if (depth.has(id)) return depth.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let d = 0;
    for (const p of byId.get(id)?.prerequisite_ids ?? []) {
      if (byId.has(p)) d = Math.max(d, visit(p) + 1);
    }
    visiting.delete(id);
    depth.set(id, d);
    return d;
  }

  concepts.forEach((c) => visit(c.id));
  return depth;
}

export function KnowledgeMap({ concepts }: { concepts: MapConcept[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => {
    const depth = computeDepths(concepts);
    const rowByDepth = new Map<number, number>();
    const ids = new Set(concepts.map((c) => c.id));

    const nodes: Node[] = concepts.map((c) => {
      const d = depth.get(c.id) ?? 0;
      const row = rowByDepth.get(d) ?? 0;
      rowByDepth.set(d, row + 1);
      return {
        id: c.id,
        position: { x: d * (NODE_W + X_GAP), y: row * (NODE_H + Y_GAP) },
        data: { label: c.name },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          width: NODE_W,
          minHeight: NODE_H,
          fontSize: 12,
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--card)",
          color: "var(--card-foreground)",
        },
      };
    });

    const edges: Edge[] = concepts.flatMap((c) =>
      c.prerequisite_ids
        .filter((p) => ids.has(p))
        .map((p) => ({
          id: `${p}->${c.id}`,
          source: p,
          target: c.id,
          markerEnd: { type: MarkerType.ArrowClosed },
        }))
    );

    return { nodes, edges };
  }, [concepts]);

  const selected = concepts.find((c) => c.id === selectedId);
  const requires = selected ? concepts.filter((c) => selected.prerequisite_ids.includes(c.id)) : [];
  const unlocks = selected ? concepts.filter((c) => c.prerequisite_ids.includes(selected.id)) : [];

  return (
    <div>
      <div className="h-[480px] rounded-lg border">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          onNodeClick={(_, node) => setSelectedId(node.id)}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <div className="mt-4 rounded-lg border p-4 text-sm min-h-[96px]">
        {selected ? (
          <>
            <p className="font-medium mb-1">{selected.name}</p>
            <p className="text-muted-foreground mb-3">{selected.description}</p>
            <p>
              <span className="font-medium">Necesitas saber antes:</span>{" "}
              {requires.length ? requires.map((c) => c.name).join(", ") : "nada previo en este mapa"}
            </p>
            <p>
              <span className="font-medium">Desbloquea:</span>{" "}
              {unlocks.length ? unlocks.map((c) => c.name).join(", ") : "ningún concepto posterior en este mapa"}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">
            Haz clic en un concepto para ver qué necesitas saber antes y qué desbloquea.
          </p>
        )}
      </div>
    </div>
  );
}