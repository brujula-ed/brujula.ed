import Link from "next/link";
import { ChevronRight, Lightbulb } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";
import { StatTile } from "@/components/stat-tile";
import { StateBar } from "@/components/state-bar";
import { STATE_BG } from "@/components/state-chip";
import { buttonVariants } from "@/components/ui/button";
import { STATE_LABEL, type ConceptState } from "@/lib/concept-state";
import { computeDependents, learningOrder } from "@/lib/knowledge-graph";
import { loadClassProgress, type StateCounts } from "@/lib/class-progress";
import { materialPositions } from "@/lib/topic-organization";
import { BAND_LABEL, RESPONSE_MAX, SCALE_LABEL, type SrlBand, type SrlScale } from "@/lib/self-regulation";

const ORDER: ConceptState[] = ["dominado", "en_desarrollo", "brecha", "sin_evidencia"];
const MAX_FREQUENT = 5;
const dateFormat = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });
const PANEL = "flex flex-col gap-4 rounded-card bg-card p-5 shadow-rest";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const evaluated = (c: StateCounts) => c.brecha + c.en_desarrollo + c.dominado;

// Pestaña "Estudiantes" de la asignatura (docs/PRINCIPIOS-DE-DISENO.md 2.10): LRR, brechas frecuentes, estados por tema,
// sugerencias para la clase y la lista de estudiantes. Todo sale de lib/class-progress.ts, igual que el inicio del
// docente. La página de la asignatura ya comprobó que el docente es el dueño.
export async function StudentsStep({ subjectId }: { subjectId: string }) {
  const supabase = await createClient();
  const progress = await loadClassProgress(supabase, subjectId);
  const { concepts, perConcept, perStudent, lrr } = progress;

  if (progress.students === 0) {
    return (
      <EmptyState
        title="Todavía no hay estudiantes"
        text="Cuando tus estudiantes se inscriban con el código de clase, verás aquí su progreso: brechas, estados por tema y cuántas brechas se cerraron."
        action={
          <Link href={`/docente/${subjectId}?paso=invitar`} className={buttonVariants({ variant: "outline" })}>
            Invitar estudiantes
          </Link>
        }
      />
    );
  }
  if (concepts.length === 0) {
    return (
      <EmptyState
        title="Aún no hay conceptos validados"
        text="El progreso de la clase se mide por concepto. Valida los conceptos de tu asignatura para verlo."
        action={
          <Link href={`/docente/${subjectId}?paso=estructura`} className={buttonVariants({ variant: "outline" })}>
            Ir a Estructura
          </Link>
        }
      />
    );
  }

  const [{ data: profiles }, { data: topics }, { data: evidenceRows }, { data: srlRows }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", perStudent.map((s) => s.id)),
    supabase.from("topics").select("id, name, position").eq("subject_id", subjectId).order("position"),
    // Solo para ordenar los conceptos de cada tema como en el resto de la app (orden de aprendizaje)
    supabase
      .from("evidence_spans")
      .select("concept_id, page_start, document_chunks(position), subject_documents(uploaded_at)")
      .eq("subject_id", subjectId)
      .is("question_id", null),
    // Autorregulación (F-08): solo agregados. Con menos de 5 respuestas la función devuelve solo el número.
    supabase.rpc("self_regulation_class_summary", { p_subject_id: subjectId }),
  ]);

  // Estados por tema: los conceptos de cada tema en orden de aprendizaje; los que no tienen tema, al final
  const { position } = materialPositions(evidenceRows ?? []);
  const topicList = topics ?? [];
  const groups = [
    ...topicList.map((t) => ({ id: t.id, name: t.name, concepts: concepts.filter((c) => c.topic_id === t.id) })),
    {
      id: "sin-tema",
      name: topicList.length > 0 ? "Sin tema" : null,
      concepts: concepts.filter((c) => !c.topic_id || !topicList.some((t) => t.id === c.topic_id)),
    },
  ]
    .filter((g) => g.concepts.length > 0)
    .map((g) => {
      const ordered = learningOrder(g.concepts, position);
      const sum: StateCounts = { sin_evidencia: 0, brecha: 0, en_desarrollo: 0, dominado: 0 };
      for (const c of ordered) for (const s of ORDER) sum[s] += perConcept.get(c.id)![s];
      return { ...g, concepts: ordered, sum, withGap: ordered.filter((c) => perConcept.get(c.id)!.brecha > 0).length };
    });

  // Brechas frecuentes: conceptos con más estudiantes en brecha hoy; a igualdad, el que abre más conceptos
  const dependents = computeDependents(concepts);
  const frequent = concepts
    .map((c) => ({ concept: c, counts: perConcept.get(c.id)!, opens: dependents.get(c.id)?.size ?? 0 }))
    .filter((r) => r.counts.brecha > 0)
    .sort((a, b) => b.counts.brecha - a.counts.brecha || b.opens - a.opens || a.concept.name.localeCompare(b.concept.name));

  // Sugerencias para la clase: reglas fijas sobre los mismos datos (sin IA)
  const inactive = progress.students - progress.activeStudents;
  const suggestions: string[] = frequent.slice(0, 3).map(
    (r) =>
      `Repasa «${r.concept.name}» en clase: ${r.counts.brecha} de ${plural(evaluated(r.counts), "estudiante evaluado", "estudiantes evaluados")} ${r.counts.brecha === 1 ? "tiene" : "tienen"} brecha` +
      (r.opens > 0 ? ` y abre ${plural(r.opens, "concepto posterior", "conceptos posteriores")}.` : ".")
  );
  if (inactive > 0) {
    suggestions.push(
      `${inactive} de ${plural(progress.students, "estudiante", "estudiantes")} aún no ${inactive === 1 ? "hace" : "hacen"} el diagnóstico. Recuérdaselo para tener el cuadro completo.`
    );
  }
  if (frequent.length === 0 && progress.activeStudents > 0) suggestions.push("No hay brechas en el grupo por ahora.");

  // Estudiantes: primero los que tienen más brechas abiertas; los que no hicieron el diagnóstico, al final
  const nameOf = (id: string) => profiles?.find((p) => p.id === id)?.full_name ?? "Sin nombre";
  const students = [...perStudent].sort(
    (a, b) =>
      Number(!a.lastDiagnostic) - Number(!b.lastDiagnostic) ||
      b.openGaps - a.openGaps ||
      nameOf(a.id).localeCompare(nameOf(b.id))
  );

  const srl = srlRows?.[0] ?? null;
  const srlScales: { scale: SrlScale; avg: number | null; bands: Record<SrlBand, number | null> }[] = srl
    ? [
        {
          scale: "conocimiento",
          avg: srl.knowledge_avg,
          bands: { poco_frecuente: srl.knowledge_low, a_veces: srl.knowledge_mid, frecuente: srl.knowledge_high },
        },
        {
          scale: "regulacion",
          avg: srl.regulation_avg,
          bands: { poco_frecuente: srl.regulation_low, a_veces: srl.regulation_mid, frecuente: srl.regulation_high },
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Estados según las respuestas de cada estudiante (las recientes pesan más). Son orientativos: no son
        calificaciones.
      </p>

      <div className="flex flex-col gap-2">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile
            tone="featured"
            label="Brechas cerradas (LRR)"
            value={lrr.identified > 0 ? `${lrr.recovered} de ${lrr.identified}` : "—"}
            context={
              lrr.identified > 0
                ? `${Math.round((lrr.lrr ?? 0) * 100)} % · ${lrr.studentsWithRecovery} de ${plural(lrr.studentsWithGaps, "estudiante", "estudiantes")} con brechas ya ${lrr.studentsWithRecovery === 1 ? "cerró" : "cerraron"} alguna`
                : "Aún no hay brechas identificadas en un diagnóstico."
            }
          />
          <StatTile
            label="Con brechas hoy"
            value={progress.studentsWithGaps}
            context={`de ${progress.activeStudents} que hicieron el diagnóstico`}
          />
          <StatTile
            label="Hicieron el diagnóstico"
            value={progress.activeStudents}
            context={`de ${plural(progress.students, "inscrito", "inscritos")}`}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Brecha: concepto bajo 70 % en el primer diagnóstico. Cerrada: superó la comprobación y, días después, la
          comprobación final. Criterios provisionales, a ajustar en el piloto.
          {progress.lrrLegacy.identified > 0 &&
            ` Con la definición anterior (cerrada al llegar a 70 % en la evaluación más reciente) serían ${progress.lrrLegacy.recovered} de ${progress.lrrLegacy.identified}.`}
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="topics-title" className={PANEL}>
            <div className="flex flex-col gap-2">
              <h3 id="topics-title" className="text-subsection">
                {topicList.length > 0 ? "Estados por tema" : "Estados por concepto"}
              </h3>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {ORDER.map((s) => (
                  <li key={s} className="flex items-center gap-1.5">
                    <span aria-hidden="true" className={`size-2 rounded-full ${STATE_BG[s]}`} />
                    {STATE_LABEL[s]}
                  </li>
                ))}
              </ul>
            </div>

            <ul className="flex flex-col gap-4">
              {groups.map((g) =>
                g.name ? (
                  <li key={g.id}>
                    <details className="group">
                      <summary className="flex cursor-pointer list-none flex-col gap-2 rounded-control [&::-webkit-details-marker]:hidden">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="flex items-center gap-1 font-medium">
                            <ChevronRight
                              aria-hidden="true"
                              className="size-4 shrink-0 transition-transform duration-(--duration-instant) group-open:rotate-90"
                            />
                            {g.name}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {plural(g.concepts.length, "concepto", "conceptos")}
                            {g.withGap > 0 && ` · brecha en ${g.withGap}`}
                          </span>
                        </span>
                        <StateBar counts={g.sum} showLegend={false} />
                      </summary>
                      <ConceptRows concepts={g.concepts} perConcept={perConcept} className="mt-4 border-l border-border pl-4" />
                    </details>
                  </li>
                ) : (
                  <li key={g.id}>
                    <ConceptRows concepts={g.concepts} perConcept={perConcept} />
                  </li>
                )
              )}
            </ul>
          </section>

          <section aria-labelledby="students-title" className={PANEL}>
            <h3 id="students-title" className="text-subsection">
              Estudiantes <span className="font-normal text-muted-foreground">· {progress.students}</span>
            </h3>
            <ul className="flex flex-col divide-y divide-border">
              {students.map((s) => (
                <li key={s.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Link href={`/docente/${subjectId}/reporte/${s.id}`} className="font-medium break-words hover:underline">
                      {nameOf(s.id)}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {s.lastDiagnostic
                        ? `Último diagnóstico: ${dateFormat.format(new Date(s.lastDiagnostic))}`
                        : "Aún no hace el diagnóstico"}
                    </p>
                  </div>
                  {s.states && (
                    <div className="flex shrink-0 flex-col gap-1.5 sm:w-48 sm:items-end">
                      <p className="text-sm">
                        <span className={s.openGaps > 0 ? "font-medium" : "text-muted-foreground"}>
                          {plural(s.openGaps, "brecha abierta", "brechas abiertas")}
                        </span>
                        <span className="text-muted-foreground"> · {plural(s.closedGaps, "cerrada", "cerradas")}</span>
                      </p>
                      <div className="w-full">
                        <StateBar counts={s.states} showLegend={false} />
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="frequent-title" className={PANEL}>
            <h3 id="frequent-title" className="text-subsection">Brechas más frecuentes</h3>
            {frequent.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {frequent.slice(0, MAX_FREQUENT).map((r) => (
                  <li key={r.concept.id} className="flex flex-col gap-1.5">
                    <span className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 break-words">{r.concept.name}</span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {r.counts.brecha} de {evaluated(r.counts)}
                      </span>
                    </span>
                    <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
                      <span
                        className={`block h-full rounded-full ${STATE_BG.brecha}`}
                        style={{ width: `${(r.counts.brecha / evaluated(r.counts)) * 100}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {progress.activeStudents > 0
                  ? "Ningún estudiante tiene brechas por ahora."
                  : "Aparecerán cuando tus estudiantes hagan el diagnóstico."}
              </p>
            )}
            {frequent.length > 0 && (
              <p className="text-xs text-muted-foreground">Sobre los estudiantes evaluados en cada concepto.</p>
            )}
          </section>

          <section aria-labelledby="suggestions-title" className={PANEL}>
            <h3 id="suggestions-title" className="text-subsection">Sugerencias para la clase</h3>
            {suggestions.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {suggestions.map((s) => (
                  <li key={s} className="flex gap-2 text-sm">
                    <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Todavía no hay datos suficientes para sugerir acciones.</p>
            )}
          </section>
        </div>
      </div>

      <section aria-labelledby="srl-title" className={PANEL}>
        <div className="flex flex-col gap-1">
          <h3 id="srl-title" className="text-subsection">Autorregulación de la clase</h3>
          <p className="text-xs text-muted-foreground">Orientativo, versión preliminar. Solo resultados de grupo.</p>
        </div>
        {srl && srl.respondents >= 5 ? (
          <>
            <p className="text-sm text-muted-foreground">
              {plural(srl.respondents, "estudiante respondió", "estudiantes respondieron")} el cuestionario «¿Cómo
              aprendes?».
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {srlScales.map((s) => (
                <div key={s.scale} className="flex flex-col gap-1 rounded-control border border-border p-4 text-sm">
                  <p className="font-medium">{SCALE_LABEL[s.scale]}</p>
                  <p className="text-muted-foreground">
                    Promedio {s.avg !== null ? Number(s.avg).toFixed(1).replace(".", ",") : "—"} de {RESPONSE_MAX}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(Object.keys(BAND_LABEL) as SrlBand[]).map((b) => `${BAND_LABEL[b]}: ${s.bands[b] ?? 0}`).join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aún no hay suficientes respuestas para mostrar un resumen (mínimo 5; hoy {srl?.respondents ?? 0}).
          </p>
        )}
      </section>
    </div>
  );
}

// Un concepto por fila con su barra de estados: cuántos estudiantes hay en cada estado
function ConceptRows({
  concepts,
  perConcept,
  className = "",
}: {
  concepts: { id: string; name: string }[];
  perConcept: Map<string, StateCounts>;
  className?: string;
}) {
  return (
    <ul className={`flex flex-col gap-4 ${className}`}>
      {concepts.map((c) => {
        const counts = perConcept.get(c.id)!;
        const detail = ORDER.filter((s) => counts[s] > 0)
          .map((s) => `${STATE_LABEL[s]} ${counts[s]}`)
          .join(" · ");
        return (
          <li key={c.id} className="flex flex-col gap-1.5">
            <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="min-w-0 break-words">{c.name}</span>
              <span className="text-xs text-muted-foreground">{detail}</span>
            </span>
            <StateBar counts={counts} showLegend={false} />
          </li>
        );
      })}
    </ul>
  );
}
