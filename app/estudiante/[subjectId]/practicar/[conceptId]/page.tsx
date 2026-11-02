import { redirect } from "next/navigation";

// Dirección anterior a la fase 3: "Explícalo con tus palabras" (F-09) ahora es un paso del recorrido del concepto
export default async function Practicar({ params }: { params: Promise<{ subjectId: string; conceptId: string }> }) {
  const { subjectId, conceptId } = await params;
  redirect(`/estudiante/${subjectId}/concepto/${conceptId}`);
}
