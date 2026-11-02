import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ConceptJourney } from "@/components/concept-journey";
import { computeConceptEvidence, type ConceptEvidence } from "@/lib/concept-state";
import { selectCheckQuestions, selectPracticeQuestions } from "@/lib/question-selection";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFERRED_DAYS = 2; // docs/MOTOR-DE-CONOCIMIENTO.md, decisión 3 (la base lo exige en submit_answer)
const relative = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
const dayFormat = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long" });

// Página de un concepto para el estudiante (docs/DISENO-DEL-ESTUDIANTE.md 2.3): su estado explicado con sus respuestas,
// qué necesita y qué abre, y el recorrido para cerrar la brecha. El layout de /estudiante ya exige sesión; la RLS solo
// devuelve conceptos, fichas y recursos validados de asignaturas en las que está inscrito.
export default async function ConceptoPage({
  params,
}: {
  params: Promise<{ subjectId: string; conceptId: string }>;
}) {
  const { subjectId, conceptId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: subject }, { data: conceptsData }, { data: attempts }, { data: ficha }, { data: resourceRows }, { data: bankRows }] =
    await Promise.all([
      supabase.from("subjects").select("id, name").eq("id", subjectId).maybeSingle(),
      supabase
        .from("concepts")
        .select("id, name, description, prerequisite_ids")
        .eq("subject_id", subjectId)
        .eq("status", "validado"),
      supabase
        .from("diagnostic_attempts")
        .select("id, created_at")
        .eq("subject_id", subjectId)
        .eq("user_id", user.id)
        .not("completed_at", "is", null),
      supabase.from("concept_cards").select("why_it_matters, application").eq("concept_id", conceptId).maybeSingle(),
      supabase
        .from("concept_resources")
        .select("title, url, kind, source")
        .eq("concept_id", conceptId)
        .order("created_at", { ascending: true }),
      // Los estudiantes no leen "questions" directamente: la función devuelve las validadas sin la respuesta correcta
      supabase.rpc("get_diagnostic_questions", { p_subject_id: subjectId }),
    ]);

  const concepts = conceptsData ?? [];
  const concept = concepts.find((c) => c.id === conceptId);
  if (!subject || !concept) notFound();

  const attemptIds = (attempts ?? []).map((a) => a.id);
  const { data: answers } = attemptIds.length
    ? await supabase
        .from("diagnostic_answers")
        .select("attempt_id, stage, concept_id, is_correct, created_at")
        .in("attempt_id", attemptIds)
    : { data: [] };

  const evidence = computeConceptEvidence(concepts, attempts ?? [], answers ?? []);
  const mine = evidence[conceptId];

  const { deferredFrom, deferredReady } = mine.awaitingDeferred
    ? deferredStatus((answers ?? []).filter((a) => a.concept_id === conceptId))
    : { deferredFrom: null, deferredReady: false };

  const bank = (bankRows ?? []).map((q) => ({
    id: q.id,
    conceptId: q.concept_id,
    lastAnsweredAt: q.last_answered_at,
    prompt: q.prompt,
    options: q.options as string[],
  }));
  const toQuiz = (list: typeof bank) => list.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options }));

  const neighbor = (id: string) => {
    const c = concepts.find((x) => x.id === id)!;
    return { id: c.id, name: c.name, state: evidence[c.id].state };
  };
  const prereqs = concept.prerequisite_ids.filter((id) => concepts.some((c) => c.id === id)).map(neighbor);
  const opens = concepts.filter((c) => c.prerequisite_ids.includes(conceptId)).map((c) => neighbor(c.id));

  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        crumbs={[
          { label: "Mis asignaturas", href: "/estudiante" },
          { label: subject.name, href: `/estudiante/${subjectId}` },
          { label: concept.name },
        ]}
        title={concept.name}
        next={nextLine(mine, deferredFrom)}
      />
      <ConceptJourney
        subject={{ id: subject.id, name: subject.name }}
        userId={user.id}
        concept={{ id: concept.id, name: concept.name, description: concept.description }}
        status={{
          state: mine.state,
          lowEvidence: mine.lowEvidence,
          evidenceLine: evidenceLine(mine),
          deferredFrom,
          deferredReady,
        }}
        prereqs={prereqs}
        opens={opens}
        ficha={ficha ? { whyItMatters: ficha.why_it_matters, application: ficha.application } : null}
        resources={resourceRows ?? []}
        checkQuestions={toQuiz(selectCheckQuestions(bank, conceptId))}
        practiceQuestions={toQuiz(selectPracticeQuestions(bank, conceptId))}
      />
    </main>
  );
}

// Comprobación final: se habilita 2 días después de la comprobación más reciente del concepto. Se mide desde la hora de
// la respuesta, igual que submit_answer, para no ofrecerla antes de que la base la acepte.
function deferredStatus(answers: { stage: string; created_at: string | null }[]) {
  const lastCheck = answers
    .filter((a) => a.stage === "comprobacion" || a.stage === "microevaluacion")
    .map((a) => a.created_at ?? "")
    .sort()
    .pop();
  if (!lastCheck) return { deferredFrom: null, deferredReady: false };
  const from = new Date(new Date(lastCheck).getTime() + DEFERRED_DAYS * DAY_MS);
  return from.getTime() <= Date.now()
    ? { deferredFrom: null, deferredReady: true }
    : { deferredFrom: `el ${dayFormat.format(from)}`, deferredReady: false };
}

// Qué hacer ahora, en una línea (docs/PRINCIPIOS-DE-DISENO.md 2.2)
function nextLine(e: ConceptEvidence, deferredFrom: string | null): string {
  if (e.state === "sin_evidencia") return "Aún no sabemos cuánto lo dominas: ponte a prueba.";
  if (e.state === "brecha") return "Hay una brecha aquí. Sigue el recorrido y compruébalo cuando estés listo.";
  if (e.state === "dominado") return "Lo dominas. Puedes repasarlo cuando quieras.";
  if (e.awaitingDeferred) {
    return deferredFrom
      ? `Vas bien. La comprobación final se habilita ${deferredFrom}.`
      : "Vas bien. Ya puedes hacer la comprobación final.";
  }
  return "Vas bien, pero con poca evidencia: compruébalo para confirmarlo.";
}

// De dónde sale el estado: cuántas respuestas, cuántas correctas y cuándo fue la última
function evidenceLine(e: ConceptEvidence): string {
  if (e.answers === 0 || !e.lastAt) return "Aún no respondiste preguntas de este concepto.";
  const days = Math.round((new Date(e.lastAt).getTime() - Date.now()) / DAY_MS);
  const answers = e.answers === 1 ? "1 respuesta" : `${e.answers} respuestas`;
  const correct = e.correct === 1 ? "1 correcta" : `${e.correct} correctas`;
  return `Estimado con ${answers}: ${correct} · la última fue ${relative.format(days, "day")}.`;
}
