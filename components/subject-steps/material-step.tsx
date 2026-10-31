import { Check, CircleAlert, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MaterialUpload } from "@/components/material-upload";
import { ProcessDocumentButton } from "@/components/process-document-button";
import { DeleteDocumentButton } from "@/components/delete-document-button";
import { GenerateStructureButton } from "@/components/generate-structure-button";

const dateFormat = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });

// Paso 1 de "Contenido": subir y procesar el material. La página de la asignatura ya comprobó que el docente es el dueño.
export async function MaterialStep({ subjectId }: { subjectId: string }) {
  const supabase = await createClient();
  const [{ data: documents }, { count: conceptCount }] = await Promise.all([
    supabase
      .from("subject_documents")
      .select("id, file_name, storage_path, uploaded_at")
      .eq("subject_id", subjectId)
      .order("uploaded_at", { ascending: false }),
    supabase.from("concepts").select("id", { count: "exact", head: true }).eq("subject_id", subjectId),
  ]);

  // Estado de cada documento: cuántos fragmentos tiene (0 = sin procesar) y hasta qué página llega (solo PDF). Dos
  // consultas pequeñas por documento: contar sin traer filas y leer solo la última página.
  const stats = await Promise.all(
    (documents ?? []).map(async (d) => {
      const [{ count }, { data: last }] = await Promise.all([
        supabase.from("document_chunks").select("id", { count: "exact", head: true }).eq("document_id", d.id),
        supabase
          .from("document_chunks")
          .select("page_end")
          .eq("document_id", d.id)
          .not("page_end", "is", null)
          .order("page_end", { ascending: false })
          .limit(1),
      ]);
      return { chunks: count ?? 0, lastPage: last?.[0]?.page_end ?? null };
    })
  );
  const processed = stats.filter((s) => s.chunks > 0).length;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Sube el material de tu curso. Se procesa al subirlo: se lee el texto por página o por sección y se prepara para
        que la IA encuentre lo relevante de cada concepto.
      </p>

      <MaterialUpload subjectId={subjectId} />

      {documents && documents.length > 0 && (
        <section aria-labelledby="documents-title" className="flex flex-col gap-3">
          <h3 id="documents-title" className="text-subsection">
            Tus documentos <span className="font-normal text-muted-foreground">· {processed} de {documents.length} procesados</span>
          </h3>
          <ul className="flex flex-col gap-2">
            {documents.map((d, i) => {
              const { chunks, lastPage } = stats[i];
              const isWord = d.file_name.toLowerCase().endsWith(".docx");
              return (
                <li
                  key={d.id}
                  className="flex flex-col gap-3 rounded-card bg-card p-4 shadow-rest sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 flex-col items-center justify-center rounded-control bg-secondary text-secondary-foreground"
                    >
                      <FileText className="size-4" />
                      <span className="text-[0.625rem] font-semibold leading-none">{isWord ? "WORD" : "PDF"}</span>
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="font-medium break-words">{d.file_name}</p>
                      {chunks > 0 ? (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Check aria-hidden="true" className="size-3.5 text-primary" />
                          Procesado · {chunks} fragmentos{lastPage !== null && ` · hasta la pág. ${lastPage}`}
                        </p>
                      ) : (
                        <p className="flex items-center gap-1 text-xs font-medium">
                          <CircleAlert aria-hidden="true" className="size-3.5" />
                          Sin procesar: la IA aún no puede usarlo
                        </p>
                      )}
                      {d.uploaded_at && (
                        <p className="text-xs text-muted-foreground">Subido el {dateFormat.format(new Date(d.uploaded_at))}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <DeleteDocumentButton documentId={d.id} storagePath={d.storage_path} fileName={d.file_name} />
                    <ProcessDocumentButton documentId={d.id} fileName={d.file_name} processed={chunks > 0} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Toda la IA de la estructura en un solo paso: conceptos, fuentes, duplicados y temas */}
      <div className="mt-2 flex flex-col gap-2 rounded-card bg-secondary/60 p-5">
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
