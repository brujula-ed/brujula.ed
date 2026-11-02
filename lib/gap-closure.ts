// Cierre de brechas (F-13). Determinista y sobre las mismas reglas que el LRR (lib/lrr.ts), para que lo que se
// celebra coincida siempre con el LRR y con el reporte del docente.

import type { ConceptState } from "@/lib/concept-state";
import type { GraphConcept } from "@/lib/knowledge-graph";
import { computeStudentGaps, type GapRecord } from "@/lib/lrr";

type Attempt = Parameters<typeof computeStudentGaps>[1][number];
type Answer = Parameters<typeof computeStudentGaps>[2][number];

// Brechas que pasan a "recuperada" gracias al intento attemptId: se calculan las brechas sin ese intento y con él.
// attempts y answers deben ser solo del estudiante e incluir el intento (ya completado). attemptId debe ser el
// intento MÁS RECIENTE: si se quita uno anterior, cambia cuál es el primer diagnóstico (la línea base del LRR).
export function newlyRecovered(
  concepts: { id: string; name: string }[],
  attempts: Attempt[],
  answers: Answer[],
  attemptId: string
): GapRecord[] {
  const before = computeStudentGaps(
    concepts,
    attempts.filter((a) => a.id !== attemptId),
    answers.filter((a) => a.attempt_id !== attemptId)
  );
  const wasRecovered = new Set(before.filter((g) => g.status === "recuperada").map((g) => g.conceptId));

  return computeStudentGaps(concepts, attempts, answers).filter(
    (g) => g.status === "recuperada" && !wasRecovered.has(g.conceptId)
  );
}

// Brechas que el estudiante cerró en sesiones terminadas desde `since` ("Esta semana cerraste N brechas"). Cada sesión
// se evalúa como la más reciente de su momento, que es lo que newlyRecovered exige.
export function recoveredSince(
  concepts: { id: string; name: string }[],
  attempts: (Attempt & { completed_at: string | null })[],
  answers: Answer[],
  since: string
): GapRecord[] {
  const ordered = [...attempts].sort((x, y) => x.created_at.localeCompare(y.created_at));
  return ordered.flatMap((attempt, i) => {
    if (!attempt.completed_at || attempt.completed_at < since) return [];
    const upTo = ordered.slice(0, i + 1);
    const ids = new Set(upTo.map((a) => a.id));
    return newlyRecovered(concepts, upTo, answers.filter((a) => ids.has(a.attempt_id)), attempt.id);
  });
}

// Conceptos que "se abren" al cerrar la brecha de conceptId: dependen de él directamente, aún no están dominados
// y todos sus prerrequisitos directos ya lo están. Si otro prerrequisito sigue pendiente, no se abre.
export function unlockedBy(
  concepts: GraphConcept[],
  states: Record<string, ConceptState>,
  conceptId: string
): GraphConcept[] {
  const ids = new Set(concepts.map((c) => c.id));
  return concepts.filter(
    (c) =>
      c.id !== conceptId &&
      c.prerequisite_ids.includes(conceptId) &&
      states[c.id] !== "dominado" &&
      c.prerequisite_ids.filter((p) => ids.has(p)).every((p) => states[p] === "dominado")
  );
}
