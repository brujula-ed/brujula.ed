import { ShareCode } from "@/components/share-code";

// Paso 5 de "Contenido": el código de clase, cómo compartirlo y cómo lo usan los estudiantes para inscribirse
export function InviteStep({
  classCode,
  subjectName,
  students,
  ready,
}: {
  classCode: string;
  subjectName: string;
  students: number;
  ready: boolean;
}) {
  return (
    <div className="max-w-3xl flex flex-col gap-4 text-sm">
      {!ready && (
        <p className="rounded-control bg-muted p-3">
          Tu asignatura todavía no está lista: tus estudiantes pueden inscribirse, pero no tendrán diagnóstico hasta que
          completes los pasos de estructura y preguntas.
        </p>
      )}
      <div className="flex flex-col gap-2">
        <p className="font-medium">Comparte este código con tus estudiantes</p>
        <ShareCode code={classCode} subjectName={subjectName} />
      </div>
      <ol className="list-decimal pl-5 flex flex-col gap-1 text-muted-foreground">
        <li>Cada estudiante crea su cuenta como estudiante en brújula.ed (o inicia sesión).</li>
        <li>En «Tus asignaturas» escribe el código y se une a la asignatura.</li>
        <li>Desde ahí hace su diagnóstico y ve su Brújula.</li>
      </ol>
      <p>
        {students === 0
          ? "Todavía no se inscribió ningún estudiante."
          : `${students} ${students === 1 ? "estudiante inscrito" : "estudiantes inscritos"}. Su progreso está en la pestaña Estudiantes.`}
      </p>
    </div>
  );
}
