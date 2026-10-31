"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkingDialog } from "@/components/working-dialog";

type Phase = "idle" | "working" | "done" | "error";

// "Generar preguntas" (paso Preguntas): /api/generate-questions completa hasta 4 por concepto validado. Es una sola
// llamada, así que la ventana muestra una sola etapa (no se sabe en cuál va por dentro) y, al terminar, lo que respondió.
export function GenerateQuestionsButton({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");

  async function handleGenerate() {
    setMessage("");
    setPhase("working");
    const res = await fetch("/api/generate-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectId }),
    });
    const data = await res.json().catch(() => ({ error: "Respuesta inesperada del servidor." }));
    if (!res.ok) {
      setMessage(data.error ?? "No se pudieron generar las preguntas. Inténtalo de nuevo.");
      setPhase("error");
      return;
    }
    router.refresh();
    // Sin conceptos que completar, la ruta responde bien con un aviso (count 0)
    setMessage(
      data.notice ??
        `${data.count} ${data.count === 1 ? "pregunta nueva" : "preguntas nuevas"}, ` +
          `${data.withQuote} con cita del material. Revísalas una por una antes de publicarlas.`
    );
    setPhase("done");
  }

  const working = phase === "working";

  return (
    <>
      <Button onClick={handleGenerate} disabled={working}>
        <Sparkles aria-hidden="true" />
        Generar preguntas
      </Button>

      <WorkingDialog
        open={phase !== "idle"}
        title={phase === "done" ? "Preguntas listas para revisar" : phase === "error" ? "No se pudo terminar" : "Generando preguntas"}
        steps={[
          {
            label: "Buscando el material de cada concepto y escribiendo sus preguntas",
            state: working ? "active" : phase === "error" ? "error" : "done",
          },
        ]}
        working={working}
      >
        <p role={phase === "error" ? "alert" : "status"} className="text-sm">
          {message}
        </p>
        <div className="flex justify-center">
          <Button onClick={() => setPhase("idle")}>{phase === "done" ? "Revisar las preguntas" : "Cerrar"}</Button>
        </div>
      </WorkingDialog>
    </>
  );
}
