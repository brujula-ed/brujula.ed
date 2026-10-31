"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ReviewChip } from "@/components/review-chip";

export type Ficha = {
  concept_id: string;
  why_it_matters: string;
  application: string;
  source: string; // "material" o "general" (la IA completó con conocimiento general)
  status: string;
};

const textareaClass = "w-full rounded-control border border-input bg-card px-3 py-2 text-base";

// Bloque "Ficha" del centro de la mesa de Fichas y recursos (components/cards-workspace.tsx): validar, editar o
// descartar la ficha del concepto. El origen (material o conocimiento general) lo ve solo el docente.
export function ConceptFicha({ ficha }: { ficha: Ficha }) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [whyItMatters, setWhyItMatters] = useState(ficha.why_it_matters);
  const [application, setApplication] = useState(ficha.application);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Se piden de vuelta las filas modificadas: si la RLS bloquea la operación, Supabase no da error,
  // simplemente no modifica nada. 0 filas = no se guardó.
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!whyItMatters.trim() || !application.trim()) {
      setError("Completa los dos textos de la ficha.");
      return;
    }
    setLoading(true);
    const { data, error: saveError } = await supabase
      .from("concept_cards")
      .update({ why_it_matters: whyItMatters.trim(), application: application.trim() })
      .eq("concept_id", ficha.concept_id)
      .select("concept_id");
    setLoading(false);
    if (saveError || !data?.length) {
      setError("No se pudieron guardar los cambios de la ficha. Inténtalo de nuevo.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function handleValidate() {
    setLoading(true);
    setError("");
    const { data, error: validateError } = await supabase
      .from("concept_cards")
      .update({ status: "validado" })
      .eq("concept_id", ficha.concept_id)
      .select("concept_id");
    setLoading(false);
    if (validateError || !data?.length) {
      setError("No se pudo validar la ficha. Inténtalo de nuevo.");
      return;
    }
    router.refresh();
  }

  async function handleDiscard() {
    if (!confirm("¿Descartar esta ficha? Podrás preparar otra desde Estructura.")) return;
    setError("");
    const { data, error: deleteError } = await supabase
      .from("concept_cards")
      .delete()
      .eq("concept_id", ficha.concept_id)
      .select("concept_id");
    if (deleteError || !data?.length) {
      setError("No se pudo descartar la ficha. Inténtalo de nuevo.");
      return;
    }
    router.refresh();
  }

  const errorMessage = error && <p role="alert" className="text-sm text-destructive">{error}</p>;

  if (editing) {
    return (
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ficha-why">Por qué importa</Label>
          <textarea
            id="ficha-why"
            value={whyItMatters}
            onChange={(e) => setWhyItMatters(e.target.value)}
            rows={3}
            autoFocus
            className={textareaClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ficha-application">Para qué te sirve</Label>
          <textarea
            id="ficha-application"
            value={application}
            onChange={(e) => setApplication(e.target.value)}
            rows={3}
            className={textareaClass}
          />
        </div>
        {errorMessage}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setWhyItMatters(ficha.why_it_matters);
              setApplication(ficha.application);
              setError("");
            }}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>{loading ? "Guardando..." : "Guardar"}</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <ReviewChip validated={ficha.status === "validado"} validatedLabel="Validada" />
        {ficha.source === "general" ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CircleAlert aria-hidden="true" className="size-3.5" />
            Conocimiento general, no de tu material: revísala con cuidado
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Sale de tu material</span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-eyebrow text-muted-foreground">Por qué importa</p>
        <p className="text-base">{ficha.why_it_matters}</p>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-eyebrow text-muted-foreground">Para qué te sirve</p>
        <p className="text-base">{ficha.application}</p>
      </div>

      {errorMessage}

      {/* Orden fijo: la principal al final */}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={handleDiscard}>Descartar</Button>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Editar</Button>
        {ficha.status === "sugerido" && (
          <Button size="sm" onClick={handleValidate} disabled={loading}>
            <Check aria-hidden="true" />
            Validar ficha
          </Button>
        )}
      </div>
    </div>
  );
}
