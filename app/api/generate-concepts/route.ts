import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { z } from "zod";

// Forma mínima de cada concepto de la IA; se valida ANTES de insertar para no dejar conceptos a medias.
// Sin descripción o sin prerrequisitos válidos el concepto se conserva: el docente lo completa al validar.
const AiConcept = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().catch(""),
  prerequisites: z.array(z.string().trim()).catch([]),
});

const AiResponse = z.object({ concepts: z.array(z.unknown()) });

export async function POST(req: NextRequest) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { subjectId } = await req.json();
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { data: chunks, error: chunksError } = await supabase
      .from("document_chunks")
      .select("content")
      .eq("subject_id", subjectId)
      .limit(40);

    if (chunksError || !chunks || chunks.length === 0) {
      return NextResponse.json({ error: "No hay documentos procesados para esta asignatura" }, { status: 400 });
    }

    const context = chunks.map((c) => c.content).join("\n\n").slice(0, 12000);

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

    const completion = await openai.chat.completions.create({
      model: "gpt-6-luna",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Eres un asistente que ayuda a un docente a estructurar el contenido de su materia. " +
            "A partir del siguiente material, propone entre 4 y 10 conceptos clave, cada uno con una " +
            "breve descripción (1-2 oraciones) y una lista de nombres de otros conceptos de la misma " +
            "lista que sean prerrequisito (pueden ser ninguno). Responde solo JSON, con este formato exacto: " +
            '{"concepts": [{"name": "...", "description": "...", "prerequisites": ["nombre de otro concepto", ...]}]}',
        },
        { role: "user", content: context },
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

    // Cada concepto se valida por separado; los nombres repetidos en el lote se descartan (sin distinguir mayúsculas)
    const concepts: z.infer<typeof AiConcept>[] = [];
    const seenNames = new Set<string>();
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
      return NextResponse.json({ error: insertError?.message ?? "Error al guardar" }, { status: 500 });
    }

    // Segunda pasada: resolver nombres de prerrequisitos a ids reales (sin distinguir mayúsculas, sin autorreferencias)
    const nameToId = new Map(inserted.map((c) => [c.name.toLowerCase(), c.id]));
    for (const c of concepts) {
      const ownId = nameToId.get(c.name.toLowerCase());
      const prereqIds = c.prerequisites
        .map((p) => nameToId.get(p.toLowerCase()))
        .filter((id): id is string => !!id && id !== ownId);
      if (ownId && prereqIds.length > 0) {
        await supabase.from("concepts").update({ prerequisite_ids: prereqIds }).eq("id", ownId);
      }
    }

    return NextResponse.json({ success: true, count: inserted.length });
  } catch (err) {
    console.error("Error en generate-concepts:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}