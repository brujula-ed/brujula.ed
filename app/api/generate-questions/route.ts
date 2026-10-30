import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { z } from "zod";
import { searchMaterial, type MaterialHit } from "@/lib/search-material";
import { normalizeForQuote, verifyQuote } from "@/lib/concept-evidence";

// Preguntas con el material de cada concepto (docs/MOTOR-DE-CONOCIMIENTO.md 4.2 y 4.4): cada concepto recibe sus
// fragmentos más relevantes (búsqueda híbrida) y cada pregunta trae una explicación por opción y la cita del material
// que respalda la respuesta correcta, comprobada tal cual (lib/concept-evidence.ts).

export const maxDuration = 300;
const MODEL = "gpt-6-luna";
const HITS_PER_CONCEPT = 4;
const CONCEPTS_PER_CALL = 3;
const CONCURRENCY = 4;

// Banco objetivo por concepto: alcanza para 2 en el diagnóstico y 2 en la microevaluación (lib/question-selection.ts)
const QUESTIONS_PER_CONCEPT = 4;

// Forma mínima de cada pregunta de la IA. Lo que no cumpla se descarta antes de guardar
// (la calidad pedagógica la sigue revisando el docente al validar). La cita es opcional: sin ella, la pregunta se
// guarda igual y el docente ve "Sin fuente en el material".
const AiQuestion = z
  .object({
    concepto: z.string().trim(),
    prompt: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).length(4),
    correctIndex: z.number().int().min(0).max(3),
    explanations: z.array(z.string().trim().min(1)).length(4),
    fragmento: z.string().trim().catch(""),
    cita: z.string().catch(""),
  })
  .refine((q) => new Set(q.options.map((o) => o.toLowerCase())).size === q.options.length, {
    message: "Opciones repetidas",
  });

const AiResponse = z.object({ questions: z.array(z.unknown()) });

const RequestBody = z.object({ subjectId: z.uuid() });

type PendingConcept = { id: string; name: string; description: string | null; missing: number; hits: MaterialHit[] };
type ValidQuestion = z.infer<typeof AiQuestion> & { concept: PendingConcept };

// Mezcla las opciones (la IA tendía a poner la correcta primera); cada explicación se mueve con su opción
function shuffleOptions(options: string[], explanations: string[], correctIndex: number) {
  const order = options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    options: order.map((i) => options[i]),
    explanations: order.map((i) => explanations[i]),
    correctIndex: order.indexOf(correctIndex),
  };
}

// Preguntas de un grupo de conceptos. Si la llamada falla, ese grupo queda sin preguntas y se sigue con los demás.
async function questionsForBatch(openai: OpenAI, batch: PendingConcept[]): Promise<unknown[]> {
  const payload = batch.map((c, i) => ({
    concepto: `C${i + 1}`,
    nombre: c.name,
    descripcion: c.description ?? "",
    cantidad: c.missing,
    fragmentos: c.hits.map((h, j) => ({ id: `F${j + 1}`, texto: h.content })),
  }));
  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Ayudas a un docente universitario a crear preguntas de diagnóstico de opción múltiple a partir de su " +
            "propio material. Para cada concepto recibes fragmentos del material; genera exactamente la cantidad " +
            'indicada en "cantidad", distintas entre sí y basadas en lo que dicen esos fragmentos. ' +
            "Cada pregunta mide comprensión o aplicación del concepto, no memoria de frases del texto. Tiene 4 " +
            "opciones y una sola correcta; las incorrectas son errores que un estudiante podría cometer de verdad " +
            "(confusiones típicas), no opciones absurdas. " +
            '"explanations" tiene una explicación breve por opción, en el mismo orden: en la correcta, por qué lo es; ' +
            "en cada incorrecta, qué error de comprensión lleva a elegirla. " +
            '"fragmento" y "cita": 1 o 2 oraciones COPIADAS LITERALMENTE de un fragmento que respalden la respuesta ' +
            'correcta (entre 20 y 300 caracteres). Si ningún fragmento la respalda, deja "cita" vacía. ' +
            'Responde solo JSON: {"questions": [{"concepto": "C1", "prompt": "...", "options": ["...", "...", ' +
            '"...", "..."], "correctIndex": 0, "explanations": ["...", "...", "...", "..."], "fragmento": "F2", ' +
            '"cita": "..."}]}',
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const parsed = AiResponse.safeParse(JSON.parse(completion.choices[0].message.content ?? "null"));
    return parsed.success ? parsed.data.questions : [];
  } catch (err) {
    console.error("generate-questions: falló la generación de un grupo:", err);
    return [];
  }
}

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

    // Regenerar solo completa el banco: cuenta las preguntas que ya tiene cada concepto (sugeridas y validadas)
    const { data: existing, error: existingError } = await supabase
      .from("questions")
      .select("concept_id")
      .eq("subject_id", subjectId);
    if (existingError) {
      console.error("generate-questions: no se pudieron contar las preguntas existentes:", existingError);
      return NextResponse.json({ error: "No se pudieron revisar las preguntas existentes" }, { status: 500 });
    }
    const existingCount = new Map<string, number>();
    for (const q of existing ?? []) existingCount.set(q.concept_id, (existingCount.get(q.concept_id) ?? 0) + 1);
    const pendingConcepts = concepts
      .map((c) => ({ ...c, missing: QUESTIONS_PER_CONCEPT - (existingCount.get(c.id) ?? 0) }))
      .filter((c) => c.missing > 0);
    // No es un error: el banco ya está completo. Se responde bien, con un aviso que el botón muestra tal cual.
    if (pendingConcepts.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        notice: `Todos los conceptos validados ya tienen ${QUESTIONS_PER_CONCEPT} preguntas. Descarta alguna si quieres generar otras.`,
      });
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

    // Material de cada concepto (todos los embeddings en una sola llamada)
    const hits = await searchMaterial(
      supabase,
      openai,
      subjectId,
      pendingConcepts.map((c) => `${c.name}: ${c.description ?? ""}`),
      HITS_PER_CONCEPT
    );
    const pending: PendingConcept[] = pendingConcepts.map((c, i) => ({ ...c, hits: hits[i] }));

    // Preguntas, de a CONCEPTS_PER_CALL conceptos por llamada y CONCURRENCY llamadas a la vez
    const batches: PendingConcept[][] = [];
    for (let i = 0; i < pending.length; i += CONCEPTS_PER_CALL) batches.push(pending.slice(i, i + CONCEPTS_PER_CALL));
    const perBatch: { batch: PendingConcept[]; items: unknown[] }[] = [];
    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const group = batches.slice(i, i + CONCURRENCY);
      const results = await Promise.all(group.map((b) => questionsForBatch(openai, b)));
      group.forEach((batch, j) => perBatch.push({ batch, items: results[j] }));
    }

    // Cada pregunta se valida por separado: una mala no tumba a las buenas.
    // Solo se aceptan conceptos del grupo y como máximo las que le faltan a cada uno.
    const remaining = new Map(pending.map((c) => [c.id, c.missing]));
    const valid: ValidQuestion[] = [];
    let discarded = 0;
    for (const { batch, items } of perBatch) {
      for (const item of items) {
        const result = AiQuestion.safeParse(item);
        const concept = result.success ? batch[Number(result.data.concepto.replace(/\D/g, "")) - 1] : undefined;
        if (result.success && concept && (remaining.get(concept.id) ?? 0) > 0) {
          valid.push({ ...result.data, concept });
          remaining.set(concept.id, remaining.get(concept.id)! - 1);
        } else {
          discarded += 1;
        }
      }
    }
    if (discarded > 0) {
      console.warn(`generate-questions: ${discarded} pregunta(s) descartada(s) por formato inválido o sobrantes`);
    }
    if (valid.length === 0) {
      return NextResponse.json(
        { error: "La IA no devolvió preguntas válidas. Vuelve a intentarlo." },
        { status: 422 }
      );
    }

    // El id se crea aquí para poder enlazar cada pregunta con su cita sin depender del orden de la respuesta
    const rows = valid.map((q) => {
      // Las opciones ya son distintas entre sí, así que la correcta se reubica sin ambigüedad
      const { options, explanations, correctIndex } = shuffleOptions(q.options, q.explanations, q.correctIndex);
      return {
        id: crypto.randomUUID(),
        subject_id: subjectId,
        concept_id: q.concept.id,
        prompt: q.prompt,
        options,
        explanations,
        correct_index: correctIndex,
        status: "sugerido",
      };
    });

    const { error: insertError } = await supabase.from("questions").insert(rows);
    if (insertError) {
      console.error("generate-questions: no se pudieron guardar las preguntas:", insertError);
      return NextResponse.json({ error: "No se pudieron guardar las preguntas. Inténtalo de nuevo." }, { status: 500 });
    }

    // Citas de las preguntas: solo las que están tal cual en su fragmento. Si fallan, las preguntas ya están guardadas.
    const evidence = valid.flatMap((q, i) => {
      const hit = q.concept.hits[Number(q.fragmento.replace(/\D/g, "")) - 1];
      const quote = normalizeForQuote(q.cita);
      return hit && verifyQuote(quote, hit.content)
        ? [{
            concept_id: q.concept.id,
            question_id: rows[i].id,
            chunk_id: hit.id,
            quote,
            subject_id: subjectId,
            document_id: hit.documentId,
          }]
        : [];
    });
    if (evidence.length > 0) {
      const { error: evidenceError } = await supabase.from("evidence_spans").insert(evidence);
      if (evidenceError) console.error("generate-questions: las preguntas se guardaron, pero no sus citas:", evidenceError);
    }

    console.info(`generate-questions: ${rows.length} preguntas, ${evidence.length} con cita, ${discarded} descartadas`);
    return NextResponse.json({ success: true, count: rows.length, withQuote: evidence.length });
  } catch (err) {
    // El detalle técnico (OpenAI, Postgres) queda en el log del servidor; al navegador, un mensaje genérico
    console.error("Error en generate-questions:", err);
    return NextResponse.json(
      { error: "Ocurrió un error al generar las preguntas. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
