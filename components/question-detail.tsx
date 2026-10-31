"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "cn";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReviewChip } from "@/components/review-chip";
import { ActionBar } from "@/components/action-bar";

export type WorkspaceQuestion = {
  id: string;
  concept_id: string;
  prompt: string;
  options: string[];
  // Una por opción, en el mismo orden: por qué es correcta o qué error lleva a elegirla. Vacía en preguntas antiguas.
  explanations: string[] | null;
  correct_index: number;
  status: string;
};

const LETTERS = ["A", "B", "C", "D"];

const textareaClass = "w-full rounded-control border border-input bg-card px-3 py-2 text-base";

// Centro de la mesa de Preguntas (components/questions-workspace.tsx): una pregunta con sus opciones y explicaciones.
// "Validar y seguir" avisa a la mesa (onDone) para pasar a la siguiente pendiente.
export function QuestionDetail({
  question,
  conceptName,
  number,
  total,
  onDone,
}: {
  question: WorkspaceQuestion;
  conceptName: string;
  number: number; // posición dentro de su concepto (1 = la primera)
  total: number; // preguntas del concepto
  onDone: () => void; // tras validar o descartar: la mesa elige la siguiente pendiente
}) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(question.prompt);
  const [options, setOptions] = useState(question.options);
  const [explanations, setExplanations] = useState(question.explanations ?? question.options.map(() => ""));
  const [correctIndex, setCorrectIndex] = useState(question.correct_index);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Se piden de vuelta las filas modificadas: si la RLS bloquea la operación, Supabase no da error,
  // simplemente no modifica nada. 0 filas = no se guardó.
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!prompt.trim() || options.some((o) => !o.trim())) {
      setError("Completa el enunciado y todas las opciones.");
      return;
    }
    setLoading(true);
    // Sin ninguna explicación escrita se guarda vacío, como en las preguntas antiguas
    const savedExplanations = explanations.some((x) => x.trim()) ? explanations.map((x) => x.trim()) : null;
    const { data, error: saveError } = await supabase
      .from("questions")
      .update({
        prompt: prompt.trim(),
        options: options.map((o) => o.trim()),
        explanations: savedExplanations,
        correct_index: correctIndex,
      })
      .eq("id", question.id)
      .select("id");
    setLoading(false);
    if (saveError || !data?.length) {
      setError("No se pudieron guardar los cambios. Inténtalo de nuevo.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function handleValidate() {
    setLoading(true);
    setError("");
    const { data, error: validateError } = await supabase
      .from("questions")
      .update({ status: "validado" })
      .eq("id", question.id)
      .select("id");
    setLoading(false);
    if (validateError || !data?.length) {
      setError("No se pudo validar la pregunta. Inténtalo de nuevo.");
      return;
    }
    onDone();
    router.refresh();
  }

  async function handleDiscard() {
    // Las respuestas guardan question_id como texto, sin clave foránea: el historial de los estudiantes se conserva
    const message =
      question.status === "validado"
        ? "¿Descartar esta pregunta validada? Tus estudiantes dejarán de verla; sus respuestas anteriores se conservan."
        : "¿Descartar esta pregunta sugerida?";
    if (!confirm(message)) return;
    setError("");
    const { data, error: deleteError } = await supabase.from("questions").delete().eq("id", question.id).select("id");
    if (deleteError || !data?.length) {
      setError("No se pudo descartar la pregunta. Inténtalo de nuevo.");
      return;
    }
    onDone();
    router.refresh();
  }

  function cancelEdit() {
    setEditing(false);
    setPrompt(question.prompt);
    setOptions(question.options);
    setExplanations(question.explanations ?? question.options.map(() => ""));
    setCorrectIndex(question.correct_index);
    setError("");
  }

  const errorMessage = error && <p role="alert" className="text-sm text-destructive">{error}</p>;

  if (editing) {
    return (
      <form onSubmit={handleSave} className="flex flex-col gap-5">
        <h2 className="text-section">Editar pregunta</h2>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="question-prompt">Enunciado</Label>
          <textarea
            id="question-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            autoFocus
            className={textareaClass}
          />
        </div>
        {options.map((opt, i) => (
          <fieldset
            key={i}
            className={cn(
              "flex flex-col gap-2 rounded-control border p-3",
              correctIndex === i ? "border-primary bg-secondary/40" : "border-border"
            )}
          >
            <legend className="px-1 text-sm font-semibold">Opción {LETTERS[i]}</legend>
            <Input
              value={opt}
              onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))}
              aria-label={`Texto de la opción ${LETTERS[i]}`}
            />
            <textarea
              value={explanations[i] ?? ""}
              onChange={(e) => setExplanations(explanations.map((x, j) => (j === i ? e.target.value : x)))}
              rows={2}
              placeholder={i === correctIndex ? "Por qué es correcta" : "Qué error lleva a elegirla"}
              aria-label={`Explicación de la opción ${LETTERS[i]}`}
              className={cn(textareaClass, "text-sm")}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`correct-${question.id}`}
                checked={correctIndex === i}
                onChange={() => setCorrectIndex(i)}
                className="size-4 accent-primary"
              />
              Es la respuesta correcta
            </label>
          </fieldset>
        ))}
        {errorMessage}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={cancelEdit}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? "Guardando..." : "Guardar"}</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-eyebrow text-muted-foreground">
          {conceptName} · Pregunta {number} de {total}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-subsection">{question.prompt}</h2>
          <ReviewChip validated={question.status === "validado"} validatedLabel="Validada" />
        </div>
      </div>

      <ol className="flex flex-col gap-2">
        {question.options.map((opt, i) => {
          const correct = i === question.correct_index;
          return (
            <li
              key={i}
              className={cn(
                "flex gap-3 rounded-control border p-3",
                correct ? "border-primary bg-secondary/60" : "border-border"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  correct ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {LETTERS[i]}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-base">
                  <span className="sr-only">Opción {LETTERS[i]}: </span>
                  {opt}
                </p>
                {correct && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                    <Check aria-hidden="true" className="size-3.5" />
                    Correcta
                  </span>
                )}
                {question.explanations?.[i] && (
                  <p className="text-sm text-muted-foreground">{question.explanations[i]}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground">
        Las explicaciones son para ti: el estudiante solo ve el enunciado y las opciones.
      </p>

      {errorMessage}

      {question.status === "validado" && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Check aria-hidden="true" className="size-4 text-primary" />
          Validada: puede salir en el diagnóstico y en la microevaluación.
        </p>
      )}

      {/* Fija abajo en el celular (ActionBar); desde md, en su lugar. Orden fijo: la principal al final */}
      <div className="md:border-t md:border-border md:pt-5">
        <ActionBar>
          <Button variant="ghost" onClick={handleDiscard}>Descartar</Button>
          <Button variant="outline" onClick={() => setEditing(true)}>Editar</Button>
          {question.status === "sugerido" && (
            <Button onClick={handleValidate} disabled={loading}>
              <Check aria-hidden="true" />
              Validar y seguir
              <ArrowRight aria-hidden="true" className="hidden sm:block" />
            </Button>
          )}
        </ActionBar>
      </div>
    </div>
  );
}
