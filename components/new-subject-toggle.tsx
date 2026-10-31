"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateSubjectForm } from "@/components/create-subject-form";

// "Nueva asignatura" como acción principal del inicio del docente: el formulario se abre en una ventana encima de la
// página, sin moverla (docs/PRINCIPIOS-DE-DISENO.md 2.10: no es el centro de la página). <dialog> nativo: Esc cierra
// y el foco queda dentro mientras está abierta.
export function NewSubjectToggle() {
  const dialog = useRef<HTMLDialogElement>(null);
  // El formulario se monta solo con la ventana abierta, así cada vez empieza vacío
  const [open, setOpen] = useState(false);

  function show() {
    setOpen(true);
    dialog.current?.showModal();
  }

  function close() {
    dialog.current?.close();
  }

  return (
    <>
      <Button onClick={show} aria-haspopup="dialog">
        <Plus aria-hidden="true" />
        Nueva asignatura
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby="new-subject-title"
        onClose={() => setOpen(false)}
        // Clic fuera de la tarjeta (sobre el fondo oscurecido) cierra la ventana
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md bg-transparent p-0 backdrop:bg-foreground/40 motion-safe:open:animate-in motion-safe:open:fade-in-0 motion-safe:open:zoom-in-95 motion-safe:open:duration-(--duration-short)"
      >
        {open && <CreateSubjectForm onCreated={close} onCancel={close} />}
      </dialog>
    </>
  );
}
