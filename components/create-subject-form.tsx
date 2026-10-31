"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateClassCode } from "@/lib/class-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Se usa dentro de la ventana de "Nueva asignatura" (components/new-subject-toggle.tsx)
export function CreateSubjectForm({ onCreated, onCancel }: { onCreated?: () => void; onCancel?: () => void }) {
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
    let created: { id: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase
        .from("subjects")
        .insert({
          teacher_id: user.id,
          name,
          description: description.trim() || null,
          class_code: generateClassCode(),
        })
        .select("id")
        .single();
      insertError = error;
      created = data;
      if (error?.code !== "23505") break;
    }
    if (insertError || !created) {
      setLoading(false);
      console.error("No se pudo crear la asignatura:", insertError);
      setError("No se pudo crear la asignatura. Inténtalo de nuevo.");
      return;
    }
    // A la página de la asignatura nueva, que empieza en el paso Material. loading sigue activo hasta que cambie la
    // página, para que no se pueda crear dos veces.
    onCreated?.();
    router.push(`/docente/${created.id}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle id="new-subject-title">Nueva asignatura</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nombre de la asignatura</Label>
            <Input id="name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ingrese el nombre de la asignatura" />
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
          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear asignatura"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}