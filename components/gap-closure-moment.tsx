"use client";

import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Card, CardContent } from "@/components/ui/card";
import { computeConceptStates } from "@/lib/concept-state";
import { newlyRecovered, unlockedBy } from "@/lib/gap-closure";
import { createClient } from "@/lib/supabase/client";

type Closure = { conceptId: string; name: string; opened: string[] };

// Momento de cierre (F-13), al final del diagnóstico: las brechas que se cerraron con ESTE intento, calculadas con
// las mismas reglas que el LRR (lib/gap-closure.ts). attemptId debe ser el intento recién completado.
// Si no se cerró ninguna o falla una consulta, no se muestra nada: el resto de la pantalla no depende de esto.
export function GapClosureMoment({ subjectId, attemptId }: { subjectId: string; attemptId: string }) {
  const [closures, setClosures] = useState<Closure[]>([]);
  const [gap, setGap] = useState(16);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;

    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [conceptsRes, attemptsRes] = await Promise.all([
        supabase
          .from("concepts")
          .select("id, name, prerequisite_ids")
          .eq("subject_id", subjectId)
          .eq("status", "validado"),
        supabase
          .from("diagnostic_attempts")
          .select("id, created_at")
          .not("completed_at", "is", null)
          .eq("subject_id", subjectId)
          .eq("user_id", user.id),
      ]);
      if (conceptsRes.error || attemptsRes.error) {
        console.error("Momento de cierre: no se pudieron cargar los datos", conceptsRes.error ?? attemptsRes.error);
        return;
      }
      const concepts = conceptsRes.data ?? [];
      const attempts = attemptsRes.data ?? [];

      const { data: answers, error } = await supabase
        .from("diagnostic_answers")
        .select("attempt_id, stage, concept_id, is_correct")
        .in("attempt_id", attempts.map((a) => a.id));
      if (error || !answers) {
        console.error("Momento de cierre: no se pudieron cargar las respuestas", error);
        return;
      }

      const states = computeConceptStates(concepts, attempts, answers);
      const result = newlyRecovered(concepts, attempts, answers, attemptId).map((g) => ({
        conceptId: g.conceptId,
        name: g.concept,
        opened: unlockedBy(concepts, states, g.conceptId).map((c) => c.name),
      }));
      if (cancelled || result.length === 0) return;
      setClosures(result);

      // El rayo amarillo se une a la rosa: 900 ms con salida suave, tras una pausa para ver la brecha abierta.
      // Con "reducir movimiento" se muestra directamente cerrado.
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let t0: number | null = null;
      const step = (ts: number) => {
        t0 ??= ts;
        const k = reduce ? 1 : Math.min(1, Math.max(0, (ts - t0 - 500) / 900));
        setGap(16 * Math.pow(1 - k, 3));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }

    load();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [subjectId, attemptId]);

  // El contenedor existe siempre para que los lectores de pantalla anuncien el mensaje cuando aparece.
  return (
    <div role="status">
      {closures.length > 0 && (
        <Card className="mb-6 border-2 border-brand-ray">
          <CardContent className="pt-4 flex items-start gap-4">
            <BrandMark size={56} tone="on-light" gap={gap} />
            <ul className="flex flex-col gap-3">
              {closures.map((c) => (
                <li key={c.conceptId}>
                  <p className="font-heading text-base font-bold">Cerraste la brecha de {c.name}</p>
                  {c.opened.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Ahora puedes seguir con {c.opened.join(", ")}.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
