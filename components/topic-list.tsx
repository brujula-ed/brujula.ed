import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { StateBar, stateSummary } from "@/components/state-bar";
import { StateChip } from "@/components/state-chip";
import { buttonVariants } from "@/components/ui/button";
import type { ConceptState } from "@/lib/concept-state";
import { computeTopicDependencies, learningOrder } from "@/lib/knowledge-graph";

type Concept = { id: string; name: string; prerequisite_ids: string[]; topic_id: string | null };
type Topic = { id: string; name: string; description: string | null };

// "Tus temas" en Mi Brújula (docs/DISENO-DEL-ESTUDIANTE.md 2.2): la forma principal de recorrer la asignatura en el
// celular. Temas en orden de aprendizaje, cada uno con su barra de estados; al abrirlo, sus conceptos (cada uno lleva a
// su página) y "Ponme a prueba en este tema". El mapa queda como vista aparte.
export function TopicList({
  subjectId,
  topics,
  concepts,
  states,
  withQuestions,
}: {
  subjectId: string;
  topics: Topic[]; // validados, en el orden del docente
  concepts: Concept[];
  states: Record<string, ConceptState>;
  withQuestions: Set<string>;
}) {
  const { needs } = computeTopicDependencies(topics, concepts);
  const ordered = learningOrder(
    topics.map((t) => ({ ...t, prerequisite_ids: needs.get(t.id) ?? [] })),
    new Map(topics.map((t, i) => [t.id, i]))
  );
  const topicIds = new Set(topics.map((t) => t.id));
  const groups = ordered
    .map((t) => ({ topic: t as Topic | null, concepts: concepts.filter((c) => c.topic_id === t.id) }))
    .filter((g) => g.concepts.length > 0);
  // El estudiante solo ve temas validados: sus conceptos sin tema visible van al final
  const loose = concepts.filter((c) => !(c.topic_id && topicIds.has(c.topic_id)));
  if (loose.length > 0) groups.push({ topic: null, concepts: loose });

  return (
    <ul className="flex flex-col gap-3">
      {groups.map(({ topic, concepts: list }, i) => {
        const counts: Partial<Record<ConceptState, number>> = {};
        for (const c of list) counts[states[c.id]] = (counts[states[c.id]] ?? 0) + 1;
        const summary = stateSummary(counts);
        const testable = topic !== null && list.some((c) => withQuestions.has(c.id));
        // Dentro del tema, también en orden de aprendizaje
        const inOrder = learningOrder(list, new Map());

        return (
          <li key={topic?.id ?? "otros"}>
            <details className="group rounded-card bg-card shadow-rest">
              <summary className="flex cursor-pointer list-none items-start gap-3 p-4 [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="text-subsection break-words">
                    {topic ? `${i + 1} · ${topic.name}` : "Otros conceptos"}
                  </span>
                  <StateBar counts={counts} showLegend={false} />
                  <span className="text-xs text-muted-foreground">{summary}</span>
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform duration-(--duration-instant) group-open:rotate-180"
                />
              </summary>
              <div className="flex flex-col gap-3 border-t border-border p-4 pt-3">
                {topic?.description && <p className="text-sm text-muted-foreground">{topic.description}</p>}
                <ul className="flex flex-col divide-y divide-border">
                  {inOrder.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/estudiante/${subjectId}/concepto/${c.id}`}
                        className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm hover:text-primary"
                      >
                        <span className="min-w-0 break-words font-medium">{c.name}</span>
                        <span className="flex shrink-0 items-center gap-1">
                          <StateChip state={states[c.id]} />
                          <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {testable && (
                  <Link
                    href={`/diagnostico/${subjectId}/tema/${topic.id}`}
                    className={`${buttonVariants({ variant: "outline" })} w-full sm:w-auto sm:self-start`}
                  >
                    Ponme a prueba en este tema
                  </Link>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
