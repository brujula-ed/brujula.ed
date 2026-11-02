import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { JoinSubjectForm } from "@/components/join-subject-form";
import { describeNextStep } from "@/components/next-step-card";
import { GapCompass } from "@/components/gap-compass";
import { StateBar, stateSummary } from "@/components/state-bar";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { computeConceptEvidence, type ConceptState } from "@/lib/concept-state";
import { computeNextStep, type NextStep } from "@/lib/next-step";
import { computeLRR, summarizeGaps } from "@/lib/lrr";

type Subject = { id: string; name: string };
type SubjectProgress = {
  subject: Subject;
  counts: Partial<Record<ConceptState, number>> | null; // null: aún no hay conceptos validados
  step: NextStep | null;
  closed: string | null;
};

// Prioridad para "Por dónde seguir" (decisión de Sergio, 02/11/2026): una comprobación final que ya toca va primero
// (si pasa mucho tiempo, cuesta más recordarlo); después, la asignatura con más brechas abiertas; después, la que tiene
// algo nuevo que probar; y al final, la que solo pide repasar. Sin conceptos o sin preguntas no se sugiere.
const RANK: Record<NextStep["kind"], number | null> = {
  final: 0,
  comprobar: 1,
  brecha: 1,
  confirmar: 2,
  tema: 2,
  nuevo: 2,
  esperar: 3,
  repasar: 3,
  sin_preguntas: null,
};

// Mis asignaturas, la página principal del estudiante (docs/DISENO-DEL-ESTUDIANTE.md 2.1), pensada primero para el
// celular: qué asignatura conviene seguir, Tu brújula con las brechas de todas y una tarjeta por asignatura con su
// barra de estados y su siguiente paso.
export default async function Estudiante() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("subjects(id, name)")
    .eq("student_id", user.id);
  const subjects = (enrollments ?? [])
    .map((e) => (Array.isArray(e.subjects) ? e.subjects[0] : e.subjects))
    .filter((s): s is Subject => !!s)
    .sort((a, b) => a.name.localeCompare(b.name));
  const subjectIds = subjects.map((s) => s.id);

  const [{ data: concepts }, { data: topics }, { data: attempts }, questionSets] = await Promise.all([
    supabase
      .from("concepts")
      .select("id, name, prerequisite_ids, topic_id, subject_id")
      .in("subject_id", subjectIds)
      .eq("status", "validado"),
    // La RLS solo devuelve al estudiante los temas validados
    supabase.from("topics").select("id, name, subject_id").in("subject_id", subjectIds).order("position"),
    supabase
      .from("diagnostic_attempts")
      .select("id, created_at, subject_id")
      .in("subject_id", subjectIds)
      .eq("user_id", user.id)
      .not("completed_at", "is", null),
    // Los estudiantes no leen "questions" directamente: la función devuelve las validadas sin la respuesta correcta
    Promise.all(subjectIds.map((id) => supabase.rpc("get_diagnostic_questions", { p_subject_id: id }))),
  ]);

  const attemptIds = (attempts ?? []).map((a) => a.id);
  const { data: answers } = attemptIds.length
    ? await supabase
        .from("diagnostic_answers")
        .select("attempt_id, stage, concept_id, is_correct, created_at")
        .in("attempt_id", attemptIds)
    : { data: [] };

  const allGaps: ReturnType<typeof computeLRR>["gaps"] = [];
  const progress: SubjectProgress[] = subjects.map((s, i) => {
    const mine = (concepts ?? []).filter((c) => c.subject_id === s.id);
    if (mine.length === 0) return { subject: s, counts: null, step: null, closed: null };
    const myAttempts = (attempts ?? []).filter((a) => a.subject_id === s.id);
    const ids = new Set(myAttempts.map((a) => a.id));
    const myAnswers = (answers ?? []).filter((a) => ids.has(a.attempt_id));
    const evidence = computeConceptEvidence(mine, myAttempts, myAnswers);
    const withQuestions = new Set(((questionSets[i].data ?? []) as { concept_id: string }[]).map((q) => q.concept_id));
    const myTopics = (topics ?? []).filter((t) => t.subject_id === s.id);
    const lrr = computeLRR(mine, myAttempts, myAnswers);
    allGaps.push(...lrr.gaps);

    const counts: Partial<Record<ConceptState, number>> = {};
    for (const c of mine) counts[evidence[c.id].state] = (counts[evidence[c.id].state] ?? 0) + 1;
    return {
      subject: s,
      counts,
      step: computeNextStep(mine, myTopics, evidence, myAnswers, withQuestions),
      closed: lrr.identified > 0 ? `${lrr.recovered} de ${lrr.identified} brechas cerradas` : null,
    };
  });

  const total = summarizeGaps(allGaps);
  const suggested = suggest(progress);

  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="Mis asignaturas"
        next={subjects.length > 0 ? undefined : "Únete con el código que te dio tu docente."}
      />

      <div className="flex flex-col gap-8">
        {(suggested || total.identified > 0) && (
          <div className="grid items-start gap-6 lg:grid-cols-2">
            {suggested && <SuggestedCard progress={suggested} />}
            {total.identified > 0 && <GapCompass lrr={total} />}
          </div>
        )}

        {progress.length > 0 && (
          <section aria-labelledby="subjects-title" className="flex flex-col gap-3">
            <h2 id="subjects-title" className="text-subsection">Tus asignaturas</h2>
            <ul className="grid gap-3 lg:grid-cols-2">
              {progress.map((p) => (
                <li key={p.subject.id}>
                  <SubjectCard progress={p} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <section aria-labelledby="join-title" className="flex flex-col gap-3">
            <h2 id="join-title" className="text-subsection">Unirme a una asignatura</h2>
            <JoinSubjectForm />
          </section>

          <Link
            href="/estudiante/autorregulacion"
            className="flex items-center gap-3 rounded-card border border-border p-5 transition-colors duration-(--duration-instant) hover:border-primary/60 lg:mt-10"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-medium">¿Cómo aprendes?</span>
              <span className="text-sm text-muted-foreground">
                Un cuestionario breve sobre tu forma de estudiar, con sugerencias para mejorar. Versión preliminar.
              </span>
            </span>
            <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </main>
  );
}

// La asignatura que conviene seguir: menor RANK y, empatadas, la de más brechas abiertas (después, por nombre)
function suggest(progress: SubjectProgress[]): SubjectProgress | null {
  const gaps = (p: SubjectProgress) => p.counts?.brecha ?? 0;
  const candidates = progress.filter((p) => p.step && RANK[p.step.kind] !== null);
  candidates.sort(
    (a, b) => RANK[a.step!.kind]! - RANK[b.step!.kind]! || gaps(b) - gaps(a) || a.subject.name.localeCompare(b.subject.name)
  );
  return candidates[0] ?? null;
}

// "Por dónde seguir": la única tarjeta destacada de la pantalla, con el botón en amarillo
function SuggestedCard({ progress: { subject, counts, step } }: { progress: SubjectProgress }) {
  const gaps = counts?.brecha ?? 0;
  const why =
    step!.kind === "final"
      ? "Te toca una comprobación final."
      : gaps > 0
        ? `Tienes ${gaps === 1 ? "1 brecha abierta" : `${gaps} brechas abiertas`}.`
        : null;
  return (
    <Card tone="featured">
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm font-medium text-primary-foreground/85">Por dónde seguir</p>
        <h2 className="text-section break-words">{subject.name}</h2>
        <p className="text-sm text-primary-foreground/85 break-words">
          {why && <>{why} </>}
          Siguiente paso: {afterColon(describeNextStep(step!, subject.id).title)}.
        </p>
        <Link
          href={`/estudiante/${subject.id}`}
          className={`${buttonVariants({ variant: "sun", size: "lg" })} w-full sm:w-auto sm:self-start`}
        >
          Ir a {subject.name}
        </Link>
      </CardContent>
    </Card>
  );
}

// Tarjeta de una asignatura: su barra de estados, su siguiente paso y sus brechas cerradas
function SubjectCard({ progress: { subject, counts, step, closed } }: { progress: SubjectProgress }) {
  return (
    <Link
      href={`/estudiante/${subject.id}`}
      className="flex h-full items-center gap-3 rounded-card bg-card p-5 shadow-rest transition-shadow duration-(--duration-instant) hover:shadow-raised"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-subsection break-words">{subject.name}</span>
        {counts ? (
          <>
            <StateBar counts={counts} showLegend={false} />
            <span className="text-xs text-muted-foreground">{stateSummary(counts)}</span>
            {step && (
              <span className="text-sm break-words">
                <span className="text-muted-foreground">Siguiente: </span>
                {afterColon(describeNextStep(step, subject.id).title)}
              </span>
            )}
            {closed && <span className="text-xs text-muted-foreground">{closed}</span>}
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Tu docente aún no publicó los conceptos.</span>
        )}
      </span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

// Después de dos puntos va minúscula: "Siguiente paso: cierra la brecha de…"
const afterColon = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
