"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function GenerateConceptsButton({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setStatus(null);
    const res = await fetch("/api/generate-concepts", {
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
    // Con material muy largo, la ruta lee solo los primeros tramos y avisa cuántos quedaron sin leer
    setStatus(
      `${data.count} conceptos sugeridos` +
        (data.skippedSections > 0
          ? `. El material es muy largo: ${data.skippedSections} partes del final no se leyeron.`
          : "")
    );
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={handleGenerate} disabled={loading}>
        {loading ? "Leyendo todo el material..." : "Generar estructura con IA"}
      </Button>
      <span role="status" className="text-xs text-muted-foreground">{status}</span>
    </div>
  );
}