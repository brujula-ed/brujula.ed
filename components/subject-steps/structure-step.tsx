import { createClient } from "@/lib/supabase/server";
import { GenerateConceptsButton } from "@/components/generate-concepts-button";
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
      {/* Herramientas de la IA: proponen; lo que proponen se revisa abajo, uno por uno */}
      <div className="flex flex-col gap-3 rounded-card border border-border bg-card/60 p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <GenerateConceptsButton subjectId={subjectId} />
          {allConcepts.length > 0 && (
            <>
              <OrganizeTopicsButton subjectId={subjectId} />
              <FindDuplicatesButton subjectId={subjectId} />
              <GenerateEvidenceButton subjectId={subjectId} />
            </>
          )}
        </div>
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">¿Qué hace cada herramienta?</summary>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
            <li>
              <span className="font-medium text-foreground">Generar estructura:</span> lee todo tu material procesado y
              propone conceptos nuevos con sus prerrequisitos.
            </li>
            <li>
              <span className="font-medium text-foreground">Organizar en temas:</span> agrupa en temas los conceptos que
              aún no tienen, en el orden de tu material.
            </li>
            <li>
              <span className="font-medium text-foreground">Buscar duplicados:</span> compara los conceptos por su
              significado y avisa de los que podrían ser el mismo. Tú decides cuál quitar.
            </li>
            <li>
              <span className="font-medium text-foreground">Buscar fuentes:</span> busca en tu material la cita que respalda
              cada concepto sin fuente, con su página, y la comprueba palabra por palabra.
            </li>
          </ul>
        </details>
      </div>

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
