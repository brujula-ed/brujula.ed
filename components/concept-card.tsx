"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type Concept = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  prerequisite_ids: string[];
};

export function ConceptCard({ concept, allConcepts }: { concept: Concept; allConcepts: Concept[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(concept.name);
  const [description, setDescription] = useState(concept.description ?? "");
  const [loading, setLoading] = useState(false);

  const prereqNames = allConcepts
    .filter((c) => concept.prerequisite_ids.includes(c.id))
    .map((c) => c.name);

  async function handleSave() {
    setLoading(true);
    await supabase.from("concepts").update({ name, description }).eq("id", concept.id);
    setLoading(false);
    setEditing(false);
    router.refresh();
  }

  async function handleValidate() {
    setLoading(true);
    await supabase.from("concepts").update({ status: "validado" }).eq("id", concept.id);
    setLoading(false);
    router.refresh();
  }

  async function handleDiscard() {
    if (!confirm("¿Descartar este concepto sugerido?")) return;
    await supabase.from("concepts").delete().eq("id", concept.id);
    router.refresh();
  }

  if (editing) {
    return (
      <Card>
        <CardContent className="pt-6 flex flex-col gap-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del concepto" />
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción breve" />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={loading}>Guardar</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-sm font-medium">{concept.name}</p>
            {prereqNames.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">Requiere: {prereqNames.join(", ")}</p>
            )}
          </div>
          <span
            className={`text-xs px-2 py-1 rounded shrink-0 ${
              concept.status === "validado" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {concept.status === "validado" ? "Validado" : "Sugerido por IA"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-3">{concept.description}</p>
        <div className="flex gap-2">
          {concept.status === "sugerido" && (
            <Button size="sm" onClick={handleValidate} disabled={loading}>Validar</Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Editar</Button>
          <Button size="sm" variant="ghost" onClick={handleDiscard}>Descartar</Button>
        </div>
      </CardContent>
    </Card>
  );
}