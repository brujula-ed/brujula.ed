import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { z } from "zod";
import { materialPositions, orderByMaterial, resolveProposal, type ProposedTopic } from "@/lib/topic-organization";

// Organizar en temas (docs/MOTOR-DE-CONOCIMIENTO.md 4.3): la IA agrupa en temas los conceptos que aún no tienen tema,
// en una sola llamada; el código comprueba que cada concepto quede en un solo tema (lib/topic-organization.ts) y
// ordena los temas nuevos por dónde aparecen en el material. Lo que ya está organizado no se toca.
export const maxDuration = 120;
const MODEL = "gpt-6-luna";

const AiTopic = z.object({
  tema: z.string().trim().catch(""),
  nombre: z.string().trim().catch(""),
  descripcion: z.string().trim().catch(""),
  conceptos: z.array(z.string()).catch([]),
});
const AiResponse = z.object({ temas: z.array(z.unknown()) });
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
    const { data: subject } = await supabase.from("subjects").select("teacher_id, name").eq("id", subjectId).maybeSingle();
    if (!subject || subject.teacher_id !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const [conceptsRes, topicsRes, evidenceRes] = await Promise.all([
      supabase.from("concepts").select("id, name, description, prerequisite_ids, topic_id").eq("subject_id", subjectId),
      supabase.from("topics").select("id, name, description, position").eq("subject_id", subjectId).order("position"),
      // Dónde aparece cada concepto: orden del documento y del fragmento de sus citas
      supabase
        .from("evidence_spans")
        .select("concept_id, page_start, document_chunks(position), subject_documents(uploaded_at)")
        .eq("subject_id", subjectId)
        .is("question_id", null),
    ]);
    if (conceptsRes.error || topicsRes.error || evidenceRes.error) {
      console.error("organize-topics: no se pudieron leer los datos:", conceptsRes.error ?? topicsRes.error ?? evidenceRes.error);
      return NextResponse.json({ error: "No se pudieron revisar los conceptos" }, { status: 500 });
    }
    const concepts = conceptsRes.data ?? [];
    const existingTopics = topicsRes.data ?? [];
    const pending = concepts.filter((c) => !c.topic_id);
    // No es un error: se responde bien, con un aviso que el botón muestra tal cual
    if (pending.length === 0) {
      return NextResponse.json({
        success: true,
        notice: concepts.length === 0 ? "Todavía no hay conceptos para organizar." : "Todos los conceptos ya tienen tema.",
      });
    }

    // Dónde aparece cada concepto en el material (por sus citas)
    const { position: conceptPosition, page: conceptPage } = materialPositions(evidenceRes.data ?? []);

    const { data: allowed, error: quotaError } = await supabase.rpc("consume_ai_quota", { p_route: "organize-topics" });
    if (quotaError) {
      console.error("organize-topics: no se pudo verificar el límite de uso:", quotaError);
      return NextResponse.json({ error: "No se pudo verificar el límite de uso de IA" }, { status: 500 });
    }
    if (!allowed) {
      return NextResponse.json(
        { error: "Alcanzaste el límite de 30 usos de IA en 24 horas. Inténtalo más tarde." },
        { status: 429 }
      );
    }

    // Conceptos pendientes en el orden del material, con etiquetas cortas para que la IA no tenga que copiar nombres
    const ordered = [...pending].sort(
      (a, b) => (conceptPosition.get(a.id) ?? Infinity) - (conceptPosition.get(b.id) ?? Infinity)
    );
    const nameById = new Map(concepts.map((c) => [c.id, c.name]));
    const payload = {
      temas_existentes: existingTopics.map((t, i) => ({ id: `T${i + 1}`, nombre: t.name, descripcion: t.description ?? "" })),
      conceptos: ordered.map((c, i) => ({
        id: `C${i + 1}`,
        nombre: c.name,
        descripcion: c.description ?? "",
        necesita: c.prerequisite_ids.map((id) => nameById.get(id)).filter((n): n is string => !!n),
        pagina: conceptPage.get(c.id) ?? null,
      })),
    };

    const completion = await openai.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Ayudas a un docente universitario a organizar los conceptos de su asignatura en temas, como los de un " +
            "programa de curso. Recibes los conceptos sin tema, en el orden en que aparecen en su material, con lo " +
            "que necesita cada uno y su página. Agrúpalos en temas coherentes (entre 3 y 8 en total, contando los " +
            "existentes; menos si hay pocos conceptos). Si un concepto encaja en un tema existente, usa ese tema " +
            '(pon su id en "tema"); si no, crea uno nuevo (deja "tema" vacío) con un nombre corto y una descripción ' +
            "de una oración. Cada concepto va en exactamente un tema. Un tema reúne conceptos que se estudian " +
            "juntos; los prerrequisitos suelen quedar en el mismo tema o en uno anterior. " +
            'Responde solo JSON: {"temas": [{"tema": "", "nombre": "...", "descripcion": "...", "conceptos": ["C1", "C2"]}]}',
        },
        { role: "user", content: `Asignatura: ${subject.name}.\n\n${JSON.stringify(payload)}` },
      ],
    });

    const parsed = AiResponse.safeParse(JSON.parse(completion.choices[0].message.content ?? "null"));
    if (!parsed.success) {
      console.error("organize-topics: la IA devolvió un formato inválido");
      return NextResponse.json(
        { error: "La IA devolvió una respuesta con formato inválido. Vuelve a intentarlo." },
        { status: 502 }
      );
    }
    const proposal: ProposedTopic[] = parsed.data.temas.flatMap((item) => {
      const t = AiTopic.safeParse(item);
      return t.success ? [t.data] : [];
    });

    const { newTopics, toExisting, unassigned } = resolveProposal(proposal, ordered.map((c) => c.id), existingTopics);

    // Temas nuevos, en el orden del material y después de los existentes
    const nextPosition = existingTopics.reduce((max, t) => Math.max(max, t.position + 1), 0);
    const sortedNew = orderByMaterial(newTopics, conceptPosition);
    const assignments = new Map(toExisting);
    if (sortedNew.length > 0) {
      const rows = sortedNew.map((t, i) => ({
        id: crypto.randomUUID(),
        subject_id: subjectId,
        name: t.name,
        description: t.description || null,
        position: nextPosition + i,
        status: "sugerido",
      }));
      const { error: insertError } = await supabase.from("topics").insert(rows);
      if (insertError) {
        console.error("organize-topics: no se pudieron guardar los temas:", insertError);
        return NextResponse.json({ error: "No se pudieron guardar los temas. Inténtalo de nuevo." }, { status: 500 });
      }
      rows.forEach((r, i) => assignments.set(r.id, sortedNew[i].conceptIds));
    }

    // Tema de cada concepto: una actualización por tema
    for (const [topicId, conceptIds] of assignments) {
      const { error } = await supabase.from("concepts").update({ topic_id: topicId }).in("id", conceptIds);
      if (error) {
        console.error("organize-topics: no se pudo asignar el tema a sus conceptos:", error);
        return NextResponse.json({ error: "No se pudieron asignar los temas. Inténtalo de nuevo." }, { status: 500 });
      }
    }

    console.info(
      `organize-topics: ${sortedNew.length} temas nuevos, ${pending.length - unassigned.length} conceptos organizados, ` +
        `${unassigned.length} sin tema`
    );
    return NextResponse.json({
      success: true,
      newTopics: sortedNew.length,
      organized: pending.length - unassigned.length,
      unassigned: unassigned.length,
    });
  } catch (err) {
    // El detalle técnico (OpenAI, Postgres) queda en el log del servidor; al navegador, un mensaje genérico
    console.error("Error en organize-topics:", err);
    return NextResponse.json({ error: "Ocurrió un error al organizar los temas. Inténtalo de nuevo." }, { status: 500 });
  }
}
