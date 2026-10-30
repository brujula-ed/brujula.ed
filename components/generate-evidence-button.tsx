"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function GenerateEvidenceButton({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setStatus(null);
    const res = await fetch("/api/generate-evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setStatus(`Error: ${data.error}`);
      return;
    }
    setStatus(
      data.notice ??
        `${data.withQuote} conceptos con fuente` +
          (data.withoutQuote > 0 ? `; ${data.withoutQuote} sin fuente en el material` : "")
    );
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={handleGenerate} disabled={loading}>
        {loading ? "Buscando en el material..." : "Buscar fuentes"}
      </Button>
      <span role="status" className="text-xs text-muted-foreground">{status}</span>
    </div>
  );
}
