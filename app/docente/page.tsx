import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateSubjectForm } from "@/components/create-subject-form";
import { SubjectCard } from "@/components/subject-card";

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
    .select("id, name, topic, class_code")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  if (subjectsError) {
    console.error("Error cargando asignaturas:", subjectsError.message);
  }

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-xl font-medium mb-1">Panel docente</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Hola {profile.full_name ?? "docente"} — crea una asignatura y comparte el código con tus estudiantes
      </p>

      <CreateSubjectForm />

      <div className="flex flex-col gap-3 mt-6">
        {subjects?.map((s) => (
          <SubjectCard key={s.id} subject={s} />
          ))}
        {subjects?.length === 0 && (
          <p className="text-sm text-muted-foreground">Aún no creaste ninguna asignatura.</p>
        )}
      </div>
    </main>
  );
}