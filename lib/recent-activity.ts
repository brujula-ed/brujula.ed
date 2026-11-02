import type { createClient } from "@/lib/supabase/server";
import { newlyRecovered } from "@/lib/gap-closure";

// Actividad reciente del inicio del docente (docs/PENDIENTES.md, pendiente 14). Se calcula al vuelo con lo que ya se
// guarda, sin tabla de eventos (decisión del 01/11/2026): diagnósticos completados, brechas cerradas (mismo cálculo que
// el LRR, intento por intento) y material subido. Del material solo se sabe cuándo se subió, no cuándo se procesó.

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;
type Subject = { id: string; name: string };

export const ACTIVITY_DAYS = 7;
const PAGE_SIZE = 1000; // "Max rows" de la Data API: las respuestas se leen por páginas

export type Activity =
  | { kind: "diagnosticos"; at: string; subject: Subject; students: number }
  | { kind: "cierre"; at: string; subject: Subject; student: string; concepts: string[] }
  | { kind: "material"; at: string; subject: Subject; files: string[] };

type AnswerRow = { attempt_id: string; stage: string; concept_id: string | null; is_correct: boolean };

export async function loadRecentActivity(supabase: SupabaseServer, subjects: Subject[]): Promise<Activity[]> {
  if (subjects.length === 0) return [];
  const since = new Date(Date.now() - ACTIVITY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const subjectIds = subjects.map((s) => s.id);
  const subjectOf = new Map(subjects.map((s) => [s.id, s]));

  const [{ data: enrollments }, { data: recent }, { data: documents }] = await Promise.all([
    supabase.from("enrollments").select("student_id, subject_id").in("subject_id", subjectIds),
    supabase
      .from("diagnostic_attempts")
      .select("id, user_id, subject_id, created_at, completed_at")
      .in("subject_id", subjectIds)
      .gte("completed_at", since),
    supabase
      .from("subject_documents")
      .select("file_name, subject_id, uploaded_at")
      .in("subject_id", subjectIds)
      .gte("uploaded_at", since),
  ]);

  const activity: Activity[] = [];

  // Material subido: uno por asignatura, con sus archivos
  const docsBySubject = new Map<string, { at: string; files: string[] }>();
  for (const d of documents ?? []) {
    if (!d.uploaded_at) continue;
    const group = docsBySubject.get(d.subject_id) ?? { at: d.uploaded_at, files: [] };
    group.files.push(d.file_name);
    if (d.uploaded_at > group.at) group.at = d.uploaded_at;
    docsBySubject.set(d.subject_id, group);
  }
  for (const [subjectId, g] of docsBySubject) {
    activity.push({ kind: "material", at: g.at, subject: subjectOf.get(subjectId)!, files: g.files });
  }

  // Solo estudiantes inscritos, como en los reportes
  const enrolled = new Set((enrollments ?? []).map((e) => `${e.subject_id}:${e.student_id}`));
  const recentAttempts = (recent ?? []).flatMap((a) =>
    a.subject_id && a.completed_at && enrolled.has(`${a.subject_id}:${a.user_id}`)
      ? [{ ...a, subject_id: a.subject_id, completed_at: a.completed_at }]
      : []
  );
  if (recentAttempts.length === 0) return sortActivity(activity);

  // Diagnósticos completados: uno por asignatura, con cuántos estudiantes distintos
  const diagBySubject = new Map<string, { at: string; students: Set<string> }>();
  for (const a of recentAttempts) {
    const group = diagBySubject.get(a.subject_id) ?? { at: a.completed_at, students: new Set<string>() };
    group.students.add(a.user_id);
    if (a.completed_at > group.at) group.at = a.completed_at;
    diagBySubject.set(a.subject_id, group);
  }
  for (const [subjectId, g] of diagBySubject) {
    activity.push({ kind: "diagnosticos", at: g.at, subject: subjectOf.get(subjectId)!, students: g.students.size });
  }

  // Brechas cerradas: para cada intento reciente, las brechas que cerró. Hace falta todo el historial del estudiante
  // en la asignatura (la línea base es su primer diagnóstico).
  const involvedSubjects = [...new Set(recentAttempts.map((a) => a.subject_id))];
  const involvedStudents = [...new Set(recentAttempts.map((a) => a.user_id))];
  const [{ data: history }, { data: concepts }, { data: profiles }] = await Promise.all([
    supabase
      .from("diagnostic_attempts")
      .select("id, user_id, subject_id, created_at")
      .in("subject_id", involvedSubjects)
      .in("user_id", involvedStudents)
      .not("completed_at", "is", null),
    supabase.from("concepts").select("id, name, subject_id").in("subject_id", involvedSubjects).eq("status", "validado"),
    supabase.from("profiles").select("id, full_name").in("id", involvedStudents),
  ]);

  const attemptIds = (history ?? []).map((a) => a.id);
  const answers: AnswerRow[] = [];
  for (let from = 0; attemptIds.length > 0; from += PAGE_SIZE) {
    const { data: page, error } = await supabase
      .from("diagnostic_answers")
      .select("attempt_id, stage, concept_id, is_correct")
      .in("attempt_id", attemptIds)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`No se pudieron leer las respuestas de la actividad reciente: ${error.message}`);
    answers.push(...(page ?? []));
    if (!page || page.length < PAGE_SIZE) break;
  }

  const recentIds = new Set(recentAttempts.map((a) => a.id));
  const pairs = new Set(recentAttempts.map((a) => `${a.subject_id}:${a.user_id}`));
  for (const pair of pairs) {
    const [subjectId, userId] = pair.split(":");
    const subjectConcepts = (concepts ?? []).filter((c) => c.subject_id === subjectId);
    const mine = (history ?? [])
      .filter((a) => a.subject_id === subjectId && a.user_id === userId)
      .sort((x, y) => x.created_at.localeCompare(y.created_at));
    const name = profiles?.find((p) => p.id === userId)?.full_name ?? "Un estudiante";

    // Cada intento reciente se evalúa como el más reciente de su momento (newlyRecovered lo exige)
    mine.forEach((attempt, i) => {
      if (!recentIds.has(attempt.id)) return;
      const upTo = mine.slice(0, i + 1);
      const ids = new Set(upTo.map((a) => a.id));
      const closed = newlyRecovered(subjectConcepts, upTo, answers.filter((a) => ids.has(a.attempt_id)), attempt.id);
      if (closed.length === 0) return;
      activity.push({
        kind: "cierre",
        at: recentAttempts.find((a) => a.id === attempt.id)!.completed_at,
        subject: subjectOf.get(subjectId)!,
        student: name,
        concepts: closed.map((g) => g.concept),
      });
    });
  }

  return sortActivity(activity);
}

const sortActivity = (list: Activity[]) => list.sort((a, b) => b.at.localeCompare(a.at));
