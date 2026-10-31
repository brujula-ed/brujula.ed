"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, CircleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReviewChip } from "@/components/review-chip";

export type Topic = { id: string; name: string; description: string | null; status: string; position: number };

// Avisos de orden del tema, calculados en el servidor desde los prerrequisitos (lib/knowledge-graph.ts)
export type TopicNotes = {
  needs: string[]; // nombres de los temas que necesita
  neededBelow: string[]; // de esos, los que están más abajo en la lista: el docente decide si reordena
  mutualWith: string[]; // temas que se necesitan mutuamente con este: conviene revisar sus prerrequisitos
};

// Centro de la mesa de Estructura cuando se elige un tema. Subir y bajar intercambian la posición con el tema vecino.
// Borrar un tema no borra sus conceptos: la base los deja sin tema.
export function TopicDetail({
  topic,
  number,
  prev,
  next,
  notes,
  concepts,
  onSelectConcept,
  onDeleted,
}: {
  topic: Topic;
  number: number; // su lugar en la lista (1, 2, 3…)
  prev?: Topic;
  next?: Topic;
  notes: TopicNotes;
  concepts: { id: string; name: string; status: string }[]; // sus conceptos, en orden de aprendizaje
  onSelectConcept: (id: string) => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(topic.name);
  const [description, setDescription] = useState(topic.description ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Se piden de vuelta las filas modificadas: si la RLS bloquea la operación, Supabase no da error. 0 filas = no se hizo.
  async function update(values: Partial<Topic>, failMessage: string) {
    setLoading(true);
    setError("");
    const { data, error: updateError } = await supabase.from("topics").update(values).eq("id", topic.id).select("id");
    setLoading(false);
    if (updateError || !data?.length) {
      setError(updateError?.code === "23505" ? "Ya hay un tema con ese nombre." : failMessage);
      return false;
    }
    router.refresh();
    return true;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Escribe el nombre del tema.");
      return;
    }
    if (await update({ name: name.trim(), description: description.trim() || null }, "No se pudo guardar el tema.")) {
      setEditing(false);
    }
  }

  async function handleMove(other: Topic) {
    setLoading(true);
    setError("");
    const [a, b] = await Promise.all([
      supabase.from("topics").update({ position: other.position }).eq("id", topic.id).select("id"),
      supabase.from("topics").update({ position: topic.position }).eq("id", other.id).select("id"),
    ]);
    setLoading(false);
    if (a.error || b.error || !a.data?.length || !b.data?.length) {
      setError("No se pudo cambiar el orden. Inténtalo de nuevo.");
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`¿Borrar el tema «${topic.name}»? Sus conceptos no se borran: quedan sin tema.`)) return;
    setError("");
    const { data, error: deleteError } = await supabase.from("topics").delete().eq("id", topic.id).select("id");
    if (deleteError || !data?.length) {
      setError("No se pudo borrar el tema. Inténtalo de nuevo.");
      return;
    }
    onDeleted();
    router.refresh();
  }

  const errorMessage = error && <p role="alert" className="text-sm text-destructive">{error}</p>;

  if (editing) {
    return (
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <h2 className="text-section">Editar tema</h2>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="topic-name">Nombre</Label>
          <Input id="topic-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="topic-description">Descripción breve (opcional)</Label>
          <Input id="topic-description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {errorMessage}
        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>{loading ? "Guardando..." : "Guardar"}</Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setName(topic.name);
              setDescription(topic.description ?? "");
              setError("");
            }}
          >
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  const validated = concepts.filter((c) => c.status === "validado").length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <p className="text-eyebrow text-muted-foreground">Tema {number}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-section">{topic.name}</h2>
          <ReviewChip validated={topic.status === "validado"} />
        </div>
        {topic.description && <p className="text-base text-muted-foreground">{topic.description}</p>}
      </div>

      {(notes.needs.length > 0 || notes.neededBelow.length > 0 || notes.mutualWith.length > 0) && (
        <div className="flex flex-col gap-1.5 text-sm">
          {notes.needs.length > 0 && <p className="text-muted-foreground">Necesita: {notes.needs.join(", ")}</p>}
          {notes.neededBelow.length > 0 && (
            <p className="flex items-start gap-1.5">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {notes.neededBelow.map((n) => `«${n}»`).join(", ")} está más abajo y conviene estudiarlo antes: considera
              reordenar.
            </p>
          )}
          {notes.mutualWith.length > 0 && (
            <p className="flex items-start gap-1.5">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Se necesita mutuamente con {notes.mutualWith.join(", ")}: revisa los prerrequisitos de sus conceptos.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-eyebrow text-muted-foreground">
          Conceptos · {validated} de {concepts.length} validados
        </p>
        {concepts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este tema todavía no tiene conceptos.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {concepts.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => onSelectConcept(c.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-sm hover:border-primary/50 hover:bg-secondary"
                >
                  {c.status === "validado" && <Check aria-hidden="true" className="size-3.5 text-primary" />}
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {errorMessage}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-5">
        {topic.status === "sugerido" && (
          <Button onClick={() => update({ status: "validado" }, "No se pudo validar el tema.")} disabled={loading}>
            <Check aria-hidden="true" />
            Validar tema
          </Button>
        )}
        <Button variant="outline" onClick={() => setEditing(true)}>Renombrar</Button>
        <Button size="icon" variant="ghost" onClick={() => prev && handleMove(prev)} disabled={!prev || loading} aria-label="Subir el tema">
          <ArrowUp />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => next && handleMove(next)} disabled={!next || loading} aria-label="Bajar el tema">
          <ArrowDown />
        </Button>
        <Button variant="ghost" onClick={handleDelete}>Borrar</Button>
      </div>
      {topic.status === "sugerido" && (
        <p className="text-sm text-muted-foreground">
          Validar el tema no valida sus conceptos: cada uno se revisa por separado.
        </p>
      )}
    </div>
  );
}
