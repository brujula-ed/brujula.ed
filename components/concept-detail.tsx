"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReviewChip } from "@/components/review-chip";

export type WorkspaceConcept = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  prerequisite_ids: string[];
  topic_id: string | null;
};

// Centro de la mesa de Estructura (components/structure-workspace.tsx): un concepto con sus acciones. "Validar y
// seguir" avisa a la mesa (onDone) para pasar al siguiente pendiente; la IA propone y el docente valida uno por uno
// (docs/PRINCIPIOS-DE-DISENO.md 1.1), sin validar en bloque.
export function ConceptDetail({
  concept,
  topics,
  onDone,
}: {
  concept: WorkspaceConcept;
  topics: { id: string; name: string }[];
  onDone: () => void; // tras validar o descartar: la mesa elige el siguiente pendiente
}) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(concept.name);
  const [description, setDescription] = useState(concept.description ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Se piden de vuelta las filas modificadas: si la RLS bloquea la operación, Supabase no da error,
  // simplemente no modifica nada. 0 filas = no se guardó.
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Escribe el nombre del concepto.");
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: saveError } = await supabase
      .from("concepts")
      .update({ name: name.trim(), description: description.trim() })
      .eq("id", concept.id)
      .select("id");
    setLoading(false);
    if (saveError?.code === "23505") {
      setError("Ya existe un concepto con ese nombre en esta asignatura.");
      return;
    }
    if (saveError || !data?.length) {
      setError("No se pudieron guardar los cambios. Inténtalo de nuevo.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function handleValidate() {
    setLoading(true);
    setError("");
    const { data, error: validateError } = await supabase
      .from("concepts")
      .update({ status: "validado" })
      .eq("id", concept.id)
      .select("id");
    setLoading(false);
    if (validateError || !data?.length) {
      setError("No se pudo validar el concepto. Inténtalo de nuevo.");
      return;
    }
    onDone();
    router.refresh();
  }

  // Mover el concepto a otro tema (un concepto está en un solo tema; vacío = sin tema)
  async function handleTopic(topicId: string) {
    setLoading(true);
    setError("");
    const { data, error: topicError } = await supabase
      .from("concepts")
      .update({ topic_id: topicId || null })
      .eq("id", concept.id)
      .select("id");
    setLoading(false);
    if (topicError || !data?.length) {
      setError("No se pudo cambiar el tema. Inténtalo de nuevo.");
      return;
    }
    router.refresh();
  }

  async function handleDiscard() {
    const what = concept.status === "validado" ? "este concepto validado" : "este concepto sugerido";
    if (!confirm(`¿Descartar ${what}? Se borran también sus preguntas, ficha y recursos.`)) return;
    setError("");
    const { data, error: deleteError } = await supabase.from("concepts").delete().eq("id", concept.id).select("id");
    if (deleteError || !data?.length) {
      setError("No se pudo descartar el concepto. Inténtalo de nuevo.");
      return;
    }
    onDone();
    router.refresh();
  }

  const errorMessage = error && <p role="alert" className="text-sm text-destructive">{error}</p>;

  if (editing) {
    return (
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <h2 className="text-section">Editar concepto</h2>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="concept-name">Nombre</Label>
          <Input id="concept-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="concept-description">Definición</Label>
          <textarea
            id="concept-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-control border border-input bg-card px-3 py-2 text-base"
          />
        </div>
        {errorMessage}
        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>{loading ? "Guardando..." : "Guardar"}</Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setName(concept.name);
              setDescription(concept.description ?? "");
              setError("");
            }}
          >
            Cancelar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-section">{concept.name}</h2>
        <ReviewChip validated={concept.status === "validado"} />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-eyebrow text-muted-foreground">Definición</p>
        <p className="text-base">{concept.description || <span className="text-muted-foreground">Sin definición.</span>}</p>
      </div>

      {topics.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="concept-topic" className="text-eyebrow text-muted-foreground">Tema</Label>
          <select
            id="concept-topic"
            value={concept.topic_id ?? ""}
            onChange={(e) => handleTopic(e.target.value)}
            disabled={loading}
            className="h-11 max-w-sm rounded-control border border-input bg-card px-3 text-base text-foreground"
          >
            <option value="">Sin tema</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {errorMessage}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-5">
        {concept.status === "sugerido" ? (
          <Button onClick={handleValidate} disabled={loading}>
            <Check aria-hidden="true" />
            Validar y seguir
            <ArrowRight aria-hidden="true" />
          </Button>
        ) : (
          <p className="mr-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Check aria-hidden="true" className="size-4 text-primary" />
            Validado: lo verán tus estudiantes cuando su tema esté validado.
          </p>
        )}
        <Button variant="outline" onClick={() => setEditing(true)}>Editar</Button>
        <Button variant="ghost" onClick={handleDiscard}>Descartar</Button>
      </div>
    </div>
  );
}
