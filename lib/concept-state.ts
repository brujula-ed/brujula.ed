// Estado de cada concepto para un estudiante (docs/DISENO-DEL-ESTUDIANTE.md 3.1). Determinista y sin IA: se calcula al
// vuelo con sus respuestas y se explica con ellas (cuántas, cuántas correctas y cuándo fue la última). Parámetros
// provisionales, a calibrar con el piloto.

export type ConceptState = "sin_evidencia" | "brecha" | "en_desarrollo" | "dominado";

export const MASTERY_THRESHOLD = 0.7;
export const HALF_LIFE_DAYS = 30; // una respuesta pierde la mitad de su peso cada 30 días
export const MIN_EVIDENCE = 3; // respuestas necesarias para afirmar un estado sin "poca evidencia"

export const STATE_LABEL: Record<ConceptState, string> = {
  sin_evidencia: "Sin evidencia",
  brecha: "Brecha",
  en_desarrollo: "En desarrollo",
  dominado: "Dominado",
};

// Etapas que miden. La práctica (que muestra la explicación y repite preguntas ya vistas) no cuenta como evidencia.
// Orden dentro de un mismo intento: el diagnóstico va antes que las comprobaciones.
const MEASURED_STAGES: Record<string, number> = {
  diagnostico: 0,
  microevaluacion: 1, // la comprobación del flujo actual
  comprobacion: 1,
  comprobacion_diferida: 2,
};

type Attempt = { id: string; created_at: string };
type Answer = { attempt_id: string; stage: string; concept_id: string | null; is_correct: boolean };

export type ConceptEvidence = {
  state: ConceptState;
  estimate: number | null; // aciertos con su peso ÷ respuestas con su peso (null sin respuestas)
  answers: number; // respuestas que cuentan para el estado (desde la última comprobación que sacó de una brecha)
  correct: number;
  lastAt: string | null; // fecha del intento de la respuesta más reciente
  lowEvidence: boolean; // menos de MIN_EVIDENCE respuestas: el estado se muestra con "poca evidencia"
  hadGap: boolean; // estuvo en brecha en algún momento
  awaitingDeferred: boolean; // fue brecha, hoy está sobre el umbral y falta la comprobación diferida
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Detalle por concepto. attempts y answers deben ser de UN estudiante. now se puede fijar para probar.
export function computeConceptEvidence(
  concepts: { id: string }[],
  attempts: Attempt[],
  answers: Answer[],
  now: Date = new Date()
): Record<string, ConceptEvidence> {
  const createdAt = new Map(attempts.map((a) => [a.id, a.created_at]));
  const result: Record<string, ConceptEvidence> = {};

  for (const c of concepts) {
    // Por id: renombrar un concepto no debe desconectar su historial
    const mine = answers.filter(
      (a) => a.concept_id === c.id && a.stage in MEASURED_STAGES && createdAt.has(a.attempt_id)
    );

    // Las respuestas se agrupan por intento y etapa, en orden cronológico, para seguir cómo cambió el estado
    const groups = new Map<string, { at: string; rank: number; stage: string; list: Answer[] }>();
    for (const a of mine) {
      const key = `${a.attempt_id}:${a.stage}`;
      const group = groups.get(key) ?? { at: createdAt.get(a.attempt_id)!, rank: MEASURED_STAGES[a.stage], stage: a.stage, list: [] };
      group.list.push(a);
      groups.set(key, group);
    }
    const ordered = [...groups.values()].sort((x, y) => x.at.localeCompare(y.at) || x.rank - y.rank);

    // Estimación en un momento: las respuestas desde `from` hasta ese momento, cada una con el peso que tenía entonces
    const estimateAt = (from: number, upTo: number, at: Date): number => {
      let weighted = 0;
      let weightedCorrect = 0;
      for (const g of ordered.slice(from, upTo + 1)) {
        const days = Math.max(0, at.getTime() - new Date(g.at).getTime()) / DAY_MS;
        const weight = Math.pow(0.5, days / HALF_LIFE_DAYS);
        weighted += weight * g.list.length;
        weightedCorrect += weight * g.list.filter((a) => a.is_correct).length;
      }
      return weightedCorrect / weighted;
    };

    // Si está en brecha y supera una comprobación, el estado se calcula desde esa comprobación: lo que respondió antes
    // del repaso ya no describe lo que sabe. Sin esto, 2 fallos y una comprobación de 2 de 2 seguirían en brecha.
    let from = 0;
    let inGap = false;
    let hadGap = false;
    let deferredAfterGap = false; // comprobación diferida superada después de la última vez en brecha
    ordered.forEach((g, i) => {
      const groupAccuracy = g.list.filter((a) => a.is_correct).length / g.list.length;
      if (inGap && g.stage !== "diagnostico" && groupAccuracy >= MASTERY_THRESHOLD) {
        from = i;
        inGap = false;
      }
      if (estimateAt(from, i, new Date(g.at)) < MASTERY_THRESHOLD) {
        inGap = true;
        hadGap = true;
        deferredAfterGap = false;
      } else if (g.stage === "comprobacion_diferida" && groupAccuracy >= MASTERY_THRESHOLD) {
        deferredAfterGap = true;
      }
    });

    const counted = ordered.slice(from).flatMap((g) => g.list);
    const estimate = counted.length > 0 ? estimateAt(from, ordered.length - 1, now) : null;
    const count = counted.length;
    const lowEvidence = count < MIN_EVIDENCE;
    const confirmed = !hadGap || deferredAfterGap;

    let state: ConceptState;
    if (estimate === null) state = "sin_evidencia";
    else if (estimate < MASTERY_THRESHOLD) state = "brecha";
    else if (!lowEvidence && confirmed) state = "dominado";
    else state = "en_desarrollo";

    result[c.id] = {
      state,
      estimate,
      answers: count,
      correct: counted.filter((a) => a.is_correct).length,
      lastAt: ordered.length > 0 ? ordered[ordered.length - 1].at : null,
      lowEvidence: count > 0 && lowEvidence,
      hadGap,
      awaitingDeferred: estimate !== null && estimate >= MASTERY_THRESHOLD && hadGap && !deferredAfterGap,
    };
  }

  return result;
}

// Solo el estado de cada concepto (lo que usan el mapa, los reportes y el siguiente paso)
export function computeConceptStates(
  concepts: { id: string }[],
  attempts: Attempt[],
  answers: Answer[],
  now: Date = new Date()
): Record<string, ConceptState> {
  const evidence = computeConceptEvidence(concepts, attempts, answers, now);
  return Object.fromEntries(Object.entries(evidence).map(([id, e]) => [id, e.state]));
}
