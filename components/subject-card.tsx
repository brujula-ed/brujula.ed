"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

type Subject = { id: string; name: string; topic: string; class_code: string };

export function SubjectCard({ subject }: { subject: Subject }) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(subject.name);
  const [topic, setTopic] = useState(subject.topic);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  // Se piden de vuelta las filas modificadas: si la RLS bloquea la operación, Supabase no da error,
  // simplemente no modifica nada. 0 filas = no se guardó.
  async function handleSave() {
    setError("");
    if (!name.trim() || !topic.trim()) {
      setError("Completa el nombre y el tema.");
      return;
    }
    setLoading(true);
    const { data, error: saveError } = await supabase
      .from("subjects")
      .update({ name, topic })
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
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Tema" aria-label="Tema" />
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
                setTopic(subject.topic);
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <Link href={`/docente/${subject.id}`} className="hover:underline">
          {subject.name}
          </Link>
          <button
            onClick={handleCopy}
            title="Clic para copiar"
            className="text-xs font-mono bg-muted px-2 py-1 rounded hover:bg-muted/70 transition-colors"
          >
            {copied ? "¡Copiado!" : subject.class_code}
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground flex items-center justify-between">
        <span>{subject.topic}</span>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => router.push(`/docente/${subject.id}`)}>
            Gestionar
          </Button>
          <Button size="sm" variant="outline" onClick={() => router.push(`/docente/${subject.id}/reporte`)}>
            Resultados
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Editar
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete}>
            Eliminar
          </Button>
        </div>
      </CardContent>
      {error && <CardContent className="pt-0">{errorMessage}</CardContent>}
    </Card>
  );
}