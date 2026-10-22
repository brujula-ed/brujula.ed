"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";
import { questions as fallbackQuestions, levelingContent as fallbackLeveling, subject as fallbackSubject } from "@/lib/data";
import { selectDiagnosticQuestions, selectMicroQuestions, type BankQuestion } from "@/lib/question-selection";

type Stage = "loading" | "quiz" | "gaps" | "leveling" | "microeval" | "comparison";
// correctIndex solo existe en la demostración: con preguntas reales la respuesta correcta nunca llega al navegador
type Question = BankQuestion & { concept: string; prompt: string; options: string[]; correctIndex?: number };
type Gap = { conceptId: string; name: string };

// Fila que devuelve la función get_diagnostic_questions (supabase/migrations)
type BankRow = {
  id: string;
  concept_id: string;
  concept_name: string;
  concept_description: string | null;
  prompt: string;
  options: string[];
  last_answered_at: string | null;
};

export default function Diagnostico() {
  const router = useRouter();
  const params = useParams();
  const subjectId = params.subjectId as string;
  const supabase = createClient();

  const [stage, setStage] = useState<Stage>("loading");
  const [usingFallback, setUsingFallback] = useState(false);
  const [subjectInfo, setSubjectInfo] = useState<{ name: string; topic: string }>({ name: "", topic: "" });
  const [bank, setBank] = useState<Question[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [levelingContent, setLevelingContent] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);

  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [microQuestions, setMicroQuestions] = useState<Question[]>([]);
  const [microResults, setMicroResults] = useState<boolean[]>([]);
  const [microCurrent, setMicroCurrent] = useState(0);
  const [conceptsWithoutMicro, setConceptsWithoutMicro] = useState<string[]>([]);
  const [focusConcept, setFocusConcept] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // El estado tarda un render en llegar a los botones; la ref bloquea el segundo clic de inmediato
  const savingRef = useRef(false);
  // Enunciado de la pregunta actual: recibe el foco en cada pregunta nueva (ver el useEffect de abajo)
  const promptRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    async function loadData() {
      const focus = new URLSearchParams(window.location.search).get("concepto");
      const { data: subjectData } = await supabase.from("subjects").select("name, topic").eq("id", subjectId).single();

      const { data: bankData, error: questionsError } = await supabase.rpc("get_diagnostic_questions", {
        p_subject_id: subjectId,
      });

      // Un error no es lo mismo que "no hay preguntas": no mostrar la demostración en ese caso
      if (questionsError) {
        console.error("Diagnóstico: no se pudieron cargar las preguntas:", questionsError);
        setLoadError("No pudimos cargar el diagnóstico. Recarga la página para intentarlo de nuevo.");
        return;
      }

      const rows = (bankData ?? []) as BankRow[];
      const isFallback = rows.length === 0;
      if (!isFallback) {
        const fullBank: Question[] = rows.map((r) => ({
          id: r.id,
          conceptId: r.concept_id,
          concept: r.concept_name,
          prompt: r.prompt,
          options: r.options,
          lastAnsweredAt: r.last_answered_at,
        }));
        const levelingMap: Record<string, string> = {};
        rows.forEach((r) => (levelingMap[r.concept_id] = r.concept_description ?? ""));
        const focused = focus ? fullBank.filter((q) => q.concept === focus) : [];
        setBank(fullBank);
        setQuestions(selectDiagnosticQuestions(focused.length > 0 ? focused : fullBank));
        setFocusConcept(focused.length > 0 ? focus : null);
        setLevelingContent(levelingMap);
        setSubjectInfo(subjectData ?? { name: "", topic: "" });
        setUsingFallback(false);
      } else {
        // En la demostración el nombre del concepto hace de id
        const demoBank: Question[] = fallbackQuestions.map((q) => ({ ...q, conceptId: q.concept, lastAnsweredAt: null }));
        setBank(demoBank);
        setQuestions(selectDiagnosticQuestions(demoBank));
        setLevelingContent(fallbackLeveling);
        setSubjectInfo(subjectData ?? fallbackSubject);
        setUsingFallback(true);
      }

      // La demostración no se guarda: no es evidencia real del estudiante y no debe contar en los reportes
      const { data: { user } } = await supabase.auth.getUser();
      if (user && !isFallback) {
        const { data: attempt, error: attemptError } = await supabase
          .from("diagnostic_attempts")
          .insert({ user_id: user.id, subject: subjectData?.name ?? fallbackSubject.name, topic: subjectData?.topic ?? fallbackSubject.topic, subject_id: subjectId })
          .select()
          .single();
        // Sin intento no se guardaría ninguna respuesta: mejor no empezar
        if (attemptError || !attempt) {
          setLoadError("No pudimos iniciar el diagnóstico. Recarga la página para intentarlo de nuevo.");
          return;
        }
        setAttemptId(attempt.id);
      }

      setStage("quiz");
    }
    loadData();
  }, [subjectId]);

  // Al pasar de pregunta, el botón pulsado desaparece y el foco se perdería: se lleva al nuevo enunciado
  // para que el teclado siga en su sitio y los lectores de pantalla lean la pregunta nueva.
  useEffect(() => {
    if (stage === "quiz" || stage === "microeval") promptRef.current?.focus();
  }, [stage, current, microCurrent]);

  function scoreByConcept(resultList: boolean[]) {
    const byConcept = new Map<string, { name: string; correct: number; total: number }>();
    questions.forEach((q, i) => {
      const score = byConcept.get(q.conceptId) ?? { name: q.concept, correct: 0, total: 0 };
      score.total += 1;
      if (resultList[i]) score.correct += 1;
      byConcept.set(q.conceptId, score);
    });
    return byConcept;
  }

  async function withSaving(action: () => Promise<void>) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await action();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  // Devuelve si acertó, o null si no se pudo guardar.
  // Con preguntas reales decide la base de datos (submit_answer); en la demostración se corrige aquí y no se guarda.
  async function checkAnswer(
    q: Question,
    answerStage: "diagnostico" | "microevaluacion",
    optionIndex: number
  ): Promise<boolean | null> {
    if (usingFallback) return optionIndex === q.correctIndex;
    if (!attemptId) {
      setSaveError("No pudimos guardar tu respuesta. Recarga la página para iniciar el diagnóstico de nuevo.");
      return null;
    }
    const { data, error } = await supabase.rpc("submit_answer", {
      p_attempt_id: attemptId,
      p_question_id: q.id,
      p_stage: answerStage,
      p_selected_index: optionIndex,
    });
    if (error || typeof data !== "boolean") {
      console.error("Diagnóstico: no se pudo guardar la respuesta:", error);
      setSaveError("No pudimos guardar tu respuesta. Revisa tu conexión y vuelve a elegir una opción.");
      return null;
    }
    return data;
  }

  async function finishDiagnostic() {
    if (attemptId) {
      const { error } = await supabase
        .from("diagnostic_attempts")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", attemptId);
      if (error) {
        setSaveError("No pudimos cerrar el diagnóstico. Revisa tu conexión y vuelve a intentarlo.");
        return;
      }
    }
    setSaveError(null);
    setStage("gaps");
  }

  async function handleAnswer(optionIndex: number) {
    const correct = await checkAnswer(questions[current], "diagnostico", optionIndex);
    if (correct === null) return;
    setSaveError(null);
    setResults([...results, correct]);
    if (current + 1 < questions.length) {
      setCurrent(current + 1);
    } else {
      await finishDiagnostic();
    }
  }

  // Preguntas nuevas para cada brecha; las del diagnóstico de este intento quedan fuera
  function startMicroeval(gapList: Gap[]) {
    const seen = new Set(questions.map((q) => q.id));
    const { questions: selected, conceptsWithoutQuestions } = selectMicroQuestions(
      bank,
      gapList.map((g) => g.conceptId),
      seen
    );
    setMicroQuestions(selected);
    setConceptsWithoutMicro(conceptsWithoutQuestions);
    setStage(selected.length > 0 ? "microeval" : "comparison");
  }

  async function handleMicroAnswer(optionIndex: number) {
    const correct = await checkAnswer(microQuestions[microCurrent], "microevaluacion", optionIndex);
    if (correct === null) return;
    setSaveError(null);
    setMicroResults([...microResults, correct]);
    if (microCurrent + 1 < microQuestions.length) {
      setMicroCurrent(microCurrent + 1);
    } else {
      setStage("comparison");
    }
  }

    function handleExit() {
    const inProgress = stage === "quiz" || stage === "microeval";
    if (
      inProgress &&
      !confirm("Si sales ahora, este diagnóstico quedará incompleto y tendrás que empezar de nuevo. ¿Salir?")
    ) {
      return;
    }
    router.push(`/estudiante/${subjectId}`);
  }

  const exitButton = (
    <button onClick={handleExit} className="text-sm text-muted-foreground hover:underline mb-4 inline-block">
      ← Salir del diagnóstico
    </button>
  );

  if (stage === "loading") {
    return (
      <main className="max-w-xl mx-auto p-8">
        {loadError ? (
          <p role="alert" className="text-sm text-destructive">{loadError}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Cargando diagnóstico...</p>
        )}
      </main>
    );
  }

  const initialScores = scoreByConcept(results);
  const gaps: Gap[] = Array.from(initialScores.entries())
    .filter(([, v]) => v.correct / v.total < 0.7)
    .map(([conceptId, v]) => ({ conceptId, name: v.name }));

  const fallbackBanner = usingFallback && (
    <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-md px-3 py-2 mb-4">
      Contenido de demostración — tu docente aún no publicó preguntas validadas para este tema.
    </div>
  );

  const saveErrorMessage = saveError && (
    <p role="alert" className="text-sm text-destructive mb-4">{saveError}</p>
  );

  if (stage === "quiz") {
    const q = questions[current];
    // Todas respondidas pero sin cerrar: solo falta reintentar el cierre, no volver a responder
    const allAnswered = results.length === questions.length;
    return (
      <main className="max-w-xl mx-auto p-8">
        {exitButton}
        <div className="mt-6 pt-6 border-t">
      </div>
        {fallbackBanner}
        <p className="text-xs text-muted-foreground mb-2">
                  {focusConcept ? `Práctica — ${focusConcept}` : `Diagnóstico — ${subjectInfo.name}`} · pregunta {current + 1} de {questions.length}
        </p>
        <Progress value={(current / questions.length) * 100} className="mb-6" />
        {saveErrorMessage}
        <Card>
          <CardContent className="pt-6">
            <p ref={promptRef} tabIndex={-1} className="text-base font-medium mb-4 outline-none">
              {q.prompt}
            </p>
            {allAnswered ? (
              <Button onClick={() => withSaving(finishDiagnostic)} disabled={saving}>Reintentar</Button>
            ) : (
              <div className="flex flex-col gap-2">
                {q.options.map((opt, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="justify-start"
                    onClick={() => withSaving(() => handleAnswer(i))}
                    disabled={saving}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    );
  }

  if (stage === "gaps") {
    return (
      <main className="max-w-xl mx-auto p-8">
        {exitButton}
        {fallbackBanner}
        <h1 className="text-lg font-medium mb-4">Tus resultados</h1>
        <div className="flex flex-col gap-3 mb-6">
          {Array.from(initialScores.entries()).map(([conceptId, v]) => (
            <Card key={conceptId}>
              <CardContent className="pt-4 flex items-center justify-between">
                <span className="text-sm">{v.name}</span>
                <span className={`text-sm font-medium ${v.correct / v.total < 0.7 ? "text-state-gap" : "text-state-mastered"}`}>
                  {Math.round((v.correct / v.total) * 100)}%
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {gaps.length > 0
            ? `Detectamos brechas en: ${gaps.map((g) => g.name).join(", ")}.`
            : "No se detectaron brechas importantes."}
        </p>
        <Button onClick={() => setStage(gaps.length > 0 ? "leveling" : "comparison")}>Continuar</Button>
      </main>
    );
  }

  if (stage === "leveling") {
    return (
      <main className="max-w-xl mx-auto p-8">
        {exitButton}
        {fallbackBanner}
        <h1 className="text-lg font-medium mb-4">Ruta de nivelación</h1>
        <div className="flex flex-col gap-4 mb-6">
          {gaps.map((g) => (
            <Card key={g.conceptId}>
              <CardContent className="pt-4">
                <p className="text-sm font-medium mb-2">{g.name}</p>
                <p className="text-sm text-muted-foreground">{levelingContent[g.conceptId]}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Button onClick={() => startMicroeval(gaps)}>Ya repasé, continuar</Button>
      </main>
    );
  }

  if (stage === "microeval") {
    const q = microQuestions[microCurrent];
    return (
      <main className="max-w-xl mx-auto p-8">
        {exitButton}
        {fallbackBanner}
        <p className="text-xs text-muted-foreground mb-2">
          Microevaluación · pregunta {microCurrent + 1} de {microQuestions.length}
        </p>
        {saveErrorMessage}
        <Card>
          <CardContent className="pt-6">
            <p ref={promptRef} tabIndex={-1} className="text-base font-medium mb-4 outline-none">
              {q.prompt}
            </p>
            <div className="flex flex-col gap-2">
              {q.options.map((opt, i) => (
                <Button
                  key={i}
                  variant="outline"
                  className="justify-start"
                  onClick={() => withSaving(() => handleMicroAnswer(i))}
                  disabled={saving}
                >
                  {opt}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const initialPct = Math.round((results.filter(Boolean).length / questions.length) * 100);
  const microPct =
    microQuestions.length > 0 ? Math.round((microResults.filter(Boolean).length / microQuestions.length) * 100) : null;
  const withoutMicroNames = conceptsWithoutMicro.map((id) => initialScores.get(id)?.name ?? id);

  return (
    <main className="max-w-xl mx-auto p-8">
      {fallbackBanner}
      <h1 className="text-lg font-medium mb-4">Antes y después</h1>
      <div className="flex gap-4 mb-6">
        <Card className="flex-1">
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Diagnóstico inicial</p>
            <p className="text-2xl font-medium">{initialPct}%</p>
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
      {withoutMicroNames.length > 0 && (
        <p className="text-sm text-muted-foreground mb-6">
          No hay preguntas nuevas de {withoutMicroNames.map((n) => `«${n}»`).join(", ")} para comprobar tu avance.
          Esas brechas quedan pendientes hasta que tu docente valide más preguntas.
        </p>
      )}
      <Button variant="outline" onClick={() => router.push("/estudiante")}>
        Volver a mis asignaturas
      </Button>
    </main>
  );
}
