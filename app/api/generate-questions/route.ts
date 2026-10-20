import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { z } from "zod";

//const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Forma mínima de cada pregunta de la IA. Lo que no cumpla se descarta antes de guardar
// (la calidad pedagógica la sigue revisando el docente al validar).
const AiQuestion = z
  .object({
    conceptName: z.string().trim().min(1),
    prompt: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).length(4),
    correctIndex: z.number().int().min(0).max(3),
  })
  .refine((q) => new Set(q.options.map((o) => o.toLowerCase())).size === q.options.length, {
    message: "Opciones repetidas",
  });

const AiResponse = z.object({ questions: z.array(z.unknown()) });

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
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const { subjectId } = await req.json();
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    // Los estudiantes inscritos también leen conceptos validados: sin esto podrían disparar la llamada a OpenAI
    const { data: subject } = await supabase
      .from("subjects")
      .select("teacher_id")
      .eq("id", subjectId)
      .maybeSingle();
    if (!subject || subject.teacher_id !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { data: concepts, error: conceptsError } = await supabase
      .from("concepts")
      .select("id, name, description")
      .eq("subject_id", subjectId)
      .eq("status", "validado");

    if (conceptsError || !concepts || concepts.length === 0) {
      return NextResponse.json({ error: "No hay conceptos validados todavía" }, { status: 400 });
    }

    const { data: allowed, error: quotaError } = await supabase.rpc("consume_ai_quota", { p_route: "generate-questions" });
    if (quotaError) {
      console.error("generate-questions: no se pudo verificar el límite de uso:", quotaError);
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
            "Eres un asistente que ayuda a un docente a crear preguntas de diagnóstico de opción múltiple. " +
            "Para cada concepto que te paso, genera 4 preguntas de opción múltiple distintas entre sí (4 opciones cada una, solo una correcta). " +
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

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      json = null;
    }
    const envelope = AiResponse.safeParse(json);
    if (!envelope.success) {
      console.error("generate-questions: la IA devolvió un formato inválido:", raw);
      return NextResponse.json(
        { error: "La IA devolvió una respuesta con formato inválido. Vuelve a intentarlo." },
        { status: 502 }
      );
    }

    // Cada pregunta se valida por separado: una mala no tumba a las buenas
    const nameToId = new Map(concepts.map((c) => [c.name, c.id]));
    const valid: z.infer<typeof AiQuestion>[] = [];
    let discarded = 0;
    for (const item of envelope.data.questions) {
      const result = AiQuestion.safeParse(item);
      if (result.success && nameToId.has(result.data.conceptName)) valid.push(result.data);
      else discarded += 1;
    }
    if (discarded > 0) {
      console.warn(`generate-questions: ${discarded} pregunta(s) descartada(s) por formato inválido`);
    }
    if (valid.length === 0) {
      return NextResponse.json(
        { error: "La IA no devolvió preguntas válidas. Vuelve a intentarlo." },
        { status: 422 }
      );
    }

    const rows = valid.map((q) => {
      // Las opciones ya son distintas entre sí, así que indexOf en shuffleOptions encuentra la correcta
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