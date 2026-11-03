"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleAlert, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth-shell";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// "Olvidé mi contraseña": Supabase envía un enlace (plantilla supabase/templates/recuperacion.html) que pasa por
// app/auth/confirm y lleva a /nueva-contrasena. La respuesta es la misma exista o no la cuenta: no revela quién está
// registrado.
export default function Recuperar() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("Revisa el correo: debe ser como nombre@dominio.com.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    // Solo el límite de envíos se avisa aparte; cualquier otro caso responde como si se hubiera enviado
    if (error && error.status === 429) {
      setError("Demasiados intentos. Espera unos minutos y vuelve a probar.");
      return;
    }
    setSent(true);
  }

  const footer = (
    <Link href="/login" className="font-medium text-primary hover:underline">
      Volver a entrar
    </Link>
  );

  if (sent) {
    return (
      <AuthShell title="Revisa tu correo" footer={footer}>
        <div className="flex items-start gap-3 rounded-control bg-secondary/60 p-4 text-sm">
          <MailCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>
            Si hay una cuenta con <span className="font-medium break-all">{email.trim()}</span>, te enviamos un enlace
            para elegir una contraseña nueva. Vence en una hora. Si no lo ves, revisa la carpeta de spam.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Recupera tu contraseña"
      intro="Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una nueva."
      footer={footer}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
          />
        </div>
        {error && (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">
          {loading ? "Enviando..." : "Enviar el enlace"}
        </Button>
      </form>
    </AuthShell>
  );
}
