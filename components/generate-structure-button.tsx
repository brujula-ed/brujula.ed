"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkingDialog, type WorkStep } from "@/components/working-dialog";

type Phase = "idle" | "reading" | "organizing" | "done" | "error";

// "Continuar y generar estructura" (paso Material): un solo botón para toda la IA de la estructura, en dos llamadas
// seguidas (cada una con su propio tiempo límite en Vercel):
//   1. /api/generate-concepts: conceptos nuevos con sus prerrequisitos, citas del material y aviso de duplicados;
//   2. /api/organize-topics: agrupa en temas los conceptos que aún no tienen.
// Repetirlo con material nuevo no duplica: la 1 solo crea conceptos nuevos y la 2 solo toca los que no tienen tema.
export function GenerateStructureButton({ subjectId, hasConcepts }: { subjectId: string; hasConcepts: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [failedAt, setFailedAt] = useState<0 | 1>(0);
  const [message, setMessage] = useState("");

  async function post(url: string) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectId }),
    });
    const data = await res.json().catch(() => ({ error: "Respuesta inesperada del servidor." }));
    return { ok: res.ok, data };
  }

  async function handleGenerate() {
    setMessage("");
    setPhase("reading");

    const concepts = await post("/api/generate-concepts");
    if (!concepts.ok) {
      setFailedAt(0);
      setMessage(concepts.data.error ?? "No se pudo generar la estructura. Inténtalo de nuevo.");
      setPhase("error");
      return;
    }

    setPhase("organizing");
    const topics = await post("/api/organize-topics");
    router.refresh();
    if (!topics.ok) {
      setFailedAt(1);
      setMessage(
        `Se crearon ${concepts.data.count} conceptos, pero no se pudieron organizar en temas` +
          (topics.data.error ? `: ${topics.data.error}` : ".") +
          " Puedes reintentarlo desde Estructura."
      );
      setPhase("error");
      return;
    }

    const parts = [`${concepts.data.count} conceptos nuevos`];
    if (topics.data.newTopics > 0) parts.push(`organizados en ${topics.data.newTopics} temas nuevos`);
    else if (topics.data.organized > 0) parts.push("organizados en tus temas");
    let summary = parts.join(", ") + ".";
    if (topics.data.unassigned > 0) summary += ` ${topics.data.unassigned} quedaron sin tema: puedes moverlos tú.`;
    // Con material muy largo, la ruta lee solo los primeros tramos y avisa cuántos quedaron sin leer
    if (concepts.data.skippedSections > 0) {
      summary += ` El material es muy largo: ${concepts.data.skippedSections} partes del final no se leyeron.`;
    }
    setMessage(summary);
    setPhase("done");
  }

  const stepState = (i: 0 | 1): WorkStep["state"] => {
    const at = phase === "reading" ? 0 : phase === "organizing" ? 1 : phase === "done" ? 2 : failedAt;
    if (phase === "error" && i === failedAt) return "error";
    return i < at ? "done" : i === at ? "active" : "pending";
  };

  const working = phase === "reading" || phase === "organizing";

  return (
    <>
      <Button size="lg" onClick={handleGenerate} disabled={working}>
        <Sparkles aria-hidden="true" />
        {hasConcepts ? "Generar con el material nuevo" : "Continuar y generar estructura"}
      </Button>

      <WorkingDialog
        open={phase !== "idle"}
        title={phase === "done" ? "Estructura lista" : phase === "error" ? "No se pudo terminar" : "Generando la estructura"}
        steps={[
          { label: "Leyendo tu material: conceptos, prerrequisitos y fuentes", state: stepState(0) },
          { label: "Organizando en temas", state: stepState(1) },
        ]}
        working={working}
        hint="Suele tardar 1 o 2 minutos."
      >
        <p role={phase === "error" ? "alert" : "status"} className="text-sm">
          {message}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {(phase === "done" || (phase === "error" && failedAt === 1)) && (
            <Button
              onClick={() => {
                setPhase("idle");
                router.push(`/docente/${subjectId}?paso=estructura`);
              }}
            >
              Revisar la estructura
              <ArrowRight aria-hidden="true" />
            </Button>
          )}
          <Button variant={phase === "error" && failedAt === 0 ? "default" : "ghost"} onClick={() => setPhase("idle")}>
            Cerrar
          </Button>
        </div>
      </WorkingDialog>
    </>
  );
}
