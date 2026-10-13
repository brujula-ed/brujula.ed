import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KnowledgeMap } from "@/components/knowledge-map";

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

  return (
    <main className="max-w-4xl mx-auto p-8">
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

      <h2 className="text-sm font-medium mb-3">Mapa de conocimiento</h2>
      {concepts && concepts.length > 0 ? (
        <KnowledgeMap concepts={concepts} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Tu docente aún no publicó conceptos validados para esta asignatura.
        </p>
      )}
    </main>
  );
}