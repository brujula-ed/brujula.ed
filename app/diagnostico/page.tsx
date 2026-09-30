"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { questions, levelingContent, subject } from "@/lib/data";

type Stage = "quiz" | "gaps" | "leveling" | "microeval" | "comparison";

export default function Diagnostico() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("quiz");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [microAnswers, setMicroAnswers] = useState<number[]>([]);
  const [microCurrent, setMicroCurrent] = useState(0);

  function scoreByConcept(answerList: number[]) {
    const byConcept: Record<string, { correct: number; total: number }> = {};
    questions.forEach((q, i) => {
      byConcept[q.concept] ??= { correct: 0, total: 0 };
      byConcept[q.concept].total += 1;
      if (answerList[i] === q.correctIndex) byConcept[q.concept].correct += 1;
    });
    return byConcept;
  }

  function handleAnswer(optionIndex: number) {
    const next = [...answers, optionIndex];
    setAnswers(next);
    if (current + 1 < questions.length) {
      setCurrent(current + 1);
    } else {
      setStage("gaps");
    }
  }

  function handleMicroAnswer(optionIndex: number) {
    const next = [...microAnswers, optionIndex];
    setMicroAnswers(next);
    const gapQuestions = questions.filter((q) => gaps.includes(q.concept));
    if (microCurrent + 1 < gapQuestions.length) {
      setMicroCurrent(microCurrent + 1);
    } else {
      setStage("comparison");
    }
  }

  const initialScores = scoreByConcept(answers);
  const gaps = Object.entries(initialScores)
    .filter(([, v]) => v.correct / v.total < 0.7)
    .map(([concept]) => concept);

  if (stage === "quiz") {
    const q = questions[current];
    return (
      <main className="max-w-xl mx-auto p-8">
        <p className="text-xs text-muted-foreground mb-2">
          Diagnóstico — {subject.name} · pregunta {current + 1} de {questions.length}
        </p>
        <Progress value={((current) / questions.length) * 100} className="mb-6" />
        <Card>
          <CardContent className="pt-6">
            <p className="text-base font-medium mb-4">{q.prompt}</p>
            <div className="flex flex-col gap-2">
              {q.options.map((opt, i) => (
                <Button key={i} variant="outline" className="justify-start" onClick={() => handleAnswer(i)}>
                  {opt}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (stage === "gaps") {
    return (
      <main className="max-w-xl mx-auto p-8">
        <h1 className="text-lg font-medium mb-4">Tus resultados</h1>
        <div className="flex flex-col gap-3 mb-6">
          {Object.entries(initialScores).map(([concept, v]) => (
            <Card key={concept}>
              <CardContent className="pt-4 flex items-center justify-between">
                <span className="text-sm">{concept}</span>
                <span className={`text-sm font-medium ${v.correct / v.total < 0.7 ? "text-red-500" : "text-green-600"}`}>
                  {Math.round((v.correct / v.total) * 100)}%
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {gaps.length > 0
            ? `Detectamos brechas en: ${gaps.join(", ")}.`
            : "No se detectaron brechas importantes."}
        </p>
        <Button onClick={() => setStage(gaps.length > 0 ? "leveling" : "comparison")}>
          Continuar
        </Button>
      </main>
    );
  }

  if (stage === "leveling") {
    return (
      <main className="max-w-xl mx-auto p-8">
        <h1 className="text-lg font-medium mb-4">Ruta de nivelación</h1>
        <div className="flex flex-col gap-4 mb-6">
          {gaps.map((concept) => (
            <Card key={concept}>
              <CardContent className="pt-4">
                <p className="text-sm font-medium mb-2">{concept}</p>
                <p className="text-sm text-muted-foreground">{levelingContent[concept]}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Button onClick={() => setStage("microeval")}>Ya repasé, continuar</Button>
      </main>
    );
  }

  if (stage === "microeval") {
    const gapQuestions = questions.filter((q) => gaps.includes(q.concept));
    const q = gapQuestions[microCurrent];
    return (
      <main className="max-w-xl mx-auto p-8">
        <p className="text-xs text-muted-foreground mb-2">
          Microevaluación · pregunta {microCurrent + 1} de {gapQuestions.length}
        </p>
        <Card>
          <CardContent className="pt-6">
            <p className="text-base font-medium mb-4">{q.prompt}</p>
            <div className="flex flex-col gap-2">
              {q.options.map((opt, i) => (
                <Button key={i} variant="outline" className="justify-start" onClick={() => handleMicroAnswer(i)}>
                  {opt}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  // stage === "comparison"
  const gapQuestions = questions.filter((q) => gaps.includes(q.concept));
  const microCorrect = microAnswers.filter((a, i) => a === gapQuestions[i]?.correctIndex).length;
  const microPct = gapQuestions.length > 0 ? Math.round((microCorrect / gapQuestions.length) * 100) : null;

  return (
    <main className="max-w-xl mx-auto p-8">
      <h1 className="text-lg font-medium mb-4">Antes y después</h1>
      <div className="flex gap-4 mb-6">
        <Card className="flex-1">
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Diagnóstico inicial</p>
            <p className="text-2xl font-medium">
              {Math.round((answers.filter((a, i) => a === questions[i].correctIndex).length / questions.length) * 100)}%
            </p>
          </CardContent>
        </Card>
        {microPct !== null && (
          <Card className="flex-1">
            <CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Después de nivelar</p>
              <p className="text-2xl font-medium text-green-600">{microPct}%</p>
            </CardContent>
          </Card>
        )}
      </div>
      <Button variant="outline" onClick={() => router.push("/")}>
        Volver al inicio
      </Button>
    </main>
  );
}