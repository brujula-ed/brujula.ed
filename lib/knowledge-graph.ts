import type { ConceptState } from "@/lib/concept-state";

export type GraphConcept = {
  id: string;
  name: string;
  prerequisite_ids: string[];
};

export type PriorityGap = { concept: GraphConcept; blocked: GraphConcept[] };

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

// Orden de aprendizaje de una lista de conceptos (p. ej. los de un tema): cada concepto va después de sus
// prerrequisitos que estén en la lista; entre los que pueden ir, primero el que aparece antes en el material
// (materialPosition; sin posición, al final). Si la IA generó un ciclo, esos conceptos van al final en orden del
// material, sin perderse. Determinista.
export function learningOrder<T extends { id: string; prerequisite_ids: string[] }>(
  concepts: T[],
  materialPosition: Map<string, number>
): T[] {
  const ids = new Set(concepts.map((c) => c.id));
  const at = (c: T) => materialPosition.get(c.id) ?? Infinity;
  const pending = new Map(concepts.map((c) => [c.id, new Set(c.prerequisite_ids.filter((p) => ids.has(p) && p !== c.id))]));
  const result: T[] = [];
  const done = new Set<string>();

  while (result.length < concepts.length) {
    const ready = concepts
      .filter((c) => !done.has(c.id) && [...pending.get(c.id)!].every((p) => done.has(p)))
      .sort((a, b) => at(a) - at(b));
    // Ciclo: ninguno está listo; se toma el que aparece antes en el material para destrabar
    const next = ready[0] ?? concepts.filter((c) => !done.has(c.id)).sort((a, b) => at(a) - at(b))[0];
    result.push(next);
    done.add(next.id);
  }
  return result;
}

// Relaciones entre temas (docs/MOTOR-DE-CONOCIMIENTO.md 4.3, decisión 3): el tema B necesita al tema A si algún
// concepto de B tiene como prerrequisito un concepto de A. Se calculan, no se guardan, así que siempre coinciden con
// los prerrequisitos validados. Devuelve las relaciones directas (sin las redundantes, misma regla que el mapa) y los
// pares de temas que se necesitan mutuamente, que conviene que el docente revise.
export function computeTopicDependencies(
  topics: { id: string; name: string }[],
  concepts: { id: string; topic_id?: string | null; prerequisite_ids: string[] }[]
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
