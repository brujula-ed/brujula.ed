// LRR (Anexo I, sec. 12): proporción de brechas identificadas que presentan
// una mejora posterior a la intervención de nivelación.
//
// Criterios operativos (a validar con Adri para el piloto):
//  - Brecha identificada: concepto bajo el umbral en el PRIMER diagnóstico.
//  - Recuperada: la microevaluación posterior llega al umbral.
//  - En proceso: mejoró respecto a la línea base pero sigue bajo el umbral.
//  - Sin mejora: la microevaluación no supera la línea base.
//  - Pendiente: aún no hay microevaluación.
//  - LRR = recuperadas / identificadas (las pendientes SÍ cuentan en el denominador).

export const LRR_THRESHOLD = 0.7;

type Attempt = { id: string; created_at: string };
type Answer = { attempt_id: string; stage: string; concept: string; is_correct: boolean };

export type GapStatus = "pendiente" | "sin_mejora" | "en_proceso" | "recuperada";

export type GapRecord = {
  concept: string;
  baseline: number;
  post: number | null;
  status: GapStatus;
};

export type LRRResult = {
  gaps: GapRecord[];
  identified: number;
  recovered: number;
  inProgress: number;
  noImprovement: number;
  pending: number;
  lrr: number | null; // recovered / identified
  avgGainPoints: number | null; // sobre las brechas con microevaluación
};

export type ClassLRRResult = LRRResult & {
  studentsWithGaps: number;
  studentsWithRecovery: number;
  byConcept: Record<string, LRRResult>;
};

function accuracy(list: Answer[]): number | null {
  if (list.length === 0) return null;
  return list.filter((a) => a.is_correct).length / list.length;
}

function orderAttempts(attempts: Attempt[]): string[] {
  return [...attempts]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((a) => a.id);
}

// Brechas de UN estudiante: attempts y answers deben ser solo suyos.
export function computeStudentGaps(
  conceptNames: string[],
  attempts: Attempt[],
  answers: Answer[]
): GapRecord[] {
  const order = orderAttempts(attempts); // antiguo -> reciente
  const gaps: GapRecord[] = [];

  for (const name of conceptNames) {
    const mine = answers.filter((a) => a.concept === name);

    let baseline: number | null = null;
    for (const id of order) {
      const diag = mine.filter((a) => a.attempt_id === id && a.stage === "diagnostico");
      if (diag.length > 0) {
        baseline = accuracy(diag);
        break;
      }
    }
    if (baseline === null || baseline >= LRR_THRESHOLD) continue;

    let post: number | null = null;
    for (const id of [...order].reverse()) {
      const micro = mine.filter((a) => a.attempt_id === id && a.stage === "microevaluacion");
      if (micro.length > 0) {
        post = accuracy(micro);
        break;
      }
    }

    let status: GapStatus = "pendiente";
    if (post !== null) {
      if (post >= LRR_THRESHOLD) status = "recuperada";
      else if (post > baseline) status = "en_proceso";
      else status = "sin_mejora";
    }
    gaps.push({ concept: name, baseline, post, status });
  }
  return gaps;
}

export function summarizeGaps(gaps: GapRecord[]): LRRResult {
  const count = (s: GapStatus) => gaps.filter((g) => g.status === s).length;
  const measured = gaps.filter((g) => g.post !== null);
  const gain =
    measured.length > 0
      ? (measured.reduce((s, g) => s + ((g.post as number) - g.baseline), 0) / measured.length) * 100
      : null;
  return {
    gaps,
    identified: gaps.length,
    recovered: count("recuperada"),
    inProgress: count("en_proceso"),
    noImprovement: count("sin_mejora"),
    pending: count("pendiente"),
    lrr: gaps.length > 0 ? count("recuperada") / gaps.length : null,
    avgGainPoints: gain,
  };
}

export function computeLRR(
  conceptNames: string[],
  attempts: Attempt[],
  answers: Answer[]
): LRRResult {
  return summarizeGaps(computeStudentGaps(conceptNames, attempts, answers));
}

// Clase: junta las brechas de todos los estudiantes (la unidad es la brecha).
export function computeClassLRR(
  conceptNames: string[],
  students: { attempts: Attempt[]; answers: Answer[] }[]
): ClassLRRResult {
  const all: GapRecord[] = [];
  let studentsWithGaps = 0;
  let studentsWithRecovery = 0;
  for (const s of students) {
    const g = computeStudentGaps(conceptNames, s.attempts, s.answers);
    if (g.length > 0) studentsWithGaps += 1;
    if (g.some((x) => x.status === "recuperada")) studentsWithRecovery += 1;
    all.push(...g);
  }
  const byConcept: Record<string, LRRResult> = {};
  for (const name of conceptNames) {
    byConcept[name] = summarizeGaps(all.filter((g) => g.concept === name));
  }
  return { ...summarizeGaps(all), studentsWithGaps, studentsWithRecovery, byConcept };
}