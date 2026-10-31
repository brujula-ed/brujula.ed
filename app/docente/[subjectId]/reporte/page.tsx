import { redirect } from "next/navigation";

// Dirección anterior al rediseño: ahora es parte de la página de la asignatura
export default async function Page({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  redirect(`/docente/${subjectId}?vista=estudiantes`);
}
