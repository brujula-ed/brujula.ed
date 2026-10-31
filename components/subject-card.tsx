"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StateBar } from "@/components/state-bar";
import type { StateCounts } from "@/lib/class-progress";
import type { SetupStep } from "@/lib/subject-setup";
import Link from "next/link";

type Subject = { id: string; name: string; description: string | null; class_code: string };

// Resumen de la preparación (lib/subject-setup.ts) y del progreso de la clase (lib/class-progress.ts)
export type SubjectCardSetup = { ready: boolean; current: SetupStep | null; stepNumber: number; pendingReview: number };
export type SubjectCardProgress = { counts: StateCounts; students: number; studentsWithGaps: number };

export function SubjectCard({
  subject,
  setup,
  progress,
}: {
  subject: Subject;
  setup: SubjectCardSetup;
  progress?: SubjectCardProgress;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(subject.name);
  const [description, setDescription] = useState(subject.description ?? "");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  // Se piden de vuelta las filas modificadas: si la RLS bloquea la operación, Supabase no da error,
  // simplemente no modifica nada. 0 filas = no se guardó.
  async function handleSave() {
    setError("");
    if (!name.trim()) {
      setError("Escribe el nombre de la asignatura.");
      return;
    }
    setLoading(true);
    const { data, error: saveError } = await supabase
      .from("subjects")
      .update({ name, description: description.trim() || null })
      .eq("id", subject.id)
      .select("id");
    setLoading(false);
    if (saveError || !data?.length) {
      setError("No se pudieron guardar los cambios. Inténtalo de nuevo.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar esta asignatura? Esto no se puede deshacer.")) return;
    setError("");
    const { data, error: deleteError } = await supabase.from("subjects").delete().eq("id", subject.id).select("id");
    if (deleteError || !data?.length) {
      setError("No se pudo eliminar la asignatura. Inténtalo de nuevo.");
      return;
    }
    router.refresh();
  }

  const errorMessage = error && <p role="alert" className="text-xs text-destructive">{error}</p>;

  async function handleCopy() {
    await navigator.clipboard.writeText(subject.class_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (editing) {
    return (
      <Card>
        <CardContent className="pt-6 flex flex-col gap-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la asignatura"
            aria-label="Nombre de la asignatura"
          />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="De qué trata (opcional)"
            aria-label="De qué trata la asignatura"
          />
          {errorMessage}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setName(subject.name);
                setDescription(subject.description ?? "");
              }}
            >
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="transition-[translate,box-shadow] duration-(--duration-short) ease-out-soft hover:shadow-raised motion-safe:hover:-translate-y-1">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/docente/${subject.id}`} className="font-heading text-subsection hover:underline">
              {subject.name}
            </Link>
            {subject.description && <p className="mt-0.5 text-sm text-muted-foreground">{subject.description}</p>}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
              {setup.ready ? "Lista" : "En preparación"}
            </span>
            {setup.pendingReview > 0 && (
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                {setup.pendingReview} por validar
              </span>
            )}
          </div>
        </div>

        {setup.ready && progress && progress.students > 0 ? (
          <div className="flex flex-col gap-1.5">
            <StateBar counts={progress.counts} showLegend={false} />
            <p className="text-xs text-muted-foreground">
              {progress.students} estudiantes · {progress.studentsWithGaps} con brechas
            </p>
          </div>
        ) : setup.current ? (
          <p className="text-sm">
            <span className="font-medium">
              Paso {setup.stepNumber} de 5: {setup.current.label}.
            </span>{" "}
            <span className="text-muted-foreground">{setup.current.detail}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={handleCopy}
            title="Copiar el código de clase"
            className="rounded-control bg-muted px-2.5 py-1 font-mono text-xs transition-colors duration-(--duration-instant) hover:bg-secondary"
          >
            {copied ? "¡Copiado!" : `Código ${subject.class_code}`}
          </button>
          <div className="flex gap-1">
            {progress && progress.students > 0 && (
              <Button variant="ghost" size="xs" onClick={() => router.push(`/docente/${subject.id}/reporte`)}>
                Resultados
              </Button>
            )}
            <Button variant="ghost" size="xs" onClick={() => setEditing(true)}>Editar</Button>
            <Button variant="ghost" size="xs" onClick={handleDelete}>Eliminar</Button>
          </div>
        </div>
      </CardContent>
      {error && <CardContent className="pt-0">{errorMessage}</CardContent>}
    </Card>
  );
}