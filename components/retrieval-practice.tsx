"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// Práctica de recuperación activa (F-09), paso "Explícalo con tus palabras" del recorrido de un concepto
// (components/concept-journey.tsx): primero explicar de memoria, después comparar con la referencia validada. Sin IA y
// sin puntaje: la autoevaluación es un juicio propio, no se guarda ni cuenta para los estados ni el LRR.

type Reference = {
  description: string | null;
  whyItMatters?: string;
  application?: string;
};

type Stage = "write" | "compare" | "next";
type SelfRating = "bien" | "a_medias" | "me_costo";

const RATINGS: { value: SelfRating; label: string }[] = [
  { value: "bien", label: "Lo expliqué bien" },
  { value: "a_medias", label: "A medias" },
  { value: "me_costo", label: "Me costó" },
];

export function RetrievalPractice({
  conceptName,
  reference,
  onCheck,
}: {
  conceptName: string;
  reference: Reference;
  onCheck?: () => void; // sin preguntas para comprobar, no se ofrece
}) {
  const [stage, setStage] = useState<Stage>("write");
  const [text, setText] = useState("");
  const [rating, setRating] = useState<SelfRating | null>(null);

  function restart() {
    setText("");
    setRating(null);
    setStage("write");
  }

  if (stage === "write") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Escribe «{conceptName}» como si se lo contaras a un compañero. Intenta no mirar tus apuntes: traerlo de
          memoria es lo que más ayuda a aprenderlo. Después podrás compararlo.
        </p>
        <label htmlFor="explicacion" className="sr-only">
          Tu explicación
        </label>
        <textarea
          id="explicacion"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="w-full rounded-control border border-input bg-card px-3 py-2 text-base"
        />
        <Button variant="outline" className="self-start" onClick={() => setStage("compare")} disabled={!text.trim()}>
          Comparar
        </Button>
      </div>
    );
  }

  if (stage === "compare") {
    return (
      <div aria-live="polite" className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 rounded-control border border-border p-3 text-sm">
            <p className="text-eyebrow text-muted-foreground">Tu explicación</p>
            <p className="whitespace-pre-wrap">{text}</p>
          </div>
          <div className="flex flex-col gap-2 rounded-control bg-secondary/60 p-3 text-sm">
            <p className="text-eyebrow text-muted-foreground">Referencia validada por tu docente</p>
            {reference.description && <p>{reference.description}</p>}
            {reference.whyItMatters && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Por qué importa</p>
                <p>{reference.whyItMatters}</p>
              </div>
            )}
            {reference.application && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Para qué te sirve</p>
                <p>{reference.application}</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">¿Cómo te fue?</p>
          <p className="text-xs text-muted-foreground">Es solo para ti: no es una nota y no se guarda.</p>
          <div className="flex flex-wrap gap-2">
            {RATINGS.map((r) => (
              <Button
                key={r.value}
                variant="outline"
                size="sm"
                onClick={() => {
                  setRating(r.value);
                  setStage("next");
                }}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div aria-live="polite" className="flex flex-col gap-3">
      <p className="font-medium">{rating === "bien" ? "¡Bien hecho!" : "Sigue practicando"}</p>
      <p className="text-sm text-muted-foreground">
        {rating !== "bien"
          ? "Repasa la referencia y vuelve a intentarlo en un rato. Explicarlo otra vez de memoria es lo que lo fija."
          : onCheck
            ? "Compruébalo con preguntas: así sabrás si de verdad lo dominas."
            : "Tu docente aún no publicó preguntas para este concepto. Cuando las publique, podrás comprobarlo."}
      </p>
      <div className="flex flex-wrap gap-2">
        {rating === "bien" && onCheck && (
          <Button size="sm" onClick={onCheck}>
            Compruébalo
          </Button>
        )}
        <Button size="sm" variant={rating === "bien" ? "ghost" : "outline"} onClick={restart}>
          Explicarlo otra vez
        </Button>
      </div>
    </div>
  );
}
