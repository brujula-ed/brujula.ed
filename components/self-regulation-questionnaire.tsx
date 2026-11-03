"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleAlert, EyeOff, Lightbulb, Save, Share2, Trash2, Users } from "lucide-react";
import { cn } from "cn";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ActionBar } from "@/components/action-bar";
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
const ADVANCE_MS = 220; // al elegir, se ve la opción marcada un instante antes de pasar a la siguiente frase

// Borrador en el navegador: si el estudiante sale a mitad, retoma donde quedó. Es solo una comodidad: puede no estar
// (navegación privada, datos borrados) y nunca llega a la base de datos hasta que envía todas las respuestas.
const draftKey = (userId: string) => `srl-draft:${INSTRUMENT_VERSION}:${userId}`;
function readDraft(userId: string): SrlAnswers {
  try {
    const raw = localStorage.getItem(draftKey(userId));
    return raw ? (JSON.parse(raw) as SrlAnswers) : {};
  } catch {
    return {};
  }
}
function writeDraft(userId: string, answers: SrlAnswers | null) {
  try {
    if (answers) localStorage.setItem(draftKey(userId), JSON.stringify(answers));
    else localStorage.removeItem(draftKey(userId));
  } catch {
    // Sin almacenamiento disponible: el cuestionario funciona igual, sin retomar
  }
}

// "¿Cómo aprendes?" (F-08, versión preliminar). Presentación → una frase por pantalla → resultado orientativo, con la
// opción de compartirlo con el docente de cada asignatura y de borrar las respuestas.
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
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState(latest);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shared, setShared] = useState<Set<string>>(new Set(sharedSubjectIds));
  const [shareError, setShareError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Al cambiar de etapa o de frase el foco va al título: teclado y lectores de pantalla siguen el paso
  useEffect(() => {
    heading.current?.focus();
  }, [stage, current]);

  useEffect(() => () => {
    if (advance.current) clearTimeout(advance.current);
  }, []);

  const answeredCount = ITEMS.filter((item) => answers[String(item.id)] !== undefined).length;
  const complete = answeredCount === ITEMS.length;
  const item = ITEMS[current];
  const isLast = current === ITEMS.length - 1;

  // Empieza o retoma: con borrador, va a la primera frase sin responder
  function start() {
    const draft = readDraft(userId);
    const firstOpen = ITEMS.findIndex((i) => draft[String(i.id)] === undefined);
    setAnswers(draft);
    setCurrent(firstOpen === -1 ? ITEMS.length - 1 : firstOpen);
    setError("");
    setStage("questions");
  }

  function choose(value: number) {
    const next = { ...answers, [String(item.id)]: value };
    setAnswers(next);
    writeDraft(userId, next);
    if (advance.current) clearTimeout(advance.current);
    if (!isLast) advance.current = setTimeout(() => setCurrent((i) => Math.min(i + 1, ITEMS.length - 1)), ADVANCE_MS);
  }

  function go(step: -1 | 1) {
    if (advance.current) clearTimeout(advance.current);
    setCurrent((i) => Math.max(0, Math.min(ITEMS.length - 1, i + step)));
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
    writeDraft(userId, null);
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
    writeDraft(userId, null);
    setShared(new Set());
    setResult(null);
    setStage("intro");
    router.refresh();
  }

  const errorMessage = error && (
    <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
      <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
      {error}
    </p>
  );

  if (stage === "intro") {
    return (
      <section aria-labelledby="srl-title" className="flex flex-col gap-5 pb-28 md:pb-0">
        <div className="flex flex-col gap-2">
          <h2 id="srl-title" ref={heading} tabIndex={-1} className="text-section outline-none">
            Antes de empezar
          </h2>
          <p className="text-base">
            Son {ITEMS.length} frases sobre cómo estudias. En cada una, elige cuánto te describe, del 1 (
            {RESPONSE_ENDS.min.toLowerCase()}) al 5 ({RESPONSE_ENDS.max.toLowerCase()}). No hay respuestas buenas ni
            malas, y te llevará unos 10 a 15 minutos.
          </p>
          <p className="text-sm text-muted-foreground">
            Al terminar verás cómo te va en dos aspectos de tu forma de aprender, con sugerencias para mejorar.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <h3 className="font-medium">Qué pasa con tus respuestas</h3>
            <ul className="flex flex-col gap-3 text-sm">
              <Fact icon={Save}>Se guardan para que puedas volver a ver tu resultado.</Fact>
              <Fact icon={EyeOff}>
                Tus docentes nunca ven tus respuestas. Solo ven un resumen de toda la clase, y solo si respondieron
                al menos 5 personas.
              </Fact>
              <Fact icon={Share2}>
                Si quieres, después puedes compartir tu resultado (no tus respuestas) con el docente de cada
                asignatura.
              </Fact>
              <Fact icon={Trash2}>Es voluntario. Puedes borrar tus respuestas cuando quieras.</Fact>
            </ul>
          </CardContent>
        </Card>

        <ActionBar>
          <Button onClick={start}>Empezar</Button>
        </ActionBar>
      </section>
    );
  }

  if (stage === "questions") {
    const value = answers[String(item.id)];
    return (
      <section aria-labelledby="srl-title" className="flex flex-col gap-5 pb-28 md:pb-0">
        <div className="flex items-center justify-between gap-3">
          <p role="status" className="text-sm text-muted-foreground">
            Frase {current + 1} de {ITEMS.length}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setStage(result ? "result" : "intro")}>
            Salir
          </Button>
        </div>
        <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-(--duration-medium) ease-out-soft"
            style={{ width: `${(answeredCount / ITEMS.length) * 100}%` }}
          />
        </div>

        <h2 id="srl-title" ref={heading} tabIndex={-1} className="text-subsection outline-none">
          {item.text}
        </h2>

        <div role="radiogroup" aria-labelledby="srl-title" className="flex flex-col gap-2">
          {VALUES.map((v) => {
            const end = v === RESPONSE_MIN ? RESPONSE_ENDS.min : v === RESPONSE_MAX ? RESPONSE_ENDS.max : null;
            const isSelected = value === v;
            return (
              <button
                key={v}
                role="radio"
                aria-checked={isSelected}
                aria-label={end ? `${v}, ${end}` : String(v)}
                onClick={() => choose(v)}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-control border bg-card px-4 py-3 text-left text-base transition-colors duration-(--duration-instant) hover:border-primary/60",
                  isSelected ? "border-primary bg-secondary/60" : "border-border"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                    isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  )}
                >
                  {v}
                </span>
                {end && <span className="text-sm text-muted-foreground">{end}</span>}
              </button>
            );
          })}
        </div>

        {errorMessage}

        <ActionBar>
          <Button variant="outline" onClick={() => go(-1)} disabled={current === 0 || loading}>
            <ArrowLeft aria-hidden="true" />
            Anterior
          </Button>
          {isLast || complete ? (
            <Button onClick={handleSubmit} disabled={!complete || loading}>
              {loading ? "Guardando..." : complete ? "Ver mi resultado" : `Faltan ${ITEMS.length - answeredCount}`}
            </Button>
          ) : (
            <Button onClick={() => go(1)} disabled={value === undefined}>
              Siguiente
              <ArrowRight aria-hidden="true" />
            </Button>
          )}
        </ActionBar>
      </section>
    );
  }

  const scores = result ? computeScores(result.answers) : null;
  return (
    <section aria-labelledby="srl-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 id="srl-title" ref={heading} tabIndex={-1} className="text-section outline-none">
          Tu forma de aprender
        </h2>
        {result && (
          <p className="text-sm text-muted-foreground">
            Respondiste el {new Date(result.createdAt).toLocaleDateString("es", { day: "numeric", month: "long" })}.
            Es orientativo: describe cómo dices que estudias, no cuánto sabes.
          </p>
        )}
      </div>

      {scores && (
        <div className="flex flex-col gap-4">
          {SCALES.map((scale) => {
            const band = bandFor(scores[scale]);
            return (
              <Card key={scale}>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-subsection">{SCALE_LABEL[scale]}</h3>
                    <p className="text-sm text-muted-foreground">{SCALE_DESCRIPTION[scale]}</p>
                  </div>
                  <p className="text-sm">
                    <span className="font-medium">{BAND_LABEL[band]}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · promedio {scores[scale].toFixed(1).replace(".", ",")} de {RESPONSE_MAX}
                    </span>
                  </p>
                  <p className="flex items-start gap-2 rounded-control bg-secondary/60 p-3 text-sm">
                    <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                    {SUGGESTIONS[scale][band]}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {result && subjects.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h3 className="flex items-center gap-2 font-medium">
                <Users aria-hidden="true" className="size-4 text-primary" />
                Compartir con tus docentes
              </h3>
              <p className="text-sm text-muted-foreground">
                Tu docente verá tus dos resultados (tramo y promedio), no tus respuestas. Puedes dejar de compartir
                cuando quieras.
              </p>
            </div>
            <ul className="flex flex-col gap-1">
              {subjects.map((s) => (
                <li key={s.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-1 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={shared.has(s.id)}
                      onChange={(e) => toggleShare(s.id, e.target.checked)}
                      className="size-5 shrink-0 accent-primary"
                    />
                    <span className="min-w-0 break-words">{s.name}</span>
                  </label>
                </li>
              ))}
            </ul>
            {shareError && (
              <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
                <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
                {shareError}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {errorMessage}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={start} disabled={loading}>
          Responder de nuevo
        </Button>
        <Button variant="ghost" onClick={handleDelete} disabled={loading}>
          Borrar mis respuestas
        </Button>
      </div>
    </section>
  );
}

function Fact({ icon: Icon, children }: { icon: typeof Save; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  );
}
