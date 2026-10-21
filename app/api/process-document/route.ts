import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractText } from "@/lib/extract-text";
import { chunkText } from "@/lib/chunk-text";
import OpenAI from "openai";
import { z } from "zod";

const RequestBody = z.object({ documentId: z.uuid() });

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
    const body = RequestBody.safeParse(await req.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
    const { documentId } = body.data;
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
    // Formato no soportado o archivo dañado: mensaje útil para el docente, detalle técnico solo en el log
    let text: string;
    try {
      text = await extractText(buffer, doc.file_name);
    } catch (extractError) {
      console.error("process-document: no se pudo extraer el texto:", extractError);
      return NextResponse.json(
        { error: "No se pudo leer el documento. Sube un PDF con texto o un Word (.docx) válido." },
        { status: 400 }
      );
    }
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
              // pgvector recibe el vector como texto "[0.1,0.2,...]" (así lo describen los tipos generados)
              embedding: JSON.stringify(embeddingResponse.data[j].embedding),
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
      console.error("process-document: no se pudieron limpiar los fragmentos anteriores:", cleanupError);
      return NextResponse.json(
        { error: "Se procesó, pero no se pudieron limpiar los fragmentos anteriores. Vuelve a procesarlo." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, chunksCreated: newIds.length });

  } catch (err) {
    // El detalle técnico (OpenAI, Postgres) queda en el log del servidor; al navegador, un mensaje genérico
    console.error("Error en process-document:", err);
    return NextResponse.json(
      { error: "Ocurrió un error al procesar el documento. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}