import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { z } from "zod";

// Forma mínima de cada ficha de la IA. Lo que no cumpla se descarta antes de guardar
// (el contenido lo sigue revisando el docente al validar).
const AiCard = z.object({
  conceptName: z.string().trim().min(1),
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
      .select("teacher_id, name, topic")
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
    const { data: chunks, error: chunksError } = await supabase
      .from("document_chunks")
      .select("content")
      .eq("subject_id", subjectId)
      // Provisional hasta la búsqueda híbrida (docs/MOTOR-DE-CONOCIMIENTO.md 4.2): el comienzo de cada documento
      .order("position")
      .order("document_id")
      .limit(40);
    if (chunksError || !chunks || chunks.length === 0) {
      return NextResponse.json({ error: "No hay documentos procesados para esta asignatura" }, { status: 400 });
    }
    const context = chunks.map((c) => c.content).join("\n\n").slice(0, 12000);

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

    const completion = await openai.chat.completions.create({
      model: "gpt-6-luna",
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
            "Fuentes: usa primero el material del docente. Si el material no alcanza para ese concepto, usa tu " +
            "conocimiento general de la disciplina y marca \"source\": \"general\"; si la ficha sale del material, " +
            "marca \"source\": \"material\". No inventes datos propios del curso (fechas, evaluaciones, métodos " +
            "del docente). " +
            'Responde solo JSON con este formato exacto: {"cards": [{"conceptName": "...", ' +
            '"whyItMatters": "...", "application": "...", "source": "material"}]}',
        },
        {
          role: "user",
          content:
            `Asignatura: ${subject.name}. Tema: ${subject.topic}.\n\n` +
            "Mapa completo de conceptos (panorama): " +
            JSON.stringify(concepts.map(withRelations)) +
            "\n\nPendientes (escribe una ficha para cada uno): " +
            JSON.stringify(pending.map((c) => c.name)) +
            "\n\nMaterial del docente:\n" +
            context,
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
      console.error("generate-concept-cards: la IA devolvió un formato inválido:", raw);
      return NextResponse.json(
        { error: "La IA devolvió una respuesta con formato inválido. Vuelve a intentarlo." },
        { status: 502 }
      );
    }

    // Cada ficha se valida por separado: una mala no tumba a las buenas. Una por concepto pendiente.
    // El nombre se compara como el índice único de conceptos: sin mayúsculas ni espacios en los extremos.
    const nameToId = new Map(pending.map((c) => [c.name.trim().toLowerCase(), c.id]));
    const rows: {
      concept_id: string;
      subject_id: string;
      why_it_matters: string;
      application: string;
      source: string;
      status: string;
    }[] = [];
    let discarded = 0;
    for (const item of envelope.data.cards) {
      const result = AiCard.safeParse(item);
      const conceptId = result.success ? nameToId.get(result.data.conceptName.toLowerCase()) : undefined;
      if (result.success && conceptId) {
        nameToId.delete(result.data.conceptName.toLowerCase());
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

    // Los conceptos que quedaron en nameToId no recibieron ficha (la IA los omitió o no eran válidos)
    const omitted = nameToId.size;
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
