"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

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
    setUploading(true);

    const path = `${subjectId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("course-documents")
      .upload(path, file);

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
      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
    </div>
  );
}