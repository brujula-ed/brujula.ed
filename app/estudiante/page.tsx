import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JoinSubjectForm } from "@/components/join-subject-form";

export default async function Estudiante() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("subjects(id, name, topic)")
    .eq("student_id", user.id);

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-xl font-medium mb-1">Tus asignaturas</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Únete con el código que te dio tu docente
      </p>

      <JoinSubjectForm />

      <div className="flex flex-col gap-3 mt-6">
        {enrollments?.map((e) => {
          const s = Array.isArray(e.subjects) ? e.subjects[0] : e.subjects;
          if (!s) return null;
          return (
            <Link key={s.id} href={`/diagnostico/${s.id}`}>
              <Card className="hover:border-foreground/30 transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-base">{s.name}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{s.topic}</CardContent>
              </Card>
            </Link>
          );
        })}
        {enrollments?.length === 0 && (
          <p className="text-sm text-muted-foreground">Aún no te uniste a ninguna asignatura.</p>
        )}
      </div>
    </main>
  );
}