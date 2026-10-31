import type { ConceptState } from "@/lib/concept-state";

export type GraphConcept = {
  id: string;
  name: string;
  prerequisite_ids: string[];
};

export type PriorityGap = { concept: GraphConcept; blocked: GraphConcept[] };

export type NextChallenge =
  | { kind: "ubicarse" }
  | { kind: "nivelar"; concept: GraphConcept; blockedCount: number }
  | { kind: "consolidar"; concept: GraphConcept }
  | { kind: "diagnosticar"; concept: GraphConcept }
  | { kind: "completo" };

// Para cada concepto, el conjunto de conceptos que dependen de él, directa o indirectamente.
// También servirá para el tamaño de los nodos en el rediseño del mapa.
export function computeDependents(concepts: GraphConcept[]): Map<string, Set<string>> {
  const ids = new Set(concepts.map((c) => c.id));
  const direct = new Map<string, string[]>();
  concepts.forEach((c) => direct.set(c.id, []));
  concepts.forEach((c) => {
    c.prerequisite_ids.filter((p) => ids.has(p)).forEach((p) => direct.get(p)?.push(c.id));
  });

  const result = new Map<string, Set<string>>();
  for (const c of concepts) {
    const seen = new Set<string>();
    const stack = [...(direct.get(c.id) ?? [])];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (id === c.id || seen.has(id)) continue; // evita ciclos generados por la IA
      seen.add(id);
      stack.push(...(direct.get(id) ?? []));
    }
    result.set(c.id, seen);
  }
  return result;
}

// Para cada concepto, el conjunto de sus prerrequisitos, directos o indirectos.
export function computePrerequisites(concepts: GraphConcept[]): Map<string, Set<string>> {
  const ids = new Set(concepts.map((c) => c.id));
  const direct = new Map<string, string[]>();
  concepts.forEach((c) => direct.set(c.id, c.prerequisite_ids.filter((p) => ids.has(p))));

  const result = new Map<string, Set<string>>();
  for (const c of concepts) {
    const seen = new Set<string>();
    const stack = [...(direct.get(c.id) ?? [])];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (id === c.id || seen.has(id)) continue; // evita ciclos generados por la IA
      seen.add(id);
      stack.push(...(direct.get(id) ?? []));
    }
    result.set(c.id, seen);
  }
  return result;
}

// Relaciones entre temas (docs/MOTOR-DE-CONOCIMIENTO.md 4.3, decisión 3): el tema B necesita al tema A si algún
// concepto de B tiene como prerrequisito un concepto de A. Se calculan, no se guardan, así que siempre coinciden con
// los prerrequisitos validados. Devuelve las relaciones directas (sin las redundantes, misma regla que el mapa) y los
// pares de temas que se necesitan mutuamente, que conviene que el docente revise.
export function computeTopicDependencies(
  topics: { id: string; name: string }[],
  concepts: { id: string; topic_id: string | null; prerequisite_ids: string[] }[]
): { needs: Map<string, string[]>; mutual: [string, string][] } {
  const topicOf = new Map(concepts.map((c) => [c.id, c.topic_id]));
  const raw = new Map<string, Set<string>>(topics.map((t) => [t.id, new Set<string>()]));
  for (const c of concepts) {
    if (!c.topic_id || !raw.has(c.topic_id)) continue;
    for (const p of c.prerequisite_ids) {
      const other = topicOf.get(p);
      if (other && other !== c.topic_id && raw.has(other)) raw.get(c.topic_id)!.add(other);
    }
  }

  const asGraph = topics.map((t) => ({ id: t.id, name: t.name, prerequisite_ids: [...raw.get(t.id)!] }));
  const needs = new Map<string, string[]>(topics.map((t) => [t.id, []]));
  for (const e of computeMapEdges(asGraph)) needs.get(e.target)!.push(e.source);

  const mutual: [string, string][] = [];
  for (const t of topics) {
    for (const o of raw.get(t.id)!) {
      if (t.id < o && raw.get(o)!.has(t.id)) mutual.push([t.id, o]);
    }
  }
  return { needs, mutual };
}

// Flechas que dibuja el mapa, sin las redundantes: si A ya llega a C pasando por B, no se dibuja A→C.
// El mapa no cambia los prerrequisitos guardados; generate-concepts usa esta misma regla para guardar solo los
// directos en los conceptos nuevos.
export function computeMapEdges(concepts: GraphConcept[]): { source: string; target: string }[] {
  const ids = new Set(concepts.map((c) => c.id));
  const prerequisites = computePrerequisites(concepts);
  const edges: { source: string; target: string }[] = [];
  for (const c of concepts) {
    const direct = [...new Set(c.prerequisite_ids)].filter((p) => ids.has(p) && p !== c.id);
    for (const p of direct) {
      // Si p y q son prerrequisito uno del otro (ciclo de la IA), no se oculta ninguna de las dos flechas.
      const redundant = direct.some(
        (q) => q !== p && prerequisites.get(q)?.has(p) && !prerequisites.get(p)?.has(q)
      );
      if (!redundant) edges.push({ source: p, target: c.id });
    }
  }
  return edges;
}

export function computePriorityGap(
  concepts: GraphConcept[],
  states: Record<string, ConceptState>
): PriorityGap | null {
  const dependents = computeDependents(concepts);
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const prereqCount = (id: string) =>
    concepts.filter((o) => dependents.get(o.id)?.has(id)).length;

  const candidates = concepts
    .filter((c) => states[c.id] === "brecha")
    .map((c) => ({
      concept: c,
      blocked: Array.from(dependents.get(c.id) ?? [])
        .map((id) => byId.get(id)!)
        .filter((d) => states[d.id] !== "dominado"),
      prereqs: prereqCount(c.id),
    }));

  if (candidates.length === 0) return null;

  candidates.sort(
    (a, b) =>
      b.blocked.length - a.blocked.length ||
      a.prereqs - b.prereqs ||
      a.concept.name.localeCompare(b.concept.name)
  );
  return { concept: candidates[0].concept, blocked: candidates[0].blocked };
}

export function computeNextChallenge(
  concepts: GraphConcept[],
  states: Record<string, ConceptState>
): NextChallenge {
  if (concepts.length === 0) return { kind: "completo" };

  const stateOf = (id: string): ConceptState => states[id] ?? "sin_evidencia";

  if (concepts.every((c) => stateOf(c.id) === "sin_evidencia")) return { kind: "ubicarse" };

  const gap = computePriorityGap(concepts, states);
  if (gap) return { kind: "nivelar", concept: gap.concept, blockedCount: gap.blocked.length };

  const dependents = computeDependents(concepts);
  const size = (c: GraphConcept) => dependents.get(c.id)?.size ?? 0;
  const bySize = (a: GraphConcept, b: GraphConcept) =>
    size(b) - size(a) || a.name.localeCompare(b.name);

  const developing = concepts.filter((c) => stateOf(c.id) === "en_desarrollo").sort(bySize);
  if (developing.length > 0) return { kind: "consolidar", concept: developing[0] };

  const ids = new Set(concepts.map((c) => c.id));
  const untested = concepts.filter((c) => stateOf(c.id) === "sin_evidencia");
  const ready = untested.filter((c) =>
    c.prerequisite_ids.every((p) => !ids.has(p) || stateOf(p) === "dominado")
  );
  const pool = (ready.length > 0 ? ready : untested).sort(bySize);
  if (pool.length > 0) return { kind: "diagnosticar", concept: pool[0] };

  return { kind: "completo" };
}