"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export type Ficha = {
  concept_id: string;
  why_it_matters: string;
  application: string;
  source: string; // "material" o "general" (la IA completó con conocimiento general)
  status: string;
};

const textareaClass = "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm";

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
  async function handleSave() {
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
    if (!confirm("¿Descartar esta ficha? Podrás generar otra con IA.")) return;
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

  const errorMessage = error && <p role="alert" className="text-xs text-destructive">{error}</p>;

  return (
    <div className="border-t pt-3 mt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium">
          Ficha del concepto
          <span className="font-normal text-muted-foreground">
            {" · "}
            {ficha.source === "general" ? "Conocimiento general: revísala con cuidado" : "Del material"}
          </span>
        </p>
        <span
          className={`text-xs px-2 py-1 rounded shrink-0 ${
            ficha.status === "validado" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {ficha.status === "validado" ? "Validada" : "Sugerida por IA"}
        </span>
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Por qué importa
            <textarea
              value={whyItMatters}
              onChange={(e) => setWhyItMatters(e.target.value)}
              rows={3}
              className={textareaClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Para qué te sirve
            <textarea
              value={application}
              onChange={(e) => setApplication(e.target.value)}
              rows={3}
              className={textareaClass}
            />
          </label>
          {errorMessage}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={loading}>Guardar</Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setWhyItMatters(ficha.why_it_matters);
                setApplication(ficha.application);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Por qué importa</p>
          <p className="text-sm mb-2">{ficha.why_it_matters}</p>
          <p className="text-xs text-muted-foreground">Para qué te sirve</p>
          <p className="text-sm mb-3">{ficha.application}</p>
          <div className="flex gap-2">
            {ficha.status === "sugerido" && (
              <Button size="sm" onClick={handleValidate} disabled={loading}>Validar ficha</Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Editar ficha</Button>
            <Button size="sm" variant="ghost" onClick={handleDiscard}>Descartar ficha</Button>
          </div>
          {error && <div className="mt-2">{errorMessage}</div>}
        </>
      )}
    </div>
  );
}
