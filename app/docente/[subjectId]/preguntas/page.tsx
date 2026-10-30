import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { QuestionCard } from "@/components/question-card";
import type { Evidence } from "@/components/concept-evidence";

export default async function Preguntas({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: subject } = await supabase
    .from("subjects")
    .select("id, name, teacher_id")
    .eq("id", subjectId)
    .single();

  if (!subject || subject.teacher_id !== user.id) notFound();

  const { data: questions } = await supabase
    .from("questions")
    .select("id, prompt, options, explanations, correct_index, status, concept_id, concepts(name)")
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: true });

  // Cita del material que respalda la respuesta correcta de cada pregunta
  const { data: evidence } = await supabase
    .from("evidence_spans")
    .select("question_id, quote, page_start, page_end, section")
    .eq("subject_id", subjectId)
    .not("question_id", "is", null);
  const evidenceByQuestion = new Map<string, Evidence[]>();
  for (const e of evidence ?? []) {
    evidenceByQuestion.set(e.question_id!, [...(evidenceByQuestion.get(e.question_id!) ?? []), e]);
  }

  return (
    <main className="max-w-2xl mx-auto p-8">
      <Link href={`/docente/${subjectId}`} className="text-sm text-muted-foreground hover:underline mb-4 inline-block">
        ← Volver a la asignatura
      </Link>
      <h1 className="text-xl font-medium mb-1">Preguntas de diagnóstico</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {subject.name} — revisa, edita o descarta lo que propuso la IA antes de publicarlo
      </p>

      <div className="flex flex-col gap-3">
        {questions?.map((q) => {
          const conceptName = Array.isArray(q.concepts) ? q.concepts[0]?.name : (q.concepts as { name: string } | null)?.name;
          // options y explanations son jsonb; las restricciones de la tabla garantizan que son listas
          return (
            <QuestionCard
              key={q.id}
              question={{
                ...q,
                options: q.options as string[],
                explanations: q.explanations as string[] | null,
                conceptName: conceptName ?? "",
              }}
              evidence={evidenceByQuestion.get(q.id) ?? []}
            />
          );
        })}
        {questions?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aún no hay preguntas. Vuelve a la asignatura y genera preguntas con IA (necesitas conceptos validados primero).
          </p>
        )}
      </div>
    </main>
  );
}