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

  async function handleSave() {
    setLoading(true);
    await supabase.from("subjects").update({ name, topic }).eq("id", subject.id);
    setLoading(false);
    setEditing(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar esta asignatura? Esto no se puede deshacer.")) return;
    await supabase.from("subjects").delete().eq("id", subject.id);
    router.refresh();
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(subject.class_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (editing) {
    return (
      <Card>
        <CardContent className="pt-6 flex flex-col gap-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la asignatura" />
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Tema" />
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
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Editar
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete}>
            Eliminar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}