"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, Mail, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Si el navegador tiene el menú nativo de compartir (casi todos los celulares). En el servidor no se sabe: false, y el
// botón aparece al hidratar sin aviso de hidratación.
const noop = () => () => {};
const useCanShare = () =>
  useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);

// Compartir el código de clase (paso Invitar): menú nativo, WhatsApp, correo o copiar el mensaje. El enlace lleva a
// /login, que es por donde entran los estudiantes (con o sin cuenta).
export function ShareCode({ code, subjectName }: { code: string; subjectName: string }) {
  const canShare = useCanShare();
  const [copied, setCopied] = useState<"code" | "message" | null>(null);

  const message = () =>
    `Únete a «${subjectName}» en brújula.ed: entra en ${window.location.origin}/login, crea tu cuenta de ` +
    `estudiante (o entra con la tuya) y escribe el código ${code} en «Código de clase».`;
  const subject = `Únete a ${subjectName} en brújula.ed`;

  async function copy(what: "code" | "message") {
    try {
      await navigator.clipboard.writeText(what === "code" ? code : message());
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Sin permiso para el portapapeles: el código sigue a la vista para copiarlo a mano
    }
  }

  async function share() {
    try {
      await navigator.share({ title: subject, text: message() });
    } catch {
      // Cerró el menú sin compartir: no pasa nada
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => copy("code")}
        title="Copiar el código"
        className="flex items-center gap-3 self-start rounded-control bg-muted px-4 py-2.5 transition-colors duration-(--duration-instant) hover:bg-secondary"
      >
        <span className="font-mono text-2xl font-semibold tracking-[0.15em]">{code}</span>
        {copied === "code" ? (
          <Check aria-hidden="true" className="size-4 text-primary" />
        ) : (
          <Copy aria-hidden="true" className="size-4 text-muted-foreground" />
        )}
        <span className="sr-only">{copied === "code" ? "Código copiado" : "Copiar el código"}</span>
      </button>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {canShare && (
          <Button onClick={share} className="col-span-2 sm:col-span-1">
            <Share2 aria-hidden="true" />
            Compartir
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(message())}`, "_blank", "noopener")}
        >
          <MessageCircle aria-hidden="true" />
          WhatsApp
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message())}`;
          }}
        >
          <Mail aria-hidden="true" />
          Correo
        </Button>
        <Button variant="outline" onClick={() => copy("message")} className="col-span-2 sm:col-span-1">
          {copied === "message" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied === "message" ? "Mensaje copiado" : "Copiar mensaje"}
        </Button>
      </div>
      <p role="status" className="sr-only">
        {copied === "message" ? "Mensaje copiado" : ""}
      </p>
    </div>
  );
}
