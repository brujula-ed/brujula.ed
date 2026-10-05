"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ProcessDocumentButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleProcess() {
    setLoading(true);
    setStatus(null);
    const res = await fetch("/api/process-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setStatus(`Error: ${data.error}`);
      return;
    }
    setStatus(`Listo — ${data.chunksCreated} fragmentos procesados`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={handleProcess} disabled={loading}>
        {loading ? "Procesando..." : "Procesar con IA"}
      </Button>
      {status && <span className="text-xs text-muted-foreground">{status}</span>}
    </div>
  );
}