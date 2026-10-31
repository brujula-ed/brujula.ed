"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateSubjectForm } from "@/components/create-subject-form";

// "Nueva asignatura" como acción principal del inicio del docente: el formulario se despliega solo cuando se pide
// (docs/PRINCIPIOS-DE-DISENO.md 2.10: no es el centro de la página).
export function NewSubjectToggle({ startOpen = false }: { startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div className="flex flex-col gap-3">
      <Button onClick={() => setOpen(!open)} aria-expanded={open} variant={open ? "outline" : "default"}>
        {!open && <Plus aria-hidden="true" />}
        {open ? "Cerrar" : "Nueva asignatura"}
      </Button>
      {open && (
        <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 motion-safe:duration-300 md:w-96">
          <CreateSubjectForm />
        </div>
      )}
    </div>
  );
}
