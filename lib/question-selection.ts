// Selección de preguntas del diagnóstico y la microevaluación. Sin IA: solo el desempate es al azar.
// Criterio provisional (a validar con Adri para el piloto):
//  - Diagnóstico: por concepto, 1 si solo hay 1 validada; si no, la mitad con un máximo de 2.
//    El resto queda reservado para la microevaluación.
//  - Microevaluación: hasta 2 preguntas del concepto que no salieron en este intento.
//    Si no queda ninguna, ese concepto no se evalúa (la brecha queda pendiente).
//  - Preferencia: nunca respondidas por el estudiante, luego las respondidas hace más tiempo.

export const MAX_DIAGNOSTIC_PER_CONCEPT = 2;
export const MAX_MICRO_PER_CONCEPT = 2;

export type BankQuestion = {
  id: string;
  conceptId: string;
  lastAnsweredAt: string | null; // null = el estudiante nunca la respondió
};

export function diagnosticCount(available: number): number {
  if (available <= 1) return available;
  return Math.min(MAX_DIAGNOSTIC_PER_CONCEPT, Math.floor(available / 2));
}

function shuffle<T>(list: T[]): T[] {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Barajar primero y ordenar después deja el azar solo para los empates.
// "" (nunca respondida) queda antes que cualquier fecha.
function byPreference<T extends BankQuestion>(list: T[]): T[] {
  return shuffle(list).sort((a, b) => (a.lastAnsweredAt ?? "").localeCompare(b.lastAnsweredAt ?? ""));
}

function groupByConcept<T extends BankQuestion>(list: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const q of list) {
    const group = groups.get(q.conceptId) ?? [];
    group.push(q);
    groups.set(q.conceptId, group);
  }
  return groups;
}

export function selectDiagnosticQuestions<T extends BankQuestion>(bank: T[]): T[] {
  const selected: T[] = [];
  for (const group of groupByConcept(bank).values()) {
    selected.push(...byPreference(group).slice(0, diagnosticCount(group.length)));
  }
  return shuffle(selected); // mezcla los conceptos para que no salgan en bloque
}

export function selectMicroQuestions<T extends BankQuestion>(
  bank: T[],
  gapConceptIds: string[],
  seenInAttempt: Set<string>
): { questions: T[]; conceptsWithoutQuestions: string[] } {
  const groups = groupByConcept(bank.filter((q) => !seenInAttempt.has(q.id)));
  const questions: T[] = [];
  const conceptsWithoutQuestions: string[] = [];
  for (const conceptId of gapConceptIds) {
    const group = groups.get(conceptId) ?? [];
    if (group.length === 0) {
      conceptsWithoutQuestions.push(conceptId);
      continue;
    }
    questions.push(...byPreference(group).slice(0, MAX_MICRO_PER_CONCEPT));
  }
  return { questions, conceptsWithoutQuestions };
}
