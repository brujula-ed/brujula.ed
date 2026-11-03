"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth-shell";
import { PasswordInput } from "@/components/password-input";
import { MIN_PASSWORD } from "@/lib/password";

// Elegir la contraseña nueva, con la sesión que abrió el enlace de recuperación. Al guardar se cierra la sesión y se
// vuelve a entrar con la nueva: así se comprueba que la recuerda.
export default function NuevaContrasena() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordError = password.length < MIN_PASSWORD ? `Usa al menos ${MIN_PASSWORD} caracteres.` : "";
  const confirmError = !confirm ? "Repite la contraseña." : confirm !== password ? "Las contraseñas no coinciden." : "";
  const showConfirm = submitted || (confirm !== "" && confirm.length >= password.length);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setError("");
    if (passwordError || confirmError) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      setError(
        error.code === "same_password"
          ? "Es la misma contraseña que tenías. Elige una distinta."
          : "No pudimos guardar la contraseña. Vuelve a intentarlo."
      );
      return;
    }
    await supabase.auth.signOut();
    router.push("/login?aviso=contrasena");
    router.refresh();
  }

  return (
    <AuthShell title="Elige una contraseña nueva" intro="La usarás desde ahora para entrar.">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Contraseña nueva</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={submitted && passwordError ? true : undefined}
            aria-describedby="password-hint"
          />
          <p
            id="password-hint"
            className={`text-xs ${submitted && passwordError ? "text-destructive" : "text-muted-foreground"}`}
          >
            Al menos {MIN_PASSWORD} caracteres. Una frase corta es fácil de recordar y difícil de adivinar.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm">Repite la contraseña</Label>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={showConfirm && confirmError ? true : undefined}
            aria-describedby={showConfirm && confirmError ? "confirm-error" : undefined}
          />
          {showConfirm && confirmError && (
            <p id="confirm-error" className="flex items-center gap-1.5 text-xs text-destructive">
              <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
              {confirmError}
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">
          {loading ? "Guardando..." : "Guardar la contraseña"}
        </Button>
      </form>
    </AuthShell>
  );
}
