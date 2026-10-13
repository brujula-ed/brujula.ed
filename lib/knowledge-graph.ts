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