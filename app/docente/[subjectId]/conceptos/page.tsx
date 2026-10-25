import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConceptCard } from "@/components/concept-card";
import Link from "next/link";
import { KnowledgeMap } from "@/components/knowledge-map";
import { GenerateCardsButton } from "@/components/generate-cards-button";
import type { Ficha } from "@/components/concept-ficha";
import { GenerateResourcesButton } from "@/components/generate-resources-button";
import type { Resource } from "@/components/concept-resources";

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

  const { data: fichas } = await supabase
    .from("concept_cards")
    .select("concept_id, why_it_matters, application, source, status")
    .eq("subject_id", subjectId);
  const fichaByConcept = new Map<string, Ficha>((fichas ?? []).map((f) => [f.concept_id, f]));
  const hasValidated = allConcepts.some((c) => c.status === "validado");
  // El mapa muestra solo las fichas validadas, para que el docente vea lo mismo que el estudiante
  const validatedFichas = Object.fromEntries(
    (fichas ?? [])
      .filter((f) => f.status === "validado")
      .map((f) => [f.concept_id, { whyItMatters: f.why_it_matters, application: f.application }])
  );

  const { data: resources } = await supabase
    .from("concept_resources")
    .select("id, concept_id, title, url, kind, source, added_by, link_check, status")
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: true });
  const resourcesByConcept = new Map<string, Resource[]>();
  // El mapa muestra solo los validados, para que el docente vea lo mismo que el estudiante
  const validatedResources: Record<string, { title: string; url: string; kind: string; source: string }[]> = {};
  for (const r of resources ?? []) {
    resourcesByConcept.set(r.concept_id, [...(resourcesByConcept.get(r.concept_id) ?? []), r]);
    if (r.status === "validado") {
      (validatedResources[r.concept_id] ??= []).push({ title: r.title, url: r.url, kind: r.kind, source: r.source });
    }
  }

  return (
    <main className="max-w-5xl mx-auto p-8">
        <Link href={`/docente/${subjectId}`} className="text-sm text-muted-foreground hover:underline mb-4 inline-block">
            ← Volver a la asignatura
        </Link>
      <h1 className="text-xl font-medium mb-1">Estructura de conceptos</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {subject.name} — revisa, edita o descarta lo que propuso la IA antes de publicarlo
      </p>

      {hasValidated && (
        <div className="mb-6">
          <GenerateCardsButton subjectId={subjectId} />
          <p className="text-xs text-muted-foreground mt-1">
            Propone una ficha (por qué importa y para qué te sirve) para cada concepto validado que aún no tenga.
          </p>
        </div>
      )}

      {hasValidated && (
        <div className="mb-6">
          <GenerateResourcesButton subjectId={subjectId} />
          <p className="text-xs text-muted-foreground mt-1">
            La IA busca hasta 3 recursos abiertos por concepto validado (una lectura, un video y un ejercicio cuando
            los encuentra) y comprueba que los enlaces existan. Tú decides cuáles publicar.
          </p>
        </div>
      )}

      {allConcepts.length > 0 && (
        <div className="mb-8">
          <KnowledgeMap concepts={allConcepts} fichas={validatedFichas} resources={validatedResources} />
        </div>
    )}

      <div className="flex flex-col gap-3">
        {allConcepts.map((c) => (
          <ConceptCard
            key={c.id}
            concept={c}
            allConcepts={allConcepts}
            ficha={fichaByConcept.get(c.id)}
            subjectId={subjectId}
            resources={resourcesByConcept.get(c.id) ?? []}
          />
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