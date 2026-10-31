"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export type DuplicatePair = { a: { id: string; name: string }; b: { id: string; name: string }; reason: string };

// Botón "Buscar duplicados": calcula los embeddings que falten y actualiza los avisos
export function FindDuplicatesButton({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleFind() {
    setLoading(true);
    setStatus(null);
    const res = await fetch("/api/find-duplicates", {
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
    setStatus(data.pairs > 0 ? `${data.pairs} posibles duplicados` : "No se encontraron posibles duplicados");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={handleFind} disabled={loading}>
        {loading ? "Comparando conceptos..." : "Buscar duplicados"}
      </Button>
      <span role="status" className="text-xs text-muted-foreground">{status}</span>
    </div>
  );
}

// Posibles duplicados (versión simple, docs/MOTOR-DE-CONOCIMIENTO.md 4.3): el docente descarta o edita uno de los dos
// desde la mesa de Estructura (onSelect abre el concepto en ella), o marca que no son el mismo (el aviso no vuelve a
// salir).
export function DuplicatePairs({
  subjectId,
  pairs,
  onSelect,
}: {
  subjectId: string;
  pairs: DuplicatePair[];
  onSelect: (conceptId: string) => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState("");

  async function dismiss(pair: DuplicatePair) {
    setError("");
    // La tabla guarda la pareja en orden (concept_a < concept_b), igual que similar_concepts
    const [first, second] = [pair.a.id, pair.b.id].sort();
    const { error: dismissError } = await supabase
      .from("concept_pair_dismissals")
      // La base vuelve a poner la asignatura desde los conceptos y comprueba que los dos sean de ella
      .insert({ concept_a: first, concept_b: second, subject_id: subjectId });
    // Ya descartada antes (23505) cuenta como hecho: igual se quita el aviso
    if (dismissError && dismissError.code !== "23505") {
      setError("No se pudo guardar. Inténtalo de nuevo.");
      return;
    }
    await supabase.from("concept_duplicate_candidates").delete().eq("concept_a", first).eq("concept_b", second);
    router.refresh();
  }

  if (pairs.length === 0) return null;
  return (
    <section className="mb-6 flex flex-col gap-3 rounded-card border border-border bg-card p-4 shadow-rest">
      <h3 className="flex items-center gap-2 text-subsection">
        <CircleAlert aria-hidden="true" className="size-4" />
        Posibles duplicados
      </h3>
      <p className="text-sm text-muted-foreground">
        Estos conceptos se parecen mucho. Si son el mismo, ábrelo y descarta o edita uno de los dos.
      </p>
      <ul className="flex flex-col gap-2">
        {pairs.map((p) => (
          <li key={`${p.a.id}-${p.b.id}`} className="flex flex-col gap-1 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                <button onClick={() => onSelect(p.a.id)} className="font-medium text-primary hover:underline">«{p.a.name}»</button>
                {" y "}
                <button onClick={() => onSelect(p.b.id)} className="font-medium text-primary hover:underline">«{p.b.name}»</button>
              </span>
              <Button size="xs" variant="ghost" onClick={() => dismiss(p)}>No son el mismo</Button>
            </div>
            <p className="text-xs text-muted-foreground">{p.reason}</p>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </section>
  );
}
