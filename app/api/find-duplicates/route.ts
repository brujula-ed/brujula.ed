import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { z } from "zod";
import { refreshDuplicateCandidates, saveConceptEmbeddings } from "@/lib/concept-embeddings";

// "Buscar duplicados": calcula el embedding de los conceptos que no lo tienen (creados a mano, editados o generados
// antes), y la IA juzga cuáles de las parejas más parecidas son el mismo concepto (lib/concept-embeddings.ts).
// El resultado queda guardado en concept_duplicate_candidates y la página lo muestra.
export const maxDuration = 120;

const RequestBody = z.object({ subjectId: z.uuid() });

export async function POST(req: NextRequest) {
  try {
    const body = RequestBody.safeParse(await req.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
    const { subjectId } = body.data;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    // Los estudiantes inscritos también leen conceptos validados: sin esto podrían disparar la llamada a OpenAI
    const { data: subject } = await supabase.from("subjects").select("teacher_id").eq("id", subjectId).maybeSingle();
    if (!subject || subject.teacher_id !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { data: missing, error: missingError } = await supabase
      .from("concepts")
      .select("id, name, description")
      .eq("subject_id", subjectId)
      .is("embedding", null);
    if (missingError) {
      console.error("find-duplicates: no se pudieron leer los conceptos:", missingError);
      return NextResponse.json({ error: "No se pudieron revisar los conceptos" }, { status: 500 });
    }

    const { data: allowed, error: quotaError } = await supabase.rpc("consume_ai_quota", { p_route: "find-duplicates" });
    if (quotaError) {
      console.error("find-duplicates: no se pudo verificar el límite de uso:", quotaError);
      return NextResponse.json({ error: "No se pudo verificar el límite de uso de IA" }, { status: 500 });
    }
    if (!allowed) {
      return NextResponse.json(
        { error: "Alcanzaste el límite de 30 usos de IA en 24 horas. Inténtalo más tarde." },
        { status: 429 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const embedded = await saveConceptEmbeddings(supabase, openai, missing ?? []);
    const pairs = await refreshDuplicateCandidates(supabase, openai, subjectId);

    console.info(`find-duplicates: ${embedded} embeddings nuevos, ${pairs} posibles duplicados`);
    return NextResponse.json({ success: true, embedded, pairs });
  } catch (err) {
    console.error("Error en find-duplicates:", err);
    return NextResponse.json({ error: "Ocurrió un error al buscar duplicados. Inténtalo de nuevo." }, { status: 500 });
  }
}
