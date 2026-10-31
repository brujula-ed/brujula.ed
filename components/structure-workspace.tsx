"use client";

import { useMemo, useState } from "react";
import { Check, Filter, List, Network } from "lucide-react";
import { cn } from "cn";
import { ConceptDetail, type WorkspaceConcept } from "@/components/concept-detail";
import { TopicDetail, type Topic, type TopicNotes } from "@/components/topic-detail";
import { DuplicatePairs, type DuplicatePair } from "@/components/duplicate-pairs";
import { NewTopicForm } from "@/components/new-topic-form";
import { KnowledgeMap, type MapFicha, type MapResource } from "@/components/knowledge-map";
import type { Evidence } from "@/components/concept-evidence";

// Un grupo de la lista: un tema (o "Sin tema", topic = null) con sus conceptos ya en orden de aprendizaje
export type WorkspaceGroup = { topic: Topic | null; notes: TopicNotes; conceptIds: string[] };

type Selection = { kind: "concept" | "topic"; id: string };

// Mesa de trabajo del paso Estructura (docs/PRINCIPIOS-DE-DISENO.md 5.10): lista de temas y conceptos a la izquierda,
// el elegido en el centro y su contexto (citas del material, qué necesita y qué abre) a la derecha. Elegir es inmediato
// porque todos los datos ya llegaron del servidor; guardar sigue pasando por Supabase y router.refresh().
export function StructureWorkspace({
  subjectId,
  groups,
  concepts,
  evidence,
  duplicatePairs,
  nextTopicPosition,
  mapFichas,
  mapResources,
}: {
  subjectId: string;
  groups: WorkspaceGroup[];
  concepts: WorkspaceConcept[];
  evidence: Record<string, Evidence[]>;
  duplicatePairs: DuplicatePair[];
  nextTopicPosition: number;
  mapFichas: Record<string, MapFicha>;
  mapResources: Record<string, MapResource[]>;
}) {
  const [view, setView] = useState<"lista" | "mapa">("lista");
  const [onlyPending, setOnlyPending] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);

  const byId = useMemo(() => new Map(concepts.map((c) => [c.id, c])), [concepts]);
  const topics = groups.flatMap((g) => (g.topic ? [g.topic] : []));
  // Todos los conceptos en el orden de la lista: el "siguiente pendiente" sigue este orden
  const ordered = groups.flatMap((g) => g.conceptIds);
  const pendingIds = ordered.filter((id) => byId.get(id)?.status === "sugerido");
  const validatedCount = concepts.filter((c) => c.status === "validado").length;
  const pendingTopics = topics.filter((t) => t.status === "sugerido").length;

  // Lo elegido, o si ya no existe (se descartó) o no se eligió nada: el primer pendiente
  const fallback: Selection | null = pendingIds[0]
    ? { kind: "concept", id: pendingIds[0] }
    : topics.find((t) => t.status === "sugerido")
      ? { kind: "topic", id: topics.find((t) => t.status === "sugerido")!.id }
      : ordered[0]
        ? { kind: "concept", id: ordered[0] }
        : null;
  const exists = (s: Selection) => (s.kind === "concept" ? byId.has(s.id) : topics.some((t) => t.id === s.id));
  const current = selection && exists(selection) ? selection : fallback;

  // Tras validar o descartar: el siguiente pendiente en el orden de la lista (sin contar el actual)
  function goToNextPending(fromId: string) {
    const from = ordered.indexOf(fromId);
    const rest = [...ordered.slice(from + 1), ...ordered.slice(0, from)];
    const next = rest.find((id) => byId.get(id)?.status === "sugerido");
    setSelection(next ? { kind: "concept", id: next } : { kind: "concept", id: fromId });
  }

  const selectConcept = (id: string) => {
    setSelection({ kind: "concept", id });
    setView("lista");
  };

  const concept = current?.kind === "concept" ? byId.get(current.id) : undefined;
  const topicIndex = current?.kind === "topic" ? topics.findIndex((t) => t.id === current.id) : -1;
  const topic = topicIndex >= 0 ? topics[topicIndex] : undefined;

  const prereqs = concept ? concept.prerequisite_ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])) : [];
  const opens = concept ? concepts.filter((c) => c.prerequisite_ids.includes(concept.id)) : [];

  if (concepts.length === 0 && topics.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay conceptos. Genéralos con IA a partir de tu material procesado.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DuplicatePairs subjectId={subjectId} pairs={duplicatePairs} onSelect={selectConcept} />

      {/* Contador y cambio de vista */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-60 flex-1 flex-col gap-1.5">
          <p className="text-sm font-medium">
            {validatedCount} de {concepts.length} conceptos validados
            {pendingTopics > 0 && (
              <span className="font-normal text-muted-foreground">
                {" "}· {pendingTopics} {pendingTopics === 1 ? "tema" : "temas"} por revisar
              </span>
            )}
          </p>
          <div className="h-2 max-w-md overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-(--duration-medium) ease-out-soft"
              style={{ width: `${concepts.length ? (validatedCount / concepts.length) * 100 : 0}%` }}
            />
          </div>
        </div>
        <div role="group" aria-label="Vista" className="flex rounded-control border border-border bg-card p-1">
          {(["lista", "mapa"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-[calc(var(--radius-control)-4px)] px-3 text-sm font-semibold transition-colors duration-(--duration-instant)",
                view === v ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v === "lista" ? <List aria-hidden="true" className="size-4" /> : <Network aria-hidden="true" className="size-4" />}
              {v === "lista" ? "Lista" : "Mapa"}
            </button>
          ))}
        </div>
      </div>

      {view === "mapa" ? (
        <KnowledgeMap concepts={concepts} topics={topics} fichas={mapFichas} resources={mapResources} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
          {/* Lista */}
          <nav
            aria-label="Temas y conceptos"
            className="flex flex-col gap-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:pr-1"
          >
            <button
              onClick={() => setOnlyPending(!onlyPending)}
              aria-pressed={onlyPending}
              className={cn(
                "flex items-center gap-2 self-start rounded-full border px-3 py-1 text-sm transition-colors duration-(--duration-instant)",
                onlyPending ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              <Filter aria-hidden="true" className="size-3.5" />
              Solo por revisar
            </button>

            {groups.map((g) => {
              const ids = onlyPending ? g.conceptIds.filter((id) => byId.get(id)?.status === "sugerido") : g.conceptIds;
              const topicPending = g.topic?.status === "sugerido";
              if (onlyPending && ids.length === 0 && !topicPending) return null;
              return (
                <div key={g.topic?.id ?? "sin-tema"} className="flex flex-col gap-1">
                  {g.topic ? (
                    <ListItem
                      selected={current?.kind === "topic" && current.id === g.topic.id}
                      onClick={() => setSelection({ kind: "topic", id: g.topic!.id })}
                      validated={!topicPending}
                      className="font-heading font-semibold"
                    >
                      {g.topic.name}
                    </ListItem>
                  ) : (
                    topics.length > 0 && <p className="px-3 pt-1 text-sm font-semibold text-muted-foreground">Sin tema</p>
                  )}
                  <ul className={cn("flex flex-col gap-1", g.topic && "border-l border-border ml-3 pl-2")}>
                    {ids.map((id) => {
                      const c = byId.get(id)!;
                      return (
                        <li key={id}>
                          <ListItem
                            selected={current?.kind === "concept" && current.id === id}
                            onClick={() => setSelection({ kind: "concept", id })}
                            validated={c.status === "validado"}
                          >
                            {c.name}
                          </ListItem>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            {onlyPending && pendingIds.length === 0 && pendingTopics === 0 && (
              <p className="px-3 text-sm text-muted-foreground">No queda nada por revisar.</p>
            )}

            <div className="mt-2 border-t border-border pt-3">
              <NewTopicForm subjectId={subjectId} nextPosition={nextTopicPosition} />
            </div>
          </nav>

          {/* Detalle: key cambia con lo elegido, así entra con un fundido breve */}
          <section
            key={current ? `${current.kind}-${current.id}` : "nada"}
            aria-label="Detalle"
            className="rounded-card bg-card p-5 shadow-rest motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2 motion-safe:duration-(--duration-short) md:p-6"
          >
            {concept ? (
              <ConceptDetail
                concept={concept}
                topics={topics.map((t) => ({ id: t.id, name: t.name }))}
                onDone={() => goToNextPending(concept.id)}
              />
            ) : topic ? (
              <TopicDetail
                topic={topic}
                number={topicIndex + 1}
                prev={topics[topicIndex - 1]}
                next={topics[topicIndex + 1]}
                notes={groups.find((g) => g.topic?.id === topic.id)!.notes}
                concepts={(groups.find((g) => g.topic?.id === topic.id)?.conceptIds ?? []).map((id) => byId.get(id)!)}
                onSelectConcept={selectConcept}
                onDeleted={() => setSelection(null)}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Elige un tema o un concepto de la lista.</p>
            )}
          </section>

          {/* Contexto */}
          <aside aria-label="Contexto" className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
            {concept ? (
              <>
                <ContextCard title="Fuente en el material">
                  {(evidence[concept.id] ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sin cita en el material. Puede que el concepto no salga de tus documentos: revísalo con más cuidado,
                      o usa «Buscar fuentes».
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {(evidence[concept.id] ?? []).map((e) => (
                        <figure key={e.quote} className="flex flex-col gap-1">
                          <blockquote className="rounded-r-control border-l-2 border-primary bg-secondary/60 px-3 py-2 text-sm">
                            «{e.quote}»
                          </blockquote>
                          {where(e) && <figcaption className="text-xs text-muted-foreground">{where(e)}</figcaption>}
                        </figure>
                      ))}
                    </div>
                  )}
                </ContextCard>
                <ContextCard title="Dónde queda en el mapa">
                  <div className="flex flex-col gap-3 text-sm">
                    <ConceptLinks label="Necesita" items={prereqs} empty="Ningún prerrequisito." onSelect={selectConcept} />
                    <ConceptLinks label="Abre" items={opens} empty="Ningún concepto depende de este." onSelect={selectConcept} />
                  </div>
                </ContextCard>
              </>
            ) : (
              <ContextCard title="Cómo revisar">
                <p className="text-sm text-muted-foreground">
                  Los estudiantes solo verán los temas validados y, dentro de ellos, los conceptos validados. Valida el
                  tema y revisa cada uno de sus conceptos con su cita.
                </p>
              </ContextCard>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function ListItem({
  selected,
  validated,
  onClick,
  className,
  children,
}: {
  selected: boolean;
  validated: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-control border px-3 py-2 text-left text-sm transition-colors duration-(--duration-instant)",
        selected ? "border-primary bg-card shadow-rest" : "border-transparent hover:bg-card",
        className
      )}
    >
      <span className="min-w-0">{children}</span>
      {validated ? (
        <Check aria-label="Validado" className="size-4 shrink-0 text-primary" />
      ) : (
        <span className="shrink-0 rounded-full border border-dashed border-primary/50 px-2 py-0.5 text-xs font-medium text-primary">
          Revisar
        </span>
      )}
    </button>
  );
}

function ContextCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-card bg-card p-4 shadow-rest">
      <h3 className="text-eyebrow text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function ConceptLinks({
  label,
  items,
  empty,
  onSelect,
}: {
  label: string;
  items: WorkspaceConcept[];
  empty: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-medium">{label}</p>
      {items.length === 0 ? (
        <p className="text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => onSelect(c.id)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs hover:border-primary/50 hover:bg-secondary"
              >
                {c.status === "validado" && <Check aria-hidden="true" className="size-3 text-primary" />}
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Página o sección de una cita, para mostrar debajo
function where(e: Evidence): string {
  if (e.page_start !== null) {
    return e.page_end !== null && e.page_end !== e.page_start ? `págs. ${e.page_start}–${e.page_end}` : `pág. ${e.page_start}`;
  }
  return e.section ?? "";
}
