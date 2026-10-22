"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB, mismo límite que process-document y el bucket
// Tipos que el sistema sabe leer (lib/extract-text.ts). Se mandan explícitos: algunos navegadores
// no reconocen .docx y subirían el archivo sin tipo, y el bucket lo rechazaría.
const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function UploadDocumentForm({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    const contentType = CONTENT_TYPES[ext];
    if (!contentType) {
      setError("Solo se pueden subir archivos PDF o Word (.docx).");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setError(`El archivo pesa ${sizeMb} MB y el límite es 10 MB.`);
      e.target.value = "";
      return;
    }

    setUploading(true);

    const path = `${subjectId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("course-documents")
      .upload(path, file, { contentType });

    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }

    const { error: dbError } = await supabase.from("subject_documents").insert({
      subject_id: subjectId,
      file_name: file.name,
      storage_path: path,
    });

    setUploading(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    e.target.value = "";
    router.refresh();
  }

  return (
    <div>
      <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? "Subiendo..." : "Subir documento (PDF o Word)"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        onChange={handleUpload}
        className="hidden"
        disabled={uploading}
      />
      {error && <p role="alert" className="text-sm text-destructive mt-2">{error}</p>}
    </div>
  );
}