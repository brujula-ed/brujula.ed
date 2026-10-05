import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConceptCard } from "@/components/concept-card";

export default async function Conceptos({ params }: { params: Promise<{ subjectId: string }> }) {
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

  const { data: concepts } = await supabase
    .from("concepts")
    .select("id, name, description, status, prerequisite_ids")
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: true });

  const allConcepts = concepts ?? [];

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-xl font-medium mb-1">Estructura de conceptos</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {subject.name} — revisa, edita o descarta lo que propuso la IA antes de publicarlo
      </p>

      <div className="flex flex-col gap-3">
        {allConcepts.map((c) => (
          <ConceptCard key={c.id} concept={c} allConcepts={allConcepts} />
        ))}
        {allConcepts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aún no hay conceptos. Vuelve a la asignatura y genera la estructura con IA.
          </p>
        )}
      </div>
    </main>
  );
}