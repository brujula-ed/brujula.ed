"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, ChevronDown, ExternalLink, PenLine, Play } from "lucide-react";
import { cn } from "cn";
import { Button, buttonVariants } from "@/components/ui/button";
import { ActionBar } from "@/components/action-bar";
import { StateChip, STATE_BG } from "@/components/state-chip";
import { RetrievalPractice } from "@/components/retrieval-practice";
import { ConceptQuiz, type QuizQuestion } from "@/components/concept-quiz";
import { STATE_LABEL, type ConceptState } from "@/lib/concept-state";

type Neighbor = { id: string; name: string; state: ConceptState };
type Resource = { title: string; url: string; kind: string; source: string };

const KIND: Record<string, { label: string; Icon: typeof BookOpen }> = {
  lectura: { label: "Lectura", Icon: BookOpen },
  video: { label: "Video", Icon: Play },
  ejercicio: { label: "Ejercicio", Icon: PenLine },
};

const STEPS = [
  "Qué es",
  "Por qué importa",
  "Un recurso para repasar",
  "Explícalo con tus palabras",
  "Practica",
  "Comprueba",
];

// Recorrido de un concepto (docs/DISENO-DEL-ESTUDIANTE.md 2.3), primero para el celular: los 6 pasos en lista, con el
// recomendado abierto; el botón fijo de abajo avanza al siguiente y, en el último, comprueba. Los pasos no se bloquean
// entre sí (Anexo I, sec. 10). Practicar y comprobar ocupan la pantalla mientras duran.
export function ConceptJourney({
  subject,
  userId,
  concept,
  status,
  prereqs,
  opens,
  ficha,
  resources,
  checkQuestions,
  practiceQuestions,
}: {
  subject: { id: string; name: string };
  userId: string;
  concept: { id: string; name: string; description: string | null };
  status: {
    state: ConceptState;
    lowEvidence: boolean;
    evidenceLine: string; // "Estimado con 4 respuestas: 3 correctas · la última hace 2 días"
    deferredFrom: string | null; // si espera la comprobación final: desde cuándo se habilita
    deferredReady: boolean; // ya pasaron los días: la comprobación de ahora es la final
  };
  prereqs: Neighbor[];
  opens: Neighbor[];
  ficha: { whyItMatters: string; application: string } | null;
  resources: Resource[];
  checkQuestions: QuizQuestion[];
  practiceQuestions: QuizQuestion[];
}) {
  const [mode, setMode] = useState<"recorrido" | "practica" | "comprobacion">("recorrido");
  const [open, setOpen] = useState<number | null>(initialStep(status, checkQuestions.length > 0));
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);
  const canCheck = checkQuestions.length > 0 && !status.deferredFrom;

  function openStep(i: number) {
    setOpen(i);
    // En el celular el paso abierto puede quedar fuera de la vista
    requestAnimationFrame(() => stepRefs.current[i]?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }

  if (mode !== "recorrido") {
    return (
      <ConceptQuiz
        mode={mode}
        final={mode === "comprobacion" && status.deferredReady}
        questions={mode === "practica" ? practiceQuestions : checkQuestions}
        session={{ userId, subjectId: subject.id, subjectName: subject.name, conceptId: concept.id }}
        onExit={() => {
          setMode("recorrido");
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  const content: React.ReactNode[] = [
    // 1. Qué es: la descripción validada por el docente, lo primero que hay que entender
    concept.description ? (
      <p className="text-base">{concept.description}</p>
    ) : (
      <p className="text-sm text-muted-foreground">Tu docente aún no publicó la descripción de este concepto.</p>
    ),

    // 2. Por qué importa
    ficha ? (
      <div className="flex flex-col gap-3 text-base">
        <p>{ficha.whyItMatters}</p>
        <div className="flex flex-col gap-1">
          <p className="text-eyebrow text-muted-foreground">Para qué te sirve</p>
          <p>{ficha.application}</p>
        </div>
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">Tu docente aún no publicó la ficha de este concepto.</p>
    ),

    // 3. Un recurso
    resources.length > 0 ? (
      <ul className="flex flex-col gap-2">
        {resources.map((r) => {
          const kind = KIND[r.kind] ?? KIND.lectura;
          return (
            <li key={r.url}>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 items-center gap-3 rounded-control border border-border bg-card px-3 py-2 hover:border-primary/60"
              >
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
                >
                  <kind.Icon className="size-4" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium break-words">{r.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {kind.label} · {r.source === "docente" ? "de tu docente" : r.source}
                  </span>
                </span>
                <ExternalLink aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <span className="sr-only">(se abre en otra pestaña)</span>
              </a>
            </li>
          );
        })}
      </ul>
    ) : (
      <p className="text-sm text-muted-foreground">Aún no hay recursos validados para este concepto.</p>
    ),

    // 4. Explícalo
    <RetrievalPractice
      key="explicalo"
      conceptName={concept.name}
      reference={{
        description: concept.description,
        whyItMatters: ficha?.whyItMatters,
        application: ficha?.application,
      }}
      onCheck={canCheck ? () => setMode("comprobacion") : undefined}
    />,

    // 5. Practica
    practiceQuestions.length > 0 ? (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {practiceQuestions.length === 1 ? "1 pregunta" : `${practiceQuestions.length} preguntas`} que ya respondiste,
          con la explicación de cada respuesta. Practicar no cambia el estado del concepto: es para aprender.
        </p>
        <Button variant="outline" className="self-start" onClick={() => setMode("practica")}>
          Practicar
        </Button>
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">
        Practicarás con las preguntas que ya respondiste, viendo por qué cada respuesta es correcta o no. Primero
        comprueba el concepto.
      </p>
    ),

    // 6. Comprueba
    <p key="comprueba" className="text-sm text-muted-foreground">
      {status.deferredReady
        ? "Ya pasaron unos días desde tu comprobación: es el momento de la comprobación final. Si la superas, cerraste la brecha."
        : status.deferredFrom
        ? `Ya superaste la comprobación. La comprobación final se habilita ${status.deferredFrom}: recordarlo días después es lo que demuestra que lo aprendiste.`
        : canCheck
          ? `${checkQuestions.length === 1 ? "1 pregunta" : `${checkQuestions.length} preguntas`}, sin pistas mientras respondes; al final ves cada una con su explicación. Tu estado se actualiza con tus respuestas.`
          : "Tu docente aún no tiene más preguntas de este concepto. Cuando las publique, podrás comprobarlo."}
    </p>,
  ];

  const nextStep = open === null ? 0 : open + 1;
  const primary =
    open !== null && open < STEPS.length - 1 ? (
      <Button onClick={() => openStep(nextStep)}>
        Seguir: {STEPS[nextStep].toLowerCase()}
        <ArrowRight aria-hidden="true" />
      </Button>
    ) : canCheck ? (
      <Button onClick={() => setMode("comprobacion")}>
        {status.deferredReady ? "Comprobación final" : status.state === "sin_evidencia" ? "Ponte a prueba" : "Comprobar ahora"}
      </Button>
    ) : (
      <Link href={`/estudiante/${subject.id}`} className={buttonVariants({ variant: "outline" })}>
        Volver a Mi Brújula
      </Link>
    );

  return (
    <div className="grid gap-6 pb-28 md:pb-0 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      {/* Estado y relaciones: arriba en el celular, a la derecha en la computadora */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:order-2">
        <div className="flex flex-col gap-2 rounded-card bg-card p-4 shadow-rest">
          <div className="flex flex-wrap items-center gap-2">
            <StateChip state={status.state} />
            {status.lowEvidence && <span className="text-xs text-muted-foreground">Poca evidencia</span>}
          </div>
          <p className="text-sm text-muted-foreground">{status.evidenceLine}</p>
        </div>
        {(prereqs.length > 0 || opens.length > 0) && (
          <div className="flex flex-col gap-3 rounded-card bg-card p-4 shadow-rest">
            <NeighborList label="Necesita" list={prereqs} subjectId={subject.id} />
            <NeighborList label="Abre" list={opens} subjectId={subject.id} />
          </div>
        )}
      </aside>

      <section aria-labelledby="journey-title" className="flex min-w-0 flex-col gap-3 lg:order-1">
        <h2 id="journey-title" className="text-eyebrow text-muted-foreground">
          Tu recorrido
        </h2>
        <ol className="flex flex-col gap-2">
          {STEPS.map((title, i) => {
            const isOpen = open === i;
            return (
              <li
                key={title}
                ref={(el) => {
                  stepRefs.current[i] = el;
                }}
                className={cn("scroll-mt-4 rounded-card bg-card shadow-rest", isOpen && "ring-1 ring-primary/40")}
              >
                <button
                  onClick={() => (isOpen ? setOpen(null) : openStep(i))}
                  aria-expanded={isOpen}
                  aria-controls={`step-${i}`}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                      isOpen ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 font-heading font-semibold">{title}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform duration-(--duration-instant)",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>
                {isOpen && (
                  <div
                    id={`step-${i}`}
                    className="px-4 pb-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-(--duration-short)"
                  >
                    {content[i]}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <div className="md:mt-2">
          <ActionBar>{primary}</ActionBar>
        </div>
      </section>
    </div>
  );
}

// Paso que se abre al entrar, según el estado (docs/DISENO-DEL-ESTUDIANTE.md 2.3)
function initialStep(status: { state: ConceptState; lowEvidence: boolean; deferredFrom: string | null }, hasCheck: boolean) {
  if (status.state === "brecha") return 0;
  if (status.deferredFrom || status.state === "dominado") return 4; // mientras espera, o para repasar: practicar
  return hasCheck ? 5 : 0; // sin evidencia o con poca: comprobar
}

function NeighborList({ label, list, subjectId }: { label: string; list: Neighbor[]; subjectId: string }) {
  if (list.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-eyebrow text-muted-foreground">{label}</p>
      <ul className="flex flex-wrap gap-2">
        {list.map((n) => (
          <li key={n.id}>
            <Link
              href={`/estudiante/${subjectId}/concepto/${n.id}`}
              className="flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm hover:border-primary/60"
            >
              <span aria-hidden="true" className={`size-2 rounded-full ${STATE_BG[n.state]}`} />
              {n.name}
              <span className="sr-only">({STATE_LABEL[n.state]})</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
