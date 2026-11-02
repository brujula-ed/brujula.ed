"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CircleAlert, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ActionBar } from "@/components/action-bar";
import { MASTERY_THRESHOLD } from "@/lib/concept-state";
import { AnswerReview, Explanation, OptionList, type ReviewRow } from "@/components/quiz-parts";
import { GapClosureMoment } from "@/components/gap-closure-moment";

export type QuizQuestion = { id: string; prompt: string; options: string[] };
type Mode = "practica" | "comprobacion";
type Feedback = { isCorrect: boolean; correctIndex: number; selected: string | null; correct: string | null };

// Práctica y comprobación de un concepto (docs/DISENO-DEL-ESTUDIANTE.md 2.3 y 3.3). Una pregunta por pantalla; se
// elige una opción y se confirma con el botón de abajo (un toque sin querer no responde). La práctica muestra la
// explicación validada después de cada respuesta; la comprobación mide sin explicar y al final deja revisar cada
// respuesta. La sesión (diagnostic_attempts, kind = concepto) se crea con la primera respuesta y se cierra al terminar:
// si el estudiante sale a mitad, esas respuestas no cuentan.
export function ConceptQuiz({
  mode,
  final = false,
  questions,
  session,
  onExit,
}: {
  mode: Mode;
  final?: boolean; // comprobación final (diferida): cierra la brecha si se supera
  questions: QuizQuestion[];
  session: { userId: string; subjectId: string; subjectName: string; conceptId: string };
  onExit: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [review, setReview] = useState<ReviewRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const counted = useRef(new Set<string>()); // preguntas ya contadas: un reintento no suma dos veces

  // Al cambiar de pregunta o terminar, el foco va al título: teclado y lectores de pantalla siguen el paso
  useEffect(() => {
    heading.current?.focus();
  }, [current, finished]);

  const q = questions[current];
  const isLast = current === questions.length - 1;

  function count(isCorrect: boolean) {
    if (counted.current.has(q.id)) return;
    counted.current.add(q.id);
    if (isCorrect) setCorrectCount((n) => n + 1);
  }

  async function ensureAttempt(): Promise<string | null> {
    if (attemptId) return attemptId;
    const { data, error: insertError } = await supabase
      .from("diagnostic_attempts")
      // subject es una columna heredada (pendiente 2): repite el nombre de la asignatura
      .insert({
        user_id: session.userId,
        subject: session.subjectName,
        subject_id: session.subjectId,
        kind: "concepto",
        concept_id: session.conceptId,
      })
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
    if (mode === "comprobacion") {
      const { data } = await supabase.rpc("get_answer_review", { p_attempt_id: id });
      setReview((data ?? []) as ReviewRow[]);
    }
    setFinished(true);
    router.refresh(); // el estado del concepto cambia con la sesión cerrada
  }

  async function handleAnswer() {
    if (selected === null) return;
    setSaving(true);
    setError("");
    const id = await ensureAttempt();
    if (!id) {
      setSaving(false);
      setError("No pudimos empezar. Revisa tu conexión y vuelve a intentarlo.");
      return;
    }

    if (mode === "practica") {
      const { data, error: rpcError } = await supabase.rpc("submit_practice_answer", {
        p_attempt_id: id,
        p_question_id: q.id,
        p_selected_index: selected,
      });
      setSaving(false);
      const row = data?.[0];
      if (rpcError || !row) {
        setError("No pudimos guardar tu respuesta. Vuelve a intentarlo.");
        return;
      }
      count(row.is_correct);
      setFeedback({
        isCorrect: row.is_correct,
        correctIndex: row.correct_index,
        selected: row.selected_explanation,
        correct: row.correct_explanation,
      });
      return;
    }

    const { data: isCorrect, error: rpcError } = await supabase.rpc("submit_answer", {
      p_attempt_id: id,
      p_question_id: q.id,
      p_stage: final ? "comprobacion_diferida" : "comprobacion",
      p_selected_index: selected,
    });
    if (rpcError || isCorrect === null) {
      setSaving(false);
      setError("No pudimos guardar tu respuesta. Vuelve a intentarlo.");
      return;
    }
    count(isCorrect);
    await next(id);
    setSaving(false);
  }

  async function next(id = attemptId) {
    if (isLast && id) {
      setSaving(true);
      await finish(id);
      setSaving(false);
      return;
    }
    setCurrent((i) => i + 1);
    setSelected(null);
    setFeedback(null);
  }

  const errorMessage = error && (
    <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
      <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
      {error}
    </p>
  );

  if (finished) {
    const total = questions.length;
    const passed = correctCount / total >= MASTERY_THRESHOLD;
    return (
      <section aria-labelledby="quiz-title" className="flex flex-col gap-5 pb-28 md:pb-0">
        <div className="flex flex-col gap-1">
          <p className="text-eyebrow text-muted-foreground">{mode === "practica" ? "Práctica" : "Comprobación"}</p>
          <h2 id="quiz-title" ref={heading} tabIndex={-1} className="text-section outline-none">
            {mode === "practica"
              ? `Acertaste ${correctCount} de ${total}`
              : passed
                ? final
                  ? "Superaste la comprobación final"
                  : "Superaste la comprobación"
                : "Todavía no"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {mode === "practica"
              ? "La práctica no cambia el estado del concepto: es para aprender. Cuando te sientas listo, compruébalo."
              : passed
                ? final
                  ? `Acertaste ${correctCount} de ${total}, días después de repasarlo: eso demuestra que lo aprendiste.`
                  : `Acertaste ${correctCount} de ${total}. Para cerrar una brecha hace falta además una comprobación final, días después: recordar con el tiempo es lo que demuestra que lo aprendiste.`
                : `Acertaste ${correctCount} de ${total}. Revisa tus respuestas, repasa el concepto y vuelve a intentarlo.`}
          </p>
        </div>

        {/* Cierre de brecha (F-13): solo aparece si el LRR la da por cerrada con esta sesión */}
        {final && passed && attemptId && <GapClosureMoment subjectId={session.subjectId} attemptId={attemptId} />}

        {review && review.length > 0 && <AnswerReview rows={review} />}

        <ActionBar>
          <Button onClick={onExit}>
            Volver al recorrido
          </Button>
        </ActionBar>
      </section>
    );
  }

  return (
    <section aria-labelledby="quiz-title" className="flex flex-col gap-5 pb-28 md:pb-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {mode === "practica" ? "Práctica" : final ? "Comprobación final" : "Comprobación"} · {current + 1} de{" "}
          {questions.length}
        </p>
        <Button variant="ghost" size="sm" onClick={onExit}>
          Salir
        </Button>
      </div>
      <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-(--duration-medium) ease-out-soft"
          style={{ width: `${((current + (feedback ? 1 : 0)) / questions.length) * 100}%` }}
        />
      </div>

      <h2 id="quiz-title" ref={heading} tabIndex={-1} className="text-subsection outline-none">
        {q.prompt}
      </h2>

      <OptionList options={q.options} selected={selected} onSelect={setSelected} disabled={saving} feedback={feedback} />

      {feedback && (
        <div aria-live="polite" className="flex flex-col gap-3 rounded-card bg-secondary/60 p-4">
          <p className="flex items-center gap-2 font-medium">
            {feedback.isCorrect ? (
              <Check aria-hidden="true" className="size-4 text-primary" />
            ) : (
              <X aria-hidden="true" className="size-4" />
            )}
            {feedback.isCorrect ? "Correcto" : "No es esa"}
          </p>
          {!feedback.isCorrect && feedback.selected && (
            <Explanation label="Por qué no" text={feedback.selected} />
          )}
          {feedback.correct && <Explanation label={feedback.isCorrect ? "Por qué" : "La correcta"} text={feedback.correct} />}
        </div>
      )}

      {errorMessage}

      <ActionBar>
        {feedback ? (
          <Button onClick={() => next()} disabled={saving}>
            {isLast ? "Terminar" : "Siguiente"}
            <ArrowRight aria-hidden="true" />
          </Button>
        ) : (
          <Button onClick={handleAnswer} disabled={selected === null || saving}>
            {saving ? "Guardando..." : "Responder"}
          </Button>
        )}
      </ActionBar>
    </section>
  );
}

