import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { KnowledgeMap } from "@/components/knowledge-map";
import { NextStepCard } from "@/components/next-step-card";
import { TopicList } from "@/components/topic-list";
import { MapDisclosure } from "@/components/map-disclosure";
import { GapCompass } from "@/components/gap-compass";
import { EmptyState } from "@/components/empty-state";
import { computeConceptEvidence } from "@/lib/concept-state";
import { computeNextStep } from "@/lib/next-step";
import { computeLRR } from "@/lib/lrr";
import { recoveredSince } from "@/lib/gap-closure";

const WEEK_DAYS = 7;

// Mi Brújula (docs/DISENO-DEL-ESTUDIANTE.md 2.2), pensada primero para el celular: el siguiente paso como única acción
// destacada, las brechas cerradas esta semana, los temas (con el mapa como vista aparte) y Tu brújula con el LRR.
export default async function MiBrujula({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: subject }, { data: conceptsData }, { data: topicsData }, { data: attemptsData }, { data: validQuestions }] =
    await Promise.all([
      supabase.from("subjects").select("id, name").eq("id", subjectId).maybeSingle(),
      supabase
        .from("concepts")
        .select("id, name, description, prerequisite_ids, topic_id")
        .eq("subject_id", subjectId)
        .eq("status", "validado"),
      // La RLS solo devuelve al estudiante los temas validados
      supabase.from("topics").select("id, name, description").eq("subject_id", subjectId).order("position"),
      supabase
        .from("diagnostic_attempts")
        .select("id, created_at, completed_at")
        .not("completed_at", "is", null)
        .eq("subject_id", subjectId)
        .eq("user_id", user.id),
      // Los estudiantes no leen "questions" directamente: la función devuelve las validadas sin la respuesta correcta
      supabase.rpc("get_diagnostic_questions", { p_subject_id: subjectId }),
    ]);
  if (!subject) notFound();

  const concepts = conceptsData ?? [];
  const topics = topicsData ?? [];
  const attempts = attemptsData ?? [];
  const attemptIds = attempts.map((a) => a.id);
  const { data: answersData } = attemptIds.length
    ? await supabase
        .from("diagnostic_answers")
        .select("attempt_id, stage, concept_id, is_correct, created_at")
        .in("attempt_id", attemptIds)
    : { data: [] };
  const answers = answersData ?? [];

  if (concepts.length === 0) {
    return (
      <main className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-8 md:py-8">
        <PageHeader crumbs={[{ label: "Mis asignaturas", href: "/estudiante" }, { label: subject.name }]} title={subject.name} />
        <EmptyState
          title="Aún no hay conceptos"
          text="Tu docente todavía no publicó los conceptos de esta asignatura. Vuelve más tarde."
        />
      </main>
    );
  }

  const evidence = computeConceptEvidence(concepts, attempts, answers);
  const states = Object.fromEntries(concepts.map((c) => [c.id, evidence[c.id].state]));
  const withQuestions = new Set(((validQuestions ?? []) as { concept_id: string }[]).map((q) => q.concept_id));
  const step = computeNextStep(concepts, topics, evidence, answers, withQuestions);
  const lrr = computeLRR(concepts, attempts, answers);
  const closedThisWeek = closedSince(concepts, attempts, answers, WEEK_DAYS);

  // Para el panel del mapa: la RLS solo devuelve al estudiante fichas y recursos validados de conceptos validados
  const [{ data: fichaRows }, { data: resourceRows }] = await Promise.all([
    supabase.from("concept_cards").select("concept_id, why_it_matters, application").eq("subject_id", subjectId),
    supabase
      .from("concept_resources")
      .select("concept_id, title, url, kind, source")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: true }),
  ]);
  const fichas = Object.fromEntries(
    (fichaRows ?? []).map((f) => [f.concept_id, { whyItMatters: f.why_it_matters, application: f.application }])
  );
  const resources: Record<string, { title: string; url: string; kind: string; source: string }[]> = {};
  for (const r of resourceRows ?? []) {
    (resources[r.concept_id] ??= []).push({ title: r.title, url: r.url, kind: r.kind, source: r.source });
  }

  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 py-6 md:px-8 md:py-8">
      <PageHeader crumbs={[{ label: "Mis asignaturas", href: "/estudiante" }, { label: subject.name }]} title={subject.name} />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <NextStepCard step={step} subjectId={subjectId} />

          {closedThisWeek > 0 && (
            <p className="flex items-center gap-3 rounded-card bg-card p-4 text-sm shadow-rest">
              <span aria-hidden="true" className="size-3 shrink-0 rounded-full bg-brand-ray" />
              <span>
                Esta semana cerraste{" "}
                <span className="font-semibold">{closedThisWeek === 1 ? "1 brecha" : `${closedThisWeek} brechas`}</span>.
              </span>
            </p>
          )}

          <section aria-labelledby="topics-title" className="flex flex-col gap-3">
            <h2 id="topics-title" className="text-subsection">Tus temas</h2>
            <TopicList
              subjectId={subjectId}
              topics={topics}
              concepts={concepts}
              states={states}
              withQuestions={withQuestions}
            />
            <MapDisclosure>
              <KnowledgeMap
                concepts={concepts}
                topics={topics}
                states={states}
                fichas={fichas}
                resources={resources}
                conceptBaseHref={`/estudiante/${subjectId}/concepto`}
              />
            </MapDisclosure>
          </section>
        </div>

        {lrr.identified > 0 && (
          <div className="lg:sticky lg:top-6">
            <GapCompass lrr={lrr} concepts={concepts} states={states} />
          </div>
        )}
      </div>
    </main>
  );
}

// Fuera del componente: la fecha de hoy no puede leerse al renderizar (regla de pureza de React)
type Args = Parameters<typeof recoveredSince>;
function closedSince(concepts: Args[0], attempts: Args[1], answers: Args[2], days: number): number {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  return recoveredSince(concepts, attempts, answers, since).length;
}
