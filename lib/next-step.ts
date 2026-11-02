// Siguiente paso del estudiante en una asignatura (docs/DISENO-DEL-ESTUDIANTE.md 3.4). Determinista y sin IA: sale de
// sus estados, de sus respuestas y del grafo validado. Una sola acción, la primera que aplica en este orden:
//   1. una comprobación final que ya toca;
//   2. un concepto en brecha que practicó y aún no comprueba;
//   3. la brecha prioritaria (la que más conceptos bloquea);
//   4. un concepto "en desarrollo" con poca evidencia, para confirmarlo (decisión de Sergio, 02/11/2026);
//   5. el siguiente tema con conceptos sin evidencia, en orden de aprendizaje (sin temas: el siguiente concepto);
//   6. todo al día: esperar la comprobación final o repasar lo que lleva más tiempo sin comprobar.

import type { ConceptEvidence } from "@/lib/concept-state";
import { computeDependents, computePriorityGap, computeTopicDependencies, learningOrder } from "@/lib/knowledge-graph";

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFERRED_DAYS = 2; // submit_answer exige lo mismo en la base

type Concept = { id: string; name: string; prerequisite_ids: string[]; topic_id?: string | null };
type Topic = { id: string; name: string };
type Answer = { concept_id: string | null; stage: string; created_at: string | null };

export type NextStep =
  | { kind: "final"; concept: Concept }
  | { kind: "comprobar"; concept: Concept }
  | { kind: "brecha"; concept: Concept; blocked: number }
  | { kind: "confirmar"; concept: Concept }
  | { kind: "tema"; topic: Topic }
  | { kind: "nuevo"; concept: Concept }
  | { kind: "esperar"; concept: Concept; from: Date }
  | { kind: "repasar"; concept: Concept }
  | { kind: "sin_preguntas" };

// Desde cuándo se acepta la comprobación final de un concepto: 2 días después de su comprobación más reciente, medidos
// desde la hora de la respuesta, igual que submit_answer. null si no hay comprobación. answers: las del concepto.
export function deferredAvailableFrom(answers: Answer[]): Date | null {
  const lastCheck = answers
    .filter((a) => a.stage === "comprobacion" || a.stage === "microevaluacion")
    .map((a) => a.created_at ?? "")
    .sort()
    .pop();
  return lastCheck ? new Date(new Date(lastCheck).getTime() + DEFERRED_DAYS * DAY_MS) : null;
}

// concepts y topics: los validados (topics en el orden del docente). withQuestions: conceptos con preguntas validadas.
// answers: todas las del estudiante en la asignatura, incluida la práctica. now se puede fijar para probar.
export function computeNextStep(
  concepts: Concept[],
  topics: Topic[],
  evidence: Record<string, ConceptEvidence>,
  answers: Answer[],
  withQuestions: Set<string>,
  now: Date = new Date()
): NextStep {
  const ev = (c: Concept) => evidence[c.id];
  const answersOf = (c: Concept) => answers.filter((a) => a.concept_id === c.id);
  const testable = concepts.filter((c) => withQuestions.has(c.id));
  if (testable.length === 0) return { kind: "sin_preguntas" };

  // 1. Comprobación final que ya toca: la que se habilitó primero
  const waiting = testable
    .filter((c) => ev(c).awaitingDeferred)
    .map((c) => ({ concept: c, from: deferredAvailableFrom(answersOf(c)) }))
    .filter((w): w is { concept: Concept; from: Date } => w.from !== null)
    .sort((a, b) => a.from.getTime() - b.from.getTime());
  const due = waiting.find((w) => w.from.getTime() <= now.getTime());
  if (due) return { kind: "final", concept: due.concept };

  // 2. Practicó un concepto en brecha después de su última medición: le falta comprobarlo. El más reciente primero.
  const measured = (a: Answer) => a.stage !== "practica";
  const practiced = testable
    .filter((c) => ev(c).state === "brecha")
    .map((c) => {
      const mine = answersOf(c);
      const lastMeasured = mine.filter(measured).map((a) => a.created_at ?? "").sort().pop() ?? "";
      const lastPractice = mine.filter((a) => !measured(a)).map((a) => a.created_at ?? "").sort().pop() ?? "";
      return { concept: c, lastPractice: lastPractice > lastMeasured ? lastPractice : null };
    })
    .filter((p) => p.lastPractice !== null)
    .sort((a, b) => b.lastPractice!.localeCompare(a.lastPractice!));
  if (practiced.length > 0) return { kind: "comprobar", concept: practiced[0].concept };

  // 3. La brecha que más conceptos bloquea. Se repasa aunque no tenga preguntas (ficha, recurso, explicarla).
  const states = Object.fromEntries(concepts.map((c) => [c.id, ev(c).state]));
  const gap = computePriorityGap(concepts, states);
  if (gap) {
    const concept = concepts.find((c) => c.id === gap.concept.id)!;
    return { kind: "brecha", concept, blocked: gap.blocked.length };
  }

  // 4. En desarrollo con poca evidencia (no los que esperan la final): primero el que más conceptos abre
  const dependents = computeDependents(concepts);
  const bySize = (a: Concept, b: Concept) =>
    (dependents.get(b.id)?.size ?? 0) - (dependents.get(a.id)?.size ?? 0) || a.name.localeCompare(b.name);
  const unconfirmed = testable
    .filter((c) => ev(c).state === "en_desarrollo" && ev(c).lowEvidence && !ev(c).awaitingDeferred)
    .sort(bySize);
  if (unconfirmed.length > 0) return { kind: "confirmar", concept: unconfirmed[0] };

  // 5. Lo que aún no se midió: el primer tema, en orden de aprendizaje, con conceptos sin evidencia que tengan preguntas
  const untested = (c: Concept) => withQuestions.has(c.id) && ev(c).state === "sin_evidencia";
  const { needs } = computeTopicDependencies(topics, concepts);
  const topicPosition = new Map(topics.map((t, i) => [t.id, i]));
  const orderedTopics = learningOrder(
    topics.map((t) => ({ ...t, prerequisite_ids: needs.get(t.id) ?? [] })),
    topicPosition
  );
  const topic = orderedTopics.find((t) => concepts.some((c) => c.topic_id === t.id && untested(c)));
  if (topic) return { kind: "tema", topic: { id: topic.id, name: topic.name } };

  // Conceptos sin un tema visible: de a uno, primero los que ya tienen sus prerrequisitos dominados
  const topicIds = new Set(topics.map((t) => t.id));
  const loose = concepts.filter((c) => !(c.topic_id && topicIds.has(c.topic_id)) && untested(c));
  const ids = new Set(concepts.map((c) => c.id));
  const ready = loose.filter((c) => c.prerequisite_ids.every((p) => !ids.has(p) || states[p] === "dominado"));
  const next = learningOrder(ready.length > 0 ? ready : loose, new Map())[0];
  if (next) return { kind: "nuevo", concept: next };

  // 6. Todo al día: la comprobación final que se habilita antes, o repasar lo que lleva más tiempo sin medir
  if (waiting.length > 0) return { kind: "esperar", concept: waiting[0].concept, from: waiting[0].from };
  const oldest = testable
    .filter((c) => ev(c).lastAt !== null)
    .sort((a, b) => ev(a).lastAt!.localeCompare(ev(b).lastAt!))[0];
  return oldest ? { kind: "repasar", concept: oldest } : { kind: "sin_preguntas" };
}
