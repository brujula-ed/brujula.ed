import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeConceptStates, type ConceptState } from "@/lib/concept-state";
import { computePriorityGap } from "@/lib/knowledge-graph";
import { KnowledgeMap } from "@/components/knowledge-map";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { StateBar } from "@/components/state-bar";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { computeLRR, type GapStatus } from "@/lib/lrr";
import { BAND_LABEL, RESPONSE_MAX, SCALE_LABEL, bandFor, type SrlScale } from "@/lib/self-regulation";

const dateFormat = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });
const PANEL = "flex flex-col gap-4 rounded-card bg-card p-5 shadow-rest";
const pct = (x: number) => `${Math.round(x * 100)} %`;

// Brechas del estudiante: primero las que siguen abiertas, después las cerradas
const GAP_ORDER: GapStatus[] = ["sin_mejora", "pendiente", "en_proceso", "recuperada"];
const GAP_LABEL: Record<GapStatus, string> = {
  recuperada: "Cerrada",
  en_proceso: "Falta la comprobación final",
  sin_mejora: "Sin mejora",
  pendiente: "Sin evaluación posterior",
};

// Progreso de un estudiante en una asignatura (desde la pestaña "Estudiantes"). Mismos cálculos que Mi Brújula: estados,
// brecha prioritaria y LRR del estudiante. Estados orientativos: no son calificaciones (Anexo I, sec. 13).
export default async function EstudianteDetalle({
  params,
}: {
  params: Promise<{ subjectId: string; studentId: string }>;
}) {
  const { subjectId, studentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: subject } = await supabase
    .from("subjects")
    .select("id, name, teacher_id")
    .eq("id", subjectId)
    .single();
  if (!subject || subject.teacher_id !== user.id) notFound();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("subject_id", subjectId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (!enrollment) notFound();

  const [{ data: profile }, { data: conceptsData }, { data: topics }, { data: attempts }, { data: srlRows }] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", studentId).single(),
      supabase
        .from("concepts")
        .select("id, name, description, prerequisite_ids, topic_id")
        .eq("subject_id", subjectId)
        .eq("status", "validado"),
      // Solo los temas validados: el mapa se ve como lo ve el estudiante
      supabase
        .from("topics")
        .select("id, name, description")
        .eq("subject_id", subjectId)
        .eq("status", "validado")
        .order("position"),
      supabase
        .from("diagnostic_attempts")
        .select("id, created_at")
        .eq("subject_id", subjectId)
        .eq("user_id", studentId)
        .not("completed_at", "is", null),
      // Autorregulación (F-08): solo llega si el estudiante compartió su resultado con esta asignatura.
      // Sin permiso no hay filas, igual que si no respondió: no se distingue un caso del otro.
      supabase.rpc("self_regulation_shared_result", { p_subject_id: subjectId, p_student_id: studentId }),
    ]);
  const concepts = conceptsData ?? [];

  const attemptIds = attempts?.map((a) => a.id) ?? [];
  const { data: answers } = attemptIds.length
    ? await supabase
        .from("diagnostic_answers")
        .select("attempt_id, stage, concept_id, is_correct")
        .in("attempt_id", attemptIds)
    : { data: [] };

  const states = computeConceptStates(concepts, attempts ?? [], answers ?? []);
  const gap = computePriorityGap(concepts, states);
  const lrr = computeLRR(concepts, attempts ?? [], answers ?? []);
  const gaps = [...lrr.gaps].sort(
    (a, b) => GAP_ORDER.indexOf(a.status) - GAP_ORDER.indexOf(b.status) || a.concept.localeCompare(b.concept)
  );

  const srl = srlRows?.[0] ?? null;
  const srlScores: Record<SrlScale, number> | null = srl
    ? { conocimiento: Number(srl.knowledge_avg), regulacion: Number(srl.regulation_avg) }
    : null;

  const counts: Record<ConceptState, number> = { sin_evidencia: 0, brecha: 0, en_desarrollo: 0, dominado: 0 };
  Object.values(states).forEach((s) => (counts[s] += 1));

  const lastAttempt = (attempts ?? []).map((a) => a.created_at).sort().pop();
  const name = profile?.full_name ?? "Estudiante sin nombre";
  const backHref = `/docente/${subjectId}?vista=estudiantes`;

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Mis asignaturas", href: "/docente" },
          { label: subject.name, href: backHref },
          { label: name },
        ]}
        title={name}
        next={
          lastAttempt
            ? `Último diagnóstico: ${dateFormat.format(new Date(lastAttempt))}.`
            : "Aún no completó ningún diagnóstico."
        }
      />

      {concepts.length === 0 ? (
        <EmptyState
          title="Aún no hay conceptos validados"
          text="El progreso se mide por concepto. Valida los conceptos de la asignatura para verlo."
          action={
            <Link href={`/docente/${subjectId}?paso=estructura`} className={buttonVariants({ variant: "outline" })}>
              Ir a Estructura
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          <p className="text-sm text-muted-foreground">
            Estos estados son orientativos para apoyar al estudiante y no deben usarse para calificar ni clasificar.
          </p>

          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatTile label="Brechas abiertas" value={counts.brecha} context="conceptos en brecha hoy" />
              <StatTile
                label="Brechas cerradas (LRR)"
                value={lrr.identified > 0 ? `${lrr.recovered} de ${lrr.identified}` : "—"}
                context={
                  lrr.identified > 0
                    ? `${pct(lrr.lrr ?? 0)} de las brechas de su primer diagnóstico`
                    : "Aún no hay brechas identificadas en un diagnóstico."
                }
              />
              <StatTile label="Dominados" value={counts.dominado} context={`de ${concepts.length} conceptos`} />
            </div>
            <StateBar counts={counts} />
          </div>

          {gap && (
            <Card tone="featured">
              <CardContent className="flex flex-col gap-1">
                <p className="text-sm font-medium">Brecha prioritaria</p>
                <p className="text-subsection">{gap.concept.name}</p>
                <p className="text-sm text-primary-foreground/85">
                  {gap.blocked.length > 0
                    ? `Es la que más conceptos bloquea: ${gap.blocked.length} ${gap.blocked.length === 1 ? "concepto posterior" : "conceptos posteriores"}.`
                    : "Es la brecha que conviene atender primero."}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid items-start gap-6 lg:grid-cols-2">
            <section aria-labelledby="gaps-title" className={PANEL}>
              <h2 id="gaps-title" className="text-subsection">Sus brechas</h2>
              {gaps.length > 0 ? (
                <ul className="flex flex-col divide-y divide-border">
                  {gaps.map((g) => (
                    <li key={g.conceptId} className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0">
                      <span className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 font-medium break-words">{g.concept}</span>
                        <span className={`shrink-0 text-xs ${g.status === "recuperada" ? "font-medium" : "text-muted-foreground"}`}>
                          {GAP_LABEL[g.status]}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Primer diagnóstico {pct(g.baseline)}
                        {g.post !== null && ` → estimación de hoy ${pct(g.post)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {lastAttempt ? "No tuvo brechas en su primer diagnóstico." : "Aparecerán cuando haga el diagnóstico."}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Brecha: concepto bajo 70 % en el primer diagnóstico. Cerrada: superó la comprobación y, días después, la
                comprobación final. Criterios provisionales.
              </p>
            </section>

            <section aria-labelledby="srl-title" className={PANEL}>
              <div className="flex flex-col gap-1">
                <h2 id="srl-title" className="text-subsection">Autorregulación</h2>
                <p className="text-xs text-muted-foreground">Orientativo, versión preliminar.</p>
              </div>
              {srl && srlScores ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Compartido por el estudiante · respondido el {dateFormat.format(new Date(srl.answered_at))}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(["conocimiento", "regulacion"] as SrlScale[]).map((scale) => (
                      <div key={scale} className="flex flex-col gap-1 rounded-control border border-border p-4 text-sm">
                        <p className="font-medium">{SCALE_LABEL[scale]}</p>
                        <p className="text-muted-foreground">
                          {BAND_LABEL[bandFor(srlScores[scale])]} · promedio{" "}
                          {srlScores[scale].toFixed(1).replace(".", ",")} de {RESPONSE_MAX}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sin resultado compartido. Cada estudiante decide si comparte su resultado del cuestionario «¿Cómo
                  aprendes?».
                </p>
              )}
            </section>
          </div>

          <section aria-labelledby="map-title" className="flex flex-col gap-3">
            <h2 id="map-title" className="text-subsection">Su mapa de conocimiento</h2>
            <KnowledgeMap concepts={concepts} topics={topics ?? []} states={states} />
          </section>
        </div>
      )}
    </main>
  );
}
