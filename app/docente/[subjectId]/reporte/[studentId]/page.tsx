import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeConceptStates, STATE_LABEL, type ConceptState } from "@/lib/concept-state";
import { computePriorityGap } from "@/lib/knowledge-graph";
import { KnowledgeMap } from "@/components/knowledge-map";
import { Card, CardContent } from "@/components/ui/card";
import { computeLRR } from "@/lib/lrr";
import { LRRCard } from "@/components/lrr-card";

const ORDER: ConceptState[] = ["brecha", "en_desarrollo", "dominado", "sin_evidencia"];

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", studentId)
    .single();

  const { data: conceptsData } = await supabase
    .from("concepts")
    .select("id, name, description, prerequisite_ids")
    .eq("subject_id", subjectId)
    .eq("status", "validado");
  const concepts = conceptsData ?? [];

  const { data: attempts } = await supabase
    .from("diagnostic_attempts")
    .select("id, created_at")
    .eq("subject_id", subjectId)
    .eq("user_id", studentId)
    .not("completed_at", "is", null);

  const attemptIds = attempts?.map((a) => a.id) ?? [];
  const { data: answers } = attemptIds.length
    ? await supabase
        .from("diagnostic_answers")
        .select("attempt_id, stage, concept, is_correct")
        .in("attempt_id", attemptIds)
    : { data: [] };

  const states = computeConceptStates(concepts, attempts ?? [], answers ?? []);
  const gap = computePriorityGap(concepts, states);

  const lrr = computeLRR(concepts.map((c) => c.name), attempts ?? [], answers ?? []);

  const counts: Record<ConceptState, number> = {
    sin_evidencia: 0,
    brecha: 0,
    en_desarrollo: 0,
    dominado: 0,
  };
  Object.values(states).forEach((s) => (counts[s] += 1));

  const lastAttempt = (attempts ?? []).map((a) => a.created_at).sort().pop();
  const name = profile?.full_name ?? "Estudiante sin nombre";

  return (
    <main className="max-w-5xl mx-auto p-8">
      <Link
        href={`/docente/${subjectId}/reporte`}
        className="text-sm text-muted-foreground hover:underline mb-4 inline-block"
      >
        ← Volver a los resultados
      </Link>
      <h1 className="text-xl font-medium mb-1">{name}</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {subject.name} ·{" "}
        {lastAttempt
          ? `último diagnóstico: ${new Date(lastAttempt).toLocaleDateString("es-BO")}`
          : "aún no completó ningún diagnóstico"}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {ORDER.map((s) => (
          <Card key={s}>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-medium">{counts[s]}</p>
              <p className="text-xs text-muted-foreground">{STATE_LABEL[s]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {gap && (
        <div className="rounded-md border p-3 text-sm mb-6">
          <span className="font-medium">Brecha prioritaria:</span> {gap.concept.name}
          {gap.blocked.length > 0 && ` (bloquea ${gap.blocked.length} concepto(s) posteriores)`}.
        </div>
      )}

      <div className="mb-6">
        <LRRCard lrr={lrr} title="Tasa de recuperación del estudiante" />
      </div>

      {concepts.length > 0 ? (
        <KnowledgeMap concepts={concepts} states={states} />
      ) : (
        <p className="text-sm text-muted-foreground">Esta asignatura aún no tiene conceptos validados.</p>
      )}

      <p className="text-xs text-muted-foreground mt-6">
        Estos estados son orientativos para apoyar al estudiante y no deben usarse para calificar ni clasificar
        (Anexo I, sección 13).
      </p>
    </main>
  );
}