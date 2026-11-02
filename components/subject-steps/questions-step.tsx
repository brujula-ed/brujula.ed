import { createClient } from "@/lib/supabase/server";
import type { Evidence } from "@/components/concept-evidence";
import type { WorkspaceQuestion } from "@/components/question-detail";
import { QuestionsWorkspace, type QuestionsGroup } from "@/components/questions-workspace";
import { GenerateQuestionsButton } from "@/components/generate-questions-button";
import { learningOrder } from "@/lib/knowledge-graph";
import { materialPositions } from "@/lib/topic-organization";

// Paso 4 de "Contenido": preguntas del diagnóstico, en una mesa de trabajo como la de Estructura. Los conceptos
// validados van agrupados por tema y en orden de aprendizaje (como en Fichas y recursos), y sus preguntas en ese orden.
// La página de la asignatura ya comprobó que el docente es el dueño.
export async function QuestionsStep({ subjectId }: { subjectId: string }) {
  const supabase = await createClient();

  const [conceptsRes, topicsRes, questionsRes, questionEvidenceRes, conceptEvidenceRes] = await Promise.all([
    supabase
      .from("concepts")
      .select("id, name, description, prerequisite_ids, topic_id")
      .eq("subject_id", subjectId)
      .eq("status", "validado")
      .order("created_at", { ascending: true }),
    supabase.from("topics").select("id, name, position").eq("subject_id", subjectId).order("position"),
    supabase
      .from("questions")
      .select("id, concept_id, prompt, options, explanations, correct_index, status")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: true }),
    // Cita del material que respalda la respuesta correcta de cada pregunta
    supabase
      .from("evidence_spans")
      .select("question_id, quote, page_start, page_end, section")
      .eq("subject_id", subjectId)
      .not("question_id", "is", null),
    // Dónde aparece cada concepto en el material: desempata el orden de aprendizaje dentro de cada tema
    supabase
      .from("evidence_spans")
      .select("concept_id, page_start, document_chunks(position), subject_documents(uploaded_at)")
      .eq("subject_id", subjectId)
      .is("question_id", null),
  ]);

  const concepts = conceptsRes.data ?? [];
  const topics = topicsRes.data ?? [];
  const { position } = materialPositions(conceptEvidenceRes.data ?? []);
  const strip = (list: typeof concepts) =>
    learningOrder(list, position).map((c) => ({ id: c.id, name: c.name, description: c.description }));

  const groups: QuestionsGroup[] = [
    ...topics.map((t) => ({ topic: { id: t.id, name: t.name }, concepts: strip(concepts.filter((c) => c.topic_id === t.id)) })),
    {
      topic: null,
      concepts: strip(concepts.filter((c) => !c.topic_id || !topics.some((t) => t.id === c.topic_id))),
    },
  ].filter((g) => g.concepts.length > 0);

  // Preguntas en el orden de la lista (por concepto); solo las de conceptos validados, que son las que se usan.
  // options y explanations son jsonb; las restricciones de la tabla garantizan que son listas
  const conceptOrder = new Map(groups.flatMap((g) => g.concepts).map((c, i) => [c.id, i]));
  const questions: WorkspaceQuestion[] = (questionsRes.data ?? [])
    .filter((q) => conceptOrder.has(q.concept_id))
    .map((q) => ({ ...q, options: q.options as string[], explanations: q.explanations as string[] | null }))
    .sort((a, b) => conceptOrder.get(a.concept_id)! - conceptOrder.get(b.concept_id)!);

  const evidence: Record<string, Evidence[]> = {};
  for (const e of questionEvidenceRes.data ?? []) {
    (evidence[e.question_id!] ??= []).push({
      quote: e.quote,
      page_start: e.page_start,
      page_end: e.page_end,
      section: e.section,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {concepts.length > 0 && (
        <div>
          <GenerateQuestionsButton subjectId={subjectId} />
          <p className="mt-1 text-xs text-muted-foreground">
            La IA completa hasta 6 preguntas por concepto validado, con la cita del material que respalda la respuesta
            cuando la encuentra. Tú decides cuáles publicar.
          </p>
        </div>
      )}
      <QuestionsWorkspace groups={groups} questions={questions} evidence={evidence} />
    </div>
  );
}
