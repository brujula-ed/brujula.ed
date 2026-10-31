"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check, CircleAlert, ExternalLink, PenLine, Play, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReviewChip } from "@/components/review-chip";
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

const KIND_ICON: Record<ResourceKind, typeof BookOpen> = { lectura: BookOpen, video: Play, ejercicio: PenLine };

const sourceName = (source: string) => (source === "docente" ? "Agregado por ti" : siteLabel(source));

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

// Bloque "Recursos" del centro de la mesa de Fichas y recursos (F-11): validar o descartar cada recurso y agregar
// enlaces propios. Cada recurso se valida por separado: nada se publica sin mirarlo.
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
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
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

  const errorMessage = error && <p role="alert" className="text-sm text-destructive">{error}</p>;

  return (
    <div className="flex flex-col gap-3">
      {resources.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay recursos para este concepto.</p>}

      <ul className="flex flex-col gap-2">
        {resources.map((r) => {
          const Icon = KIND_ICON[r.kind as ResourceKind] ?? BookOpen;
          return (
            <li key={r.id} className="flex flex-col gap-3 rounded-control border border-border p-3 sm:flex-row sm:items-start">
              <div className="flex min-w-0 flex-1 gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
                >
                  <Icon className="size-4" />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-1 font-medium text-primary hover:underline"
                  >
                    <span className="min-w-0 break-words">{r.title}</span>
                    <ExternalLink aria-hidden="true" className="mt-1 size-3.5 shrink-0" />
                    <span className="sr-only">(se abre en otra pestaña)</span>
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {RESOURCE_KIND_LABEL[r.kind as ResourceKind] ?? r.kind} · {sourceName(r.source)}
                  </p>
                  {r.link_check === "verificado" && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Check aria-hidden="true" className="size-3.5 text-primary" />
                      Enlace comprobado
                    </p>
                  )}
                  {r.link_check === "no_verificable" && (
                    <p className="flex items-start gap-1 text-xs font-medium text-foreground">
                      <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                      Este sitio no deja comprobar el enlace: ábrelo antes de validarlo
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <ReviewChip validated={r.status === "validado"} />
                <Button size="sm" variant="ghost" onClick={() => handleDiscard(r.id)}>Descartar</Button>
                {r.status === "sugerido" && (
                  <Button size="sm" variant="outline" onClick={() => handleValidate(r.id)}>
                    <Check aria-hidden="true" />
                    Validar
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {adding ? (
        <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-control border border-dashed border-border p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`resource-title-${conceptId}`}>Título</Label>
            <Input id={`resource-title-${conceptId}`} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`resource-url-${conceptId}`}>Enlace</Label>
            <Input
              id={`resource-url-${conceptId}`}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              inputMode="url"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`resource-kind-${conceptId}`}>Tipo</Label>
            <select
              id={`resource-kind-${conceptId}`}
              value={kind}
              onChange={(e) => setKind(e.target.value as ResourceKind)}
              className="h-11 max-w-xs rounded-control border border-input bg-card px-3 text-base text-foreground"
            >
              {(Object.keys(RESOURCE_KIND_LABEL) as ResourceKind[]).map((k) => (
                <option key={k} value={k}>{RESOURCE_KIND_LABEL[k]}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">Tus enlaces se publican al agregarlos: no pasan por la verificación.</p>
          {errorMessage}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setError("");
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>{loading ? "Agregando..." : "Agregar"}</Button>
          </div>
        </form>
      ) : (
        <>
          {errorMessage}
          <Button variant="outline" size="sm" className="self-start" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            Agregar enlace propio
          </Button>
        </>
      )}
    </div>
  );
}
