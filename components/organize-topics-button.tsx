"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function OrganizeTopicsButton({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleOrganize() {
    setLoading(true);
    setStatus(null);
    const res = await fetch("/api/organize-topics", {
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
        `${data.organized} conceptos organizados en ${data.newTopics} temas nuevos` +
          (data.unassigned > 0 ? `; ${data.unassigned} quedaron sin tema` : "")
    );
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={handleOrganize} disabled={loading}>
        {loading ? "Organizando..." : "Organizar en temas"}
      </Button>
      <span role="status" className="text-xs text-muted-foreground">{status}</span>
    </div>
  );
}
