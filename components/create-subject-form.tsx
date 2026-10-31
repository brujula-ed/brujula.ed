"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateClassCode } from "@/lib/class-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export function CreateSubjectForm() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Escribe el nombre de la asignatura.");
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setError("Tu sesión expiró. Vuelve a iniciar sesión.");
      return;
    }

    // class_code es único: si el código generado ya existe (23505, muy poco probable), se prueba con otro
    let insertError: { code: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabase.from("subjects").insert({
        teacher_id: user.id,
        name,
        description: description.trim() || null,
        class_code: generateClassCode(),
      });
      insertError = error;
      if (error?.code !== "23505") break;
    }
    setLoading(false);
    if (insertError) {
      console.error("No se pudo crear la asignatura:", insertError);
      setError("No se pudo crear la asignatura. Inténtalo de nuevo.");
      return;
    }
    setName("");
    setDescription("");
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nombre de la asignatura</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ingrese el nombre de la asignatura" />
          </div>
          <div className="flex flex-col gap-1.5">
            {/* Los temas de la asignatura se organizan después, desde sus conceptos */}
            <Label htmlFor="description">De qué trata (opcional)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Por ejemplo: análisis de videojuegos como discurso"
            />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? "Creando..." : "Crear asignatura"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}