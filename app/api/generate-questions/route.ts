import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function shuffleOptions(options: string[], correctIndex: number) {
  const correctText = options[correctIndex];
  const shuffled = [...options];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return { options: shuffled, correctIndex: shuffled.indexOf(correctText) };
}

export async function POST(req: NextRequest) {
  try {
    const { subjectId } = await req.json();
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { data: concepts, error: conceptsError } = await supabase
      .from("concepts")
      .select("id, name, description")
      .eq("subject_id", subjectId)
      .eq("status", "validado");

    if (conceptsError || !concepts || concepts.length === 0) {
      return NextResponse.json({ error: "No hay conceptos validados todavía" }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-6-luna",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Eres un asistente que ayuda a un docente a crear preguntas de diagnóstico de opción múltiple. " +
            "Para cada concepto que te paso, genera 2 preguntas de opción múltiple (4 opciones cada una, solo una correcta). " +
            'Responde solo JSON con este formato exacto: {"questions": [{"conceptName": "...", "prompt": "...", ' +
            '"options": ["...", "...", "...", "..."], "correctIndex": 0}]}',
        },
        {
          role: "user",
          content: JSON.stringify(concepts.map((c) => ({ name: c.name, description: c.description }))),
        },
      ],
    });

    const raw = completion.choices[0].message.content;
    if (!raw) return NextResponse.json({ error: "La IA no devolvió contenido" }, { status: 500 });

    const parsed = JSON.parse(raw) as {
      questions: { conceptName: string; prompt: string; options: string[]; correctIndex: number }[];
    };

       const nameToId = new Map(concepts.map((c) => [c.name, c.id]));
    const rows = parsed.questions
      .filter((q) => nameToId.has(q.conceptName))
      .map((q) => {
        const { options, correctIndex } = shuffleOptions(q.options, q.correctIndex);
        return {
          subject_id: subjectId,
          concept_id: nameToId.get(q.conceptName)!,
          prompt: q.prompt,
          options,
          correct_index: correctIndex,
          status: "sugerido",
        };
      });

    const { error: insertError } = await supabase.from("questions").insert(rows);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: rows.length });
  } catch (err) {
    console.error("Error en generate-questions:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}