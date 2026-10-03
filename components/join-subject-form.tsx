"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export function JoinSubjectForm() {
  const router = useRouter();
  const supabase = createClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: subjectId, error: findError } = await supabase
      .rpc("find_subject_id_by_code", { input_code: code.toUpperCase().trim() });

    if (findError || !subjectId) {
      setLoading(false);
      setError("Código no encontrado. Revisa que esté bien escrito.");
      return;
    }

    const { error: joinError } = await supabase
      .from("enrollments")
      .insert({ student_id: user.id, subject_id: subjectId });

    setLoading(false);
    if (joinError) {
      setError(joinError.message.includes("duplicate") ? "Ya estás inscrito en esta asignatura." : joinError.message);
      return;
    }
    setCode("");
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Código de clase (ej. 4X7KPQ)"
            className="font-mono uppercase"
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Uniendo..." : "Unirme"}
          </Button>
        </form>
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      </CardContent>
    </Card>
  );
}