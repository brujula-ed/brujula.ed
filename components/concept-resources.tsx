"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RESOURCE_KIND_LABEL, siteLabel, type ResourceKind } from "@/lib/resource-sources";

export type Resource = {
  id: string;
  concept_id: string;
  title: string;
  url: string;
  kind: string;
  source: string;
  added_by: string;
  link_check: string; // "verificado" | "no_verificable" | "docente"
  status: string;
};

const sourceName = (source: string) => (source === "docente" ? "Agregado por ti" : siteLabel(source));

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

// Recursos de un concepto en la página de conceptos del docente (F-11): validar, descartar y agregar propios
export function ConceptResources({
  conceptId,
  subjectId,
  resources,
}: {
  conceptId: string;
  subjectId: string;
  resources: Resource[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<ResourceKind>("lectura");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Se piden de vuelta las filas modificadas: si la RLS bloquea la operación, Supabase no da error,
  // simplemente no modifica nada. 0 filas = no se guardó.
  async function handleValidate(id: string) {
    setError("");
    const { data, error: validateError } = await supabase
      .from("concept_resources")
      .update({ status: "validado" })
      .eq("id", id)
      .select("id");
    if (validateError || !data?.length) {
      setError("No se pudo validar el recurso. Inténtalo de nuevo.");
      return;
    }
    router.refresh();
  }

  async function handleDiscard(id: string) {
    if (!confirm("¿Descartar este recurso?")) return;
    setError("");
    const { data, error: deleteError } = await supabase.from("concept_resources").delete().eq("id", id).select("id");
    if (deleteError || !data?.length) {
      setError("No se pudo descartar el recurso. Inténtalo de nuevo.");
      return;
    }
    router.refresh();
  }

  // Los enlaces propios no pasan por el catálogo ni por la verificación: los valida el docente al agregarlos
  async function handleAdd() {
    setError("");
    if (!title.trim() || !isHttpsUrl(url.trim())) {
      setError("Escribe un título y un enlace que empiece por https://.");
      return;
    }
    setLoading(true);
    const { data, error: insertError } = await supabase
      .from("concept_resources")
      .insert({
        concept_id: conceptId,
        subject_id: subjectId, // el trigger lo vuelve a poner desde el concepto
        title: title.trim(),
        url: url.trim(),
        kind,
        source: "docente",
        added_by: "docente",
        link_check: "docente",
        status: "validado",
      })
      .select("id");
    setLoading(false);
    if (insertError?.code === "23505") {
      setError("Ese enlace ya está en este concepto.");
      return;
    }
    if (insertError || !data?.length) {
      setError("No se pudo agregar el enlace. Inténtalo de nuevo.");
      return;
    }
    setAdding(false);
    setTitle("");
    setUrl("");
    router.refresh();
  }

  return (
    <div className="border-t pt-3 mt-3">
      <p className="text-xs font-medium mb-2">Recursos para repasar</p>
      {resources.length === 0 && (
        <p className="text-xs text-muted-foreground mb-2">Aún no hay recursos para este concepto.</p>
      )}
      <ul className="flex flex-col gap-2 mb-2">
        {resources.map((r) => (
          <li key={r.id} className="text-sm flex items-start justify-between gap-2">
            <div>
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {r.title}
              </a>
              <p className="text-xs text-muted-foreground">
                {RESOURCE_KIND_LABEL[r.kind as ResourceKind] ?? r.kind} · {sourceName(r.source)}
                {r.link_check === "no_verificable" && " · Sin verificar: ábrelo antes de validarlo"}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {r.status === "sugerido" ? (
                <>
                  <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700">Sugerido por IA</span>
                  <Button size="sm" variant="outline" onClick={() => handleValidate(r.id)}>Validar</Button>
                </>
              ) : (
                <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">Validado</span>
              )}
              <Button size="sm" variant="ghost" onClick={() => handleDiscard(r.id)}>Descartar</Button>
            </div>
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="flex flex-col gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" aria-label="Título del recurso" />
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." aria-label="Enlace del recurso" />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Tipo
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ResourceKind)}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground"
            >
              {(Object.keys(RESOURCE_KIND_LABEL) as ResourceKind[]).map((k) => (
                <option key={k} value={k}>{RESOURCE_KIND_LABEL[k]}</option>
              ))}
            </select>
          </label>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={loading}>Agregar</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setError(""); }}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <>
          {error && <p role="alert" className="text-xs text-destructive mb-2">{error}</p>}
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>Agregar enlace</Button>
        </>
      )}
    </div>
  );
}
