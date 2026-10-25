"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function GenerateResourcesButton({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setStatus(null);
    const res = await fetch("/api/generate-resources", {
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
    setStatus(data.notice ?? `${data.count} recursos sugeridos`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={handleGenerate} disabled={loading}>
        {loading ? "Buscando y verificando..." : "Buscar recursos con IA"}
      </Button>
      <span role="status" className="text-xs text-muted-foreground">{status}</span>
    </div>
  );
}
