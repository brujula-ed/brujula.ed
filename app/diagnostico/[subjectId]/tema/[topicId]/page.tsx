import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopicDiagnostic } from "@/components/topic-diagnostic";
import { computeConceptEvidence } from "@/lib/concept-state";
import { learningOrder } from "@/lib/knowledge-graph";
import { preferenceOrder } from "@/lib/question-selection";

// Diagnóstico de un tema (docs/DISENO-DEL-ESTUDIANTE.md 2.4). Pantalla de foco: sin el encabezado de la app
// (components/header-gate.tsx). La RLS solo devuelve al estudiante temas y conceptos validados de sus asignaturas.
export default async function DiagnosticoTema({
  params,
}: {
  params: Promise<{ subjectId: string; topicId: string }>;
}) {
  const { subjectId, topicId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: subject }, { data: topic }, { data: conceptsData }, { data: attempts }, { data: bankRows }] =
    await Promise.all([
      supabase.from("subjects").select("id, name").eq("id", subjectId).maybeSingle(),
      supabase.from("topics").select("id, name").eq("id", topicId).eq("subject_id", subjectId).maybeSingle(),
      supabase
        .from("concepts")
        .select("id, name, prerequisite_ids, topic_id")
        .eq("subject_id", subjectId)
        .eq("status", "validado"),
      supabase
        .from("diagnostic_attempts")
        .select("id, created_at")
        .eq("subject_id", subjectId)
        .eq("user_id", user.id)
        .not("completed_at", "is", null),
      // Los estudiantes no leen "questions" directamente: la función devuelve las validadas sin la respuesta correcta
      supabase.rpc("get_diagnostic_questions", { p_subject_id: subjectId }),
    ]);
  if (!subject || !topic) notFound();

  const concepts = conceptsData ?? [];
  const attemptIds = (attempts ?? []).map((a) => a.id);
  const { data: answers } = attemptIds.length
    ? await supabase
        .from("diagnostic_answers")
        .select("attempt_id, stage, concept_id, is_correct")
        .in("attempt_id", attemptIds)
    : { data: [] };
  const evidence = computeConceptEvidence(concepts, attempts ?? [], answers ?? []);

  // Orden de aprendizaje dentro del tema (el estudiante no lee las citas del material, así que sin desempate por página)
  const topicConcepts = learningOrder(
    concepts.filter((c) => c.topic_id === topicId),
    new Map()
  );
  const questions = preferenceOrder(
    (bankRows ?? []).map((q) => ({
      id: q.id,
      conceptId: q.concept_id,
      lastAnsweredAt: q.last_answered_at,
      prompt: q.prompt,
      options: q.options as string[],
    }))
  ).map(({ id, conceptId, prompt, options }) => ({ id, conceptId, prompt, options }));

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6 md:py-10">
      <TopicDiagnostic
        subject={{ id: subject.id, name: subject.name }}
        userId={user.id}
        topic={{ id: topic.id, name: topic.name }}
        topicConcepts={topicConcepts.map(({ id, name, prerequisite_ids }) => ({ id, name, prerequisite_ids }))}
        allConcepts={concepts.map(({ id, name, prerequisite_ids }) => ({ id, name, prerequisite_ids }))}
        questions={questions}
        states={Object.fromEntries(
          Object.entries(evidence).map(([id, e]) => [id, { state: e.state, lowEvidence: e.lowEvidence }])
        )}
      />
    </main>
  );
}
