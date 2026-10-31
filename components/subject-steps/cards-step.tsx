import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { ConceptFicha, type Ficha } from "@/components/concept-ficha";
import { ConceptResources, type Resource } from "@/components/concept-resources";
import { GenerateCardsButton } from "@/components/generate-cards-button";
import { GenerateResourcesButton } from "@/components/generate-resources-button";
import { learningOrder } from "@/lib/knowledge-graph";
import { materialPositions } from "@/lib/topic-organization";

// Paso 3 de "Contenido": la ficha y los recursos abiertos de cada concepto validado, agrupados por tema y en orden de
// aprendizaje (como en Estructura). La página de la asignatura ya comprobó que el docente es el dueño.
export async function CardsStep({ subjectId }: { subjectId: string }) {
  const supabase = await createClient();

  const [conceptsRes, topicsRes, fichasRes, resourcesRes, evidenceRes] = await Promise.all([
    supabase
      .from("concepts")
      .select("id, name, prerequisite_ids, topic_id")
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
    // Dónde aparece cada concepto en el material: desempata el orden de aprendizaje dentro de cada tema
    supabase
      .from("evidence_spans")
      .select("concept_id, page_start, document_chunks(position), subject_documents(uploaded_at)")
      .eq("subject_id", subjectId)
      .is("question_id", null),
  ]);

  const concepts = conceptsRes.data ?? [];
  const topics = topicsRes.data ?? [];
  const fichaByConcept = new Map<string, Ficha>((fichasRes.data ?? []).map((f) => [f.concept_id, f]));
  const resourcesByConcept = new Map<string, Resource[]>();
  for (const r of resourcesRes.data ?? []) {
    resourcesByConcept.set(r.concept_id, [...(resourcesByConcept.get(r.concept_id) ?? []), r]);
  }
  const { position } = materialPositions(evidenceRes.data ?? []);

  const groups = [
    ...topics.map((t) => ({ id: t.id, name: t.name, concepts: concepts.filter((c) => c.topic_id === t.id) })),
    {
      id: "sin-tema",
      name: topics.length > 0 ? "Sin tema" : "",
      concepts: concepts.filter((c) => !c.topic_id || !topics.some((t) => t.id === c.topic_id)),
    },
  ].filter((g) => g.concepts.length > 0);

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-muted-foreground mb-6">
        Cada concepto validado puede tener una ficha (por qué importa y para qué le sirve al estudiante) y hasta 3
        recursos abiertos para repasar. Tus estudiantes pueden empezar el diagnóstico antes de que termines este paso.
      </p>

      {concepts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Primero valida conceptos en el paso Estructura: las fichas y los recursos se preparan sobre ellos.
        </p>
      ) : (
        <>
          <div className="mb-8 flex flex-col gap-4">
            <div>
              <GenerateCardsButton subjectId={subjectId} />
              <p className="text-xs text-muted-foreground mt-1">
                Propone una ficha para cada concepto validado que aún no tenga.
              </p>
            </div>
            <div>
              <GenerateResourcesButton subjectId={subjectId} />
              <p className="text-xs text-muted-foreground mt-1">
                La IA busca hasta 3 recursos abiertos por concepto validado (una lectura, un video y un ejercicio cuando
                los encuentra) y comprueba que los enlaces existan. Tú decides cuáles publicar.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-8">
            {groups.map((g) => (
              <section key={g.id} className="flex flex-col gap-3">
                {g.name && <h3 className="text-subsection">{g.name}</h3>}
                {learningOrder(g.concepts, position).map((c) => {
                  const ficha = fichaByConcept.get(c.id);
                  const resources = resourcesByConcept.get(c.id) ?? [];
                  const done = ficha?.status === "validado" && resources.some((r) => r.status === "validado");
                  return (
                    <Card key={c.id}>
                      <CardContent>
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium">{c.name}</p>
                          {done && (
                            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                              <CheckCircle2 aria-hidden="true" className="size-4" />
                              Listo
                            </span>
                          )}
                        </div>
                        {ficha ? (
                          <ConceptFicha ficha={ficha} />
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">Todavía sin ficha.</p>
                        )}
                        <ConceptResources conceptId={c.id} subjectId={subjectId} resources={resources} />
                      </CardContent>
                    </Card>
                  );
                })}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
