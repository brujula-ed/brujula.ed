import { createClient } from "@/lib/supabase/server";
import type { Ficha } from "@/components/concept-ficha";
import type { Resource } from "@/components/concept-resources";
import type { Evidence } from "@/components/concept-evidence";
import { CardsWorkspace, type CardsGroup } from "@/components/cards-workspace";
import { learningOrder } from "@/lib/knowledge-graph";
import { materialPositions } from "@/lib/topic-organization";

// Paso 3 de "Contenido": la ficha y los recursos abiertos de cada concepto validado, en una mesa de trabajo como la de
// Estructura. Conceptos agrupados por tema y en orden de aprendizaje. La IA de este paso se lanza desde Estructura
// (components/prepare-cards-button.tsx). La página de la asignatura ya comprobó que el docente es el dueño.
export async function CardsStep({ subjectId }: { subjectId: string }) {
  const supabase = await createClient();

  const [conceptsRes, topicsRes, fichasRes, resourcesRes, evidenceRes] = await Promise.all([
    supabase
      .from("concepts")
      .select("id, name, description, status, prerequisite_ids, topic_id")
      .eq("subject_id", subjectId)
      .eq("status", "validado")
      .order("created_at", { ascending: true }),
    supabase.from("topics").select("id, name, position").eq("subject_id", subjectId).order("position"),
    supabase
      .from("concept_cards")
      .select("concept_id, why_it_matters, application, source, status")
      .eq("subject_id", subjectId),
    supabase
      .from("concept_resources")
      .select("id, concept_id, title, url, kind, source, added_by, link_check, status")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: true }),
    // Citas de cada concepto: se muestran como contexto y desempatan el orden de aprendizaje dentro de cada tema
    supabase
      .from("evidence_spans")
      .select("concept_id, quote, page_start, page_end, section, document_chunks(position), subject_documents(uploaded_at)")
      .eq("subject_id", subjectId)
      .is("question_id", null),
  ]);

  const concepts = conceptsRes.data ?? [];
  const topics = topicsRes.data ?? [];
  const { position } = materialPositions(evidenceRes.data ?? []);

  const groups: CardsGroup[] = [
    ...topics.map((t) => ({
      topic: { id: t.id, name: t.name },
      concepts: learningOrder(concepts.filter((c) => c.topic_id === t.id), position),
    })),
    {
      topic: null,
      concepts: learningOrder(concepts.filter((c) => !c.topic_id || !topics.some((t) => t.id === c.topic_id)), position),
    },
  ].filter((g) => g.concepts.length > 0);

  const fichas: Record<string, Ficha> = Object.fromEntries((fichasRes.data ?? []).map((f) => [f.concept_id, f]));
  const resources: Record<string, Resource[]> = {};
  for (const r of resourcesRes.data ?? []) (resources[r.concept_id] ??= []).push(r);
  const evidence: Record<string, Evidence[]> = {};
  for (const e of evidenceRes.data ?? []) {
    (evidence[e.concept_id] ??= []).push({
      quote: e.quote,
      page_start: e.page_start,
      page_end: e.page_end,
      section: e.section,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Cada concepto validado lleva una ficha (por qué importa y para qué le sirve al estudiante) y hasta 3 recursos
        abiertos para repasar. Tus estudiantes pueden empezar el diagnóstico antes de que termines este paso.
      </p>
      <CardsWorkspace subjectId={subjectId} groups={groups} fichas={fichas} resources={resources} evidence={evidence} />
    </div>
  );
}
