import type { createClient } from "@/lib/supabase/server";
import { computeConceptStates, type ConceptState } from "@/lib/concept-state";
import { computeClassLRR, computeClassLRRLegacy, computeStudentGaps, type ClassLRRResult, type LRRResult } from "@/lib/lrr";

// Progreso de la clase de una asignatura: estados por concepto y estudiante, y LRR grupal. La usan el inicio del docente
// y la pestaña "Estudiantes" (components/subject-steps/students-step.tsx).

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

// Supabase devuelve como máximo "Max rows" filas por consulta (Data API, hoy 1000) sin avisar si corta.
// Las respuestas de toda la clase pueden superarlo, así que se leen por páginas de este tamaño.
const PAGE_SIZE = 1000;

type AnswerRow = { attempt_id: string; stage: string; concept_id: string | null; is_correct: boolean };
export type StateCounts = Record<ConceptState, number>;

// Un estudiante inscrito. Sin diagnóstico completado, states es null y lo demás queda en cero.
export type StudentProgress = {
  id: string;
  states: StateCounts | null; // cuántos conceptos tiene en cada estado
  openGaps: number; // conceptos en brecha hoy
  closedGaps: number; // brechas del primer diagnóstico ya cerradas (mismo criterio que el LRR)
  lastDiagnostic: string | null; // fecha del diagnóstico completado más reciente
};

export type ClassProgress = {
  concepts: { id: string; name: string; prerequisite_ids: string[]; topic_id: string | null }[]; // validados
  students: number; // inscritos
  activeStudents: number; // con al menos un diagnóstico completado
  studentsWithGaps: number; // con al menos un concepto en brecha hoy
  perConcept: Map<string, StateCounts>; // cuántos estudiantes hay en cada estado (los inactivos, sin evidencia)
  perStudent: StudentProgress[]; // todos los inscritos
  lrr: ClassLRRResult;
  lrrLegacy: LRRResult; // definición anterior a la fase 3, solo para comparar durante el piloto
};

export async function loadClassProgress(supabase: SupabaseServer, subjectId: string): Promise<ClassProgress> {
  const [{ data: conceptsData }, { data: enrollments }] = await Promise.all([
    supabase
      .from("concepts")
      .select("id, name, prerequisite_ids, topic_id")
      .eq("subject_id", subjectId)
      .eq("status", "validado"),
    supabase.from("enrollments").select("student_id").eq("subject_id", subjectId),
  ]);
  const concepts = conceptsData ?? [];
  const studentIds = enrollments?.map((e) => e.student_id) ?? [];

  const { data: attempts } = studentIds.length
    ? await supabase
        .from("diagnostic_attempts")
        .select("id, user_id, created_at")
        .eq("subject_id", subjectId)
        .in("user_id", studentIds)
        .not("completed_at", "is", null)
    : { data: [] };
  const attemptIds = attempts?.map((a) => a.id) ?? [];

  // Ordenadas por id para que ninguna página se salte ni repita filas
  const answers: AnswerRow[] = [];
  for (let from = 0; attemptIds.length > 0; from += PAGE_SIZE) {
    const { data: page, error } = await supabase
      .from("diagnostic_answers")
      .select("attempt_id, stage, concept_id, is_correct")
      .in("attempt_id", attemptIds)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`No se pudieron leer las respuestas de la clase: ${error.message}`);
    answers.push(...(page ?? []));
    if (!page || page.length < PAGE_SIZE) break;
  }

  const activeIds = studentIds.filter((id) => (attempts ?? []).some((a) => a.user_id === id));
  const inactive = studentIds.length - activeIds.length;
  const perConcept = new Map<string, StateCounts>(
    concepts.map((c) => [c.id, { sin_evidencia: inactive, brecha: 0, en_desarrollo: 0, dominado: 0 }])
  );

  let studentsWithGaps = 0;
  const evidence: { attempts: { id: string; created_at: string }[]; answers: AnswerRow[] }[] = [];
  const perStudent: StudentProgress[] = studentIds.map((sid) => {
    const myAttempts = (attempts ?? []).filter((a) => a.user_id === sid);
    if (myAttempts.length === 0) return { id: sid, states: null, openGaps: 0, closedGaps: 0, lastDiagnostic: null };
    const myIds = new Set(myAttempts.map((a) => a.id));
    const myAnswers = answers.filter((a) => myIds.has(a.attempt_id));
    evidence.push({ attempts: myAttempts, answers: myAnswers });

    const states = computeConceptStates(concepts, myAttempts, myAnswers);
    const counts: StateCounts = { sin_evidencia: 0, brecha: 0, en_desarrollo: 0, dominado: 0 };
    concepts.forEach((c) => {
      perConcept.get(c.id)![states[c.id]] += 1;
      counts[states[c.id]] += 1;
    });
    if (counts.brecha > 0) studentsWithGaps += 1;
    return {
      id: sid,
      states: counts,
      openGaps: counts.brecha,
      closedGaps: computeStudentGaps(concepts, myAttempts, myAnswers).filter((g) => g.status === "recuperada").length,
      lastDiagnostic: myAttempts.map((a) => a.created_at).sort().pop() ?? null,
    };
  });

  return {
    concepts: concepts.map((c) => ({ id: c.id, name: c.name, prerequisite_ids: c.prerequisite_ids, topic_id: c.topic_id })),
    students: studentIds.length,
    activeStudents: activeIds.length,
    studentsWithGaps,
    perConcept,
    perStudent,
    lrr: computeClassLRR(concepts, evidence),
    lrrLegacy: computeClassLRRLegacy(concepts, evidence),
  };
}
