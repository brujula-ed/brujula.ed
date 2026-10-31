import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { z } from "zod";
import { searchMaterial, type MaterialHit } from "@/lib/search-material";

// Cada concepto recibe sus fragmentos más relevantes del material (búsqueda híbrida, docs/MOTOR-DE-CONOCIMIENTO.md
// 4.2), de a CONCEPTS_PER_CALL conceptos por llamada, con el panorama completo de la asignatura en cada una.
export const maxDuration = 300;
const MODEL = "gpt-6-luna";
const HITS_PER_CONCEPT = 4;
const CONCEPTS_PER_CALL = 5;
const CONCURRENCY = 4;

// Forma mínima de cada ficha de la IA. Lo que no cumpla se descarta antes de guardar
// (el contenido lo sigue revisando el docente al validar).
const AiCard = z.object({
  concepto: z.string().trim(), // etiqueta del concepto en la llamada ("C1"), no su nombre
  whyItMatters: z.string().trim().min(1).max(600),
  application: z.string().trim().min(1).max(600),
  // Si la IA no lo indica, se trata como conocimiento general: obliga al docente a revisar con más cuidado
  source: z.enum(["material", "general"]).catch("general"),
});

const AiResponse = z.object({ cards: z.array(z.unknown()) });

const RequestBody = z.object({ subjectId: z.uuid() });

export async function POST(req: NextRequest) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const body = RequestBody.safeParse(await req.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
    const { subjectId } = body.data;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    // Los estudiantes inscritos también leen conceptos validados: sin esto podrían disparar la llamada a OpenAI
    const { data: subject } = await supabase
      .from("subjects")
      .select("teacher_id, name, description")
      .eq("id", subjectId)
      .maybeSingle();
    if (!subject || subject.teacher_id !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { data: concepts, error: conceptsError } = await supabase
      .from("concepts")
      .select("id, name, description, prerequisite_ids")
      .eq("subject_id", subjectId)
      .eq("status", "validado");

    if (conceptsError || !concepts || concepts.length === 0) {
      return NextResponse.json({ error: "No hay conceptos validados todavía" }, { status: 400 });
    }

    // Regenerar solo completa: los conceptos que ya tienen ficha (sugerida o validada) no se tocan
    const { data: existing, error: existingError } = await supabase
      .from("concept_cards")
      .select("concept_id")
      .eq("subject_id", subjectId);
    if (existingError) {
      console.error("generate-concept-cards: no se pudieron leer las fichas existentes:", existingError);
      return NextResponse.json({ error: "No se pudieron revisar las fichas existentes" }, { status: 500 });
    }
    const withCard = new Set((existing ?? []).map((c) => c.concept_id));
    const pending = concepts.filter((c) => !withCard.has(c.id));
    // No es un error: todas las fichas existen. Se responde bien, con un aviso que el botón muestra tal cual.
    if (pending.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        notice: "Todos los conceptos validados ya tienen ficha. Descarta alguna si quieres generar otra.",
      });
    }

    // Panorama de la materia: cada concepto con lo que necesita y lo que desbloquea (solo conceptos validados)
    const nameById = new Map(concepts.map((c) => [c.id, c.name]));
    const withRelations = (c: (typeof concepts)[number]) => ({
      name: c.name,
      description: c.description,
      necesita: c.prerequisite_ids.map((id) => nameById.get(id)).filter((n): n is string => !!n),
      desbloquea: concepts.filter((o) => o.prerequisite_ids.includes(c.id)).map((o) => o.name),
    });

    // El material del docente es la primera fuente; si no alcanza, la IA completa y lo marca como "general"
    const { count: chunkCount, error: chunksError } = await supabase
      .from("document_chunks")
      .select("id", { count: "exact", head: true })
      .eq("subject_id", subjectId);
    if (chunksError || !chunkCount) {
      return NextResponse.json({ error: "No hay documentos procesados para esta asignatura" }, { status: 400 });
    }

    const { data: allowed, error: quotaError } = await supabase.rpc("consume_ai_quota", {
      p_route: "generate-concept-cards",
    });
    if (quotaError) {
      console.error("generate-concept-cards: no se pudo verificar el límite de uso:", quotaError);
      return NextResponse.json({ error: "No se pudo verificar el límite de uso de IA" }, { status: 500 });
    }
    if (!allowed) {
      return NextResponse.json(
        { error: "Alcanzaste el límite de 30 usos de IA en 24 horas. Inténtalo más tarde." },
        { status: 429 }
      );
    }

    // Fragmentos de cada concepto pendiente (todos los embeddings en una sola llamada)
    const hits = await searchMaterial(
      supabase,
      openai,
      subjectId,
      pending.map((c) => `${c.name}: ${c.description ?? ""}`),
      HITS_PER_CONCEPT
    );
    const panorama = JSON.stringify(concepts.map(withRelations));

    // Una llamada por grupo; si falla, ese grupo queda sin fichas y el aviso final lo cuenta como omitido
    async function cardsForBatch(batch: { concept: (typeof pending)[number]; hits: MaterialHit[] }[]) {
      try {
        const completion = await openai.chat.completions.create({
          model: MODEL,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "Eres un asistente que ayuda a un docente a preparar una ficha breve de cada concepto de su materia, " +
                "para sus estudiantes. Escribe una ficha para CADA concepto de la lista \"pendientes\", sin omitir " +
                "ninguno. Cada ficha tiene dos textos de 1 a 3 oraciones, en español claro y tuteando al estudiante:\n" +
                "- \"whyItMatters\": por qué importa este concepto EN ESTA MATERIA. Conéctalo con el panorama: qué " +
                "conceptos necesita antes y, sobre todo, qué conceptos del mapa te permite aprender después.\n" +
                "- \"application\": para qué le sirve este concepto al estudiante más allá de la asignatura: en su " +
                "vida cotidiana o en su carrera y su futuro profesional. Explica la aplicación general con un caso " +
                "reconocible fuera del aula, no un detalle técnico de la materia. Evita generalidades vacías como " +
                "\"se usa en muchas áreas\".\n" +
                "Fuentes: cada pendiente trae los fragmentos del material del docente que más tienen que ver con él; " +
                "úsalos primero. Si no alcanzan para ese concepto, usa tu conocimiento general de la disciplina y " +
                "marca \"source\": \"general\"; si la ficha sale del material, marca \"source\": \"material\". No " +
                "inventes datos propios del curso (fechas, evaluaciones, métodos del docente). " +
                'Responde solo JSON con este formato exacto: {"cards": [{"concepto": "C1", ' +
                '"whyItMatters": "...", "application": "...", "source": "material"}]}',
            },
            {
              role: "user",
              content:
                `Asignatura: ${subject!.name}.` +
                (subject!.description ? ` De qué trata: ${subject!.description}.` : "") +
                "\n\n" +
                "Mapa completo de conceptos (panorama): " +
                panorama +
                "\n\nPendientes (escribe una ficha para cada uno), con sus fragmentos del material: " +
                JSON.stringify(
                  batch.map((b, i) => ({
                    concepto: `C${i + 1}`,
                    nombre: b.concept.name,
                    fragmentos: b.hits.map((h) => h.content),
                  }))
                ),
            },
          ],
        });
        const parsed = AiResponse.safeParse(JSON.parse(completion.choices[0].message.content ?? "null"));
        return parsed.success ? parsed.data.cards : [];
      } catch (err) {
        console.error("generate-concept-cards: falló la generación de un grupo:", err);
        return [];
      }
    }

    const withHits = pending.map((concept, i) => ({ concept, hits: hits[i] }));
    const batches: (typeof withHits)[] = [];
    for (let i = 0; i < withHits.length; i += CONCEPTS_PER_CALL) batches.push(withHits.slice(i, i + CONCEPTS_PER_CALL));
    const perBatch: { batch: typeof withHits; items: unknown[] }[] = [];
    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const group = batches.slice(i, i + CONCURRENCY);
      const results = await Promise.all(group.map((b) => cardsForBatch(b)));
      group.forEach((batch, j) => perBatch.push({ batch, items: results[j] }));
    }

    // Cada ficha se valida por separado: una mala no tumba a las buenas. Una por concepto pendiente.
    // Los conceptos que queden en remainingIds no recibieron ficha (la IA los omitió o no eran válidos).
    const remainingIds = new Set(pending.map((c) => c.id));
    const rows: {
      concept_id: string;
      subject_id: string;
      why_it_matters: string;
      application: string;
      source: string;
      status: string;
    }[] = [];
    let discarded = 0;
    for (const { batch, items } of perBatch) {
      for (const item of items) {
        const result = AiCard.safeParse(item);
        const conceptId = result.success
          ? batch[Number(result.data.concepto.replace(/\D/g, "")) - 1]?.concept.id
          : undefined;
        if (result.success && conceptId && remainingIds.has(conceptId)) {
          remainingIds.delete(conceptId);
          rows.push({
            concept_id: conceptId,
            subject_id: subjectId, // el trigger lo vuelve a poner desde el concepto
            why_it_matters: result.data.whyItMatters,
            application: result.data.application,
            source: result.data.source,
            status: "sugerido",
          });
        } else {
          discarded += 1;
        }
      }
    }
    if (discarded > 0) {
      console.warn(`generate-concept-cards: ${discarded} ficha(s) descartada(s) por formato inválido o sobrantes`);
    }
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "La IA no devolvió fichas válidas. Vuelve a intentarlo." },
        { status: 422 }
      );
    }

    const { error: insertError } = await supabase.from("concept_cards").insert(rows);
    if (insertError) {
      console.error("generate-concept-cards: no se pudieron guardar las fichas:", insertError);
      return NextResponse.json({ error: "No se pudieron guardar las fichas. Inténtalo de nuevo." }, { status: 500 });
    }

    const omitted = remainingIds.size;
    return NextResponse.json({
      success: true,
      count: rows.length,
      notice:
        omitted > 0
          ? `${rows.length} ficha(s) sugerida(s). ${omitted} concepto(s) quedaron sin ficha; vuelve a generar para completarlos.`
          : undefined,
    });
  } catch (err) {
    // El detalle técnico (OpenAI, Postgres) queda en el log del servidor; al navegador, un mensaje genérico
    console.error("Error en generate-concept-cards:", err);
    return NextResponse.json(
      { error: "Ocurrió un error al generar las fichas. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
