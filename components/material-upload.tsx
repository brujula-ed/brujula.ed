"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, Upload } from "lucide-react";
import { cn } from "cn";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { WorkingDialog, type WorkStep } from "@/components/working-dialog";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB, mismo límite que process-document y el bucket
// Tipos que el sistema sabe leer (lib/extract-text.ts). Se mandan explícitos: algunos navegadores
// no reconocen .docx y subirían el archivo sin tipo, y el bucket lo rechazaría.
const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// Storage no acepta tildes ni algunos símbolos en la ruta: "Óliver Pérez.pdf" → "Oliver-Perez.pdf".
// El nombre original se guarda aparte (file_name) y es el que ve el docente.
function storageSafeName(name: string): string {
  const safe = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes y diéresis
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-(?=\.)/g, "");
  return safe.slice(-100) || "documento";
}

// Por qué no se puede subir un archivo, o null si se puede
function rejectReason(file: File): string | null {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (!CONTENT_TYPES[ext]) return "solo se pueden subir PDF o Word (.docx).";
  if (file.size > MAX_FILE_BYTES) return `pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB y el límite es 10 MB.`;
  return null;
}

type Item = { name: string; state: WorkStep["state"]; text: string };

// Subir material (paso Material): se sueltan o eligen uno o varios archivos y cada uno se sube y se procesa
// (/api/process-document: texto por página o sección, fragmentos y embeddings), de uno en uno y en la misma ventana de
// espera. Procesar gasta 1 uso del cupo de IA por archivo. Si procesar falla, el documento queda subido "sin procesar"
// y se puede reintentar desde su fila.
export function MaterialUpload({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [working, setWorking] = useState(false);
  const [open, setOpen] = useState(false);

  // Sube un archivo y lo procesa. Devuelve el texto del resultado y si salió bien.
  async function uploadAndProcess(file: File): Promise<{ ok: boolean; text: string }> {
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    const path = `${subjectId}/${Date.now()}-${storageSafeName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("course-documents")
      .upload(path, file, { contentType: CONTENT_TYPES[ext] });
    if (uploadError) {
      console.error("No se pudo subir el documento:", uploadError);
      return { ok: false, text: "No se pudo subir. Revisa tu conexión e inténtalo de nuevo." };
    }

    const { data: doc, error: dbError } = await supabase
      .from("subject_documents")
      .insert({ subject_id: subjectId, file_name: file.name, storage_path: path })
      .select("id")
      .single();
    if (dbError || !doc) {
      console.error("No se pudo registrar el documento:", dbError);
      // El archivo subió pero no quedó registrado: se borra para no dejarlo sin dueño en Storage
      await supabase.storage.from("course-documents").remove([path]);
      return { ok: false, text: "No se pudo guardar el documento. Inténtalo de nuevo." };
    }

    const res = await fetch("/api/process-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: doc.id }),
    });
    const data = await res.json().catch(() => ({ error: "Respuesta inesperada del servidor." }));
    if (!res.ok) {
      return { ok: false, text: `Se subió, pero no se pudo procesar: ${data.error ?? "error desconocido."} Puedes reintentarlo desde la lista.` };
    }
    return { ok: true, text: `${data.chunksCreated} fragmentos listos para la búsqueda.` };
  }

  async function handleFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;

    // Los que no se pueden subir se avisan sin gastar nada; los demás quedan en espera
    const start: Item[] = files.map((f) => {
      const reason = rejectReason(f);
      return reason
        ? { name: f.name, state: "error", text: `No se subió: ${reason}` }
        : { name: f.name, state: "pending", text: "" };
    });
    setItems(start);
    setOpen(true);
    setWorking(true);

    const current = [...start];
    for (let i = 0; i < files.length; i++) {
      if (current[i].state === "error") continue;
      current[i] = { ...current[i], state: "active" };
      setItems([...current]);
      const result = await uploadAndProcess(files[i]);
      current[i] = { ...current[i], state: result.ok ? "done" : "error", text: result.text };
      setItems([...current]);
      router.refresh();
    }

    setWorking(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  const allOk = items.length > 0 && items.every((it) => it.state === "done");

  return (
    <>
      {/* Zona para soltar archivos. El botón de dentro la hace usable con teclado y en el celular */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!working) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-card border-2 border-dashed px-4 py-8 text-center transition-colors duration-(--duration-instant)",
          dragging ? "border-primary bg-secondary/60" : "border-border bg-card"
        )}
      >
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        >
          <Upload className="size-5" />
        </span>
        <p className="font-medium">
          <span className="hidden md:inline">Arrastra aquí tus documentos, o </span>
          <span className="md:hidden">Sube tus documentos</span>
        </p>
        <Button onClick={() => inputRef.current?.click()} disabled={working}>
          Elegir archivos
        </Button>
        <p className="text-xs text-muted-foreground">
          PDF con texto (no escaneado) o Word (.docx), hasta 10 MB cada uno. Se procesan al subirlos.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          disabled={working}
        />
      </div>

      <WorkingDialog
        open={open}
        title={working ? "Subiendo y procesando tu material" : allOk ? "Material listo" : "Terminó con avisos"}
        steps={items.map((it, i) => ({ label: `${i + 1}. ${it.name}`, state: it.state }))}
        working={working}
        hint="Un documento largo puede tardar unos minutos."
      >
        <ul className="flex flex-col gap-2 text-left text-sm" role="status">
          {items.map((it, i) => (
            <li key={i} className={cn("flex items-start gap-2", it.state === "error" && "text-destructive")}>
              {it.state === "done" ? (
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
              ) : (
                <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              )}
              <span className="min-w-0">
                <span className="font-medium break-words">{it.name}</span>: {it.text}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex justify-center">
          <Button onClick={() => setOpen(false)}>Cerrar</Button>
        </div>
      </WorkingDialog>
    </>
  );
}
