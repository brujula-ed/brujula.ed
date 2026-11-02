"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Subject = { id: string; name: string; description: string | null };

// Editar y eliminar la asignatura, en el encabezado de su página (antes estaban en la tarjeta del inicio). Son acciones
// raras: por eso van aquí y no a mano en el inicio. Editar se abre en una ventana, como "Nueva asignatura".
export function SubjectActions({ subject }: { subject: Subject }) {
  const router = useRouter();
  const supabase = createClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(subject.name);
  const [description, setDescription] = useState(subject.description ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  function openEdit() {
    setName(subject.name);
    setDescription(subject.description ?? "");
    setError("");
    dialog.current?.showModal();
  }

  // Se piden de vuelta las filas modificadas: si la RLS bloquea la operación, Supabase no da error,
  // simplemente no modifica nada. 0 filas = no se guardó.
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Escribe el nombre de la asignatura.");
      return;
    }
    setLoading(true);
    const { data, error: saveError } = await supabase
      .from("subjects")
      .update({ name, description: description.trim() || null })
      .eq("id", subject.id)
      .select("id");
    setLoading(false);
    if (saveError || !data?.length) {
      setError("No se pudieron guardar los cambios. Inténtalo de nuevo.");
      return;
    }
    dialog.current?.close();
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar «${subject.name}»? Se borran también su material, conceptos, preguntas y resultados. Esto no se puede deshacer.`)) return;
    setDeleteError("");

    // La base borra en cascada las filas de la asignatura, pero no sus archivos de Storage: se borran antes. Si falla,
    // no se borra la asignatura (mejor un error que archivos sin dueño). Un archivo que ya no estaba no cuenta como fallo.
    const { data: docs, error: docsError } = await supabase
      .from("subject_documents")
      .select("storage_path")
      .eq("subject_id", subject.id);
    if (docsError) {
      setDeleteError("No se pudo eliminar la asignatura. Inténtalo de nuevo.");
      return;
    }
    if (docs.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("course-documents")
        .remove(docs.map((d) => d.storage_path));
      if (storageError) {
        setDeleteError("No se pudieron borrar los archivos del material, así que la asignatura no se eliminó. Inténtalo de nuevo.");
        return;
      }
    }

    const { data, error: delError } = await supabase.from("subjects").delete().eq("id", subject.id).select("id");
    if (delError || !data?.length) {
      setDeleteError("No se pudo eliminar la asignatura. Inténtalo de nuevo.");
      return;
    }
    router.push("/docente");
    router.refresh();
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={openEdit} aria-haspopup="dialog">
        <Pencil aria-hidden="true" />
        Editar
      </Button>
      <Button variant="ghost" size="sm" onClick={handleDelete}>
        <Trash2 aria-hidden="true" />
        Eliminar
      </Button>
      {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}

      <dialog
        ref={dialog}
        aria-labelledby="edit-subject-title"
        // Clic fuera de la tarjeta (sobre el fondo oscurecido) cierra la ventana
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md bg-transparent p-0 backdrop:bg-foreground/40 motion-safe:open:animate-in motion-safe:open:fade-in-0 motion-safe:open:zoom-in-95 motion-safe:open:duration-(--duration-short)"
      >
        <Card>
          <CardHeader>
            <CardTitle id="edit-subject-title">Editar asignatura</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-name">Nombre de la asignatura</Label>
                <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-description">De qué trata (opcional)</Label>
                <Input id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => dialog.current?.close()}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </dialog>
    </>
  );
}
