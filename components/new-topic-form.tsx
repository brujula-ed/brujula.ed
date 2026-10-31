"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Crear un tema a mano: va al final de la lista. Lo crea el docente, así que queda validado.
export function NewTopicForm({ subjectId, nextPosition }: { subjectId: string; nextPosition: number }) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Escribe el nombre del tema.");
      return;
    }
    setLoading(true);
    const { error: insertError } = await supabase
      .from("topics")
      .insert({ subject_id: subjectId, name: name.trim(), position: nextPosition, status: "validado" });
    setLoading(false);
    if (insertError) {
      setError(insertError.code === "23505" ? "Ya hay un tema con ese nombre." : "No se pudo crear el tema.");
      return;
    }
    setName("");
    router.refresh();
  }

  return (
    <form onSubmit={handleCreate} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nuevo tema" aria-label="Nombre del nuevo tema" />
        <Button type="submit" variant="outline" disabled={loading}>Crear tema</Button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
