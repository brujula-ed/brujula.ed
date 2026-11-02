"use client";

import { useState } from "react";
import { Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// "Ver como mapa" en Mi Brújula: el mapa de conocimiento se monta solo al abrirlo. React Flow necesita medir su
// contenedor para encuadrar, y dentro de un <details> cerrado mediría cero.
export function MapDisclosure({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <Button variant="ghost" className="self-start" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <MapIcon aria-hidden="true" />
        {open ? "Ocultar el mapa" : "Ver como mapa"}
      </Button>
      {open && children}
    </div>
  );
}
