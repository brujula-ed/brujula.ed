import type OpenAI from "openai";
import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";

// Posibles duplicados entre conceptos (docs/MOTOR-DE-CONOCIMIENTO.md 4.3, versión simple): los embeddings eligen las
// parejas más parecidas y la IA juzga cuáles son de verdad el mismo concepto. El docente decide qué hacer.
// Calibración del 31/10/2026 (23 conceptos de una misma disciplina): las parejas relacionadas llegan a 0,72–0,80 de
// parecido, así que ningún umbral separa duplicados de conceptos cercanos solo con embeddings. En esa prueba la IA marcó
// una pareja de 10 ("Discurso videolúdico" / "Videojuego como discurso") y el docente decidió que no son el mismo.

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

const CANDIDATE_MIN_SIMILARITY = 0.6; // por debajo, ni se le pregunta a la IA (mediana de la calibración: 0,44)
const MAX_CANDIDATES = 10; // parejas más parecidas que juzga la IA, en una sola llamada
const MODEL = "gpt-6-luna";

const AiVerdict = z.object({ par: z.string(), razon: z.string().trim().min(1).max(300) });
const AiResponse = z.object({ duplicados: z.array(z.unknown()) });

// Calcula y guarda el embedding de cada concepto dado, en una sola llamada a OpenAI. Devuelve cuántos guardó.
export async function saveConceptEmbeddings(
  supabase: SupabaseServer,
  openai: OpenAI,
  concepts: { id: string; name: string; description: string | null }[]
): Promise<number> {
  if (concepts.length === 0) return 0;
  const { data } = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: concepts.map((c) => `${c.name}: ${c.description ?? ""}`),
  });
  const results = await Promise.all(
    concepts.map((c, i) =>
      supabase
        .from("concepts")
        .update({ embedding: JSON.stringify(data[i].embedding) }) // pgvector lo recibe como texto, igual que los fragmentos
        .eq("id", c.id)
        .select("id")
    )
  );
  return results.filter((r) => !r.error && r.data?.length).length;
}

// Recalcula los posibles duplicados de la asignatura y reemplaza los guardados. Devuelve cuántos confirmó la IA.
// Las parejas que el docente marcó como "No son el mismo" no vuelven (similar_concepts ya las excluye).
export async function refreshDuplicateCandidates(
  supabase: SupabaseServer,
  openai: OpenAI,
  subjectId: string
): Promise<number> {
  const { data: similar, error } = await supabase.rpc("similar_concepts", {
    p_subject_id: subjectId,
    p_min_similarity: CANDIDATE_MIN_SIMILARITY,
  });
  if (error) throw new Error(`similar_concepts: ${error.message}`);
  const pairs = (similar ?? []).slice(0, MAX_CANDIDATES);

  const { error: deleteError } = await supabase.from("concept_duplicate_candidates").delete().eq("subject_id", subjectId);
  if (deleteError) throw new Error(`concept_duplicate_candidates (borrar): ${deleteError.message}`);
  if (pairs.length === 0) return 0;

  const ids = [...new Set(pairs.flatMap((p) => [p.concept_a, p.concept_b]))];
  const { data: concepts } = await supabase.from("concepts").select("id, name, description").in("id", ids);
  const byId = new Map((concepts ?? []).map((c) => [c.id, c]));
  const describe = (id: string) => ({ nombre: byId.get(id)?.name ?? "", descripcion: byId.get(id)?.description ?? "" });

  const completion = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Ayudas a un docente universitario a limpiar los conceptos de su asignatura. Recibes parejas de conceptos " +
          "parecidos. Indica SOLO las parejas que son el mismo concepto con otro nombre (sinónimos o la misma idea " +
          "formulada distinto), de modo que conviene quedarse con uno. NO marques conceptos relacionados, uno parte " +
          "del otro, o uno general y otro específico: esos son distintos. Para cada duplicado, da una razón de una " +
          'oración. Responde solo JSON: {"duplicados": [{"par": "P1", "razon": "..."}]} (lista vacía si no hay).',
      },
      {
        role: "user",
        content: JSON.stringify(pairs.map((p, i) => ({ par: `P${i + 1}`, a: describe(p.concept_a), b: describe(p.concept_b) }))),
      },
    ],
  });
  const parsed = AiResponse.safeParse(JSON.parse(completion.choices[0].message.content ?? "null"));
  if (!parsed.success) return 0;

  const rows = parsed.data.duplicados.flatMap((item) => {
    const v = AiVerdict.safeParse(item);
    const pair = v.success ? pairs[Number(v.data.par.replace(/\D/g, "")) - 1] : undefined;
    return v.success && pair
      ? [{ concept_a: pair.concept_a, concept_b: pair.concept_b, subject_id: subjectId, reason: v.data.razon, similarity: pair.similarity }]
      : [];
  });
  const unique = rows.filter((r, i) => rows.findIndex((o) => o.concept_a === r.concept_a && o.concept_b === r.concept_b) === i);
  if (unique.length > 0) {
    const { error: insertError } = await supabase.from("concept_duplicate_candidates").insert(unique);
    if (insertError) throw new Error(`concept_duplicate_candidates (guardar): ${insertError.message}`);
  }
  return unique.length;
}
