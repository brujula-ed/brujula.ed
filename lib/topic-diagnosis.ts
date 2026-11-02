// Diagnóstico de un tema que busca la causa (docs/DISENO-DEL-ESTUDIANTE.md 3.2). Sin IA y determinista: con las
// respuestas dadas hasta ahora decide la siguiente pregunta, y al final qué conceptos fallaron y cuál es la brecha raíz.
// Se recalcula desde cero en cada paso, así que el resultado se puede rastrear hasta las respuestas.
//
//  1. Empieza por los conceptos "de arriba" del tema (ningún otro del tema los necesita), en orden de aprendizaje.
//  2. Un acierto basta: no se gastan preguntas en sus prerrequisitos.
//  3. Un fallo pide una segunda pregunta del mismo concepto. Si queda bajo el umbral (1 de 2 o 0 de 2), falla y se
//     bajan a sus prerrequisitos directos; los de otros temas se preguntan, pero desde ellos no se sigue bajando.
//  4. Un concepto sin preguntas no se puede medir: se pasa a sus prerrequisitos (solo dentro del tema).
//  5. Si la búsqueda termina antes de MIN_TOPIC_QUESTIONS, sigue con los conceptos del tema que no se preguntaron.
//  6. Termina a las MAX_TOPIC_QUESTIONS preguntas o cuando no queda nada por explorar.

import { MASTERY_THRESHOLD } from "@/lib/concept-state";

export const MAX_TOPIC_QUESTIONS = 10;
export const MIN_TOPIC_QUESTIONS = 5; // Anexo I: de 5 a 10 preguntas (con temas chicos pueden ser menos)

type Concept = { id: string; prerequisite_ids: string[] };
export type TopicAnswer = { conceptId: string; questionId: string; correct: boolean };

export type TopicPlan = {
  next: { conceptId: string; questionId: string } | null; // null = terminó
  passed: string[];
  failed: string[];
  roots: string[]; // fallaron y ninguno de sus prerrequisitos falló
};

export function planTopicDiagnosis(
  topicConcepts: Concept[], // los del tema, en orden de aprendizaje
  allConcepts: Concept[], // todos los de la asignatura (para los prerrequisitos de otros temas)
  questionsByConcept: Map<string, string[]>, // ids de preguntas, ya en orden de preferencia
  answers: TopicAnswer[]
): TopicPlan {
  const inTopic = new Set(topicConcepts.map((c) => c.id));
  const byId = new Map(allConcepts.map((c) => [c.id, c]));
  const used = new Set(answers.map((a) => a.questionId));
  const passed: string[] = [];
  const failed: string[] = [];

  const needed = new Set(topicConcepts.flatMap((c) => c.prerequisite_ids.filter((p) => inTopic.has(p))));
  const queue = topicConcepts.filter((c) => !needed.has(c.id)).map((c) => c.id);
  const visited = new Set(queue);
  const expand = (id: string) => {
    if (!inTopic.has(id)) return; // desde un concepto de otro tema no se sigue bajando
    for (const p of byId.get(id)?.prerequisite_ids ?? []) {
      if (byId.has(p) && !visited.has(p)) {
        visited.add(p);
        queue.push(p);
      }
    }
  };

  // Al llegar al límite ya no se pregunta: lo respondido se clasifica con lo que hay
  const limitReached = answers.length >= MAX_TOPIC_QUESTIONS;
  let next: TopicPlan["next"] = null;
  for (;;) {
    // Terminó la búsqueda de la causa antes del mínimo: sigue con lo que no se preguntó del tema, en orden de aprendizaje
    if (queue.length === 0 && answers.length < MIN_TOPIC_QUESTIONS) {
      const pending = topicConcepts.find((c) => !visited.has(c.id));
      if (!pending) break;
      visited.add(pending.id);
      queue.push(pending.id);
    }
    if (queue.length === 0) break;
    const id = queue[0];
    const mine = answers.filter((a) => a.conceptId === id);
    const available = (questionsByConcept.get(id) ?? []).filter((q) => !used.has(q));
    const correct = mine.filter((a) => a.correct).length;

    // Sin preguntas (ni respondidas ni disponibles): no se puede medir, se pasa a lo previo
    if (mine.length === 0 && available.length === 0) {
      queue.shift();
      expand(id);
      continue;
    }
    // Falta preguntar: la primera, o la segunda después de un fallo
    if (mine.length === 0 || (mine.length === 1 && correct === 0 && available.length > 0)) {
      if (limitReached) {
        if (mine.length === 0) break;
      } else {
        next = { conceptId: id, questionId: available[0] };
        break;
      }
    }

    queue.shift();
    if (correct / mine.length >= MASTERY_THRESHOLD) {
      passed.push(id);
    } else {
      failed.push(id);
      expand(id);
    }
  }

  const failedSet = new Set(failed);
  const roots = failed.filter((id) => !(byId.get(id)?.prerequisite_ids ?? []).some((p) => failedSet.has(p)));
  return { next, passed, failed, roots };
}
