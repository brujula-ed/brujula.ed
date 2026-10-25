"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  BAND_LABEL,
  INSTRUMENT_VERSION,
  ITEMS,
  RESPONSE_ENDS,
  RESPONSE_MAX,
  RESPONSE_MIN,
  SCALE_DESCRIPTION,
  SCALE_LABEL,
  SUGGESTIONS,
  bandFor,
  computeScores,
  type SrlAnswers,
  type SrlScale,
} from "@/lib/self-regulation";

type Stage = "intro" | "questions" | "result";

const VALUES = Array.from({ length: RESPONSE_MAX - RESPONSE_MIN + 1 }, (_, i) => RESPONSE_MIN + i);
const SCALES: SrlScale[] = ["conocimiento", "regulacion"];

const preliminaryBanner = (
  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-md px-3 py-2 mb-4">
    Versión preliminar en revisión por especialistas. Los resultados son orientativos: no son una nota ni un
    diagnóstico.
  </div>
);

export function SelfRegulationQuestionnaire({
  userId,
  latest,
  subjects,
  sharedSubjectIds,
}: {
  userId: string;
  latest: { answers: SrlAnswers; createdAt: string } | null;
  subjects: { id: string; name: string }[]; // asignaturas en las que está inscrito
  sharedSubjectIds: string[]; // con cuáles comparte su resultado
}) {
  const router = useRouter();
  const supabase = createClient();
  const [stage, setStage] = useState<Stage>(latest ? "result" : "intro");
  const [answers, setAnswers] = useState<SrlAnswers>({});
  const [result, setResult] = useState(latest);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shared, setShared] = useState<Set<string>>(new Set(sharedSubjectIds));
  const [shareError, setShareError] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Al cambiar de etapa el foco va al título, para que teclado y lectores de pantalla sigan el paso
  useEffect(() => {
    titleRef.current?.focus();
  }, [stage]);

  const answeredCount = ITEMS.filter((item) => answers[String(item.id)] !== undefined).length;
  const complete = answeredCount === ITEMS.length;

  function start() {
    setAnswers({});
    setError("");
    setStage("questions");
  }

  async function handleSubmit() {
    if (!complete) return;
    setLoading(true);
    setError("");
    // La base de datos valida versión, ítems y valores; no se puede guardar a medias
    const { error: submitError } = await supabase.rpc("submit_self_regulation", {
      p_version: INSTRUMENT_VERSION,
      p_answers: answers,
    });
    setLoading(false);
    if (submitError) {
      setError("No se pudieron guardar tus respuestas. Inténtalo de nuevo.");
      return;
    }
    setResult({ answers, createdAt: new Date().toISOString() });
    setStage("result");
    router.refresh();
  }

  // Se piden de vuelta las filas afectadas: si la RLS bloquea la operación, Supabase no da error,
  // simplemente no cambia nada. 0 filas = no se guardó.
  async function toggleShare(subjectId: string, share: boolean) {
    setShareError("");
    const { data, error: shareFail } = share
      ? await supabase.from("self_regulation_shares").insert({ subject_id: subjectId }).select("subject_id")
      : await supabase
          .from("self_regulation_shares")
          .delete()
          .eq("student_id", userId)
          .eq("subject_id", subjectId)
          .select("subject_id");
    if (shareFail || !data?.length) {
      setShareError("No se pudo guardar tu elección. Inténtalo de nuevo.");
      return;
    }
    setShared((prev) => {
      const next = new Set(prev);
      if (share) next.add(subjectId);
      else next.delete(subjectId);
      return next;
    });
  }

  async function handleDelete() {
    if (!confirm("¿Borrar todas tus respuestas de este cuestionario? No se puede deshacer.")) return;
    setLoading(true);
    setError("");
    const { error: deleteError } = await supabase
      .from("self_regulation_responses")
      .delete()
      .eq("user_id", userId)
      .select("id");
    // Sin respuestas no hay nada que compartir: se borran también los permisos
    const { error: sharesError } = await supabase.from("self_regulation_shares").delete().eq("student_id", userId);
    setLoading(false);
    if (deleteError || sharesError) {
      setError("No se pudieron borrar tus respuestas. Inténtalo de nuevo.");
      return;
    }
    setShared(new Set());
    setResult(null);
    setStage("intro");
    router.refresh();
  }

  const errorMessage = error && <p role="alert" className="text-sm text-destructive mb-4">{error}</p>;

  if (stage === "intro") {
    return (
      <div>
        <h1 ref={titleRef} tabIndex={-1} className="text-lg font-medium mb-2 outline-none">
          ¿Cómo aprendes?
        </h1>
        {preliminaryBanner}
        <div className="text-sm flex flex-col gap-3 mb-6">
          <p>
            Son {ITEMS.length} frases sobre cómo estudias. Indica en qué medida cada una te describe, del 1 (
            {RESPONSE_ENDS.min.toLowerCase()}) al 5 ({RESPONSE_ENDS.max.toLowerCase()}). Te llevará unos 10 a 15
            minutos. No hay respuestas buenas ni malas.
          </p>
          <p>
            Al terminar verás cómo te va en dos aspectos de tu forma de aprender, con sugerencias para mejorar.
          </p>
          <div className="rounded-md border bg-card p-3">
            <p className="font-medium mb-1">Qué pasa con tus respuestas</p>
            <ul className="list-disc list-inside text-muted-foreground flex flex-col gap-1">
              <li>Se guardan para que puedas volver a ver tu resultado.</li>
              <li>
                Tus docentes solo ven un resumen de toda la clase, y solo si respondieron al menos 5 personas.
                Nunca ven tus respuestas.
              </li>
              <li>
                Si quieres, después podrás compartir tu resultado (no tus respuestas) con el docente de cada
                asignatura.
              </li>
              <li>Es voluntario. Puedes borrar tus respuestas cuando quieras.</li>
            </ul>
          </div>
        </div>
        <Button onClick={start}>Empezar</Button>
      </div>
    );
  }

  if (stage === "questions") {
    return (
      <div>
        <h1 ref={titleRef} tabIndex={-1} className="text-lg font-medium mb-2 outline-none">
          ¿Cómo aprendes?
        </h1>
        {preliminaryBanner}
        <p className="text-sm text-muted-foreground mb-4">
          1 = {RESPONSE_ENDS.min.toLowerCase()} · 5 = {RESPONSE_ENDS.max.toLowerCase()}
        </p>
        <ol className="flex flex-col gap-3 mb-6">
          {ITEMS.map((item, index) => {
            const labelId = `srl-item-${item.id}`;
            return (
              <li key={item.id}>
                <Card>
                  <CardContent className="pt-4">
                    <p id={labelId} className="text-sm mb-3">
                      {index + 1}. {item.text}
                    </p>
                    <RadioGroup
                      aria-labelledby={labelId}
                      value={answers[String(item.id)] !== undefined ? String(answers[String(item.id)]) : ""}
                      onValueChange={(value) =>
                        setAnswers((prev) => ({ ...prev, [String(item.id)]: Number(value) }))
                      }
                      className="flex gap-6"
                    >
                      {VALUES.map((v) => (
                        <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
                          <RadioGroupItem
                            value={String(v)}
                            aria-label={
                              v === RESPONSE_MIN
                                ? `${v}, ${RESPONSE_ENDS.min}`
                                : v === RESPONSE_MAX
                                  ? `${v}, ${RESPONSE_ENDS.max}`
                                  : String(v)
                            }
                          />
                          {v}
                        </label>
                      ))}
                    </RadioGroup>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
        {errorMessage}
        <div className="flex items-center gap-3">
          <Button onClick={handleSubmit} disabled={!complete || loading}>
            {loading ? "Guardando..." : "Ver mi resultado"}
          </Button>
          <span role="status" className="text-xs text-muted-foreground">
            Respondiste {answeredCount} de {ITEMS.length}
          </span>
        </div>
      </div>
    );
  }

  const scores = result ? computeScores(result.answers) : null;
  return (
    <div>
      <h1 ref={titleRef} tabIndex={-1} className="text-lg font-medium mb-2 outline-none">
        Tu forma de aprender
      </h1>
      {preliminaryBanner}
      {result && (
        <p className="text-xs text-muted-foreground mb-4">
          Respondido el {new Date(result.createdAt).toLocaleDateString("es")}
        </p>
      )}
      {scores && (
        <div className="flex flex-col gap-4 mb-6">
          {SCALES.map((scale) => {
            const band = bandFor(scores[scale]);
            return (
              <Card key={scale}>
                <CardContent className="pt-6 text-sm">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <p className="font-medium">{SCALE_LABEL[scale]}</p>
                    <p className="text-xs text-muted-foreground shrink-0">
                      {BAND_LABEL[band]} · promedio {scores[scale].toFixed(1).replace(".", ",")} de {RESPONSE_MAX}
                    </p>
                  </div>
                  <p className="text-muted-foreground mb-3">{SCALE_DESCRIPTION[scale]}</p>
                  <p>{SUGGESTIONS[scale][band]}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {result && subjects.length > 0 && (
        <Card className="mb-6">
          <CardContent className="pt-6 text-sm">
            <p className="font-medium mb-1">Compartir con tus docentes</p>
            <p className="text-muted-foreground mb-3">
              Tu docente verá tus dos resultados (tramo y promedio), no tus respuestas. Puedes dejar de compartir
              cuando quieras.
            </p>
            <div className="flex flex-col gap-2">
              {subjects.map((s) => (
                <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shared.has(s.id)}
                    onChange={(e) => toggleShare(s.id, e.target.checked)}
                    className="size-4 accent-primary"
                  />
                  {s.name}
                </label>
              ))}
            </div>
            {shareError && <p role="alert" className="text-xs text-destructive mt-2">{shareError}</p>}
          </CardContent>
        </Card>
      )}
      {errorMessage}
      <div className="flex flex-wrap gap-2">
        <Button onClick={start} disabled={loading}>Responder de nuevo</Button>
        <Button variant="ghost" onClick={handleDelete} disabled={loading}>Borrar mis respuestas</Button>
      </div>
    </div>
  );
}
