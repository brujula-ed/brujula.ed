import type OpenAI from "openai";
import type { createClient } from "@/lib/supabase/server";

// Búsqueda híbrida en el material de una asignatura (función SQL search_chunks, docs/MOTOR-DE-CONOCIMIENTO.md 4.2).
// Solo funciona con la sesión del docente dueño de la asignatura (la RLS de document_chunks se aplica).

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export type MaterialHit = {
  id: string;
  documentId: string;
  content: string;
  pageStart: number | null;
  pageEnd: number | null;
  section: string | null;
  position: number;
  score: number;
};

// Una lista de resultados por consulta, en el mismo orden. Los embeddings de todas las consultas se piden en una sola
// llamada a OpenAI (más barato y rápido que una por consulta).
export async function searchMaterial(
  supabase: SupabaseServer,
  openai: OpenAI,
  subjectId: string,
  queries: string[],
  limit = 8
): Promise<MaterialHit[][]> {
  if (queries.length === 0) return [];

  const { data: embeddings } = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: queries,
  });

  return Promise.all(
    queries.map(async (query, i) => {
      const { data, error } = await supabase.rpc("search_chunks", {
        p_subject_id: subjectId,
        p_query: query,
        p_query_embedding: JSON.stringify(embeddings[i].embedding),
        p_limit: limit,
      });
      if (error) throw new Error(`search_chunks: ${error.message}`);
      return (data ?? []).map((r) => ({
        id: r.id,
        documentId: r.document_id,
        content: r.content,
        pageStart: r.page_start,
        pageEnd: r.page_end,
        section: r.section,
        position: r.position,
        score: r.score,
      }));
    })
  );
}
