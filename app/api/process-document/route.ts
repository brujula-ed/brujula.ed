import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractText } from "@/lib/extract-text";
import { chunkText } from "@/lib/chunk-text";
import OpenAI from "openai";

//const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Máximo del plan Hobby con Fluid Compute (300 s). En Pro se puede subir hasta 800 s.
export const maxDuration = 300;

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB, mismo límite que el formulario y el bucket
// OpenAI acepta hasta 2048 textos y 300 000 tokens por llamada; 100 fragmentos de ~400 tokens quedan muy por debajo
const EMBEDDING_BATCH = 100;

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

// Borra fragmentos por id en tandas: una lista larga de ids no cabe en una sola URL
async function deleteChunks(supabase: SupabaseServer, ids: string[]) {
  for (let i = 0; i < ids.length; i += EMBEDDING_BATCH) {
    const { error } = await supabase.from("document_chunks").delete().in("id", ids.slice(i, i + EMBEDDING_BATCH));
    if (error) return error;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { documentId } = await req.json();
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { data: doc, error: docError } = await supabase
      .from("subject_documents")
      .select("id, subject_id, storage_path, file_name")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("course-documents")
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: "No se pudo descargar el archivo" }, { status: 500 });
    }

    if (fileData.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "El archivo supera el límite de 10 MB." }, { status: 413 });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const text = await extractText(buffer, doc.file_name);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      return NextResponse.json({ error: "No se pudo extraer texto del documento" }, { status: 400 });
    }

    const { data: allowed, error: quotaError } = await supabase.rpc("consume_ai_quota", { p_route: "process-document" });
    if (quotaError) {
      console.error("process-document: no se pudo verificar el límite de uso:", quotaError);
      return NextResponse.json({ error: "No se pudo verificar el límite de uso de IA" }, { status: 500 });
    }
    if (!allowed) {
      return NextResponse.json(
        { error: "Alcanzaste el límite de 30 usos de IA en 24 horas. Inténtalo más tarde." },
        { status: 429 }
      );
    }

    // Embeddings e inserción por tandas. Si una tanda falla, se deshace lo nuevo y el documento queda como estaba.
    const newIds: string[] = [];
    let firstNewAt: string | null = null; // hora (de la base de datos) de la primera tanda nueva
    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH) {
      const batch = chunks.slice(i, i + EMBEDDING_BATCH);
      try {
        const embeddingResponse = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: batch,
        });
        const { data: inserted, error: insertError } = await supabase
          .from("document_chunks")
          .insert(
            batch.map((content, j) => ({
              document_id: doc.id,
              subject_id: doc.subject_id,
              content,
              embedding: embeddingResponse.data[j].embedding,
            }))
          )
          .select("id, created_at");
        if (insertError || !inserted) {
          throw new Error(insertError?.message ?? "No se pudieron guardar los fragmentos");
        }
        newIds.push(...inserted.map((r) => r.id));
        firstNewAt ??= inserted[0]?.created_at ?? null;
      } catch (err) {
        const rollbackError = await deleteChunks(supabase, newIds);
        if (rollbackError) console.error("process-document: no se pudo deshacer la tanda fallida:", rollbackError);
        throw err;
      }
    }

    // Fragmentos de procesamientos anteriores: todos los del documento creados antes de la primera tanda nueva.
    // Una sola sentencia, sin lista de ids (que podría superar las 1000 filas o no caber en la URL).
    const { error: cleanupError } = firstNewAt
      ? await supabase.from("document_chunks").delete().eq("document_id", doc.id).lt("created_at", firstNewAt)
      : { error: null };
    if (cleanupError) {
      return NextResponse.json(
        { error: `Se procesó, pero no se pudieron limpiar los fragmentos anteriores: ${cleanupError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, chunksCreated: newIds.length });

  } catch (err) {
    console.error("Error en process-document:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}