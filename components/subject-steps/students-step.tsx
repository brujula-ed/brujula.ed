import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";
import { computeConceptStates, STATE_LABEL, type ConceptState } from "@/lib/concept-state";
import { computeDependents } from "@/lib/knowledge-graph";
import { Card, CardContent } from "@/components/ui/card";
import { computeClassLRR } from "@/lib/lrr";
import { LRRCard } from "@/components/lrr-card";
import { BAND_LABEL, RESPONSE_MAX, SCALE_LABEL, type SrlBand, type SrlScale } from "@/lib/self-regulation";

const COLORS: Record<ConceptState, string> = {
  sin_evidencia: "var(--state-none-soft)",
  brecha: "var(--state-gap)",
  en_desarrollo: "var(--state-progress)",
  dominado: "var(--state-mastered)",
};
const ORDER: ConceptState[] = ["brecha", "en_desarrollo", "dominado", "sin_evidencia"];
// Supabase devuelve como máximo "Max rows" filas por consulta (Data API, hoy 1000) sin avisar si corta.
// Las respuestas de toda la clase pueden superarlo, así que se leen por páginas de este tamaño.
const PAGE_SIZE = 1000;

type AnswerRow = { attempt_id: string; stage: string; concept_id: string | null; is_correct: boolean };

// Pestaña "Estudiantes" de la asignatura (el reporte de clase, todavía sin rediseñar). La página de la asignatura ya
// comprobó que el docente es el dueño.
export async function StudentsStep({ subjectId }: { subjectId: string }) {
  const supabase = await createClient();

  const { data: conceptsData } = await supabase
    .from("concepts")
    .select("id, name, description, prerequisite_ids")
    .eq("subject_id", subjectId)
    .eq("status", "validado");
  const concepts = conceptsData ?? [];

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id")
    .eq("subject_id", subjectId);
  const studentIds = enrollments?.map((e) => e.student_id) ?? [];

  const { data: attempts } = studentIds.length
    ? await supabase
        .from("diagnostic_attempts")
        .select("id, user_id, created_at")
        .eq("subject_id", subjectId)
        .in("user_id", studentIds)
        .not("completed_at", "is", null)
    : { data: [] };

  const attemptIds = attempts?.map((a) => a.id) ?? [];

  // Ordenadas por id para que ninguna página se salte ni repita filas. Si una página falla, mejor mostrar
  // el error que un reporte con datos incompletos.
  const answers: AnswerRow[] = [];
  for (let from = 0; attemptIds.length > 0; from += PAGE_SIZE) {
    const { data: page, error } = await supabase
      .from("diagnostic_answers")
      .select("attempt_id, stage, concept_id, is_correct")
      .in("attempt_id", attemptIds)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`No se pudieron leer las respuestas del reporte: ${error.message}`);
    answers.push(...(page ?? []));
    if (!page || page.length < PAGE_SIZE) break;
  }

  const activeIds = studentIds.filter((id) => (attempts ?? []).some((a) => a.user_id === id));
  const inactiveCount = studentIds.length - activeIds.length;

    const { data: profiles } = studentIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", studentIds)
    : { data: [] };

  const studentRows: {
    id: string;
    name: string;
    gaps: number;
    mastered: number;
    lastActivity: string | null;
  }[] = [];

  type Counts = Record<ConceptState, number>;
  const perConcept = new Map<string, Counts>(
    concepts.map((c) => [c.id, { sin_evidencia: inactiveCount, brecha: 0, en_desarrollo: 0, dominado: 0 }])
  );

  for (const sid of activeIds) {
    const myAttempts = (attempts ?? []).filter((a) => a.user_id === sid);
    const myIds = new Set(myAttempts.map((a) => a.id));
    const myAnswers = (answers ?? []).filter((a) => myIds.has(a.attempt_id));
    const st = computeConceptStates(concepts, myAttempts, myAnswers);

        const myStates = Object.values(st);
    studentRows.push({
      id: sid,
      name: profiles?.find((p) => p.id === sid)?.full_name ?? "Sin nombre",
      gaps: myStates.filter((s) => s === "brecha").length,
      mastered: myStates.filter((s) => s === "dominado").length,
      lastActivity: myAttempts.map((a) => a.created_at).sort().pop() ?? null,
    });

    concepts.forEach((c) => {
      perConcept.get(c.id)![st[c.id]] += 1;
    });
  }

    studentIds
    .filter((id) => !activeIds.includes(id))
    .forEach((id) =>
      studentRows.push({
        id,
        name: profiles?.find((p) => p.id === id)?.full_name ?? "Sin nombre",
        gaps: 0,
        mastered: 0,
        lastActivity: null,
      })
    );
  studentRows.sort((a, b) => {
    if (!a.lastActivity !== !b.lastActivity) return a.lastActivity ? -1 : 1;
    return b.gaps - a.gaps || a.name.localeCompare(b.name);
  });

    const lrr = computeClassLRR(
    concepts,
    activeIds.map((sid) => {
      const myAttempts = (attempts ?? []).filter((a) => a.user_id === sid);
      const myIds = new Set(myAttempts.map((a) => a.id));
      return {
        attempts: myAttempts,
        answers: (answers ?? []).filter((a) => myIds.has(a.attempt_id)),
      };
    })
  );

  const dependents = computeDependents(concepts);
  const rows = concepts
    .map((c) => {
      const counts = perConcept.get(c.id)!;
      return {
        concept: c,
        counts,
        evaluated: counts.brecha + counts.en_desarrollo + counts.dominado,
        blocks: dependents.get(c.id)?.size ?? 0,
      };
    })
    .sort(
      (a, b) =>
        b.counts.brecha - a.counts.brecha ||
        b.blocks - a.blocks ||
        a.concept.name.localeCompare(b.concept.name)
    );

  const suggestions: string[] = [];
  const withGaps = rows.filter((r) => r.counts.brecha > 0).slice(0, 3);
  withGaps.forEach((r) => {
    suggestions.push(
      `«${r.concept.name}»: ${r.counts.brecha} de ${r.evaluated} estudiante(s) evaluados tienen brecha` +
        (r.blocks > 0 ? ` y el concepto abre ${r.blocks} concepto(s) posteriores` : "") +
        ". Conviene repasarlo en clase."
    );
  });
  if (inactiveCount > 0) {
    suggestions.push(
      `${inactiveCount} de ${studentIds.length} estudiante(s) aún no completan el diagnóstico. Recuérdales hacerlo para tener un cuadro completo.`
    );
  }
  if (withGaps.length === 0 && activeIds.length > 0) {
    suggestions.push("No hay brechas detectadas en el grupo por ahora.");
  }

  // Autorregulación de la clase (F-08): solo agregados. Con menos de 5 respuestas la función devuelve solo el número.
  const { data: srlSummaryRows } = await supabase.rpc("self_regulation_class_summary", { p_subject_id: subjectId });
  const srlSummary = srlSummaryRows?.[0] ?? null;
  const srlScales: {
    scale: SrlScale;
    avg: number | null;
    bands: Record<SrlBand, number | null>;
  }[] = srlSummary
    ? [
        {
          scale: "conocimiento",
          avg: srlSummary.knowledge_avg,
          bands: {
            poco_frecuente: srlSummary.knowledge_low,
            a_veces: srlSummary.knowledge_mid,
            frecuente: srlSummary.knowledge_high,
          },
        },
        {
          scale: "regulacion",
          avg: srlSummary.regulation_avg,
          bands: {
            poco_frecuente: srlSummary.regulation_low,
            a_veces: srlSummary.regulation_mid,
            frecuente: srlSummary.regulation_high,
          },
        },
      ]
    : [];

  if (studentIds.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay estudiantes"
        text="Cuando tu asignatura esté lista y se inscriban tus estudiantes, verás aquí su progreso: brechas, estados por concepto y cuántas brechas se cerraron."
      />
    );
  }

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-muted-foreground mb-6">
        Se calcula con el diagnóstico completado más reciente de cada estudiante.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-medium">{studentIds.length}</p>
            <p className="text-xs text-muted-foreground">Inscritos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-medium">{activeIds.length}</p>
            <p className="text-xs text-muted-foreground">Completaron el diagnóstico</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-medium">{inactiveCount}</p>
            <p className="text-xs text-muted-foreground">Sin actividad</p>
          </CardContent>
        </Card>
      </div>

      {studentIds.length > 0 && (
        <Card className="mb-8">
          <CardContent className="pt-6 text-sm">
            <p className="font-medium mb-1">Autorregulación de la clase (orientativo, versión preliminar)</p>
            {srlSummary && srlSummary.respondents >= 5 ? (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  {srlSummary.respondents} estudiante(s) respondieron el cuestionario «¿Cómo aprendes?».
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {srlScales.map((s) => (
                    <div key={s.scale} className="rounded-md border p-3">
                      <p className="font-medium">{SCALE_LABEL[s.scale]}</p>
                      <p className="text-muted-foreground mb-1">
                        Promedio {s.avg !== null ? Number(s.avg).toFixed(1).replace(".", ",") : "—"} de {RESPONSE_MAX}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(Object.keys(BAND_LABEL) as SrlBand[])
                          .map((b) => `${BAND_LABEL[b]}: ${s.bands[b] ?? 0}`)
                          .join(" · ")}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">
                Aún no hay suficientes respuestas para mostrar un resumen (mínimo 5; hoy{" "}
                {srlSummary?.respondents ?? 0}).
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {studentIds.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay estudiantes inscritos en esta asignatura.</p>
      ) : concepts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Esta asignatura aún no tiene conceptos validados. Valídalos para ver el reporte.
        </p>
      ) : (
          <>
          <div className="mb-8">
            <LRRCard
              lrr={lrr}
              title="Tasa de recuperación de la clase"
              extra={{
                studentsWithGaps: lrr.studentsWithGaps,
                studentsWithRecovery: lrr.studentsWithRecovery,
              }}
            />
          </div>

          <h2 className="text-sm font-medium mb-3">Acciones sugeridas</h2>
          <ul className="flex flex-col gap-2 mb-8 text-sm">
            {suggestions.map((s, i) => (
              <li key={i} className="rounded-md border p-3">{s}</li>
            ))}
            {suggestions.length === 0 && (
              <li className="text-muted-foreground">Todavía no hay datos suficientes para sugerir acciones.</li>
            )}
          </ul>

          <h2 className="text-sm font-medium mb-3">Estado por concepto</h2>
          <div className="flex flex-wrap gap-4 mb-4 text-xs text-muted-foreground">
            {ORDER.map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: COLORS[s] }} />
                {STATE_LABEL[s]}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            {rows.map((r) => {
              const total = studentIds.length;
              const detail = ORDER.filter((s) => r.counts[s] > 0)
                .map((s) => `${STATE_LABEL[s].toLowerCase()} ${r.counts[s]}`)
                .join(" · ");
              return (
                <div key={r.concept.id}>
                  <div className="flex items-baseline justify-between mb-1">
                    <p className="text-sm font-medium">{r.concept.name}</p>
                    <p className="text-xs text-muted-foreground">{detail}</p>
                  </div>
                  <div className="flex h-3 rounded overflow-hidden bg-muted" role="img" aria-label={detail}>
                    {ORDER.map(
                      (s) =>
                        r.counts[s] > 0 && (
                          <div
                            key={s}
                            style={{ width: `${(r.counts[s] / total) * 100}%`, background: COLORS[s] }}
                          />
                        )
                    )}
                  </div>
                </div>
              );
            })}
          </div>

                    <h2 className="text-sm font-medium mt-10 mb-3">Estudiantes</h2>
          <div className="flex flex-col gap-2">
            {studentRows.map((r) => (
              <Card key={r.id}>
                <CardContent className="pt-4 flex items-center justify-between">
                  <div>
                    <Link href={`/docente/${subjectId}/reporte/${r.id}`} className="text-sm font-medium hover:underline">
                        {r.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {r.lastActivity
                        ? `Último diagnóstico: ${new Date(r.lastActivity).toLocaleDateString("es-BO")}`
                        : "Aún no completó ningún diagnóstico"}
                    </p>
                  </div>
                  {r.lastActivity && (
                    <p className="text-xs text-right text-muted-foreground">
                      <span className={r.gaps > 0 ? "text-state-gap font-medium" : ""}>{r.gaps} brecha(s)</span>
                      {" · "}
                      {r.mastered} de {concepts.length} dominado(s)
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}