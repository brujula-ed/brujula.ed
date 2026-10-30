import type OpenAI from "openai";
import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";
import { searchMaterial, type MaterialHit } from "@/lib/search-material";

// Citas del material que respaldan cada concepto (docs/MOTOR-DE-CONOCIMIENTO.md 4.2):
//   1. búsqueda híbrida de los fragmentos más relevantes de cada concepto;
//   2. la IA elige hasta 2 citas textuales de esos fragmentos;
//   3. se comprueba sin IA que cada cita esté tal cual en su fragmento (la tabla evidence_spans lo vuelve a comprobar).

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;
export type EvidenceConcept = { id: string; name: string; description: string | null };
export type EvidenceResult = { withQuote: number; withoutQuote: number; discarded: number };

const MODEL = "gpt-6-luna"; // el mismo de generate-concepts
const HITS_PER_CONCEPT = 4;
const CONCEPTS_PER_CALL = 5;
const MAX_QUOTES = 2;
const CONCURRENCY = 4;

// Misma comparación que normalize_quote_text en la base de datos (migración evidencias_del_material): cambiarlas juntas
export function normalizeForQuote(text: string): string {
  return text
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// La cita tiene que estar tal cual en el fragmento (salvo espacios, comillas y guiones tipográficos) y medir 20 a 400
export function verifyQuote(quote: string, chunkContent: string): boolean {
  const q = normalizeForQuote(quote);
  return q.length >= 20 && q.length <= 400 && normalizeForQuote(chunkContent).includes(q);
}

const AiQuote = z.object({
  concepto: z.string().trim(),
  fragmento: z.string().trim(),
  cita: z.string(),
});
const AiResponse = z.object({ citas: z.array(z.unknown()) });

type Found = { conceptId: string; hit: MaterialHit; quote: string };

// Paso 2 para un grupo de conceptos. Si la llamada falla, ese grupo queda sin citas y se sigue con los demás.
async function quotesForBatch(
  openai: OpenAI,
  batch: { concept: EvidenceConcept; hits: MaterialHit[] }[]
): Promise<{ found: Found[]; discarded: number }> {
  const payload = batch.map((b, i) => ({
    concepto: `C${i + 1}`,
    nombre: b.concept.name,
    descripcion: b.concept.description ?? "",
    fragmentos: b.hits.map((h, j) => ({ id: `F${j + 1}`, texto: h.content })),
  }));

  let items: unknown[] = [];
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Ayudas a un docente universitario a mostrar de dónde sale cada concepto de su asignatura. Para cada " +
            `concepto recibes fragmentos de su material. Elige hasta ${MAX_QUOTES} citas que mejor definan o ` +
            "expliquen el concepto. Cada cita son 1 o 2 oraciones COPIADAS LITERALMENTE de un solo fragmento, " +
            "carácter por carácter, sin cambiar, resumir ni completar nada (entre 20 y 300 caracteres). Si ningún " +
            "fragmento trata realmente el concepto, no des citas para él. " +
            'Responde solo JSON: {"citas": [{"concepto": "C1", "fragmento": "F2", "cita": "..."}]}',
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const parsed = AiResponse.safeParse(JSON.parse(completion.choices[0].message.content ?? "null"));
    items = parsed.success ? parsed.data.citas : [];
  } catch (err) {
    console.error("concept-evidence: falló la búsqueda de citas de un grupo:", err);
    return { found: [], discarded: 0 };
  }

  const found: Found[] = [];
  let discarded = 0;
  for (const item of items) {
    const q = AiQuote.safeParse(item);
    const b = q.success ? batch[Number(q.data.concepto.replace(/\D/g, "")) - 1] : undefined;
    const hit = q.success && b ? b.hits[Number(q.data.fragmento.replace(/\D/g, "")) - 1] : undefined;
    // Se descarta lo que no se puede ubicar, lo que no está tal cual en el fragmento, lo repetido y lo que sobra
    const quote = q.success ? normalizeForQuote(q.data.cita) : "";
    const ok =
      b && hit && verifyQuote(quote, hit.content) &&
      !found.some((f) => f.conceptId === b.concept.id && f.quote === quote) &&
      found.filter((f) => f.conceptId === b.concept.id).length < MAX_QUOTES;
    if (ok) found.push({ conceptId: b.concept.id, hit, quote });
    else discarded += 1;
  }
  return { found, discarded };
}

// Busca y guarda las citas de los conceptos dados; reemplaza las que tuvieran antes.
export async function findAndSaveEvidence(
  supabase: SupabaseServer,
  openai: OpenAI,
  subjectId: string,
  concepts: EvidenceConcept[]
): Promise<EvidenceResult> {
  if (concepts.length === 0) return { withQuote: 0, withoutQuote: 0, discarded: 0 };

  // Paso 1: fragmentos relevantes de cada concepto (todos los embeddings en una sola llamada)
  const hits = await searchMaterial(
    supabase,
    openai,
    subjectId,
    concepts.map((c) => `${c.name}: ${c.description ?? ""}`),
    HITS_PER_CONCEPT
  );
  const withHits = concepts.map((concept, i) => ({ concept, hits: hits[i] })).filter((b) => b.hits.length > 0);

  // Paso 2: citas, de a CONCEPTS_PER_CALL conceptos por llamada y CONCURRENCY llamadas a la vez
  const batches: (typeof withHits)[] = [];
  for (let i = 0; i < withHits.length; i += CONCEPTS_PER_CALL) batches.push(withHits.slice(i, i + CONCEPTS_PER_CALL));
  const results: { found: Found[]; discarded: number }[] = [];
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    results.push(...(await Promise.all(batches.slice(i, i + CONCURRENCY).map((b) => quotesForBatch(openai, b)))));
  }
  const found = results.flatMap((r) => r.found);
  const discarded = results.reduce((s, r) => s + r.discarded, 0);

  // Paso 3: reemplazar las citas anteriores de estos conceptos (solo las de concepto, no las de preguntas)
  const ids = concepts.map((c) => c.id);
  const { error: deleteError } = await supabase
    .from("evidence_spans")
    .delete()
    .in("concept_id", ids)
    .is("question_id", null);
  if (deleteError) throw new Error(`evidence_spans (borrar): ${deleteError.message}`);

  if (found.length > 0) {
    // subject_id, document_id, páginas y sección los completa la base desde el concepto y el fragmento
    const { error: insertError } = await supabase.from("evidence_spans").insert(
      found.map((f) => ({
        concept_id: f.conceptId,
        chunk_id: f.hit.id,
        quote: f.quote,
        subject_id: subjectId,
        document_id: f.hit.documentId,
      }))
    );
    if (insertError) throw new Error(`evidence_spans (guardar): ${insertError.message}`);
  }

  const withQuote = new Set(found.map((f) => f.conceptId)).size;
  return { withQuote, withoutQuote: concepts.length - withQuote, discarded };
}
