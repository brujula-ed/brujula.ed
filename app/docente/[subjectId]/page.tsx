import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CopyCodeButton } from "@/components/copy-code-button";
import { SubjectActions } from "@/components/subject-actions";
import { buttonVariants } from "@/components/ui/button";
import { loadSetup, type StepId } from "@/lib/subject-setup";
import { SubjectTabs, SetupStepsNav, shortLabel, type View } from "@/components/subject-steps/subject-nav";
import { MaterialStep } from "@/components/subject-steps/material-step";
import { StructureStep } from "@/components/subject-steps/structure-step";
import { CardsStep } from "@/components/subject-steps/cards-step";
import { QuestionsStep } from "@/components/subject-steps/questions-step";
import { InviteStep } from "@/components/subject-steps/invite-step";
import { StudentsStep } from "@/components/subject-steps/students-step";

const STEP_IDS: StepId[] = ["material", "estructura", "fichas", "preguntas", "invitar"];

// Página de la asignatura (docs/PRINCIPIOS-DE-DISENO.md 2.10): pestañas "Contenido" (los 5 pasos de preparación) y
// "Estudiantes". Lo que se ve lo dice la dirección (?vista= y ?paso=); sin nada, se abre en el paso que falta o, si no
// falta ninguno, en Estudiantes. Cada paso carga solo sus datos.
export default async function SubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ subjectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { subjectId } = await params;
  const { vista, paso } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: subject } = await supabase
    .from("subjects")
    .select("id, name, description, teacher_id, class_code")
    .eq("id", subjectId)
    .single();
  if (!subject || subject.teacher_id !== user.id) notFound();

  const setup = await loadSetup(supabase, subjectId);
  const requestedStep = STEP_IDS.find((id) => id === paso);
  // Sin nada en la dirección se elige el paso que falta (o Estudiantes) y se redirige a la dirección explícita: así un
  // router.refresh() tras procesar o validar no cambia de paso solo porque el paso actual quedó hecho.
  if (vista !== "estudiantes" && !requestedStep) {
    redirect(
      setup.current || vista === "contenido"
        ? `/docente/${subjectId}?paso=${setup.current?.id ?? "material"}`
        : `/docente/${subjectId}?vista=estudiantes`
    );
  }
  const view: View = vista === "estudiantes" ? "estudiantes" : "contenido";
  const step: StepId = requestedStep ?? "material";
  const stepIndex = STEP_IDS.indexOf(step);
  const stepInfo = setup.steps[stepIndex];
  const nextStep = setup.steps[stepIndex + 1];

  const { count: students } =
    view === "contenido" && step === "invitar"
      ? await supabase.from("enrollments").select("student_id", { count: "exact", head: true }).eq("subject_id", subjectId)
      : { count: 0 };

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[{ label: "Mis asignaturas", href: "/docente" }, { label: subject.name }]}
        title={subject.name}
        next={
          <>
            {subject.description && <span className="block">{subject.description}</span>}
            <span className="block">
              {setup.ready
                ? "Lista para estudiantes."
                : setup.current
                  ? `En preparación: paso ${STEP_IDS.indexOf(setup.current.id) + 1} de 5, ${setup.current.label.toLowerCase()}.`
                  : ""}
            </span>
          </>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <CopyCodeButton code={subject.class_code} />
            <SubjectActions subject={subject} />
          </div>
        }
      />

      <SubjectTabs subjectId={subjectId} view={view} />

      {view === "estudiantes" ? (
        <StudentsStep subjectId={subjectId} />
      ) : (
        <>
          <SetupStepsNav subjectId={subjectId} steps={setup.steps} selected={step} current={setup.current?.id ?? null} />

          <section aria-labelledby="step-title" className="flex flex-col gap-2">
            <h2 id="step-title" className="text-section">
              {stepIndex + 1}. {stepInfo.label}
            </h2>
            <p className="text-sm font-medium">{stepInfo.detail}.</p>
            <div className="mt-2">
              {step === "material" && <MaterialStep subjectId={subjectId} />}
              {step === "estructura" && <StructureStep subjectId={subjectId} />}
              {step === "fichas" && <CardsStep subjectId={subjectId} />}
              {step === "preguntas" && <QuestionsStep subjectId={subjectId} />}
              {step === "invitar" && (
                <InviteStep classCode={subject.class_code} students={students ?? 0} ready={setup.ready} />
              )}
            </div>
          </section>

          {/* Cada paso ofrece el siguiente: se avanza en el recorrido, sin volver atrás */}
          <div className="mt-10 flex justify-end border-t border-border pt-6">
            <Link
              href={nextStep ? `/docente/${subjectId}?paso=${nextStep.id}` : `/docente/${subjectId}?vista=estudiantes`}
              className={buttonVariants({ variant: "outline" })}
            >
              {nextStep ? `Siguiente: ${shortLabel(nextStep)}` : "Ver estudiantes"}
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
