import { createClient } from "@/lib/supabase/server";
import { QuestionCard } from "@/components/question-card";
import type { Evidence } from "@/components/concept-evidence";
import { GenerateQuestionsButton } from "@/components/generate-questions-button";

// Paso 4 de "Contenido": preguntas del diagnóstico. La página de la asignatura ya comprobó que el docente es el dueño.
export async function QuestionsStep({ subjectId }: { subjectId: string }) {
  const supabase = await createClient();

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
    <div className="max-w-3xl">
      <p className="text-sm text-muted-foreground mb-6">
        Revisa, edita o descarta lo que propuso la IA antes de publicarlo.
      </p>

      <div className="mb-6">
        <GenerateQuestionsButton subjectId={subjectId} />
      </div>

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
            Aún no hay preguntas. Genéralas con IA (necesitas conceptos validados primero).
          </p>
        )}
      </div>
    </div>
  );
}