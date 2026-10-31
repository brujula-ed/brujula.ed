import { createClient } from "@/lib/supabase/server";
import { CircleAlert } from "lucide-react";
import { GenerateEvidenceButton } from "@/components/generate-evidence-button";
import type { Evidence } from "@/components/concept-evidence";
import { OrganizeTopicsButton } from "@/components/organize-topics-button";
import type { Topic } from "@/components/topic-detail";
import { computeTopicDependencies, learningOrder } from "@/lib/knowledge-graph";
import { materialPositions } from "@/lib/topic-organization";
import { FindDuplicatesButton, type DuplicatePair } from "@/components/duplicate-pairs";
import { StructureWorkspace, type WorkspaceGroup } from "@/components/structure-workspace";

// Paso 2 de "Contenido": conceptos y temas. Carga los datos y calcula el orden y los avisos (determinista); la mesa de
// trabajo (components/structure-workspace.tsx) los muestra. La página de la asignatura ya comprobó que el docente es el
// dueño.
export async function StructureStep({ subjectId }: { subjectId: string }) {
  const supabase = await createClient();

  const { data: concepts } = await supabase
    .from("concepts")
    .select("id, name, description, status, prerequisite_ids, topic_id")
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: true });

  const allConcepts = concepts ?? [];

  // Temas de la asignatura, en su orden (docs/MOTOR-DE-CONOCIMIENTO.md 4.3): cada concepto está en uno o en ninguno
  const { data: topicRows } = await supabase
    .from("topics")
    .select("id, name, description, status, position")
    .eq("subject_id", subjectId)
    .order("position");
  const topics: Topic[] = topicRows ?? [];
  const withoutTopic = allConcepts.filter((c) => !c.topic_id || !topics.some((t) => t.id === c.topic_id));
  const nextTopicPosition = topics.reduce((max, t) => Math.max(max, t.position + 1), 0);
  const { needs: topicNeeds, mutual } = computeTopicDependencies(topics, allConcepts);
  const topicName = new Map(topics.map((t) => [t.id, t.name]));
  const namesOf = (ids: string[]) => ids.map((id) => topicName.get(id) ?? "").filter(Boolean);
  const mutualOf = (id: string) => mutual.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []));

  // Fichas y recursos se validan en su propio paso (cards-step.tsx). Aquí solo se leen los validados, porque el mapa
  // muestra lo mismo que ve el estudiante.
  const { data: fichas } = await supabase
    .from("concept_cards")
    .select("concept_id, why_it_matters, application")
    .eq("subject_id", subjectId)
    .eq("status", "validado");
  const validatedFichas = Object.fromEntries(
    (fichas ?? [])
      .map((f) => [f.concept_id, { whyItMatters: f.why_it_matters, application: f.application }])
  );

  const { data: resources } = await supabase
    .from("concept_resources")
    .select("concept_id, title, url, kind, source")
    .eq("subject_id", subjectId)
    .eq("status", "validado")
    .order("created_at", { ascending: true });
  const validatedResources: Record<string, { title: string; url: string; kind: string; source: string }[]> = {};
  for (const r of resources ?? []) {
    (validatedResources[r.concept_id] ??= []).push({ title: r.title, url: r.url, kind: r.kind, source: r.source });
  }

  // Citas del material de cada concepto (solo las del concepto, no las de sus preguntas)
  const { data: evidence } = await supabase
    .from("evidence_spans")
    .select("concept_id, quote, page_start, page_end, section, document_chunks(position), subject_documents(uploaded_at)")
    .eq("subject_id", subjectId)
    .is("question_id", null)
    .order("page_start", { ascending: true });
  // Dónde aparece cada concepto en el material: desempata el orden de aprendizaje dentro de cada tema
  const { position: conceptPosition } = materialPositions(evidence ?? []);
  // Al navegador va solo lo que se muestra de cada cita
  const evidenceByConcept: Record<string, Evidence[]> = {};
  for (const e of evidence ?? []) {
    (evidenceByConcept[e.concept_id] ??= []).push({
      quote: e.quote,
      page_start: e.page_start,
      page_end: e.page_end,
      section: e.section,
    });
  }

  // Posibles duplicados que confirmó la IA (lib/concept-embeddings.ts); se guardan al generar o con "Buscar duplicados"
  const { data: candidates } = await supabase
    .from("concept_duplicate_candidates")
    .select("concept_a, concept_b, reason")
    .eq("subject_id", subjectId)
    .order("similarity", { ascending: false });
  const conceptById = new Map(allConcepts.map((c) => [c.id, c]));
  const duplicatePairs: DuplicatePair[] = (candidates ?? []).flatMap((p) => {
    const a = conceptById.get(p.concept_a);
    const b = conceptById.get(p.concept_b);
    return a && b ? [{ a: { id: a.id, name: a.name }, b: { id: b.id, name: b.name }, reason: p.reason }] : [];
  });


const withoutEvidence = allConcepts.filter((c) => !evidenceByConcept[c.id]).length;
  // Grupos de la lista en orden: los temas (con sus avisos de orden) y al final los conceptos sin tema
  const ids = (list: typeof allConcepts) => learningOrder(list, conceptPosition).map((c) => c.id);
  const groups: WorkspaceGroup[] = topics.map((t, i) => ({
    topic: t,
    notes: {
      needs: namesOf(topicNeeds.get(t.id) ?? []),
      neededBelow: namesOf((topicNeeds.get(t.id) ?? []).filter((id) => topics.findIndex((o) => o.id === id) > i)),
      mutualWith: namesOf(mutualOf(t.id)),
    },
    conceptIds: ids(allConcepts.filter((c) => c.topic_id === t.id)),
  }));
  if (withoutTopic.length > 0) {
    groups.push({ topic: null, notes: { needs: [], neededBelow: [], mutualWith: [] }, conceptIds: ids(withoutTopic) });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* La IA de la estructura se lanza desde Material (generate-structure-button.tsx). Aquí solo "Buscar duplicados"
          y, cuando hacen falta, los reintentos de organizar en temas y de buscar fuentes */}
      {allConcepts.length > 0 && (
        <div className="flex flex-col gap-3">
          {withoutTopic.length > 0 && (
            <Notice text={`${plural(withoutTopic.length, "concepto sin tema", "conceptos sin tema")}. La IA puede agruparlos en temas, en el orden de tu material.`}>
              <OrganizeTopicsButton subjectId={subjectId} />
            </Notice>
          )}
          {withoutEvidence > 0 && (
            <Notice text={`${plural(withoutEvidence, "concepto sin fuente", "conceptos sin fuente")} en el material. La IA puede buscar la cita que los respalda, con su página.`}>
              <GenerateEvidenceButton subjectId={subjectId} />
            </Notice>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <FindDuplicatesButton subjectId={subjectId} />
            <p className="text-xs text-muted-foreground">
              Compara los conceptos por su significado y avisa de los que podrían ser el mismo.
            </p>
          </div>
        </div>
      )}

      <StructureWorkspace
        subjectId={subjectId}
        groups={groups}
        concepts={allConcepts}
        evidence={evidenceByConcept}
        duplicatePairs={duplicatePairs}
        nextTopicPosition={nextTopicPosition}
        mapFichas={validatedFichas}
        mapResources={validatedResources}
      />
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Aviso con su solución: algo que falta en la estructura y el botón de la IA que lo resuelve
function Notice({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-card p-4 shadow-rest md:flex-row md:items-center md:justify-between">
      <p className="flex items-start gap-2 text-sm">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {text}
      </p>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
