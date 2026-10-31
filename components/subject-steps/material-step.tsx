import { createClient } from "@/lib/supabase/server";
import { UploadDocumentForm } from "@/components/upload-document-form";
import { ProcessDocumentButton } from "@/components/process-document-button";
import { DeleteDocumentButton } from "@/components/delete-document-button";
import { Card, CardContent } from "@/components/ui/card";
import { GenerateStructureButton } from "@/components/generate-structure-button";

// Paso 1 de "Contenido": subir y procesar el material. La página de la asignatura ya comprobó que el docente es el dueño.
export async function MaterialStep({ subjectId }: { subjectId: string }) {
  const supabase = await createClient();
  const [{ data: documents }, { data: firstChunks }, { count: conceptCount }] = await Promise.all([
    supabase
      .from("subject_documents")
      .select("id, file_name, storage_path, uploaded_at")
      .eq("subject_id", subjectId)
      .order("uploaded_at", { ascending: false }),
    // Un documento está procesado si tiene fragmentos: basta con mirar el primero (position 0) de cada uno
    supabase.from("document_chunks").select("document_id").eq("subject_id", subjectId).eq("position", 0),
    supabase.from("concepts").select("id", { count: "exact", head: true }).eq("subject_id", subjectId),
  ]);
  const processed = new Set((firstChunks ?? []).map((c) => c.document_id)).size;

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

      {/* Toda la IA de la estructura en un solo paso: conceptos, fuentes, duplicados y temas */}
      <div className="mt-8 flex flex-col gap-2 rounded-card bg-secondary/60 p-5">
        <p className="font-medium">
          {(conceptCount ?? 0) > 0 ? "¿Subiste material nuevo?" : "Cuando tu material esté procesado"}
        </p>
        <p className="text-sm text-muted-foreground">
          La IA lee todo tu material procesado y te propone los conceptos de la asignatura con sus prerrequisitos y la
          cita de donde sale cada uno, y los organiza en temas. Después los revisas uno por uno en Estructura.
          {(conceptCount ?? 0) > 0 && " Solo se agregan conceptos nuevos: lo que ya revisaste no se toca."}
        </p>
        <div className="mt-2">
          {processed > 0 ? (
            <GenerateStructureButton subjectId={subjectId} hasConcepts={(conceptCount ?? 0) > 0} />
          ) : (
            <p className="text-sm font-medium">Procesa al menos un documento para continuar.</p>
          )}
        </div>
      </div>
    </div>
  );
}
