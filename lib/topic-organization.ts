import { nameKey } from "@/lib/concept-candidates";

// Piezas sin IA de "Organizar en temas" (docs/MOTOR-DE-CONOCIMIENTO.md 4.3): interpretar la propuesta de la IA con
// la regla "cada concepto en un solo tema" y ordenar los temas nuevos por dónde aparecen en el material.

// Lo que propone la IA para un tema. tema = etiqueta de un tema existente ("T1") o vacío si es nuevo.
export type ProposedTopic = { tema: string; nombre: string; descripcion: string; conceptos: string[] };

export type ResolvedNewTopic = { name: string; description: string; conceptIds: string[] };
export type Resolution = {
  newTopics: ResolvedNewTopic[];
  toExisting: Map<string, string[]>; // id de tema existente → conceptos que se le asignan
  unassigned: string[]; // conceptos que la IA no ubicó: quedan sin tema
};

const labelIndex = (label: string) => Number(label.replace(/\D/g, "")) - 1;

// conceptIds[i] es el concepto "C{i+1}"; existingTopics[j] es el tema "T{j+1}".
// Reglas: un concepto va al primer tema que lo nombre (las repeticiones se ignoran); las etiquetas inventadas se
// ignoran; un tema "nuevo" con el mismo nombre que uno existente se trata como ese existente; un tema sin conceptos
// no se crea.
export function resolveProposal(
  proposal: ProposedTopic[],
  conceptIds: string[],
  existingTopics: { id: string; name: string }[]
): Resolution {
  const placed = new Set<string>();
  const toExisting = new Map<string, string[]>();
  const newTopics: ResolvedNewTopic[] = [];
  const existingByName = new Map(existingTopics.map((t) => [nameKey(t.name), t.id]));

  for (const p of proposal) {
    const concepts = p.conceptos
      .map((label) => conceptIds[labelIndex(label)])
      .filter((id): id is string => !!id && !placed.has(id));
    const unique = [...new Set(concepts)];
    if (unique.length === 0) continue;
    unique.forEach((id) => placed.add(id));

    const existingId = existingTopics[labelIndex(p.tema)]?.id ?? existingByName.get(nameKey(p.nombre));
    if (existingId) {
      toExisting.set(existingId, [...(toExisting.get(existingId) ?? []), ...unique]);
      continue;
    }
    const same = newTopics.find((t) => nameKey(t.name) === nameKey(p.nombre));
    if (same) same.conceptIds.push(...unique);
    else if (p.nombre.trim()) newTopics.push({ name: p.nombre.trim(), description: p.descripcion.trim(), conceptIds: unique });
    else unique.forEach((id) => placed.delete(id)); // tema sin nombre: sus conceptos quedan sin tema
  }

  return { newTopics, toExisting, unassigned: conceptIds.filter((id) => !placed.has(id)) };
}

// Ordena los temas nuevos por la primera aparición en el material de cualquiera de sus conceptos. Los temas sin
// ninguna ubicación conocida van al final, en el orden que propuso la IA.
export function orderByMaterial<T extends { conceptIds: string[] }>(
  topics: T[],
  conceptPosition: Map<string, number>
): T[] {
  const first = (t: T) => Math.min(...t.conceptIds.map((id) => conceptPosition.get(id) ?? Infinity));
  return topics
    .map((t, i) => ({ t, i, at: first(t) }))
    .sort((a, b) => a.at - b.at || a.i - b.i)
    .map((x) => x.t);
}
