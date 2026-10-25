import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { z } from "zod";
import { hostOf } from "@/lib/resource-sources";
import { checkLinks } from "@/lib/link-check";

// Forma mínima de cada recurso de la IA. Lo que no cumpla se descarta antes de verificar el enlace
// (la pertinencia la sigue revisando el docente al validar).
const AiResource = z.object({
  conceptName: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200),
  url: z.string().trim().min(1),
  kind: z.enum(["lectura", "video", "ejercicio"]),
});

const AiResponse = z.object({ resources: z.array(z.unknown()) });

const RequestBody = z.object({ subjectId: z.uuid() });

// Hasta 3 por concepto: idealmente una lectura, un video y un ejercicio
const RESOURCES_PER_CONCEPT = 3;

export async function POST(req: NextRequest) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const body = RequestBody.safeParse(await req.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
    const { subjectId } = body.data;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    // Los estudiantes inscritos también leen la asignatura: sin esto podrían disparar la llamada a OpenAI
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

    // Regenerar solo completa: cuenta los recursos que ya tiene cada concepto (sugeridos y validados)
    const { data: existing, error: existingError } = await supabase
      .from("concept_resources")
      .select("concept_id, url")
      .eq("subject_id", subjectId);
    if (existingError) {
      console.error("generate-resources: no se pudieron leer los recursos existentes:", existingError);
      return NextResponse.json({ error: "No se pudieron revisar los recursos existentes" }, { status: 500 });
    }
    const existingCount = new Map<string, number>();
    const existingUrls = new Set<string>();
    for (const r of existing ?? []) {
      existingCount.set(r.concept_id, (existingCount.get(r.concept_id) ?? 0) + 1);
      existingUrls.add(`${r.concept_id} ${r.url}`);
    }
    const missing = new Map(
      concepts
        .map((c) => [c.id, RESOURCES_PER_CONCEPT - (existingCount.get(c.id) ?? 0)] as const)
        .filter(([, n]) => n > 0)
    );
    const pending = concepts.filter((c) => missing.has(c.id));
    // No es un error: ya están completos. Se responde bien, con un aviso que el botón muestra tal cual.
    if (pending.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        notice: `Todos los conceptos validados ya tienen ${RESOURCES_PER_CONCEPT} recursos. Descarta alguno si quieres buscar otros.`,
      });
    }

    const { data: allowed, error: quotaError } = await supabase.rpc("consume_ai_quota", {
      p_route: "generate-resources",
    });
    if (quotaError) {
      console.error("generate-resources: no se pudo verificar el límite de uso:", quotaError);
      return NextResponse.json({ error: "No se pudo verificar el límite de uso de IA" }, { status: 500 });
    }
    if (!allowed) {
      return NextResponse.json(
        { error: "Alcanzaste el límite de 30 usos de IA en 24 horas. Inténtalo más tarde." },
        { status: 429 }
      );
    }

    // Panorama de la materia, como en las fichas: cada concepto con lo que necesita
    const nameById = new Map(concepts.map((c) => [c.id, c.name]));
    const completion = await openai.chat.completions.create({
      model: "gpt-6-luna",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Eres un asistente que ayuda a un docente a reunir recursos para que sus estudiantes repasen cada " +
            "concepto de su materia. Para cada concepto pendiente propone, como máximo, la cantidad indicada en " +
            "\"cantidad\". Reglas:\n" +
            "- Solo recursos ABIERTOS o de acceso libre y legal: con licencia abierta o gratuitos sin registro ni " +
            "pago. Nada pirateado ni copias no autorizadas. Elige tú los sitios: que sean reconocidos y fiables " +
            "(universidades, proyectos educativos abiertos, enciclopedias, canales educativos, simuladores, etc.).\n" +
            "- VARIEDAD: para cada concepto busca UNA lectura, UN video y UN ejercicio (práctica, simulación o " +
            "problemas resueltos), en ese orden de prioridad según la cantidad. Usa sitios DISTINTOS para cada " +
            "recurso del mismo concepto. No uses Wikipedia para más de un recurso por concepto.\n" +
            "- Da la URL exacta y completa de una página concreta, empezando por https://. Cada enlace se " +
            "comprueba y los que no existen se descartan: propón solo URLs que estés seguro de que existen. En " +
            "videos, solo si conoces el enlace exacto del video.\n" +
            "- Prefiere contenido en español y del nivel de este curso.\n" +
            "- \"kind\" es \"lectura\", \"video\" o \"ejercicio\".\n" +
            'Responde solo JSON con este formato exacto: {"resources": [{"conceptName": "...", "title": "...", ' +
            '"url": "https://...", "kind": "lectura"}]}',
        },
        {
          role: "user",
          content:
            `Asignatura: ${subject.name}. Tema: ${subject.topic}.\n\n` +
            "Conceptos pendientes: " +
            JSON.stringify(
              pending.map((c) => ({
                name: c.name,
                description: c.description,
                necesita: c.prerequisite_ids.map((id) => nameById.get(id)).filter((n): n is string => !!n),
                cantidad: missing.get(c.id),
              }))
            ),
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
      console.error("generate-resources: la IA devolvió un formato inválido:", raw);
      return NextResponse.json(
        { error: "La IA devolvió una respuesta con formato inválido. Vuelve a intentarlo." },
        { status: 502 }
      );
    }

    // Primer filtro, sin visitar nada: formato, concepto pendiente con cupo, https y sin repetir.
    // El nombre se compara como el índice único de conceptos: sin mayúsculas ni espacios en los extremos.
    const nameToId = new Map(pending.map((c) => [c.name.trim().toLowerCase(), c.id]));
    const remaining = new Map(missing);
    const candidates: { conceptId: string; title: string; url: string; kind: string; source: string }[] = [];
    let proposed = 0;
    for (const item of envelope.data.resources) {
      proposed += 1;
      const result = AiResource.safeParse(item);
      if (!result.success) continue;
      const conceptId = nameToId.get(result.data.conceptName.toLowerCase());
      const host = result.data.url.startsWith("https://") ? hostOf(result.data.url) : null;
      const key = `${conceptId} ${result.data.url}`;
      if (!conceptId || !host || (remaining.get(conceptId) ?? 0) <= 0 || existingUrls.has(key)) continue;
      existingUrls.add(key);
      remaining.set(conceptId, remaining.get(conceptId)! - 1);
      candidates.push({ conceptId, title: result.data.title, url: result.data.url, kind: result.data.kind, source: host });
    }

    // Segundo filtro: el servidor comprueba que cada enlace exista, sin visitar nunca la red interna (lib/link-check.ts)
    const checks = await checkLinks(candidates.map((c) => c.url));
    const rows = candidates
      .map((c, i) => ({ c, check: checks[i] }))
      .filter(({ check }) => check !== "rechazado")
      .map(({ c, check }) => ({
        concept_id: c.conceptId,
        subject_id: subjectId, // el trigger lo vuelve a poner desde el concepto
        title: c.title,
        url: c.url,
        kind: c.kind,
        source: c.source,
        added_by: "ia",
        link_check: check,
        status: "sugerido",
      }));

    const discarded = proposed - rows.length;
    if (discarded > 0) {
      console.warn(`generate-resources: ${discarded} de ${proposed} recurso(s) descartado(s)`);
    }
    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: `La IA propuso ${proposed} recurso(s), pero ninguno pasó la verificación (los enlaces no existían). Vuelve a intentarlo o agrega enlaces a mano.`,
        },
        { status: 422 }
      );
    }

    const { error: insertError } = await supabase.from("concept_resources").insert(rows);
    if (insertError) {
      console.error("generate-resources: no se pudieron guardar los recursos:", insertError);
      return NextResponse.json({ error: "No se pudieron guardar los recursos. Inténtalo de nuevo." }, { status: 500 });
    }

    // El aviso detalla los tipos guardados, para ver de un vistazo si hubo variedad
    const unverifiable = rows.filter((r) => r.link_check === "no_verificable").length;
    const byKind = (k: string) => rows.filter((r) => r.kind === k).length;
    return NextResponse.json({
      success: true,
      count: rows.length,
      notice:
        `${rows.length} recurso(s) sugerido(s): ${byKind("lectura")} lectura(s), ${byKind("video")} video(s) y ` +
        `${byKind("ejercicio")} ejercicio(s)` +
        (unverifiable > 0 ? `; ${unverifiable} sin poder verificar (ábrelos antes de validarlos)` : "") +
        (discarded > 0 ? `. ${discarded} descartado(s) porque el enlace no existía o no era válido.` : "."),
    });
  } catch (err) {
    // El detalle técnico (OpenAI, Postgres) queda en el log del servidor; al navegador, un mensaje genérico
    console.error("Error en generate-resources:", err);
    return NextResponse.json(
      { error: "Ocurrió un error al buscar los recursos. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
