import { createClient } from "@/lib/supabase/server";
import { ConceptCard } from "@/components/concept-card";
import { KnowledgeMap } from "@/components/knowledge-map";
import { GenerateConceptsButton } from "@/components/generate-concepts-button";
import { GenerateCardsButton } from "@/components/generate-cards-button";
import type { Ficha } from "@/components/concept-ficha";
import { GenerateResourcesButton } from "@/components/generate-resources-button";
import type { Resource } from "@/components/concept-resources";
import { GenerateEvidenceButton } from "@/components/generate-evidence-button";
import type { Evidence } from "@/components/concept-evidence";
import { OrganizeTopicsButton } from "@/components/organize-topics-button";
import { NewTopicForm } from "@/components/new-topic-form";
import { TopicGroup, type Topic } from "@/components/topic-group";
import { computeTopicDependencies, learningOrder } from "@/lib/knowledge-graph";
import { materialPositions } from "@/lib/topic-organization";
import { DuplicatePairs, FindDuplicatesButton, type DuplicatePair } from "@/components/duplicate-pairs";

// Paso 2 de "Contenido": conceptos y temas. La página de la asignatura ya comprobó que el docente es el dueño.
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

  // Citas del material de cada concepto (solo las del concepto, no las de sus preguntas)
  const { data: evidence } = await supabase
    .from("evidence_spans")
    .select("concept_id, quote, page_start, page_end, section, document_chunks(position), subject_documents(uploaded_at)")
    .eq("subject_id", subjectId)
    .is("question_id", null)
    .order("page_start", { ascending: true });
  // Dónde aparece cada concepto en el material: desempata el orden de aprendizaje dentro de cada tema
  const { position: conceptPosition } = materialPositions(evidence ?? []);
  const inLearningOrder = (list: typeof allConcepts) => learningOrder(list, conceptPosition);
  const evidenceByConcept = new Map<string, Evidence[]>();
  for (const e of evidence ?? []) {
    evidenceByConcept.set(e.concept_id, [...(evidenceByConcept.get(e.concept_id) ?? []), e]);
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

  const topicOptions = topics.map((t) => ({ id: t.id, name: t.name }));
  const card = (c: (typeof allConcepts)[number]) => (
    <ConceptCard
      key={c.id}
      concept={c}
      allConcepts={allConcepts}
      ficha={fichaByConcept.get(c.id)}
      subjectId={subjectId}
      resources={resourcesByConcept.get(c.id) ?? []}
      evidence={evidenceByConcept.get(c.id) ?? []}
      topics={topicOptions}
    />
  );

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-6">
        Revisa, edita o descarta lo que propuso la IA antes de publicarlo.
      </p>

      <div className="mb-6">
        <GenerateConceptsButton subjectId={subjectId} />
      </div>

      <DuplicatePairs subjectId={subjectId} pairs={duplicatePairs} />

      {allConcepts.length > 0 && (
        <div className="mb-6">
          <FindDuplicatesButton subjectId={subjectId} />
          <p className="text-xs text-muted-foreground mt-1">
            Compara los conceptos por su significado y avisa de los que podrían ser el mismo. Tú decides cuál quitar.
          </p>
        </div>
      )}

      {allConcepts.length > 0 && (
        <div className="mb-6">
          <OrganizeTopicsButton subjectId={subjectId} />
          <p className="text-xs text-muted-foreground mt-1">
            La IA agrupa en temas los conceptos que aún no tienen, en el orden de tu material. Después puedes renombrar,
            ordenar, validar o mover cada concepto de tema.
          </p>
        </div>
      )}

      {allConcepts.length > 0 && (
        <div className="mb-6">
          <GenerateEvidenceButton subjectId={subjectId} />
          <p className="text-xs text-muted-foreground mt-1">
            Busca en tu material las citas que respaldan cada concepto que aún no tenga fuente, con su página. Cada cita
            se comprueba palabra por palabra contra el documento.
          </p>
        </div>
      )}

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
          <KnowledgeMap concepts={allConcepts} topics={topics} fichas={validatedFichas} resources={validatedResources} />
        </div>
    )}

      {allConcepts.length > 0 && (
        <div className="mb-6 max-w-md">
          <NewTopicForm subjectId={subjectId} nextPosition={nextTopicPosition} />
        </div>
      )}

      <div className="flex flex-col gap-6">
        {topics.map((t, i) => (
          <TopicGroup
            key={t.id}
            topic={t}
            prev={topics[i - 1]}
            next={topics[i + 1]}
            needs={namesOf(topicNeeds.get(t.id) ?? [])}
            neededBelow={namesOf((topicNeeds.get(t.id) ?? []).filter((id) => topics.findIndex((o) => o.id === id) > i))}
            mutualWith={namesOf(mutualOf(t.id))}
          >
            {inLearningOrder(allConcepts.filter((c) => c.topic_id === t.id)).map(card)}
            {!allConcepts.some((c) => c.topic_id === t.id) && (
              <p className="text-sm text-muted-foreground">Este tema todavía no tiene conceptos.</p>
            )}
          </TopicGroup>
        ))}
        {withoutTopic.length > 0 && (
          <section className="flex flex-col gap-3">
            {topics.length > 0 && <h2 className="text-subsection">Sin tema</h2>}
            {inLearningOrder(withoutTopic).map(card)}
          </section>
        )}
        {allConcepts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aún no hay conceptos. Genéralos con IA a partir de tu material procesado.
          </p>
        )}
      </div>
    </div>
  );
}