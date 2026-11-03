import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SelfRegulationQuestionnaire } from "@/components/self-regulation-questionnaire";
import { INSTRUMENT_VERSION, type SrlAnswers } from "@/lib/self-regulation";

// Diagnóstico de autorregulación (F-08, versión preliminar). Uno por estudiante, no por asignatura.
export default async function Autorregulacion() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // La RLS solo devuelve las respuestas propias. Solo cuenta la versión actual del instrumento.
  const { data: latest } = await supabase
    .from("self_regulation_responses")
    .select("answers, created_at")
    .eq("instrument_version", INSTRUMENT_VERSION)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Asignaturas en las que está inscrito y con cuáles comparte ya su resultado
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("subjects(id, name)")
    .eq("student_id", user.id);
  const subjects = (enrollments ?? [])
    .map((e) => (Array.isArray(e.subjects) ? e.subjects[0] : e.subjects))
    .filter((s): s is { id: string; name: string } => !!s);
  const { data: shares } = await supabase.from("self_regulation_shares").select("subject_id");

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        crumbs={[{ label: "Mis asignaturas", href: "/estudiante" }, { label: "¿Cómo aprendes?" }]}
        title="¿Cómo aprendes?"
        next="Versión preliminar, en revisión por especialistas. Es orientativo: no es una nota ni un diagnóstico."
      />
      <SelfRegulationQuestionnaire
        userId={user.id}
        latest={latest ? { answers: latest.answers as SrlAnswers, createdAt: latest.created_at } : null}
        subjects={subjects}
        sharedSubjectIds={(shares ?? []).map((s) => s.subject_id)}
      />
    </main>
  );
}
