import { createClient } from "@/lib/supabase/server";
import { UploadDocumentForm } from "@/components/upload-document-form";
import { ProcessDocumentButton } from "@/components/process-document-button";
import { DeleteDocumentButton } from "@/components/delete-document-button";
import { Card, CardContent } from "@/components/ui/card";

// Paso 1 de "Contenido": subir y procesar el material. La página de la asignatura ya comprobó que el docente es el dueño.
export async function MaterialStep({ subjectId }: { subjectId: string }) {
  const supabase = await createClient();
  const { data: documents } = await supabase
    .from("subject_documents")
    .select("id, file_name, storage_path, uploaded_at")
    .eq("subject_id", subjectId)
    .order("uploaded_at", { ascending: false });

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-muted-foreground mb-6">
        Sube tu material (PDF o Word) y procésalo. La IA lo lee para proponerte los conceptos de la asignatura.
      </p>

      <UploadDocumentForm subjectId={subjectId} />

      <div className="flex flex-col gap-2 mt-6">
        {documents?.map((d) => (
          <Card key={d.id}>
            <CardContent className="text-sm flex flex-wrap items-center justify-between gap-2">
              <span className="truncate">{d.file_name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <ProcessDocumentButton documentId={d.id} />
                <DeleteDocumentButton documentId={d.id} storagePath={d.storage_path} fileName={d.file_name} />
              </div>
            </CardContent>
          </Card>
        ))}
        {documents?.length === 0 && (
          <p className="text-sm text-muted-foreground">Aún no subiste ningún documento.</p>
        )}
      </div>
    </div>
  );
}
