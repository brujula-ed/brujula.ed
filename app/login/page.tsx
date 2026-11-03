"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth-shell";
import { PasswordInput } from "@/components/password-input";
import { CheckEmail } from "@/components/check-email";

// Avisos que llegan en la dirección (?aviso=), desde app/auth/confirm/route.ts y la pantalla de nueva contraseña
const NOTICES: Record<string, { text: string; error: boolean }> = {
  enlace: { text: "El enlace venció o ya se usó. Entra con tu cuenta o pide que te reenviemos el correo.", error: true },
  recuperacion: { text: "El enlace para cambiar la contraseña venció o ya se usó. Pide uno nuevo.", error: true },
  contrasena: { text: "Listo: cambiaste tu contraseña. Ya puedes entrar con ella.", error: false },
};

export default function Login({ searchParams }: PageProps<"/login">) {
  const { aviso } = use(searchParams);
  const notice = typeof aviso === "string" ? NOTICES[aviso] : undefined;
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Escribe tu correo y tu contraseña.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      if (error.code === "email_not_confirmed") setUnconfirmed(true);
      else setError("Correo o contraseña incorrectos.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (unconfirmed) {
    return (
      <AuthShell title="Confirma tu correo" intro="Tu cuenta existe, pero falta confirmarla.">
        <CheckEmail email={email.trim()} text="Para entrar, abre el enlace que te enviamos al crear la cuenta." />
        <Button variant="ghost" onClick={() => setUnconfirmed(false)}>
          Volver
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Entrar"
      intro="Con el correo y la contraseña de tu cuenta."
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-medium text-primary hover:underline">
            Crea una
          </Link>
        </>
      }
    >
      {notice && (
        <p
          role={notice.error ? "alert" : "status"}
          className={`rounded-control p-3 text-sm ${notice.error ? "bg-destructive/10 text-destructive" : "bg-secondary/60"}`}
        >
          {notice.text}
        </p>
      )}
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
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="password">Contraseña</Label>
            <Link href="/recuperar" className="text-sm text-primary hover:underline">
              ¿La olvidaste?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </AuthShell>
  );
}
