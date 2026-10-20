import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KnowledgeMap } from "@/components/knowledge-map";
import { computeConceptStates } from "@/lib/concept-state";
import { computePriorityGap, computeNextChallenge } from "@/lib/knowledge-graph";
import { NextSteps } from "@/components/next-steps";
import { computeLRR } from "@/lib/lrr";
import { LRRCard } from "@/components/lrr-card";

export default async function MiBrujula({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: subject } = await supabase
    .from("subjects")
    .select("id, name, topic")
    .eq("id", subjectId)
    .single();
  if (!subject) notFound();

  const { data: concepts } = await supabase
    .from("concepts")
    .select("id, name, description, prerequisite_ids")
    .eq("subject_id", subjectId)
    .eq("status", "validado");

   const { data: attempts } = await supabase
    .from("diagnostic_attempts")
    .select("id, created_at")
    .not("completed_at", "is", null)
    .eq("subject_id", subjectId)
    .eq("user_id", user.id);

  const attemptIds = attempts?.map((a) => a.id) ?? [];

  const { data: answers } = attemptIds.length
    ? await supabase
        .from("diagnostic_answers")
        .select("attempt_id, stage, concept_id, is_correct")
        .in("attempt_id", attemptIds)
    : { data: [] };

  const states = computeConceptStates(concepts ?? [], attempts ?? [], answers ?? []);
  const lrr = computeLRR(concepts ?? [], attempts ?? [], answers ?? []);

  // Los estudiantes no leen "questions" directamente: la función devuelve las validadas sin la respuesta correcta
  const { data: validQuestions } = await supabase.rpc("get_diagnostic_questions", { p_subject_id: subjectId });
  const conceptsWithQuestions = new Set(
    ((validQuestions ?? []) as { concept_id: string }[]).map((q) => q.concept_id)
  );

  const graphConcepts = concepts ?? [];
  const gap = computePriorityGap(graphConcepts, states);
  const challenge = computeNextChallenge(graphConcepts, states);
  const challengeHasQuestions =
    challenge.kind === "ubicarse"
      ? true
      : challenge.kind === "completo"
        ? false
        : conceptsWithQuestions.has(challenge.concept.id);

  return (
    <main className="max-w-5xl mx-auto p-8">
      <Link href="/estudiante" className="text-sm text-muted-foreground hover:underline mb-4 inline-block">
        ← Volver a mis asignaturas
      </Link>
      <h1 className="text-xl font-medium mb-1">{subject.name}</h1>
      <p className="text-sm text-muted-foreground mb-6">{subject.topic}</p>

      <Link
        href={`/diagnostico/${subjectId}`}
        className="inline-block rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium mb-8"
      >
        Hacer diagnóstico
      </Link>

            {graphConcepts.length > 0 && (
        <NextSteps
          subjectId={subjectId}
          gap={gap}
          challenge={challenge}
          challengeHasQuestions={challengeHasQuestions}
        />
      )}

      {(attempts ?? []).length > 0 && (
        <div className="mb-8">
          <LRRCard lrr={lrr} title="Tu avance en cerrar brechas" />
        </div>
      )}

      <h2 className="text-sm font-medium mb-3">Mapa de conocimiento</h2>
      {concepts && concepts.length > 0 ? (
        <KnowledgeMap concepts={concepts} states={states} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Tu docente aún no publicó conceptos validados para esta asignatura.
        </p>
      )}
    </main>
  );
}