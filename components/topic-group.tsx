"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CircleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type Topic = { id: string; name: string; description: string | null; status: string; position: number };

// Un tema con sus conceptos (versión mínima, hasta el rediseño de la validación). Subir y bajar intercambian la
// posición con el tema vecino. Borrar un tema no borra sus conceptos: la base los deja sin tema.
export function TopicGroup({
  topic,
  prev,
  next,
  needs = [],
  neededBelow = [],
  mutualWith = [],
  children,
}: {
  topic: Topic;
  prev?: Topic;
  next?: Topic;
  needs?: string[]; // nombres de los temas que necesita (calculados desde los prerrequisitos)
  neededBelow?: string[]; // de esos, los que están más abajo en la lista: el docente decide si reordena
  mutualWith?: string[]; // temas que se necesitan mutuamente con este: conviene revisar sus prerrequisitos
  children: React.ReactNode;
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

  async function handleSave() {
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
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border/60 bg-muted/40 p-4">
      {editing ? (
        <div className="flex flex-col gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre del tema" />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción breve (opcional)"
            aria-label="Descripción del tema"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={loading}>Guardar</Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setName(topic.name);
                setDescription(topic.description ?? "");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2 className="text-subsection">{topic.name}</h2>
              <span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">
                {topic.status === "validado" ? "Validado" : "Propuesto por la IA"}
              </span>
            </div>
            {topic.description && <p className="text-sm text-muted-foreground">{topic.description}</p>}
            {needs.length > 0 && (
              <p className="text-xs text-muted-foreground">Necesita: {needs.join(", ")}</p>
            )}
            {neededBelow.length > 0 && (
              <p className="flex items-center gap-1 text-xs text-foreground">
                <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
                {neededBelow.map((n) => `«${n}»`).join(", ")} está más abajo y conviene estudiarlo antes: considera
                reordenar.
              </p>
            )}
            {mutualWith.length > 0 && (
              <p className="flex items-center gap-1 text-xs text-foreground">
                <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
                Se necesita mutuamente con {mutualWith.join(", ")}: revisa los prerrequisitos de sus conceptos.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {topic.status === "sugerido" && (
              <Button size="sm" onClick={() => update({ status: "validado" }, "No se pudo validar el tema.")} disabled={loading}>
                Validar
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Renombrar</Button>
            <Button size="icon-sm" variant="ghost" onClick={() => prev && handleMove(prev)} disabled={!prev || loading} aria-label="Subir el tema">
              <ArrowUp />
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => next && handleMove(next)} disabled={!next || loading} aria-label="Bajar el tema">
              <ArrowDown />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDelete}>Borrar</Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
