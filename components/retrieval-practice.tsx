"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Práctica de recuperación activa (F-09, versión 1): primero explicar de memoria, después comparar con la
// referencia validada. Sin IA y sin puntaje: la autoevaluación es un juicio propio, no se guarda ni cuenta
// para los estados ni el LRR.

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
  subjectId,
  conceptName,
  reference,
  hasQuestions,
}: {
  subjectId: string;
  conceptName: string;
  reference: Reference;
  hasQuestions: boolean; // sin preguntas validadas, el diagnóstico ignora el foco: no se ofrece el enlace
}) {
  const [stage, setStage] = useState<Stage>("write");
  const [text, setText] = useState("");
  const [rating, setRating] = useState<SelfRating | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Al cambiar de etapa el foco va al título, para que teclado y lectores de pantalla sigan el paso
  useEffect(() => {
    if (stage !== "write") titleRef.current?.focus();
  }, [stage]);

  function restart() {
    setText("");
    setRating(null);
    setStage("write");
  }

  const myBrujula = `/estudiante/${subjectId}`;
  const focusHref = `/diagnostico/${subjectId}?concepto=${encodeURIComponent(conceptName)}`;

  if (stage === "write") {
    return (
      <div>
        <h1 ref={titleRef} tabIndex={-1} className="text-lg font-medium mb-2 outline-none">
          Explica «{conceptName}» con tus palabras
        </h1>
        <p className="text-sm text-muted-foreground mb-4">
          Escríbelo como si se lo contaras a un compañero. Intenta no mirar tus apuntes: traerlo de memoria es lo
          que más ayuda a aprenderlo. Después podrás compararlo.
        </p>
        <label htmlFor="explicacion" className="sr-only">
          Tu explicación
        </label>
        <textarea
          id="explicacion"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm mb-3"
        />
        <Button onClick={() => setStage("compare")} disabled={!text.trim()}>
          Comparar
        </Button>
      </div>
    );
  }

  if (stage === "compare") {
    return (
      <div aria-live="polite">
        <h1 ref={titleRef} tabIndex={-1} className="text-lg font-medium mb-4 outline-none">
          Compara tu explicación
        </h1>
        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <Card>
            <CardContent className="pt-6 text-sm">
              <p className="text-xs font-medium text-muted-foreground mb-2">Tu explicación</p>
              <p className="whitespace-pre-wrap">{text}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-sm flex flex-col gap-3">
              <p className="text-xs font-medium text-muted-foreground">Referencia validada por tu docente</p>
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
            </CardContent>
          </Card>
        </div>
        <p className="text-sm font-medium mb-2">¿Cómo te fue?</p>
        <p className="text-xs text-muted-foreground mb-3">
          Es solo para ti: no es una nota y no se guarda.
        </p>
        <div className="flex flex-wrap gap-2">
          {RATINGS.map((r) => (
            <Button
              key={r.value}
              variant="outline"
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
    );
  }

  return (
    <div aria-live="polite">
      <h1 ref={titleRef} tabIndex={-1} className="text-lg font-medium mb-2 outline-none">
        {rating === "bien" ? "¡Bien hecho!" : "Sigue practicando"}
      </h1>
      <p className="text-sm text-muted-foreground mb-4">
        {rating !== "bien"
          ? "Repasa la referencia y vuelve a intentarlo en un rato. Explicarlo otra vez de memoria es lo que lo fija."
          : hasQuestions
            ? "Compruébalo con preguntas: así sabrás si de verdad lo dominas."
            : "Tu docente aún no publicó preguntas para este concepto. Cuando las publique, podrás comprobarlo."}
      </p>
      <div className="flex flex-wrap gap-2">
        {rating === "bien" ? (
          hasQuestions && (
          <Link
            href={focusHref}
            className="inline-block rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium"
          >
            Compruébalo con preguntas
          </Link>
          )
        ) : (
          <Button onClick={restart}>Practicar otra vez</Button>
        )}
        <Link href={myBrujula} className="inline-block px-3 py-1.5 text-sm text-muted-foreground hover:underline">
          Volver a Mi Brújula
        </Link>
      </div>
    </div>
  );
}
