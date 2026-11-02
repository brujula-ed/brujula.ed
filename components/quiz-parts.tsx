import { Check, X } from "lucide-react";
import { cn } from "cn";

// Piezas comunes de los cuestionarios del estudiante: la práctica y comprobación de un concepto
// (components/concept-quiz.tsx) y el diagnóstico de un tema (components/topic-diagnostic.tsx).

const LETTERS = ["A", "B", "C", "D", "E", "F"];

// Una fila de get_answer_review: la respuesta, la correcta y la explicación de cada opción
export type ReviewRow = {
  question_id: string;
  concept_id: string;
  prompt: string;
  options: string[];
  selected_index: number;
  correct_index: number;
  is_correct: boolean;
  explanations: string[] | null;
};

// Opciones de una pregunta como botones grandes (cómodos con el pulgar). Elegir no responde: se confirma con el botón
// de abajo. Con feedback (práctica) marca la correcta y la elegida si fue incorrecta.
export function OptionList({
  options,
  selected,
  onSelect,
  disabled,
  feedback,
}: {
  options: string[];
  selected: number | null;
  onSelect: (i: number) => void;
  disabled?: boolean;
  feedback?: { isCorrect: boolean; correctIndex: number } | null;
}) {
  return (
    <div role="radiogroup" aria-label="Opciones" className="flex flex-col gap-2">
      {options.map((option, i) => {
        const isSelected = selected === i;
        const isCorrect = feedback && feedback.correctIndex === i;
        const isWrongPick = feedback && isSelected && !feedback.isCorrect;
        return (
          <button
            key={i}
            role="radio"
            aria-checked={isSelected}
            disabled={!!feedback || disabled}
            onClick={() => onSelect(i)}
            className={cn(
              "flex min-h-12 items-start gap-3 rounded-control border bg-card px-4 py-3 text-left text-base transition-colors duration-(--duration-instant)",
              isSelected && !feedback ? "border-primary bg-secondary/60" : "border-border",
              !feedback && "hover:border-primary/60",
              isCorrect && "border-primary bg-secondary/60",
              isWrongPick && "border-foreground/40"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                (isSelected && !feedback) || isCorrect ? "border-primary bg-primary text-primary-foreground" : "border-border"
              )}
            >
              {isCorrect ? <Check className="size-3.5" /> : isWrongPick ? <X className="size-3.5" /> : LETTERS[i]}
            </span>
            <span className="min-w-0 break-words">{option}</span>
          </button>
        );
      })}
    </div>
  );
}

// "Revisar mis respuestas": cada pregunta con lo que eligió, la correcta y sus explicaciones validadas
export function AnswerReview({ rows }: { rows: ReviewRow[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {rows.map((r, i) => (
        <li key={r.question_id} className="flex flex-col gap-2 rounded-card bg-card p-4 shadow-rest">
          <p className="flex items-start gap-2 text-sm font-medium">
            {r.is_correct ? (
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            ) : (
              <X aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            )}
            <span>
              <span className="sr-only">{r.is_correct ? "Correcta. " : "Incorrecta. "}</span>
              {i + 1}. {r.prompt}
            </span>
          </p>
          {!r.is_correct && (
            <Explanation label="Elegiste" option={r.options[r.selected_index]} text={r.explanations?.[r.selected_index]} />
          )}
          <Explanation label="Respuesta correcta" option={r.options[r.correct_index]} text={r.explanations?.[r.correct_index]} />
        </li>
      ))}
    </ol>
  );
}

export function Explanation({ label, option, text }: { label: string; option?: string; text?: string | null }) {
  if (!option && !text) return null;
  return (
    <div className="flex flex-col gap-0.5 text-sm">
      <p className="text-eyebrow text-muted-foreground">{label}</p>
      {option && <p className="font-medium">{option}</p>}
      {text && <p>{text}</p>}
    </div>
  );
}
