import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SubjectCard, type SubjectCardProgress } from "@/components/subject-card";
import { NewSubjectToggle } from "@/components/new-subject-toggle";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadSetup, type PendingReview, type SetupStatus } from "@/lib/subject-setup";
import { loadClassProgress, type ClassProgress } from "@/lib/class-progress";

// Inicio del docente (docs/PRINCIPIOS-DE-DISENO.md 2.10): qué sigue, pendientes y estados de todas sus asignaturas.
// Todas las cifras salen de datos reales; si todavía no hay datos, la sección no aparece.
export default async function Docente() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "docente") redirect("/");

  const { data: subjects, error: subjectsError } = await supabase
    .from("subjects")
    .select("id, name, description, class_code")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });
  if (subjectsError) console.error("Error cargando asignaturas:", subjectsError.message);
  const list = subjects ?? [];

  // Preparación de cada asignatura y, si ya tiene estudiantes, el progreso de su clase
  const overview = await Promise.all(
    list.map(async (s) => {
      const setup = await loadSetup(supabase, s.id);
      const students = setup.steps.find((st) => st.id === "invitar")?.done;
      const progress = students ? await loadClassProgress(supabase, s.id) : null;
      return { subject: s, setup, progress };
    })
  );

  const pendingReview = overview.reduce((n, o) => n + o.setup.pendingReview, 0);
  const withProgress = overview.filter((o): o is typeof o & { progress: ClassProgress } => !!o.progress);
  const students = withProgress.reduce((n, o) => n + o.progress.students, 0);
  const studentsWithGaps = withProgress.reduce((n, o) => n + o.progress.studentsWithGaps, 0);
  const gapsIdentified = withProgress.reduce((n, o) => n + o.progress.lrr.identified, 0);
  const gapsRecovered = withProgress.reduce((n, o) => n + o.progress.lrr.recovered, 0);

  // Brechas más frecuentes en todas sus asignaturas: conceptos con más estudiantes en brecha hoy
  const frequentGaps = withProgress
    .flatMap((o) =>
      o.progress.concepts.map((c) => ({
        concept: c.name,
        subject: o.subject.name,
        gap: o.progress.perConcept.get(c.id)?.brecha ?? 0,
        students: o.progress.students,
      }))
    )
    .filter((g) => g.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 4);

  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 py-8 md:px-8">
      <PageHeader
        title={firstName ? `Hola, ${firstName}` : "Hola"}
        next={nextLine(overview)}
        action={<NewSubjectToggle />}
      />

      {list.length > 0 && (pendingReview > 0 || students > 0) && (
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3">
          {pendingReview > 0 && (
            <StatTile tone="featured" label="Por validar" value={pendingReview} context="propuestas de la IA esperando tu revisión">
              <ul className="mt-1 flex flex-col gap-1 border-t border-primary-foreground/25 pt-3 text-sm">
                {overview
                  .filter((o) => o.setup.pendingReview > 0)
                  .sort((a, b) => b.setup.pendingReview - a.setup.pendingReview)
                  .map((o) => (
                    <li key={o.subject.id}>
                      <Link
                        href={reviewHref(o.subject.id, o.setup.pending)}
                        className="flex items-center justify-between gap-2 rounded-control py-1 font-medium hover:underline"
                      >
                        <span className="min-w-0 truncate">
                          {o.subject.name} · {o.setup.pendingReview}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          Validar <ArrowRight aria-hidden="true" className="size-4" />
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </StatTile>
          )}
          {students > 0 && (
            <StatTile label="Estudiantes con brechas" value={studentsWithGaps} context={`de ${students} inscritos`} />
          )}
          {gapsIdentified > 0 && (
            <StatTile
              label="Brechas cerradas (LRR)"
              value={`${gapsRecovered} de ${gapsIdentified}`}
              context={`${Math.round((gapsRecovered / gapsIdentified) * 100)} % de las brechas detectadas`}
            />
          )}
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState
          title="Todavía no tienes asignaturas"
          text="Crea tu primera asignatura con el botón Nueva asignatura. Después subirás tu material y la IA te propondrá sus conceptos, temas y preguntas para que los revises."
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <section className="flex flex-col gap-4">
            <h2 className="text-section">Mis asignaturas</h2>
            {overview.map((o) => (
              <SubjectCard
                key={o.subject.id}
                subject={o.subject}
                setup={{
                  ready: o.setup.ready,
                  current: o.setup.current,
                  stepNumber: o.setup.current ? o.setup.steps.indexOf(o.setup.current) + 1 : 5,
                  pendingReview: o.setup.pendingReview,
                }}
                progress={o.progress ? classSummary(o.progress) : undefined}
              />
            ))}
          </section>

          <aside className="flex flex-col gap-4">
            {frequentGaps.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Brechas más frecuentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-3">
                    {frequentGaps.map((g) => (
                      <li key={`${g.subject}-${g.concept}`} className="flex flex-col gap-1">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="font-medium">{g.concept}</span>
                          <span className="shrink-0 text-muted-foreground">
                            {g.gap} de {g.students}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-state-gap" style={{ width: `${(g.gap / g.students) * 100}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{g.subject}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Espacio reservado: hoy no se guarda un historial de eventos (docs/PENDIENTES.md). Sin datos inventados. */}
            <Card>
              <CardHeader>
                <CardTitle>Actividad reciente</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Muy pronto verás aquí lo que pasa en tus asignaturas: diagnósticos completados, brechas cerradas y
                  material procesado.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
    </main>
  );
}

// Qué sigue, por prioridad: lo que falta validar, la asignatura que no está lista, invitar estudiantes o todo al día
function nextLine(overview: { subject: { name: string }; setup: SetupStatus }[]): string {
  if (overview.length === 0) return "Empieza por crear tu primera asignatura con el botón Nueva asignatura.";
  const total = overview.reduce((n, o) => n + o.setup.pendingReview, 0);
  const review = [...overview].sort((a, b) => b.setup.pendingReview - a.setup.pendingReview)[0];
  if (review.setup.pendingReview > 0) {
    // El mismo total que la cifra "Por validar"; si está repartido, se nombra la asignatura con más
    return total === review.setup.pendingReview
      ? `Tienes ${total} propuestas de la IA por validar en ${review.subject.name}.`
      : `Tienes ${total} propuestas de la IA por validar, ${review.setup.pendingReview} en ${review.subject.name}. Empieza por ahí.`;
  }
  const notReady = overview.find((o) => !o.setup.ready);
  if (notReady && notReady.setup.current) {
    return `${notReady.subject.name}: ${notReady.setup.current.label.toLowerCase()}. ${notReady.setup.current.detail}.`;
  }
  const toInvite = overview.find((o) => o.setup.current?.id === "invitar");
  if (toInvite) return `${toInvite.subject.name} está lista: comparte el código de clase con tus estudiantes.`;
  return "Todo al día. Tus asignaturas están listas.";
}

// Dónde se valida hoy cada cosa: conceptos, temas, fichas y recursos en el paso Estructura; las preguntas en Preguntas.
// Cambiará cuando las fichas y los recursos tengan su propio paso.
function reviewHref(subjectId: string, p: PendingReview): string {
  return p.concepts + p.topics + p.cards + p.resources > 0
    ? `/docente/${subjectId}?paso=estructura`
    : `/docente/${subjectId}?paso=preguntas`;
}

// Estados de toda la clase en una sola barra: suma de los estados de cada concepto validado
function classSummary(p: ClassProgress): SubjectCardProgress {
  const counts = { sin_evidencia: 0, brecha: 0, en_desarrollo: 0, dominado: 0 };
  for (const c of p.perConcept.values()) {
    counts.sin_evidencia += c.sin_evidencia;
    counts.brecha += c.brecha;
    counts.en_desarrollo += c.en_desarrollo;
    counts.dominado += c.dominado;
  }
  return { counts, students: p.students, studentsWithGaps: p.studentsWithGaps };
}
