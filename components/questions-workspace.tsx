"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { QuestionDetail, type WorkspaceQuestion } from "@/components/question-detail";
import { EvidenceQuotes, type Evidence } from "@/components/concept-evidence";
import { ListItem, ContextCard } from "@/components/workspace-parts";
import { MIN_QUESTIONS_PER_CONCEPT } from "@/lib/subject-setup";

export type QuestionsConcept = { id: string; name: string; description: string | null };
// Un grupo de la lista: un tema (o "Sin tema", topic = null) con sus conceptos validados en orden de aprendizaje
export type QuestionsGroup = { topic: { id: string; name: string } | null; concepts: QuestionsConcept[] };

type Selection = { kind: "question" | "concept"; id: string };

// Mesa de trabajo del paso Preguntas (como la de Estructura, docs/PRINCIPIOS-DE-DISENO.md 5.10): conceptos validados a
// la izquierda con cuántas preguntas tienen validadas, una pregunta en el centro y su contexto a la derecha (la cita que
// respalda la respuesta correcta, la definición del concepto y sus otras preguntas, para ver si se repiten).
export function QuestionsWorkspace({
  groups,
  questions,
  evidence,
}: {
  groups: QuestionsGroup[];
  questions: WorkspaceQuestion[]; // ya en el orden de la lista: por concepto y, dentro, por fecha de creación
  evidence: Record<string, Evidence[]>;
}) {
  const [onlyPending, setOnlyPending] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  // Solo en el celular y la tableta (bajo lg): una pantalla para la lista y otra para la pregunta
  const [pane, setPane] = useState<"lista" | "detalle">("detalle");
  const root = useRef<HTMLDivElement>(null);

  const concepts = groups.flatMap((g) => g.concepts);
  const conceptById = useMemo(() => new Map(concepts.map((c) => [c.id, c])), [concepts]);
  const questionById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const byConcept = useMemo(() => {
    const map = new Map<string, WorkspaceQuestion[]>();
    for (const q of questions) map.set(q.concept_id, [...(map.get(q.concept_id) ?? []), q]);
    return map;
  }, [questions]);

  const ordered = questions.map((q) => q.id);
  const pendingIds = questions.filter((q) => q.status === "sugerido").map((q) => q.id);
  const validatedIn = (conceptId: string) => (byConcept.get(conceptId) ?? []).filter((q) => q.status === "validado").length;
  const readyConcepts = concepts.filter((c) => validatedIn(c.id) >= MIN_QUESTIONS_PER_CONCEPT).length;

  // Lo elegido, o si ya no existe (se descartó) o no se eligió nada: la primera pendiente
  const fallback: Selection | null = pendingIds[0]
    ? { kind: "question", id: pendingIds[0] }
    : ordered[0]
      ? { kind: "question", id: ordered[0] }
      : concepts[0]
        ? { kind: "concept", id: concepts[0].id }
        : null;
  const exists = (s: Selection) => (s.kind === "question" ? questionById.has(s.id) : conceptById.has(s.id));
  const current = selection && exists(selection) ? selection : fallback;

  const question = current?.kind === "question" ? questionById.get(current.id) : undefined;
  const concept = question ? conceptById.get(question.concept_id) : current ? conceptById.get(current.id) : undefined;
  const siblings = concept ? (byConcept.get(concept.id) ?? []) : [];

  // Elegir algo: en el celular abre su pantalla y vuelve arriba (en escritorio la lista ya está a la vista)
  function select(s: Selection) {
    setSelection(s);
    setPane("detalle");
    if (!window.matchMedia("(min-width: 1024px)").matches) root.current?.scrollIntoView({ block: "start" });
  }

  // Un concepto de la lista abre su primera pregunta pendiente, o la primera, o el concepto si aún no tiene
  function selectConcept(id: string) {
    const list = byConcept.get(id) ?? [];
    const first = list.find((q) => q.status === "sugerido") ?? list[0];
    select(first ? { kind: "question", id: first.id } : { kind: "concept", id });
  }

  // Tras validar o descartar: la siguiente pendiente en el orden de la lista (sin contar la actual)
  function goToNextPending(fromId: string) {
    const from = ordered.indexOf(fromId);
    const rest = [...ordered.slice(from + 1), ...ordered.slice(0, from)];
    const next = rest.find((id) => questionById.get(id)?.status === "sugerido");
    select({ kind: "question", id: next ?? fromId });
  }

  if (concepts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Primero valida conceptos en el paso Estructura: las preguntas se preparan sobre ellos.
      </p>
    );
  }

  // Posición de la pregunta elegida entre todas, para "5 de 48 ‹ ›" en el celular
  const position = question ? ordered.indexOf(question.id) : -1;

  return (
    <div ref={root} className="flex scroll-mt-4 flex-col gap-4">
      {/* Contador: cuántos conceptos tienen ya las preguntas que pide "lista para estudiantes" */}
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">
          {readyConcepts} de {concepts.length} conceptos con {MIN_QUESTIONS_PER_CONCEPT} o más preguntas validadas
          {pendingIds.length > 0 && (
            <span className="font-normal text-muted-foreground">
              {" "}· {pendingIds.length} {pendingIds.length === 1 ? "pregunta" : "preguntas"} por revisar
            </span>
          )}
        </p>
        <div className="h-2 max-w-md overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-(--duration-medium) ease-out-soft"
            style={{ width: `${(readyConcepts / concepts.length) * 100}%` }}
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
            const list = onlyPending
              ? g.concepts.filter((c) => (byConcept.get(c.id) ?? []).some((q) => q.status === "sugerido"))
              : g.concepts;
            if (list.length === 0) return null;
            return (
              <div key={g.topic?.id ?? "sin-tema"} className="flex flex-col gap-1">
                {(g.topic || groups.length > 1) && (
                  <p className="px-3 pt-1 font-heading text-sm font-semibold">{g.topic?.name ?? "Sin tema"}</p>
                )}
                <ul className="ml-3 flex flex-col gap-1 border-l border-border pl-2">
                  {list.map((c) => {
                    const total = (byConcept.get(c.id) ?? []).length;
                    const validated = validatedIn(c.id);
                    const enough = validated >= MIN_QUESTIONS_PER_CONCEPT;
                    return (
                      <li key={c.id}>
                        <ListItem
                          selected={concept?.id === c.id}
                          validated={enough}
                          onClick={() => selectConcept(c.id)}
                          badge={
                            <span
                              className={cn(
                                "flex shrink-0 items-center gap-1 text-xs font-medium",
                                enough ? "text-primary" : "text-muted-foreground"
                              )}
                            >
                              {enough && <Check aria-hidden="true" className="size-3.5" />}
                              <span>
                                {validated} de {total}
                                <span className="sr-only"> preguntas validadas</span>
                              </span>
                            </span>
                          }
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
          {onlyPending && pendingIds.length === 0 && (
            <p className="px-3 text-sm text-muted-foreground">No queda nada por revisar.</p>
          )}
        </nav>

        {/* Celular: volver a la lista y pasar a la pregunta anterior o siguiente */}
        <div className={cn("flex items-center justify-between gap-2 lg:hidden", pane === "lista" && "hidden")}>
          <Button variant="ghost" size="sm" onClick={() => setPane("lista")}>
            <ArrowLeft aria-hidden="true" />
            Lista
          </Button>
          {position >= 0 && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Pregunta anterior"
                disabled={position === 0}
                onClick={() => select({ kind: "question", id: ordered[position - 1] })}
              >
                <ChevronLeft />
              </Button>
              {position + 1} de {ordered.length}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Pregunta siguiente"
                disabled={position === ordered.length - 1}
                onClick={() => select({ kind: "question", id: ordered[position + 1] })}
              >
                <ChevronRight />
              </Button>
            </div>
          )}
        </div>

        {/* Detalle: key cambia con lo elegido, así entra con un fundido breve (el deslizamiento, solo en escritorio) */}
        <section
          key={current ? `${current.kind}-${current.id}` : "nada"}
          aria-label="Pregunta"
          className={cn(
            "rounded-card bg-card p-5 shadow-rest motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-(--duration-short) md:p-6 lg:motion-safe:slide-in-from-right-2",
            pane === "lista" && "hidden lg:block"
          )}
        >
          {question && concept ? (
            <QuestionDetail
              question={question}
              conceptName={concept.name}
              number={siblings.indexOf(question) + 1}
              total={siblings.length}
              onDone={() => goToNextPending(question.id)}
            />
          ) : concept ? (
            <div className="flex flex-col gap-2">
              <h2 className="text-section">{concept.name}</h2>
              <p className="text-sm text-muted-foreground">
                Este concepto aún no tiene preguntas. Usa «Generar preguntas», arriba: la IA propone hasta 4 por concepto
                validado.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Elige un concepto de la lista.</p>
          )}
        </section>

        {/* Contexto */}
        <aside
          aria-label="Contexto"
          className={cn("flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start", pane === "lista" && "hidden lg:flex")}
        >
          {question && (
            <ContextCard title="Fuente en el material">
              <EvidenceQuotes
                evidence={evidence[question.id] ?? []}
                empty="Sin cita en el material: comprueba la respuesta correcta con la definición del concepto."
              />
            </ContextCard>
          )}
          {concept && (
            <ContextCard title="Definición del concepto">
              <p className="text-sm">
                {concept.description || <span className="text-muted-foreground">Sin definición.</span>}
              </p>
            </ContextCard>
          )}
          {siblings.length > 1 && (
            <ContextCard title="Preguntas de este concepto">
              <ul className="flex flex-col gap-1">
                {siblings.map((q, i) => (
                  <li key={q.id}>
                    <ListItem
                      selected={q.id === question?.id}
                      validated={q.status === "validado"}
                      onClick={() => select({ kind: "question", id: q.id })}
                    >
                      <span className="line-clamp-2">
                        {i + 1}. {q.prompt}
                      </span>
                    </ListItem>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Si dos preguntan lo mismo, descarta una. Para que la asignatura quede lista, cada concepto necesita{" "}
                {MIN_QUESTIONS_PER_CONCEPT} validadas.
              </p>
            </ContextCard>
          )}
        </aside>
      </div>
    </div>
  );
}
