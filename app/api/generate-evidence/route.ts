import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { z } from "zod";
import { findAndSaveEvidence } from "@/lib/concept-evidence";

// Busca las citas del material de los conceptos que todavía no tienen (creados a mano, generados antes de las citas
// o que se quedaron sin cita al reprocesar un documento). generate-concepts ya las busca para los conceptos nuevos.
export const maxDuration = 300;

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
    const { data: subject } = await supabase.from("subjects").select("teacher_id").eq("id", subjectId).maybeSingle();
    if (!subject || subject.teacher_id !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const [conceptsRes, evidenceRes] = await Promise.all([
      supabase.from("concepts").select("id, name, description").eq("subject_id", subjectId),
      supabase.from("evidence_spans").select("concept_id").eq("subject_id", subjectId).is("question_id", null),
    ]);
    if (conceptsRes.error || evidenceRes.error) {
      console.error("generate-evidence: no se pudieron leer conceptos o citas:", conceptsRes.error ?? evidenceRes.error);
      return NextResponse.json({ error: "No se pudieron revisar los conceptos" }, { status: 500 });
    }
    const withEvidence = new Set((evidenceRes.data ?? []).map((e) => e.concept_id));
    const pending = (conceptsRes.data ?? []).filter((c) => !withEvidence.has(c.id));
    // No es un error: se responde bien, con un aviso que el botón muestra tal cual
    if (pending.length === 0) {
      return NextResponse.json({ success: true, notice: "Todos los conceptos ya tienen sus fuentes en el material." });
    }

    const { data: allowed, error: quotaError } = await supabase.rpc("consume_ai_quota", { p_route: "generate-evidence" });
    if (quotaError) {
      console.error("generate-evidence: no se pudo verificar el límite de uso:", quotaError);
      return NextResponse.json({ error: "No se pudo verificar el límite de uso de IA" }, { status: 500 });
    }
    if (!allowed) {
      return NextResponse.json(
        { error: "Alcanzaste el límite de 30 usos de IA en 24 horas. Inténtalo más tarde." },
        { status: 429 }
      );
    }

    const result = await findAndSaveEvidence(supabase, openai, subjectId, pending);
    console.info(
      `generate-evidence: ${result.withQuote} con cita, ${result.withoutQuote} sin cita, ${result.discarded} citas descartadas`
    );
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    // El detalle técnico (OpenAI, Postgres) queda en el log del servidor; al navegador, un mensaje genérico
    console.error("Error en generate-evidence:", err);
    return NextResponse.json(
      { error: "Ocurrió un error al buscar las fuentes. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
