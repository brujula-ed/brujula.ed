import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StateBar } from "@/components/state-bar";
import { CopyCodeButton } from "@/components/copy-code-button";
import type { StateCounts } from "@/lib/class-progress";
import type { SetupStep } from "@/lib/subject-setup";

type Subject = { id: string; name: string; description: string | null; class_code: string };

// Resumen de la preparación (lib/subject-setup.ts) y del progreso de la clase (lib/class-progress.ts)
export type SubjectCardSetup = { ready: boolean; current: SetupStep | null; stepNumber: number; pendingReview: number };
export type SubjectCardProgress = { counts: StateCounts; students: number; studentsWithGaps: number };

// Tarjeta de asignatura del inicio del docente: toda la tarjeta lleva a la página de la asignatura (el enlace del nombre
// se estira sobre ella con after:inset-0). Solo "Copiar código" queda encima, porque compartirlo es frecuente; editar y
// eliminar están en la página de la asignatura (components/subject-actions.tsx).
export function SubjectCard({
  subject,
  setup,
  progress,
}: {
  subject: Subject;
  setup: SubjectCardSetup;
  progress?: SubjectCardProgress;
}) {
  return (
    <Card className="relative transition-[translate,box-shadow] duration-(--duration-short) ease-out-soft hover:shadow-raised motion-safe:hover:-translate-y-1 has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/docente/${subject.id}`}
              className="font-heading text-subsection outline-none after:absolute after:inset-0 after:rounded-card"
            >
              {subject.name}
            </Link>
            {subject.description && <p className="mt-0.5 text-sm text-muted-foreground">{subject.description}</p>}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
              {setup.ready ? "Lista" : "En preparación"}
            </span>
            {setup.pendingReview > 0 && (
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                {setup.pendingReview} por validar
              </span>
            )}
          </div>
        </div>

        {setup.ready && progress && progress.students > 0 ? (
          <div className="flex flex-col gap-1.5">
            <StateBar counts={progress.counts} showLegend={false} />
            <p className="text-xs text-muted-foreground">
              {progress.students} estudiantes · {progress.studentsWithGaps} con brechas
            </p>
          </div>
        ) : setup.current ? (
          <p className="text-sm">
            <span className="font-medium">
              Paso {setup.stepNumber} de 5: {setup.current.label}.
            </span>{" "}
            <span className="text-muted-foreground">{setup.current.detail}</span>
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          {/* relative z-10: por encima del enlace estirado, para copiar sin entrar a la asignatura */}
          <CopyCodeButton code={subject.class_code} className="relative z-10" />
          {/* Lo mismo que abre la página: el paso que falta o, si no falta ninguno, Estudiantes */}
          <span aria-hidden="true" className="flex items-center gap-1 text-sm font-semibold text-primary">
            {setup.current ? "Continuar" : "Ver estudiantes"}
            <ArrowRight className="size-4" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
