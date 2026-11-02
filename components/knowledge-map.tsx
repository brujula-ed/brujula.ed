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
import Link from "next/link";
import dagre from "@dagrejs/dagre";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopicMap, type TopicGroup } from "@/components/topic-map";
import { STATE_LABEL, type ConceptState } from "@/lib/concept-state";
import { computeDependents, computeMapEdges, computePrerequisites, computeTopicDependencies } from "@/lib/knowledge-graph";
import { RESOURCE_KIND_LABEL, siteLabel, type ResourceKind } from "@/lib/resource-sources";

export type MapConcept = {
  id: string;
  name: string;
  description: string | null;
  prerequisite_ids: string[];
  topic_id?: string | null;
};

// Tema de la asignatura (docs/MOTOR-DE-CONOCIMIENTO.md 4.3). status solo llega en la vista del docente.
export type MapTopic = { id: string; name: string; description: string | null; status?: string };

type ConceptNodeData = {
  label: string;
  opens: number; // conceptos que desbloquea, directa o indirectamente (en toda la asignatura)
  state?: ConceptState;
  dimmed?: boolean; // fuera de la ruta del concepto seleccionado
  ghostTopic?: string; // prerrequisito de otro tema: tarjeta tenue con el nombre de su tema
};
type ConceptNodeType = Node<ConceptNodeData, "concept">;

// Todas las tarjetas miden lo mismo para que el mapa quede alineado en filas.
const NODE_W = 184;
const NODE_H = 88;
const DIMMED_OPACITY = 0.35;
const GHOST_OPACITY = 0.6;
const NO_TOPIC = "__sin_tema__";

const STATE_STYLE: Record<ConceptState, { border: string; background: string; icon: string }> = {
  sin_evidencia: { border: "var(--state-none)", background: "color-mix(in srgb, var(--state-none) 18%, transparent)", icon: "?" },
  brecha: { border: "var(--state-gap)", background: "color-mix(in srgb, var(--state-gap) 18%, transparent)", icon: "!" },
  en_desarrollo: { border: "var(--state-progress)", background: "color-mix(in srgb, var(--state-progress) 20%, transparent)", icon: "↑" },
  dominado: { border: "var(--state-mastered)", background: "color-mix(in srgb, var(--state-mastered) 20%, transparent)", icon: "✓" },
};

function StateChip({ state }: { state: ConceptState }) {
  const s = STATE_STYLE[state];
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold"
      style={{ border: `2px solid ${s.border}`, background: s.background, color: s.border }}
    >
      {s.icon}
    </span>
  );
}

function ConceptNode({ data, selected }: NodeProps<ConceptNodeType>) {
  const borderColor = data.state ? STATE_STYLE[data.state].border : "var(--border)";
  const ghost = !!data.ghostTopic;
  return (
    <div
      role="img"
      aria-label={`${data.label}${data.state ? `: ${STATE_LABEL[data.state]}` : ""}${ghost ? `, del tema ${data.ghostTopic}` : ""}`}
      style={{
        width: NODE_W,
        height: NODE_H,
        boxSizing: "border-box",
        padding: "8px 10px",
        borderRadius: 10,
        border: `2px ${ghost ? "dashed" : "solid"} ${borderColor}`,
        background: "var(--card)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 4,
        boxShadow: selected ? "0 0 0 4px color-mix(in srgb, var(--ring) 35%, transparent)" : "none",
        opacity: data.dimmed ? DIMMED_OPACITY : ghost ? GHOST_OPACITY : 1,
        transition: "opacity 150ms",
        cursor: "pointer",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        {data.state && <StateChip state={data.state} />}
        <span
          style={{
            fontSize: 13,
            lineHeight: 1.25,
            fontWeight: 500,
            display: "-webkit-box",
            WebkitLineClamp: ghost ? 2 : 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {data.label}
        </span>
      </div>
      {ghost ? (
        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>De: {data.ghostTopic}</span>
      ) : (
        data.opens > 0 && <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Abre {data.opens}</span>
      )}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { concept: ConceptNode };

function buildLayout(
  concepts: MapConcept[],
  opens: Map<string, Set<string>>,
  states: Record<string, ConceptState> | undefined,
  ghostTopicName: Map<string, string>
) {
  const mapEdges = computeMapEdges(concepts);

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 32, ranksep: 56 });

  concepts.forEach((c) => g.setNode(c.id, { width: NODE_W, height: NODE_H }));
  mapEdges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  const nodes: ConceptNodeType[] = concepts.map((c) => {
    const pos = g.node(c.id);
    return {
      id: c.id,
      type: "concept",
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
      data: {
        label: c.name,
        opens: opens.get(c.id)?.size ?? 0,
        state: states ? (states[c.id] ?? "sin_evidencia") : undefined,
        ghostTopic: ghostTopicName.get(c.id),
      },
    };
  });

  const edges: Edge[] = mapEdges.map((e) => ({
    id: `${e.source}->${e.target}`,
    source: e.source,
    target: e.target,
    type: "smoothstep",
  }));

  return { nodes, edges };
}

// Ficha validada del concepto (F-05): por qué importa y para qué te sirve.
export type MapFicha = { whyItMatters: string; application: string };

// Recurso abierto validado del concepto (F-11)
export type MapResource = { title: string; url: string; kind: string; source: string };

type ConceptDetails = {
  states?: Record<string, ConceptState>;
  fichas?: Record<string, MapFicha>;
  resources?: Record<string, MapResource[]>;
  conceptBaseHref?: string; // solo en Mi Brújula: enlace a la página del concepto, con su recorrido
};

// Mapa de conceptos con su panel. visible = lo que se dibuja (un tema y sus prerrequisitos de otros temas, o todo);
// universe = todos los conceptos de la asignatura, para "Abre N", la ruta y el panel.
function ConceptLevel({
  visible,
  universe,
  ghosts,
  onGoToTopic,
  states,
  fichas,
  resources,
  conceptBaseHref,
}: ConceptDetails & {
  visible: MapConcept[];
  universe: MapConcept[];
  ghosts: Map<string, { topicId: string; topicName: string }>; // conceptos de otro tema que se ven tenues
  onGoToTopic?: (topicId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const dependents = useMemo(() => computeDependents(universe), [universe]);
  const prerequisites = useMemo(() => computePrerequisites(universe), [universe]);
  const ghostTopicName = useMemo(
    () => new Map([...ghosts].map(([id, g]) => [id, g.topicName])),
    [ghosts]
  );
  const { nodes: initialNodes, edges } = useMemo(
    () => buildLayout(visible, dependents, states, ghostTopicName),
    [visible, dependents, states, ghostTopicName]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<ConceptNodeType>(initialNodes);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  // La selección cambia igual con clic que con teclado (Tab hasta el concepto y Enter o Espacio);
  // onNodeClick solo se dispara con el ratón. React Flow pide que esta función sea estable (useCallback).
  const onSelectionChange = useCallback(({ nodes: selectedNodes }: OnSelectionChangeParams) => {
    setSelectedId(selectedNodes[0]?.id ?? null);
  }, []);

  const selected = universe.find((c) => c.id === selectedId);
  const selectedGhost = selectedId ? ghosts.get(selectedId) : undefined;
  const requires = selected ? universe.filter((c) => selected.prerequisite_ids.includes(c.id)) : [];
  const unlocks = selected ? universe.filter((c) => c.prerequisite_ids.includes(selected.id)) : [];
  const totalOpened = selected ? (dependents.get(selected.id)?.size ?? 0) : 0;

  // Ruta del concepto seleccionado: toda su cadena de prerrequisitos y lo que desbloquea directamente.
  // El resto se atenúa. Sin selección, todo se ve normal.
  const { displayNodes, displayEdges } = useMemo(() => {
    const chain = selectedId ? new Set([selectedId, ...(prerequisites.get(selectedId) ?? [])]) : null;
    const onPath = (e: Edge) => !!chain && ((chain.has(e.source) && chain.has(e.target)) || e.source === selectedId);
    const shown = chain ? new Set([...chain, ...edges.filter((e) => e.source === selectedId).map((e) => e.target)]) : null;

    return {
      displayNodes: nodes.map((n) => ({ ...n, data: { ...n.data, dimmed: !!shown && !shown.has(n.id) } })),
      displayEdges: edges.map((e) => {
        const color = onPath(e) ? "var(--primary)" : "var(--state-none)";
        return {
          ...e,
          style: { stroke: color, opacity: chain && !onPath(e) ? DIMMED_OPACITY : 1 },
          markerEnd: { type: MarkerType.ArrowClosed, color },
        };
      }),
    };
  }, [nodes, edges, selectedId, prerequisites]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div>
        <div className="h-[520px] rounded-card border bg-card">
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onSelectionChange={onSelectionChange}
            nodesConnectable={false}
            nodesDraggable={false}
            fitView
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </div>

      <aside className="rounded-card border bg-card p-4 text-sm flex flex-col gap-4">
        <div>
          <p className="font-medium mb-2">Cómo leer el mapa</p>
          <ul className="text-xs text-muted-foreground list-disc list-inside flex flex-col gap-1">
            <li>Lo de arriba se aprende antes; las flechas apuntan a lo que desbloquea.</li>
            <li>«Abre N» indica cuántos conceptos desbloquea, directa o indirectamente.</li>
            <li>Al elegir un concepto se resalta lo que necesitas antes y lo que desbloquea.</li>
            {ghosts.size > 0 && <li>Las tarjetas tenues son conceptos de otros temas que este tema necesita.</li>}
          </ul>
          {states && (
            <div className="flex flex-col gap-1.5 mt-3">
              {(Object.keys(STATE_STYLE) as ConceptState[]).map((s) => (
                <span key={s} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <StateChip state={s} />
                  {STATE_LABEL[s]}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* aria-live: los lectores de pantalla leen el detalle al seleccionar un concepto */}
        <div className="border-t pt-4" aria-live="polite">
          {selected && selectedGhost ? (
            <div className="flex flex-col gap-3">
              <div>
                <p className="font-medium">{selected.name}</p>
                <p className="text-xs text-muted-foreground">Está en el tema «{selectedGhost.topicName}»</p>
              </div>
              {selected.description && <p>{selected.description}</p>}
              {onGoToTopic && (
                <Button variant="outline" onClick={() => onGoToTopic(selectedGhost.topicId)}>
                  Ir a ese tema
                </Button>
              )}
            </div>
          ) : selected ? (
            <>
              <p className="font-medium">{selected.name}</p>
              {states && (
                <p className="text-xs text-muted-foreground mb-2">
                  {STATE_LABEL[states[selected.id] ?? "sin_evidencia"]}
                </p>
              )}
              {selected.description && <p className="mb-3">{selected.description}</p>}
              {fichas?.[selected.id] && (
                <div className="mb-3 flex flex-col gap-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Por qué importa</p>
                    <p>{fichas[selected.id].whyItMatters}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Para qué te sirve</p>
                    <p>{fichas[selected.id].application}</p>
                  </div>
                </div>
              )}
              {resources?.[selected.id]?.length ? (
                <div className="mb-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Recursos para repasar</p>
                  <ul className="flex flex-col gap-1">
                    {resources[selected.id].map((r) => (
                      <li key={r.url}>
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {r.title}
                        </a>
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · {RESOURCE_KIND_LABEL[r.kind as ResourceKind] ?? r.kind}
                          {r.source !== "docente" && ` · ${siteLabel(r.source)}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
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
              {conceptBaseHref && (
                <Link
                  href={`${conceptBaseHref}/${selected.id}`}
                  className="inline-block mt-3 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium"
                >
                  Abrir concepto
                </Link>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">
              Haz clic en un concepto para ver su detalle (con teclado: Tab hasta el concepto y Enter).
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

const NO_GHOSTS = new Map<string, { topicId: string; topicName: string }>();

// Mapa de conocimiento en dos niveles (docs/MOTOR-DE-CONOCIMIENTO.md 4.3): primero los temas y, al entrar en uno,
// sus conceptos con los prerrequisitos de otros temas como tarjetas tenues. Sin temas, un solo nivel como antes.
export function KnowledgeMap({
  concepts,
  topics,
  ...details
}: ConceptDetails & { concepts: MapConcept[]; topics?: MapTopic[] }) {
  const [openTopic, setOpenTopic] = useState<string | null>(null);

  const { groups, groupOf, needs } = useMemo(() => {
    const list = topics ?? [];
    const known = new Set(list.map((t) => t.id));
    const groupOf = (c: MapConcept) => (c.topic_id && known.has(c.topic_id) ? c.topic_id : NO_TOPIC);
    const groups: TopicGroup[] = list.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      status: t.status,
      concepts: concepts.filter((c) => groupOf(c) === t.id),
    }));
    const loose = concepts.filter((c) => groupOf(c) === NO_TOPIC);
    if (loose.length > 0) {
      // El estudiante solo ve temas validados: sus conceptos sin tema visible son "otros"
      groups.push({ id: NO_TOPIC, name: details.states ? "Otros conceptos" : "Sin tema", description: null, concepts: loose });
    }
    return { groups, groupOf, needs: computeTopicDependencies(list, concepts).needs };
  }, [topics, concepts, details.states]);

  const { visible, ghosts } = useMemo(() => {
    if (!openTopic) return { visible: concepts, ghosts: NO_GHOSTS };
    const inside = concepts.filter((c) => groupOf(c) === openTopic);
    const insideIds = new Set(inside.map((c) => c.id));
    const ghosts = new Map<string, { topicId: string; topicName: string }>();
    for (const c of inside) {
      for (const p of c.prerequisite_ids) {
        const pre = concepts.find((o) => o.id === p);
        if (pre && !insideIds.has(p)) {
          const g = groups.find((t) => t.id === groupOf(pre));
          ghosts.set(p, { topicId: g?.id ?? NO_TOPIC, topicName: g?.name ?? "" });
        }
      }
    }
    return { visible: [...inside, ...concepts.filter((c) => ghosts.has(c.id))], ghosts };
  }, [openTopic, concepts, groups, groupOf]);

  if (!topics || topics.length === 0) {
    return <ConceptLevel visible={concepts} universe={concepts} ghosts={NO_GHOSTS} {...details} />;
  }

  const current = groups.find((t) => t.id === openTopic);

  return (
    // key: al cambiar de nivel o de tema, el contenido entra con un fundido corto
    <div key={openTopic ?? "temas"} className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300">
      <nav aria-label="Nivel del mapa" className="mb-3">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <li>
            {current ? (
              <button type="button" onClick={() => setOpenTopic(null)} className="rounded-sm hover:text-foreground hover:underline">
                Temas
              </button>
            ) : (
              <span aria-current="page" className="font-medium text-foreground">Temas</span>
            )}
          </li>
          {current && (
            <li className="flex items-center gap-1">
              <ChevronRight aria-hidden="true" className="size-3.5" />
              <span aria-current="page" className="font-medium text-foreground">{current.name}</span>
            </li>
          )}
        </ol>
      </nav>
      {current ? (
        <ConceptLevel visible={visible} universe={concepts} ghosts={ghosts} onGoToTopic={setOpenTopic} {...details} />
      ) : (
        <TopicMap groups={groups} needs={needs} states={details.states} onOpen={setOpenTopic} />
      )}
    </div>
  );
}
