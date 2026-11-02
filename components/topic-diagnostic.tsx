"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, CircleAlert, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { ActionBar } from "@/components/action-bar";
import { StateChip } from "@/components/state-chip";
import { AnswerReview, OptionList, type ReviewRow } from "@/components/quiz-parts";
import { MAX_TOPIC_QUESTIONS, planTopicDiagnosis, type TopicAnswer } from "@/lib/topic-diagnosis";
import type { ConceptState } from "@/lib/concept-state";

type Concept = { id: string; name: string; prerequisite_ids: string[] };
type Question = { id: string; conceptId: string; prompt: string; options: string[] };

// Diagnóstico de un tema (docs/DISENO-DEL-ESTUDIANTE.md 2.4 y 3.2), pantalla de foco y primero para el celular. Una
// pregunta por pantalla, sin explicación al responder; lib/topic-diagnosis.ts elige la siguiente con las respuestas
// (corregidas en la base por submit_answer). Al terminar: estados del tema, la brecha raíz y la revisión de respuestas.
// La sesión (kind = tema) se crea con la primera respuesta y se cierra al terminar; si sale a mitad, no cuenta.
export function TopicDiagnostic({
  subject,
  userId,
  topic,
  topicConcepts,
  allConcepts,
  questions,
  states,
}: {
  subject: { id: string; name: string };
  userId: string;
  topic: { id: string; name: string };
  topicConcepts: Concept[]; // en orden de aprendizaje
  allConcepts: Concept[];
  questions: Question[]; // en orden de preferencia
  states: Record<string, { state: ConceptState; lowEvidence: boolean }>; // se actualizan al cerrar la sesión
}) {
  const router = useRouter();
  const supabase = createClient();
  const [stage, setStage] = useState<"inicio" | "preguntas" | "resultado">("inicio");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<TopicAnswer[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [review, setReview] = useState<ReviewRow[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);

  const byQuestion = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const byConcept = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const q of questions) map.set(q.conceptId, [...(map.get(q.conceptId) ?? []), q.id]);
    return map;
  }, [questions]);
  const names = useMemo(() => new Map(allConcepts.map((c) => [c.id, c.name])), [allConcepts]);
  const plan = planTopicDiagnosis(topicConcepts, allConcepts, byConcept, answers);
  const current = plan.next ? byQuestion.get(plan.next.questionId) : undefined;

  useEffect(() => {
    heading.current?.focus();
  }, [stage, answers.length]);

  const backHref = `/estudiante/${subject.id}`;

  async function ensureAttempt(): Promise<string | null> {
    if (attemptId) return attemptId;
    const { data, error: insertError } = await supabase
      .from("diagnostic_attempts")
      // subject es una columna heredada (pendiente 2): repite el nombre de la asignatura
      .insert({ user_id: userId, subject: subject.name, subject_id: subject.id, kind: "tema", topic_id: topic.id })
      .select("id")
      .single();
    if (insertError || !data) return null;
    setAttemptId(data.id);
    return data.id;
  }

  async function finish(id: string) {
    const { error: closeError } = await supabase
      .from("diagnostic_attempts")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", id)
      .select("id");
    if (closeError) {
      setError("No pudimos guardar el final. Revisa tu conexión y vuelve a intentarlo.");
      return;
    }
    const { data } = await supabase.rpc("get_answer_review", { p_attempt_id: id });
    setReview((data ?? []) as ReviewRow[]);
    setStage("resultado");
    router.refresh(); // trae los estados nuevos del tema
  }

  async function handleAnswer() {
    if (selected === null || !plan.next) return;
    setSaving(true);
    setError("");
    const id = await ensureAttempt();
    if (!id) {
      setSaving(false);
      setError("No pudimos empezar. Revisa tu conexión y vuelve a intentarlo.");
      return;
    }
    const { data: correct, error: rpcError } = await supabase.rpc("submit_answer", {
      p_attempt_id: id,
      p_question_id: plan.next.questionId,
      p_stage: "diagnostico",
      p_selected_index: selected,
    });
    if (rpcError || correct === null) {
      setSaving(false);
      setError("No pudimos guardar tu respuesta. Vuelve a intentarlo.");
      return;
    }
    const nextAnswers = [...answers, { ...plan.next, correct }];
    setAnswers(nextAnswers);
    setSelected(null);
    if (!planTopicDiagnosis(topicConcepts, allConcepts, byConcept, nextAnswers).next) await finish(id);
    setSaving(false);
  }

  function handleExit() {
    if (answers.length > 0 && !confirm("¿Salir del diagnóstico? Lo que respondiste no se tendrá en cuenta.")) return;
    router.push(backHref);
  }

  const errorMessage = error && (
    <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
      <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
      {error}
    </p>
  );

  // Inicio: qué va a pasar, antes de crear nada
  if (stage === "inicio") {
    const measurable = topicConcepts.filter((c) => byConcept.has(c.id)).length;
    return (
      <section aria-labelledby="diag-title" className="flex flex-col gap-5 pb-28 md:pb-0">
        <ExitRow onExit={handleExit} />
        <div className="flex flex-col gap-2">
          <p className="text-eyebrow text-muted-foreground">Diagnóstico del tema</p>
          <h1 id="diag-title" ref={heading} tabIndex={-1} className="text-section outline-none">
            {topic.name}
          </h1>
        </div>
        {measurable === 0 ? (
          <p className="text-base">Tu docente aún no publicó preguntas para este tema. Vuelve más adelante.</p>
        ) : (
          <ul className="flex flex-col gap-3 text-base">
            <li>Entre 5 y {MAX_TOPIC_QUESTIONS} preguntas, según lo que respondas: si fallas algo, buscamos qué lo causa.</li>
            <li>Sin pistas mientras respondes. Al final ves cada pregunta con su explicación.</li>
            <li>No es una nota: sirve para saber por dónde empezar.</li>
          </ul>
        )}
        <ActionBar>
          {measurable === 0 ? (
            <Link href={backHref} className={buttonVariants({ variant: "outline" })}>
              Volver a Mi Brújula
            </Link>
          ) : (
            <Button onClick={() => setStage("preguntas")}>
              Empezar
              <ArrowRight aria-hidden="true" />
            </Button>
          )}
        </ActionBar>
      </section>
    );
  }

  if (stage === "preguntas" && current) {
    return (
      <section aria-labelledby="diag-title" className="flex flex-col gap-5 pb-28 md:pb-0">
        <ExitRow onExit={handleExit}>
          Pregunta {answers.length + 1} · como máximo {MAX_TOPIC_QUESTIONS}
        </ExitRow>
        <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-(--duration-medium) ease-out-soft"
            style={{ width: `${(answers.length / MAX_TOPIC_QUESTIONS) * 100}%` }}
          />
        </div>
        <h1 id="diag-title" ref={heading} tabIndex={-1} className="text-subsection outline-none">
          {current.prompt}
        </h1>
        <OptionList options={current.options} selected={selected} onSelect={setSelected} disabled={saving} />
        {errorMessage}
        <ActionBar>
          <Button onClick={handleAnswer} disabled={selected === null || saving}>
            {saving ? "Guardando..." : "Responder"}
          </Button>
        </ActionBar>
      </section>
    );
  }

  // Todas respondidas pero no se pudo cerrar la sesión: solo falta reintentar el cierre
  if (stage === "preguntas") {
    return (
      <section aria-labelledby="diag-title" className="flex flex-col gap-5">
        <h1 id="diag-title" ref={heading} tabIndex={-1} className="text-section outline-none">
          Terminaste las preguntas
        </h1>
        {errorMessage}
        <Button className="self-start" disabled={saving} onClick={() => attemptId && finish(attemptId)}>
          Reintentar
        </Button>
      </section>
    );
  }

  // Resultado
  const root = plan.roots[0];
  return (
    <section aria-labelledby="diag-title" className="flex flex-col gap-6 pb-28 md:pb-0">
      <div className="flex flex-col gap-2">
        <p className="text-eyebrow text-muted-foreground">Diagnóstico · {topic.name}</p>
        <h1 id="diag-title" ref={heading} tabIndex={-1} className="text-section outline-none">
          {root ? `Tu brecha está en ${names.get(root)}` : "No encontramos brechas en este tema"}
        </h1>
        <p className="text-base text-muted-foreground">
          {root
            ? plan.roots.length > 1
              ? `También en ${plan.roots.slice(1).map((id) => names.get(id)).join(" y ")}. Empieza por ${names.get(root)}: lo demás que fallaste depende de esto.`
              : plan.failed.length > 1
                ? "Es la base de lo demás que fallaste: empieza por ahí."
                : "Empieza por ahí."
            : "Respondiste bien lo que te preguntamos. Sigue con el mapa para confirmar lo que aún tiene poca evidencia."}
        </p>
      </div>

      <section aria-labelledby="topic-states" className="flex flex-col gap-3 rounded-card bg-card p-4 shadow-rest">
        <h2 id="topic-states" className="text-subsection">Así está el tema</h2>
        <ul className="flex flex-col divide-y divide-border">
          {topicConcepts.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
              <Link href={`/estudiante/${subject.id}/concepto/${c.id}`} className="min-w-0 break-words hover:underline">
                {c.name}
              </Link>
              <span className="flex items-center gap-2">
                {states[c.id]?.lowEvidence && <span className="text-xs text-muted-foreground">Poca evidencia</span>}
                <StateChip state={states[c.id]?.state ?? "sin_evidencia"} />
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">Estados orientativos, calculados con todas tus respuestas.</p>
      </section>

      {review.length > 0 && (
        <section className="flex flex-col gap-3">
          <button
            onClick={() => setShowReview((v) => !v)}
            aria-expanded={showReview}
            className="flex min-h-11 items-center justify-between gap-2 rounded-control text-left font-heading font-semibold"
          >
            Revisar mis respuestas
            <ChevronDown
              aria-hidden="true"
              className={`size-4 transition-transform duration-(--duration-instant) ${showReview ? "rotate-180" : ""}`}
            />
          </button>
          {showReview && <AnswerReview rows={review} />}
        </section>
      )}

      <ActionBar>
        {root ? (
          <>
            <Link href={backHref} className={buttonVariants({ variant: "ghost" })}>
              Mi Brújula
            </Link>
            <Link href={`/estudiante/${subject.id}/concepto/${root}`} className={buttonVariants()}>
              Empieza por {names.get(root)}
              <ArrowRight aria-hidden="true" />
            </Link>
          </>
        ) : (
          <Link href={backHref} className={buttonVariants()}>
            Volver a Mi Brújula
          </Link>
        )}
      </ActionBar>
    </section>
  );
}

function ExitRow({ onExit, children }: { onExit: () => void; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{children}</p>
      <Button variant="ghost" size="sm" onClick={onExit}>
        <X aria-hidden="true" />
        Salir
      </Button>
    </div>
  );
}
