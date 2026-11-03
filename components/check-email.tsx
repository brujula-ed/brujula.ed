"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

// "Revisa tu correo": después de crear la cuenta (si Supabase pide confirmarla) o al entrar sin haberla confirmado.
// Reenviar usa el mismo límite de envíos de Supabase; si se pasa, se avisa sin detalles técnicos.
export function CheckEmail({ email, text }: { email: string; text: string }) {
  const supabase = createClient();
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function resend() {
    setStatus("sending");
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setStatus(error ? "error" : "sent");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-control bg-secondary/60 p-4 text-sm">
        <MailCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
        <p>
          {text} Lo enviamos a <span className="font-medium break-all">{email}</span>. Si no lo ves, revisa la carpeta
          de spam o de promociones.
        </p>
      </div>
      <Button variant="outline" onClick={resend} disabled={status === "sending" || status === "sent"}>
        {status === "sending" ? "Enviando..." : status === "sent" ? "Correo reenviado" : "Reenviar el correo"}
      </Button>
      <p role="status" className="text-xs text-muted-foreground">
        {status === "sent" && "Listo. Puede tardar un par de minutos en llegar."}
        {status === "error" && "No pudimos reenviarlo ahora. Espera unos minutos y vuelve a probar."}
      </p>
    </div>
  );
}
