"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkingDialog } from "@/components/working-dialog";

type Phase = "idle" | "working" | "done" | "error";

// Procesar un documento ya subido (paso Material): para reintentar si falló al subirlo o, si ya estaba procesado, volver
// a procesarlo (la ruta reemplaza sus fragmentos anteriores). Gasta 1 uso del cupo de IA.
export function ProcessDocumentButton({
  documentId,
  fileName,
  processed,
}: {
  documentId: string;
  fileName: string;
  processed: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");

  async function handleProcess() {
    if (processed && !confirm(`¿Volver a procesar «${fileName}»? Se reemplazan sus fragmentos; los conceptos no se tocan.`)) {
      return;
    }
    setMessage("");
    setPhase("working");
    const res = await fetch("/api/process-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    });
    const data = await res.json().catch(() => ({ error: "Respuesta inesperada del servidor." }));
    if (!res.ok) {
      setMessage(data.error ?? "No se pudo procesar el documento. Inténtalo de nuevo.");
      setPhase("error");
      return;
    }
    setMessage(`${data.chunksCreated} fragmentos listos para la búsqueda.`);
    setPhase("done");
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant={processed ? "ghost" : "default"} onClick={handleProcess} disabled={phase === "working"}>
        {processed && <RefreshCw aria-hidden="true" />}
        {processed ? "Volver a procesar" : "Procesar"}
      </Button>

      <WorkingDialog
        open={phase !== "idle"}
        title={phase === "done" ? "Documento procesado" : phase === "error" ? "No se pudo procesar" : "Procesando el documento"}
        steps={[
          {
            label: `Leyendo «${fileName}» y preparando la búsqueda`,
            state: phase === "working" ? "active" : phase === "error" ? "error" : "done",
          },
        ]}
        working={phase === "working"}
        hint="Un documento largo puede tardar unos minutos."
      >
        <p role={phase === "error" ? "alert" : "status"} className="text-sm">
          {message}
        </p>
        <div className="flex justify-center">
          <Button onClick={() => setPhase("idle")}>Cerrar</Button>
        </div>
      </WorkingDialog>
    </>
  );
}
