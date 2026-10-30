import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { z } from "zod";
import { buildSections, groupCandidates, type Candidate, type ChunkText } from "@/lib/concept-candidates";
import { computeMapEdges, type GraphConcept } from "@/lib/knowledge-graph";
import { findAndSaveEvidence } from "@/lib/concept-evidence";

// Conceptos sobre TODO el material (docs/MOTOR-DE-CONOCIMIENTO.md 4.2), en tres pasos:
//   1. la IA lee el material por tramos y propone candidatos de cada uno (en paralelo);
//   2. se unen los repetidos sin IA (mismo nombre o embeddings casi iguales);
//   3. una última llamada elige los más importantes, fusiona sinónimos y propone prerrequisitos directos.

// La ruta puede durar hasta 300 s en Vercel Hobby; caben 40 tramos de ~12 000 caracteres (unas 300 páginas), leídos
// de a 4 en paralelo. Con más material se leen los primeros 40 y se avisa.
export const maxDuration = 300;
const MAX_SECTIONS = 40;
const CONCURRENCY = 4;
const MODEL = "gpt-6-luna";

// Forma mínima de cada concepto de la IA; se valida ANTES de insertar para no dejar conceptos a medias.
// Sin descripción o sin prerrequisitos válidos el concepto se conserva: el docente lo completa al validar.
const AiConcept = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().catch(""),
  prerequisites: z.array(z.string().trim()).catch([]),
});

const AiCandidate = z.object({ name: z.string().trim().min(1), description: z.string().trim().catch("") });

const AiResponse = z.object({ concepts: z.array(z.unknown()) });

const RequestBody = z.object({ subjectId: z.uuid() });

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

// Todos los fragmentos de la asignatura en el orden del material. La API devuelve como mucho 1000 filas por consulta.
async function loadChunks(supabase: SupabaseServer, subjectId: string): Promise<ChunkText[] | null> {
  const PAGE = 1000;
  const rows: ChunkText[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("document_chunks")
      .select("document_id, position, content")
      .eq("subject_id", subjectId)
      .order("document_id")
      .order("position")
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("generate-concepts: no se pudieron leer los fragmentos:", error);
      return null;
    }
    rows.push(...data.map((r) => ({ documentId: r.document_id, position: r.position, content: r.content })));
    if (data.length < PAGE) return rows;
  }
}

// Paso 1 para un tramo. Si falla, se registra y se sigue con los demás (un tramo menos no invalida el resto).
async function candidatesFromSection(openai: OpenAI, section: string): Promise<Candidate[]> {
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Eres un asistente que ayuda a un docente universitario a estructurar su asignatura. Este es un tramo " +
            "de su material. Extrae entre 2 y 6 conceptos que se enseñan o se usan en este tramo, cada uno con una " +
            "descripción breve (1-2 oraciones). Usa nombres cortos y precisos, como los del material. " +
            'Responde solo JSON: {"concepts": [{"name": "...", "description": "..."}]}',
        },
        { role: "user", content: section },
      ],
    });
    const parsed = AiResponse.safeParse(JSON.parse(completion.choices[0].message.content ?? "null"));
    if (!parsed.success) return [];
    return parsed.data.concepts.flatMap((item) => {
      const c = AiCandidate.safeParse(item);
      return c.success ? [c.data] : [];
    });
  } catch (err) {
    console.error("generate-concepts: falló la lectura de un tramo:", err);
    return [];
  }
}

// Ejecuta fn sobre cada elemento con como mucho `limit` llamadas a la vez, conservando el orden
async function mapWithLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function POST(req: NextRequest) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const body = RequestBody.safeParse(await req.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
    const { subjectId } = body.data;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const chunks = await loadChunks(supabase, subjectId);
    if (!chunks) return NextResponse.json({ error: "No se pudo leer el material" }, { status: 500 });
    if (chunks.length === 0) {
      return NextResponse.json({ error: "No hay documentos procesados para esta asignatura" }, { status: 400 });
    }

    const allSections = buildSections(chunks);
    const sections = allSections.slice(0, MAX_SECTIONS);
    const skippedSections = allSections.length - sections.length;

    // Regenerar solo añade conceptos nuevos: los existentes (validados o no) no se tocan
    const { data: existing, error: existingError } = await supabase
      .from("concepts")
      .select("id, name, prerequisite_ids")
      .eq("subject_id", subjectId);
    if (existingError) {
      console.error("generate-concepts: no se pudieron leer los conceptos existentes:", existingError);
      return NextResponse.json({ error: "No se pudieron revisar los conceptos existentes" }, { status: 500 });
    }
    const existingNames = (existing ?? []).map((c) => c.name);
    const existingHint =
      existingNames.length > 0
        ? "Ya existen estos conceptos; NO los repitas, pero puedes usarlos como prerrequisitos: " +
          JSON.stringify(existingNames) + ". "
        : "";

    const { data: allowed, error: quotaError } = await supabase.rpc("consume_ai_quota", { p_route: "generate-concepts" });
    if (quotaError) {
      console.error("generate-concepts: no se pudo verificar el límite de uso:", quotaError);
      return NextResponse.json({ error: "No se pudo verificar el límite de uso de IA" }, { status: 500 });
    }
    if (!allowed) {
      return NextResponse.json(
        { error: "Alcanzaste el límite de 30 usos de IA en 24 horas. Inténtalo más tarde." },
        { status: 429 }
      );
    }

    // Paso 1: candidatos de cada tramo, en paralelo
    const perSection = await mapWithLimit(sections, CONCURRENCY, (s) => candidatesFromSection(openai, s));
    const candidates = perSection.flat();
    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron conceptos en el material. Revisa que el documento tenga contenido temático y texto legible." },
        { status: 422 }
      );
    }

    // Paso 2: unir repetidos sin IA (mismo nombre o significado casi igual)
    const { data: candidateEmbeddings } = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: candidates.map((c) => `${c.name}: ${c.description}`),
    });
    const groups = groupCandidates(candidates, candidateEmbeddings.map((e) => e.embedding));

    // Paso 3: elegir los más importantes, fusionar sinónimos y proponer prerrequisitos directos
    const completion = await openai.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Eres un asistente que ayuda a un docente universitario a estructurar su asignatura. Recibes los " +
            "conceptos candidatos encontrados al leer TODO su material, en orden de aparición y con cuántas partes " +
            "del material los mencionan (más menciones suele indicar un concepto más central). " +
            "Elige entre 4 y 25 conceptos clave, según la extensión y la variedad del material: los centrales para " +
            "la asignatura, no detalles sueltos. Si dos candidatos son el mismo concepto, quédate con uno. " +
            "Mantén los nombres de la lista siempre que puedas. Para cada concepto da una descripción breve (1-2 " +
            "oraciones) y sus prerrequisitos DIRECTOS: solo los conceptos que hace falta entender inmediatamente " +
            "antes, no toda la cadena hacia atrás (si A requiere B y B requiere C, A lista solo B). Los " +
            "prerrequisitos deben ser nombres de tu propia lista o de los conceptos que ya existen. " +
            existingHint +
            "Responde solo JSON, con este formato exacto: " +
            '{"concepts": [{"name": "...", "description": "...", "prerequisites": ["nombre de otro concepto", ...]}]}',
        },
        { role: "user", content: JSON.stringify(groups) },
      ],
    });

    const raw = completion.choices[0].message.content;
    if (!raw) return NextResponse.json({ error: "La IA no devolvió contenido" }, { status: 500 });

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      json = null;
    }
    const envelope = AiResponse.safeParse(json);
    if (!envelope.success) {
      console.error("generate-concepts: la IA devolvió un formato inválido:", raw);
      return NextResponse.json(
        { error: "La IA devolvió una respuesta con formato inválido. Vuelve a intentarlo." },
        { status: 502 }
      );
    }

    // Cada concepto se valida por separado. Se descartan los nombres repetidos en el lote y los que ya existen
    // (misma comparación que el índice único: sin mayúsculas ni espacios en los extremos)
    const concepts: z.infer<typeof AiConcept>[] = [];
    const seenNames = new Set(existingNames.map((n) => n.trim().toLowerCase()));
    let discarded = 0;
    for (const item of envelope.data.concepts) {
      const result = AiConcept.safeParse(item);
      const key = result.success ? result.data.name.toLowerCase() : "";
      if (result.success && !seenNames.has(key)) {
        seenNames.add(key);
        concepts.push(result.data);
      } else {
        discarded += 1;
      }
    }
    if (discarded > 0) {
      console.warn(`generate-concepts: ${discarded} concepto(s) descartado(s) por formato inválido o nombre repetido`);
    }

    if (concepts.length === 0 && existingNames.length > 0) {
      return NextResponse.json(
        { error: "La IA no propuso conceptos nuevos: todo lo que encontró en el material ya está en la asignatura." },
        { status: 422 }
      );
    }
    if (concepts.length === 0) {
      console.error("generate-concepts: la IA devolvió 0 conceptos válidos. Respuesta:", raw);
      return NextResponse.json(
        { error: "No se encontraron conceptos en el material. Revisa que el documento tenga contenido temático y texto legible." },
        { status: 422 }
      );
    }

    // Primera pasada: insertar los conceptos sin prerrequisitos todavía
    const { data: inserted, error: insertError } = await supabase
      .from("concepts")
      .insert(
        concepts.map((c) => ({
          subject_id: subjectId,
          name: c.name,
          description: c.description,
          status: "sugerido",
        }))
      )
      .select("id, name");

    if (insertError || !inserted) {
      console.error("generate-concepts: no se pudieron guardar los conceptos:", insertError);
      return NextResponse.json({ error: "No se pudieron guardar los conceptos. Inténtalo de nuevo." }, { status: 500 });
    }

    // Segunda pasada: resolver nombres de prerrequisitos a ids reales (sin distinguir mayúsculas, sin autorreferencias).
    // Un concepto nuevo puede depender de uno nuevo o de uno que ya existía.
    const nameToId = new Map(
      [...(existing ?? []), ...inserted].map((c) => [c.name.trim().toLowerCase(), c.id])
    );
    const newConcepts: GraphConcept[] = concepts.flatMap((c) => {
      const ownId = nameToId.get(c.name.toLowerCase());
      if (!ownId) return [];
      const prereqIds = c.prerequisites
        .map((p) => nameToId.get(p.toLowerCase()))
        .filter((id): id is string => !!id && id !== ownId);
      return [{ id: ownId, name: c.name, prerequisite_ids: [...new Set(prereqIds)] }];
    });

    // Solo prerrequisitos directos: si A ya llega a C pasando por B, A no guarda C. Es la misma regla con la que el
    // mapa oculta las flechas redundantes (computeMapEdges, que también tolera ciclos). Se aplica solo a los conceptos
    // nuevos; los existentes no se tocan.
    const directEdges = computeMapEdges([...(existing ?? []), ...newConcepts]);
    for (const c of newConcepts) {
      const direct = directEdges.filter((e) => e.target === c.id).map((e) => e.source);
      if (direct.length > 0) {
        await supabase.from("concepts").update({ prerequisite_ids: direct }).eq("id", c.id);
      }
    }

    // Citas del material de los conceptos nuevos. Si fallan, los conceptos ya están guardados: las citas se pueden
    // buscar después con /api/generate-evidence ("Buscar fuentes").
    let evidence = null;
    try {
      const described = new Map(concepts.map((c) => [c.name.toLowerCase(), c.description]));
      evidence = await findAndSaveEvidence(
        supabase,
        openai,
        subjectId,
        inserted.map((c) => ({ id: c.id, name: c.name, description: described.get(c.name.toLowerCase()) ?? null }))
      );
    } catch (err) {
      console.error("generate-concepts: los conceptos se guardaron, pero falló la búsqueda de citas:", err);
    }

    console.info(
      `generate-concepts: ${sections.length} tramos leídos (${skippedSections} sin leer), ` +
        `${candidates.length} candidatos, ${groups.length} tras unir repetidos, ${inserted.length} conceptos nuevos` +
        (evidence ? `, ${evidence.withQuote} con cita` : ", sin citas (falló la búsqueda)")
    );
    return NextResponse.json({ success: true, count: inserted.length, sections: sections.length, skippedSections });
  } catch (err) {
    // El detalle técnico (OpenAI, Postgres) queda en el log del servidor; al navegador, un mensaje genérico
    console.error("Error en generate-concepts:", err);
    return NextResponse.json(
      { error: "Ocurrió un error al generar los conceptos. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}