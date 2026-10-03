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
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name || !topic) {
      setError("Completa ambos campos.");
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("subjects").insert({
      teacher_id: user.id,
      name,
      topic,
      class_code: generateClassCode(),
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    setTopic("");
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nombre de la asignatura</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Programación I" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="topic">Tema</Label>
            <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Estructuras de control" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? "Creando..." : "Crear asignatura"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}