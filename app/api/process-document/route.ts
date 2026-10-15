import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractText } from "@/lib/extract-text";
import { chunkText } from "@/lib/chunk-text";
import OpenAI from "openai";

//const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const text = await extractText(buffer, doc.file_name);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      return NextResponse.json({ error: "No se pudo extraer texto del documento" }, { status: 400 });
    }

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunks,
    });

    const rows = chunks.map((content, i) => ({
      document_id: doc.id,
      subject_id: doc.subject_id,
      content,
      embedding: embeddingResponse.data[i].embedding,
    }));

        const { data: inserted, error: insertError } = await supabase
      .from("document_chunks")
      .insert(rows)
      .select("id");

    if (insertError || !inserted) {
      return NextResponse.json({ error: insertError?.message ?? "No se pudieron guardar los fragmentos" }, { status: 500 });
    }

    // Se borran los fragmentos de procesamientos anteriores, ya con los nuevos guardados
    const newIds = inserted.map((r) => r.id);
    const { error: cleanupError } = await supabase
      .from("document_chunks")
      .delete()
      .eq("document_id", doc.id)
      .not("id", "in", `(${newIds.join(",")})`);

    if (cleanupError) {
      return NextResponse.json(
        { error: `Se procesó, pero no se pudieron limpiar los fragmentos anteriores: ${cleanupError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, chunksCreated: rows.length });

  } catch (err) {
    console.error("Error en process-document:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}