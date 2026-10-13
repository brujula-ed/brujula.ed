export type ConceptState = "sin_evidencia" | "brecha" | "en_desarrollo" | "dominado";

export const MASTERY_THRESHOLD = 0.7;

export const STATE_LABEL: Record<ConceptState, string> = {
  sin_evidencia: "Sin evidencia",
  brecha: "Brecha",
  en_desarrollo: "En desarrollo",
  dominado: "Dominado",
};

type Attempt = { id: string; created_at: string };
type Answer = { attempt_id: string; stage: string; concept: string; is_correct: boolean };

function accuracy(list: Answer[]): number | null {
  if (list.length === 0) return null;
  return list.filter((a) => a.is_correct).length / list.length;
}

export function computeConceptStates(
  concepts: { id: string; name: string }[],
  attempts: Attempt[],
  answers: Answer[]
): Record<string, ConceptState> {
  const createdAt = new Map(attempts.map((a) => [a.id, a.created_at]));
  const result: Record<string, ConceptState> = {};

  for (const c of concepts) {
    const mine = answers.filter((a) => a.concept === c.name);
    if (mine.length === 0) {
      result[c.id] = "sin_evidencia";
      continue;
    }

    const attemptIds = Array.from(new Set(mine.map((a) => a.attempt_id)));
    attemptIds.sort((x, y) => (createdAt.get(y) ?? "").localeCompare(createdAt.get(x) ?? ""));
    const inLatest = mine.filter((a) => a.attempt_id === attemptIds[0]);

    const diag = accuracy(inLatest.filter((a) => a.stage === "diagnostico"));
    const micro = accuracy(inLatest.filter((a) => a.stage === "microevaluacion"));

    if (micro !== null) {
      if (micro >= MASTERY_THRESHOLD) result[c.id] = "dominado";
      else if (diag !== null && micro > diag) result[c.id] = "en_desarrollo";
      else result[c.id] = "brecha";
    } else if (diag !== null) {
      result[c.id] = diag >= MASTERY_THRESHOLD ? "dominado" : "brecha";
    } else {
      result[c.id] = "sin_evidencia";
    }
  }

  return result;
}