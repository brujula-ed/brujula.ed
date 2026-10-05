import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UploadDocumentForm } from "@/components/upload-document-form";
import { Card, CardContent } from "@/components/ui/card";
import { ProcessDocumentButton } from "@/components/process-document-button";
import {GenerateConceptsButton } from "@/components/generate-concepts-button";
import { Link } from "lucide-react";

export default async function SubjectDetail({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: subject } = await supabase
    .from("subjects")
    .select("id, name, topic, teacher_id")
    .eq("id", subjectId)
    .single();

  if (!subject || subject.teacher_id !== user.id) notFound();

  const { data: documents } = await supabase
    .from("subject_documents")
    .select("id, file_name, uploaded_at")
    .eq("subject_id", subjectId)
    .order("uploaded_at", { ascending: false });

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-xl font-medium mb-1">{subject.name}</h1>
      <p className="text-sm text-muted-foreground mb-6">{subject.topic}</p>

      <UploadDocumentForm subjectId={subjectId} />

      <div className="flex flex-col gap-2 mt-6">
        {documents?.map((d) => (
          <Card key={d.id}>
            <CardContent className="pt-4 text-sm flex items-center justify-between">
                <span>{d.file_name}</span>
                <ProcessDocumentButton documentId={d.id} />
            </CardContent>
          </Card>
        ))}
        {documents?.length === 0 && (
          <p className="text-sm text-muted-foreground">Aún no subiste ningún documento.</p>
        )}
      </div>
      <div className="mt-8 pt-6 border-t">
        <h2 className="text-sm font-medium mb-3">Estructura de conceptos</h2>
        <div className="flex items-center gap-3">
          <GenerateConceptsButton subjectId={subjectId} />
          <Link href={`/docente/${subjectId}/conceptos`} className="text-sm text-muted-foreground hover:underline">
          Ver / validar conceptos →
          </Link>
        </div>
      </div>
    </main>
  );
}