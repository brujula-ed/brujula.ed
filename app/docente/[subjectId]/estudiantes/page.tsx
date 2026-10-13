import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

export default async function Estudiantes({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: subject } = await supabase
    .from("subjects")
    .select("id, name, teacher_id")
    .eq("id", subjectId)
    .single();
  if (!subject || subject.teacher_id !== user.id) notFound();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id")
    .eq("subject_id", subjectId);

  const studentIds = enrollments?.map((e) => e.student_id) ?? [];

  const { data: profiles } = studentIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", studentIds)
    : { data: [] };

  const { data: attempts } = studentIds.length
    ? await supabase
        .from("diagnostic_attempts")
        .select("id, user_id, created_at")
        .not("completed_at", "is", null)
        .eq("subject_id", subjectId)
        .in("user_id", studentIds)
    : { data: [] };

  const attemptIds = attempts?.map((a) => a.id) ?? [];

  const { data: answers } = attemptIds.length
    ? await supabase
        .from("diagnostic_answers")
        .select("attempt_id, is_correct")
        .eq("stage", "diagnostico")
        .in("attempt_id", attemptIds)
    : { data: [] };

  const results = studentIds.map((id) => {
    const profile = profiles?.find((p) => p.id === id);
    const userAttempts = attempts?.filter((a) => a.user_id === id) ?? [];
    const userAttemptIds = userAttempts.map((a) => a.id);
    const userAnswers = answers?.filter((a) => userAttemptIds.includes(a.attempt_id)) ?? [];
    const correct = userAnswers.filter((a) => a.is_correct).length;
    const total = userAnswers.length;
    const lastAttempt = userAttempts.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

    return {
      id,
      name: profile?.full_name ?? "Sin nombre",
      score: total > 0 ? Math.round((correct / total) * 100) : null,
      attemptsCount: userAttempts.length,
      lastActivity: lastAttempt?.created_at ?? null,
    };
  });

  return (
    <main className="max-w-2xl mx-auto p-8">
      <Link href={`/docente/${subjectId}`} className="text-sm text-muted-foreground hover:underline mb-4 inline-block">
        ← Volver a la asignatura
      </Link>
      <h1 className="text-xl font-medium mb-1">Estudiantes — {subject.name}</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {results.length} estudiante(s) inscrito(s)
      </p>

      <div className="flex flex-col gap-2">
        {results.map((r) => (
          <Card key={r.id}>
            <CardContent className="pt-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  {r.attemptsCount > 0
                    ? `${r.attemptsCount} diagnóstico(s) realizado(s)`
                    : "Aún no realizó ningún diagnóstico"}
                </p>
              </div>
              {r.score !== null && (
                <span
                  className={`text-sm font-medium ${r.score < 70 ? "text-red-500" : "text-green-600"}`}
                >
                  {r.score}%
                </span>
              )}
            </CardContent>
          </Card>
        ))}
        {results.length === 0 && (
          <p className="text-sm text-muted-foreground">Aún no hay estudiantes inscritos en esta asignatura.</p>
        )}
      </div>
    </main>
  );
}