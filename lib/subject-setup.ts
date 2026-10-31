import type { createClient } from "@/lib/supabase/server";

// Preparación de una asignatura (docs/PRINCIPIOS-DE-DISENO.md 2.5 y 2.10): el estado de los 5 pasos de la vista
// "Contenido" y si la asignatura está lista para estudiantes. Determinista, a partir de lo que hay en la base.
//
// "Lista para estudiantes" (provisional, 31/10/2026): al menos un tema validado, y cada concepto validado de los temas
// validados con 2 o más preguntas validadas. Fichas y recursos suman pero no bloquean.

export const MIN_QUESTIONS_PER_CONCEPT = 2;

export type StepId = "material" | "estructura" | "fichas" | "preguntas" | "invitar";

export type SetupInput = {
  processedDocuments: number;
  concepts: { id: string; status: string; topic_id: string | null }[];
  topics: { id: string; status: string }[];
  questions: { concept_id: string; status: string }[];
  cards: { concept_id: string; status: string }[];
  resources: { concept_id: string; status: string }[];
  students: number;
};

export type SetupStep = { id: StepId; label: string; done: boolean; required: boolean; detail: string };

export type SetupStatus = {
  steps: SetupStep[];
  ready: boolean;
  current: SetupStep | null; // primer paso obligatorio que falta; null si no falta ninguno
  pendingReview: number; // propuestas de la IA esperando validación (conceptos, temas, preguntas, fichas, recursos)
  pending: PendingReview; // el mismo total, por tipo: dice a qué página llevar al docente para validar
};

export type PendingReview = { concepts: number; topics: number; questions: number; cards: number; resources: number };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function computeSetup(input: SetupInput): SetupStatus {
  const validatedTopics = new Set(input.topics.filter((t) => t.status === "validado").map((t) => t.id));
  const validatedConcepts = input.concepts.filter((c) => c.status === "validado");
  // Los conceptos que verán los estudiantes: validados y en un tema validado
  const studentConcepts = validatedConcepts.filter((c) => c.topic_id && validatedTopics.has(c.topic_id));

  const validatedQuestions = new Map<string, number>();
  for (const q of input.questions) {
    if (q.status === "validado") validatedQuestions.set(q.concept_id, (validatedQuestions.get(q.concept_id) ?? 0) + 1);
  }
  const short = studentConcepts.filter((c) => (validatedQuestions.get(c.id) ?? 0) < MIN_QUESTIONS_PER_CONCEPT);

  const pending: PendingReview = {
    concepts: input.concepts.filter((c) => c.status === "sugerido").length,
    topics: input.topics.filter((t) => t.status === "sugerido").length,
    questions: input.questions.filter((q) => q.status === "sugerido").length,
    cards: input.cards.filter((c) => c.status === "sugerido").length,
    resources: input.resources.filter((r) => r.status === "sugerido").length,
  };

  const withCard = new Set(input.cards.filter((c) => c.status === "validado").map((c) => c.concept_id));
  const withResource = new Set(input.resources.filter((r) => r.status === "validado").map((r) => r.concept_id));
  const cardsDone = validatedConcepts.filter((c) => withCard.has(c.id)).length;
  const resourcesDone = validatedConcepts.filter((c) => withResource.has(c.id)).length;

  const structureDone = studentConcepts.length > 0;
  const questionsDone = structureDone && short.length === 0;

  const steps: SetupStep[] = [
    {
      id: "material",
      label: "Material",
      required: true,
      done: input.processedDocuments > 0,
      detail: input.processedDocuments > 0
        ? plural(input.processedDocuments, "documento procesado", "documentos procesados")
        : "Sube y procesa tu primer documento",
    },
    {
      id: "estructura",
      label: "Estructura: conceptos y temas",
      required: true,
      done: structureDone,
      detail: pending.concepts + pending.topics > 0
        ? [
            pending.concepts > 0 ? plural(pending.concepts, "concepto", "conceptos") : "",
            pending.topics > 0 ? plural(pending.topics, "tema", "temas") : "",
          ].filter(Boolean).join(" y ") + " por validar"
        : structureDone
          ? `${plural(studentConcepts.length, "concepto validado", "conceptos validados")} en temas validados`
          : "Genera los conceptos y organízalos en temas",
    },
    {
      id: "fichas",
      label: "Fichas y recursos",
      required: false,
      done: validatedConcepts.length > 0 && cardsDone === validatedConcepts.length && resourcesDone === validatedConcepts.length,
      detail: validatedConcepts.length > 0
        ? `Fichas ${cardsDone} de ${validatedConcepts.length} · recursos ${resourcesDone} de ${validatedConcepts.length}`
        : "Primero valida conceptos",
    },
    {
      id: "preguntas",
      label: "Preguntas",
      required: true,
      done: questionsDone,
      detail: !structureDone
        ? "Primero valida conceptos dentro de un tema"
        : short.length > 0
          ? `${plural(short.length, "concepto necesita", "conceptos necesitan")} ${MIN_QUESTIONS_PER_CONCEPT} preguntas validadas` +
            (pending.questions > 0 ? ` · ${plural(pending.questions, "pregunta", "preguntas")} por validar` : "")
          : "Cada concepto tiene sus preguntas",
    },
    {
      id: "invitar",
      label: "Invitar estudiantes",
      required: true,
      done: input.students > 0,
      detail: input.students > 0
        ? plural(input.students, "estudiante inscrito", "estudiantes inscritos")
        : "Comparte el código de clase",
    },
  ];

  return {
    steps,
    ready: structureDone && questionsDone,
    current: steps.find((s) => s.required && !s.done) ?? null,
    pendingReview: pending.concepts + pending.topics + pending.questions + pending.cards + pending.resources,
    pending,
  };
}

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

// Lee lo necesario para computeSetup de una asignatura (el docente dueño; la RLS no deja leer a otros)
export async function loadSetup(supabase: SupabaseServer, subjectId: string): Promise<SetupStatus> {
  const [documents, chunks, concepts, topics, questions, cards, resources, students] = await Promise.all([
    supabase.from("subject_documents").select("id").eq("subject_id", subjectId),
    supabase.from("document_chunks").select("document_id").eq("subject_id", subjectId).eq("position", 0),
    supabase.from("concepts").select("id, status, topic_id").eq("subject_id", subjectId),
    supabase.from("topics").select("id, status").eq("subject_id", subjectId),
    supabase.from("questions").select("concept_id, status").eq("subject_id", subjectId),
    supabase.from("concept_cards").select("concept_id, status").eq("subject_id", subjectId),
    supabase.from("concept_resources").select("concept_id, status").eq("subject_id", subjectId),
    supabase.from("enrollments").select("student_id", { count: "exact", head: true }).eq("subject_id", subjectId),
  ]);
  // Un documento está procesado si tiene fragmentos: basta con mirar el primero (position 0) de cada uno
  const processed = new Set((chunks.data ?? []).map((c) => c.document_id));
  return computeSetup({
    processedDocuments: (documents.data ?? []).filter((d) => processed.has(d.id)).length,
    concepts: concepts.data ?? [],
    topics: topics.data ?? [],
    questions: questions.data ?? [],
    cards: cards.data ?? [],
    resources: resources.data ?? [],
    students: students.count ?? 0,
  });
}
