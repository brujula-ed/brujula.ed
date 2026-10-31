import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConceptCard } from "@/components/concept-card";
import Link from "next/link";
import { KnowledgeMap } from "@/components/knowledge-map";
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
    <main className="max-w-5xl mx-auto p-8">
        <Link href={`/docente/${subjectId}`} className="text-sm text-muted-foreground hover:underline mb-4 inline-block">
            ← Volver a la asignatura
        </Link>
      <h1 className="text-xl font-medium mb-1">Estructura de conceptos</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {subject.name} — revisa, edita o descarta lo que propuso la IA antes de publicarlo
      </p>

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
            Aún no hay conceptos. Vuelve a la asignatura y genera la estructura con IA.
          </p>
        )}
      </div>
    </main>
  );
}