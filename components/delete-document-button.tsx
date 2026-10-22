"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function DeleteDocumentButton({
  documentId,
  storagePath,
  fileName,
}: {
  documentId: string;
  storagePath: string;
  fileName: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (
      !confirm(
        `¿Eliminar «${fileName}»? Se borrarán el archivo y sus fragmentos procesados. Los conceptos y preguntas que ya se generaron con él no se eliminan.`
      )
    )
      return;

    setError("");
    setLoading(true);

    const { data: removed, error: storageError } = await supabase.storage
      .from("course-documents")
      .remove([storagePath]);

    if (storageError || !removed || removed.length === 0) {
      setLoading(false);
      setError("No se pudo borrar el archivo.");
      return;
    }

    const { error: dbError } = await supabase.from("subject_documents").delete().eq("id", documentId);
    setLoading(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="ghost" onClick={handleDelete} disabled={loading}>
        {loading ? "Eliminando..." : "Eliminar"}
      </Button>
      {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
    </div>
  );
}