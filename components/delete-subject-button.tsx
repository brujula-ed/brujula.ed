"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function DeleteSubjectButton({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("¿Eliminar esta asignatura? Esto no se puede deshacer.")) return;
    setLoading(true);
    await supabase.from("subjects").delete().eq("id", subjectId);
    setLoading(false);
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleDelete} disabled={loading}>
      {loading ? "Eliminando..." : "Eliminar"}
    </Button>
  );
}