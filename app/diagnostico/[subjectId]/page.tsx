"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";
import { questions as fallbackQuestions, levelingContent as fallbackLeveling, subject as fallbackSubject } from "@/lib/data";

type Stage = "loading" | "quiz" | "gaps" | "leveling" | "microeval" | "comparison";
type Question = { id: string; concept: string; prompt: string; options: string[]; correctIndex: number };

export default function Diagnostico() {
  const router = useRouter();
  const params = useParams();
  const subjectId = params.subjectId as string;
  const supabase = createClient();

  const [stage, setStage] = useState<Stage>("loading");
  const [usingFallback, setUsingFallback] = useState(false);
  const [subjectInfo, setSubjectInfo] = useState<{ name: string; topic: string }>({ name: "", topic: "" });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [levelingContent, setLevelingContent] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [microAnswers, setMicroAnswers] = useState<number[]>([]);
  const [microCurrent, setMicroCurrent] = useState(0);

  useEffect(() => {
    async function loadData() {
      const { data: subjectData } = await supabase.from("subjects").select("name, topic").eq("id", subjectId).single();

      const { data: validQuestions } = await supabase
        .from("questions")
        .select("id, prompt, options, correct_index, concepts(id, name, description)")
        .eq("subject_id", subjectId)
        .eq("status", "validado");

      if (validQuestions && validQuestions.length > 0) {
        const mapped: Question[] = validQuestions.map((q) => {
          const concept = Array.isArray(q.concepts) ? q.concepts[0] : q.concepts;
          return {
            id: q.id,
            concept: concept?.name ?? "General",
            prompt: q.prompt,
            options: q.options as string[],
            correctIndex: q.correct_index,
          };
        });
        const levelingMap: Record<string, string> = {};
        validQuestions.forEach((q) => {
          const concept = Array.isArray(q.concepts) ? q.concepts[0] : q.concepts;
          if (concept) levelingMap[concept.name] = concept.description ?? "";
        });
        setQuestions(mapped);
        setLevelingContent(levelingMap);
        setSubjectInfo(subjectData ?? { name: "", topic: "" });
        setUsingFallback(false);
      } else {
        setQuestions(fallbackQuestions);
        setLevelingContent(fallbackLeveling);
        setSubjectInfo(subjectData ?? fallbackSubject);
        setUsingFallback(true);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: attempt } = await supabase
          .from("diagnostic_attempts")
          .insert({ user_id: user.id, subject: subjectData?.name ?? fallbackSubject.name, topic: subjectData?.topic ?? fallbackSubject.topic, subject_id: subjectId })
          .select()
          .single();
        if (attempt) setAttemptId(attempt.id);
      }

      setStage("quiz");
    }
    loadData();
  }, [subjectId]);

  function scoreByConcept(answerList: number[]) {
    const byConcept: Record<string, { correct: number; total: number }> = {};
    questions.forEach((q, i) => {
      byConcept[q.concept] ??= { correct: 0, total: 0 };
      byConcept[q.concept].total += 1;
      if (answerList[i] === q.correctIndex) byConcept[q.concept].correct += 1;
    });
    return byConcept;
  }

  async function handleAnswer(optionIndex: number) {
    const q = questions[current];
    if (attemptId) {
      await supabase.from("diagnostic_answers").insert({
        attempt_id: attemptId,
        stage: "diagnostico",
        question_id: q.id,
        concept: q.concept,
        selected_index: optionIndex,
        correct_index: q.correctIndex,
        is_correct: optionIndex === q.correctIndex,
      });
    }
    const next = [...answers, optionIndex];
    setAnswers(next);
    if (current + 1 < questions.length) {
      setCurrent(current + 1);
    } else {
      setStage("gaps");
    }
  }

  async function handleMicroAnswer(optionIndex: number) {
    const gapQuestions = questions.filter((q) => gaps.includes(q.concept));
    const q = gapQuestions[microCurrent];
    if (attemptId) {
      await supabase.from("diagnostic_answers").insert({
        attempt_id: attemptId,
        stage: "microevaluacion",
        question_id: q.id,
        concept: q.concept,
        selected_index: optionIndex,
        correct_index: q.correctIndex,
        is_correct: optionIndex === q.correctIndex,
      });
    }
    const next = [...microAnswers, optionIndex];
    setMicroAnswers(next);
    if (microCurrent + 1 < gapQuestions.length) {
      setMicroCurrent(microCurrent + 1);
    } else {
      setStage("comparison");
    }
  }

  if (stage === "loading") {
    return (
      <main className="max-w-xl mx-auto p-8">
        <p className="text-sm text-muted-foreground">Cargando diagnóstico...</p>
      </main>
    );
  }

  const initialScores = scoreByConcept(answers);
  const gaps = Object.entries(initialScores)
    .filter(([, v]) => v.correct / v.total < 0.7)
    .map(([concept]) => concept);

  const fallbackBanner = usingFallback && (
    <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-md px-3 py-2 mb-4">
      Contenido de demostración — tu docente aún no publicó preguntas validadas para este tema.
    </div>
  );

  if (stage === "quiz") {
    const q = questions[current];
    return (
      <main className="max-w-xl mx-auto p-8">
        {fallbackBanner}
        <p className="text-xs text-muted-foreground mb-2">
          Diagnóstico — {subjectInfo.name} · pregunta {current + 1} de {questions.length}
        </p>
        <Progress value={(current / questions.length) * 100} className="mb-6" />
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
        {fallbackBanner}
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
          {gaps.length > 0 ? `Detectamos brechas en: ${gaps.join(", ")}.` : "No se detectaron brechas importantes."}
        </p>
        <Button onClick={() => setStage(gaps.length > 0 ? "leveling" : "comparison")}>Continuar</Button>
      </main>
    );
  }

  if (stage === "leveling") {
    return (
      <main className="max-w-xl mx-auto p-8">
        {fallbackBanner}
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
        {fallbackBanner}
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

  const gapQuestions = questions.filter((q) => gaps.includes(q.concept));
  const microCorrect = microAnswers.filter((a, i) => a === gapQuestions[i]?.correctIndex).length;
  const microPct = gapQuestions.length > 0 ? Math.round((microCorrect / gapQuestions.length) * 100) : null;

  return (
    <main className="max-w-xl mx-auto p-8">
      {fallbackBanner}
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
      <Button variant="outline" onClick={() => router.push("/estudiante")}>
        Volver a mis asignaturas
      </Button>
    </main>
  );
}