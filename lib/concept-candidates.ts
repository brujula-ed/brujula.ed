// Piezas sin IA de la extracción de conceptos sobre todo el material (docs/MOTOR-DE-CONOCIMIENTO.md 4.2):
// armar tramos de lectura y unir candidatos repetidos. Deterministas, para poder probarlas solas.

export type ChunkText = { documentId: string; position: number; content: string };

// Tramos de lectura en el orden del material: fragmentos seguidos hasta ~maxChars. Un documento nuevo empieza
// siempre un tramo nuevo (no se mezclan documentos en una lectura).
export function buildSections(chunks: ChunkText[], maxChars = 12000): string[] {
  const sections: string[] = [];
  let current: string[] = [];
  let length = 0;
  let doc: string | null = null;

  for (const c of chunks) {
    if (current.length > 0 && (c.documentId !== doc || length + c.content.length > maxChars)) {
      sections.push(current.join("\n\n"));
      current = [];
      length = 0;
    }
    doc = c.documentId;
    current.push(c.content);
    length += c.content.length + 2;
  }
  if (current.length > 0) sections.push(current.join("\n\n"));
  return sections;
}

export type Candidate = { name: string; description: string };
export type CandidateGroup = Candidate & { mentions: number }; // en cuántos tramos apareció

// Clave para comparar nombres: sin mayúsculas, tildes ni espacios de más
export function nameKey(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

// Une candidatos repetidos: mismo nombre (nameKey) o significado casi igual (coseno ≥ threshold entre embeddings de
// "nombre: descripción"). Se conserva el primero que aparece en el material y se cuenta en cuántos tramos salió.
// Los embeddings de OpenAI vienen normalizados: el producto punto es el coseno.
export function groupCandidates(
  candidates: Candidate[],
  embeddings: number[][],
  threshold = 0.9
): CandidateGroup[] {
  const groups: (CandidateGroup & { key: string; vector: number[] })[] = [];

  candidates.forEach((c, i) => {
    const key = nameKey(c.name);
    const vector = embeddings[i];
    const same = groups.find((g) => g.key === key || dot(g.vector, vector) >= threshold);
    if (same) {
      same.mentions += 1;
      if (!same.description && c.description) same.description = c.description;
    } else {
      groups.push({ ...c, mentions: 1, key, vector });
    }
  });

  return groups.map(({ name, description, mentions }) => ({ name, description, mentions }));
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
