import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RetrievalPractice } from "@/components/retrieval-practice";

// Práctica de recuperación activa de un concepto (F-09). El layout de /estudiante ya exige sesión.
export default async function Practicar({
  params,
}: {
  params: Promise<{ subjectId: string; conceptId: string }>;
}) {
  const { subjectId, conceptId } = await params;
  const supabase = await createClient();

  // La RLS solo devuelve al estudiante conceptos validados de asignaturas en las que está inscrito
  const { data: concept } = await supabase
    .from("concepts")
    .select("id, name, description")
    .eq("id", conceptId)
    .eq("subject_id", subjectId)
    .eq("status", "validado")
    .maybeSingle();
  if (!concept) notFound();

  // Y solo fichas validadas: si no hay, la referencia es la descripción
  const { data: ficha } = await supabase
    .from("concept_cards")
    .select("why_it_matters, application")
    .eq("concept_id", conceptId)
    .maybeSingle();

  // Los estudiantes no leen "questions" directamente: la función devuelve las validadas sin la respuesta correcta
  const { data: validQuestions } = await supabase.rpc("get_diagnostic_questions", { p_subject_id: subjectId });
  const hasQuestions = ((validQuestions ?? []) as { concept_id: string }[]).some((q) => q.concept_id === conceptId);

  return (
    <main className="max-w-3xl mx-auto p-8">
      <Link href={`/estudiante/${subjectId}`} className="text-sm text-muted-foreground hover:underline mb-4 inline-block">
        ← Volver a Mi Brújula
      </Link>
      <RetrievalPractice
        subjectId={subjectId}
        conceptName={concept.name}
        reference={{
          description: concept.description,
          whyItMatters: ficha?.why_it_matters,
          application: ficha?.application,
        }}
        hasQuestions={hasQuestions}
      />
    </main>
  );
}
