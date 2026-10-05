import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
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

    const parsed = JSON.parse(raw) as { concepts: { name: string; description: string; prerequisites: string[] }[] };

    // Primera pasada: insertar los conceptos sin prerrequisitos todavía
    const { data: inserted, error: insertError } = await supabase
      .from("concepts")
      .insert(
        parsed.concepts.map((c) => ({
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

    // Segunda pasada: resolver nombres de prerrequisitos a ids reales
    const nameToId = new Map(inserted.map((c) => [c.name, c.id]));
    for (const c of parsed.concepts) {
      const prereqIds = c.prerequisites.map((p) => nameToId.get(p)).filter(Boolean) as string[];
      if (prereqIds.length > 0) {
        await supabase.from("concepts").update({ prerequisite_ids: prereqIds }).eq("id", nameToId.get(c.name));
      }
    }

    return NextResponse.json({ success: true, count: inserted.length });
  } catch (err) {
    console.error("Error en generate-concepts:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}