"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { ActionBar } from "@/components/action-bar";
import { ConceptFicha, type Ficha } from "@/components/concept-ficha";
import { ConceptResources, type Resource } from "@/components/concept-resources";
import { ConceptNeighborhood } from "@/components/concept-neighborhood";
import { EvidenceQuotes, type Evidence } from "@/components/concept-evidence";
import { ListItem, ContextCard } from "@/components/workspace-parts";

export type CardsConcept = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  prerequisite_ids: string[];
  topic_id: string | null;
};
// Un grupo de la lista: un tema (o "Sin tema", topic = null) con sus conceptos validados en orden de aprendizaje
export type CardsGroup = { topic: { id: string; name: string } | null; concepts: CardsConcept[] };

// Mesa de trabajo del paso Fichas y recursos (como Estructura y Preguntas, docs/PRINCIPIOS-DE-DISENO.md 5.10): conceptos
// validados a la izquierda, la ficha y los recursos del elegido en el centro, y su contexto a la derecha. La ficha y cada
// recurso se validan por separado; el botón de abajo solo pasa al siguiente concepto con algo por revisar.
export function CardsWorkspace({
  subjectId,
  groups,
  fichas,
  resources,
  evidence,
}: {
  subjectId: string;
  groups: CardsGroup[];
  fichas: Record<string, Ficha>;
  resources: Record<string, Resource[]>;
  evidence: Record<string, Evidence[]>;
}) {
  const [onlyPending, setOnlyPending] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  // Solo en el celular y la tableta (bajo lg): una pantalla para la lista y otra para el concepto
  const [pane, setPane] = useState<"lista" | "detalle">("detalle");
  const root = useRef<HTMLDivElement>(null);

  const concepts = groups.flatMap((g) => g.concepts);
  const byId = useMemo(() => new Map(concepts.map((c) => [c.id, c])), [concepts]);
  const ordered = concepts.map((c) => c.id);

  // Algo por revisar: una ficha o un recurso sugeridos por la IA. Listo: ficha validada y al menos un recurso validado
  const hasPending = (id: string) =>
    fichas[id]?.status === "sugerido" || (resources[id] ?? []).some((r) => r.status === "sugerido");
  const isDone = (id: string) =>
    fichas[id]?.status === "validado" && (resources[id] ?? []).some((r) => r.status === "validado");
  const pendingCount = ordered.filter(hasPending).length;
  const doneCount = ordered.filter(isDone).length;

  // Lo elegido, o si ya no existe o no se eligió nada: el primero con algo por revisar
  const currentId = selection && byId.has(selection) ? selection : (ordered.find(hasPending) ?? ordered[0] ?? null);
  const concept = currentId ? byId.get(currentId) : undefined;

  // El siguiente con algo por revisar, en el orden de la lista y sin contar el actual
  const from = currentId ? ordered.indexOf(currentId) : -1;
  const nextPending = [...ordered.slice(from + 1), ...ordered.slice(0, Math.max(from, 0))].find(
    (id) => id !== currentId && hasPending(id)
  );

  // Elegir un concepto: en el celular abre su pantalla y vuelve arriba (en escritorio la lista ya está a la vista)
  function select(id: string) {
    setSelection(id);
    setPane("detalle");
    if (!window.matchMedia("(min-width: 1024px)").matches) root.current?.scrollIntoView({ block: "start" });
  }

  if (concepts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Primero valida conceptos en el paso{" "}
        <Link href={`/docente/${subjectId}?paso=estructura`} className="font-medium text-primary hover:underline">
          Estructura
        </Link>
        : las fichas y los recursos se preparan sobre ellos.
      </p>
    );
  }

  const prereqs = concept ? concept.prerequisite_ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])) : [];
  const opens = concept ? concepts.filter((c) => c.prerequisite_ids.includes(concept.id)) : [];
  const ficha = concept ? fichas[concept.id] : undefined;
  const conceptResources = concept ? (resources[concept.id] ?? []) : [];
  const validatedResources = conceptResources.filter((r) => r.status === "validado").length;

  return (
    <div ref={root} className="flex scroll-mt-4 flex-col gap-4">
      {/* Contador: conceptos con ficha validada y al menos un recurso validado */}
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">
          {doneCount} de {concepts.length} conceptos con ficha y recursos validados
          {pendingCount > 0 && (
            <span className="font-normal text-muted-foreground">
              {" "}· {pendingCount} {pendingCount === 1 ? "concepto" : "conceptos"} por revisar
            </span>
          )}
        </p>
        <div className="h-2 max-w-md overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-(--duration-medium) ease-out-soft"
            style={{ width: `${(doneCount / concepts.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        {/* Lista */}
        <nav
          aria-label="Conceptos"
          className={cn(
            "flex flex-col gap-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:pr-1",
            pane === "detalle" && "hidden lg:flex"
          )}
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
            const list = onlyPending ? g.concepts.filter((c) => hasPending(c.id)) : g.concepts;
            if (list.length === 0) return null;
            return (
              <div key={g.topic?.id ?? "sin-tema"} className="flex flex-col gap-1">
                {(g.topic || groups.length > 1) && (
                  <p className="px-3 pt-1 font-heading text-sm font-semibold">{g.topic?.name ?? "Sin tema"}</p>
                )}
                <ul className="ml-3 flex flex-col gap-1 border-l border-border pl-2">
                  {list.map((c) => (
                    <li key={c.id}>
                      <ListItem
                        selected={c.id === currentId}
                        validated={isDone(c.id)}
                        onClick={() => select(c.id)}
                        // Sin nada por revisar ni listo: falta ficha o recursos (se preparan desde Estructura)
                        badge={
                          !isDone(c.id) && !hasPending(c.id) ? (
                            <span className="shrink-0 text-xs text-muted-foreground">Falta</span>
                          ) : undefined
                        }
                      >
                        {c.name}
                      </ListItem>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {onlyPending && pendingCount === 0 && (
            <p className="px-3 text-sm text-muted-foreground">No queda nada por revisar.</p>
          )}
        </nav>

        {/* Celular: volver a la lista y pasar al concepto anterior o siguiente */}
        <div className={cn("flex items-center justify-between gap-2 lg:hidden", pane === "lista" && "hidden")}>
          <Button variant="ghost" size="sm" onClick={() => setPane("lista")}>
            <ArrowLeft aria-hidden="true" />
            Lista
          </Button>
          {from >= 0 && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Concepto anterior"
                disabled={from === 0}
                onClick={() => select(ordered[from - 1])}
              >
                <ChevronLeft />
              </Button>
              {from + 1} de {ordered.length}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Concepto siguiente"
                disabled={from === ordered.length - 1}
                onClick={() => select(ordered[from + 1])}
              >
                <ChevronRight />
              </Button>
            </div>
          )}
        </div>

        {/* Detalle: key cambia con lo elegido, así entra con un fundido breve (el deslizamiento, solo en escritorio) */}
        <section
          key={currentId ?? "nada"}
          aria-label="Ficha y recursos"
          className={cn(
            "flex flex-col gap-6 rounded-card bg-card p-5 shadow-rest motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-(--duration-short) md:p-6 lg:motion-safe:slide-in-from-right-2",
            pane === "lista" && "hidden lg:flex"
          )}
        >
          {concept && (
            <>
              <h2 className="text-section">{concept.name}</h2>

              <section aria-labelledby="ficha-title" className="flex flex-col gap-3">
                <h3 id="ficha-title" className="text-subsection">Ficha</h3>
                {ficha ? (
                  <ConceptFicha ficha={ficha} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Todavía sin ficha. Prepárala desde{" "}
                    <Link href={`/docente/${subjectId}?paso=estructura`} className="font-medium text-primary hover:underline">
                      Estructura
                    </Link>
                    , con «Continuar y preparar fichas y recursos».
                  </p>
                )}
              </section>

              <section aria-labelledby="recursos-title" className="flex flex-col gap-3 border-t border-border pt-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 id="recursos-title" className="text-subsection">Recursos para repasar</h3>
                  <p className="text-xs text-muted-foreground">
                    {validatedResources} de {conceptResources.length} validados · el estudiante ve solo los validados
                  </p>
                </div>
                <ConceptResources conceptId={concept.id} subjectId={subjectId} resources={conceptResources} />
              </section>

              {/* Fija abajo en el celular (ActionBar); desde md, en su lugar */}
              <div className="md:border-t md:border-border md:pt-5">
                {nextPending ? (
                  <ActionBar>
                    <Button onClick={() => select(nextPending)}>
                      Siguiente pendiente
                      <ArrowRight aria-hidden="true" />
                    </Button>
                  </ActionBar>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {hasPending(concept.id) ? "Este es el último concepto por revisar." : "No queda nada por revisar en este paso."}
                  </p>
                )}
              </div>
            </>
          )}
        </section>

        {/* Contexto */}
        <aside
          aria-label="Contexto"
          className={cn("flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start", pane === "lista" && "hidden lg:flex")}
        >
          {concept && (
            <>
              <ContextCard title="Definición del concepto">
                <p className="text-sm">
                  {concept.description || <span className="text-muted-foreground">Sin definición.</span>}
                </p>
              </ContextCard>
              <ContextCard title="Fuente en el material">
                <EvidenceQuotes
                  evidence={evidence[concept.id] ?? []}
                  empty="Sin cita en el material: comprueba la ficha con más cuidado."
                />
              </ContextCard>
              <ContextCard title="Dónde queda en el mapa">
                <ConceptNeighborhood
                  concept={concept}
                  prereqs={prereqs}
                  opens={opens}
                  topicNames={new Map(groups.flatMap((g) => (g.topic ? [[g.topic.id, g.topic.name] as const] : [])))}
                  onSelect={select}
                />
              </ContextCard>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
