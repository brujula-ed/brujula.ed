"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { cn } from "cn";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth-shell";
import { PasswordInput } from "@/components/password-input";
import { CheckEmail } from "@/components/check-email";
import { MIN_PASSWORD } from "@/lib/password";

type Role = "estudiante" | "docente";
type Field = "fullName" | "email" | "password" | "confirm";

// Forma de un correo: algo@dominio.algo, sin espacios. Que el correo exista se comprobará al confirmar la cuenta.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const ROLES: { value: Role; label: string }[] = [
  { value: "estudiante", label: "Estudiante" },
  { value: "docente", label: "Docente" },
];

function validate(values: { fullName: string; email: string; password: string; confirm: string }) {
  const errors: Partial<Record<Field, string>> = {};
  if (!values.fullName.trim()) errors.fullName = "Escribe tu nombre.";
  if (!values.email.trim()) errors.email = "Escribe tu correo.";
  else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = "Revisa el correo: debe ser como nombre@dominio.com.";
  if (values.password.length < MIN_PASSWORD) errors.password = `Usa al menos ${MIN_PASSWORD} caracteres.`;
  if (!values.confirm) errors.confirm = "Repite la contraseña.";
  else if (values.confirm !== values.password) errors.confirm = "Las contraseñas no coinciden.";
  return errors;
}

// Mensajes de Supabase en español; lo desconocido, con un mensaje general (no se muestra el texto técnico)
function signUpError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already exists")) return "Ya hay una cuenta con este correo. Entra con ella.";
  if (m.includes("password")) return `La contraseña no es válida: usa al menos ${MIN_PASSWORD} caracteres.`;
  if (m.includes("email")) return "Revisa el correo: no parece válido.";
  if (m.includes("rate limit") || m.includes("too many")) return "Demasiados intentos. Espera unos minutos y vuelve a probar.";
  return "No pudimos crear la cuenta. Revisa tu conexión y vuelve a intentarlo.";
}

export default function Registro() {
  const router = useRouter();
  const supabase = createClient();
  const [values, setValues] = useState({ fullName: "", email: "", password: "", confirm: "" });
  const [role, setRole] = useState<Role>("estudiante");
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null); // correo al que se envió la confirmación

  const errors = validate(values);
  // Un error se muestra al salir del campo o al intentar enviar; la confirmación avisa en vivo si ya escribió algo
  const shown = (f: Field) =>
    (submitted || touched[f] || (f === "confirm" && values.confirm.length >= values.password.length && values.confirm !== ""))
      ? errors[f]
      : undefined;

  const set = (f: Field) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [f]: e.target.value }));
  const blur = (f: Field) => () => setTouched((t) => ({ ...t, [f]: true }));
  const field = (f: Field) => ({
    id: f,
    value: values[f],
    onChange: set(f),
    onBlur: blur(f),
    "aria-invalid": shown(f) ? true : undefined,
    "aria-describedby": shown(f) ? `${f}-error` : f === "password" ? "password-hint" : undefined,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setError("");
    if (Object.keys(errors).length > 0) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: values.email.trim(),
      password: values.password,
      options: { data: { full_name: values.fullName.trim(), role } },
    });
    setLoading(false);
    if (error) {
      setError(signUpError(error.message));
      return;
    }
    // Con "Confirm email" activo no hay sesión hasta abrir el enlace del correo. Si el correo ya tenía cuenta, Supabase
    // responde igual (para no revelar quién está registrado): también se muestra "Revisa tu correo".
    if (!data.session) {
      setSentTo(values.email.trim());
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (sentTo) {
    return (
      <AuthShell title="Revisa tu correo" intro="Falta un paso para usar tu cuenta.">
        <CheckEmail email={sentTo} text="Te enviamos un enlace para confirmar tu cuenta." />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Crea tu cuenta"
      intro="Te toma un minuto."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Entra
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Soy</legend>
          <div role="radiogroup" aria-label="Soy" className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={role === r.value}
                onClick={() => setRole(r.value)}
                className={cn(
                  "min-h-11 rounded-control border px-3 text-base font-medium transition-colors duration-(--duration-instant)",
                  role === r.value
                    ? "border-primary bg-secondary/60 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/60"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input {...field("fullName")} autoComplete="name" />
          <FieldError id="fullName-error" text={shown("fullName")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input {...field("email")} type="email" autoComplete="email" inputMode="email" />
          <FieldError id="email-error" text={shown("email")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <PasswordInput {...field("password")} autoComplete="new-password" />
          {shown("password") ? (
            <FieldError id="password-error" text={shown("password")} />
          ) : (
            <p id="password-hint" className="text-xs text-muted-foreground">
              Al menos {MIN_PASSWORD} caracteres. Una frase corta es fácil de recordar y difícil de adivinar.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm">Repite la contraseña</Label>
          <PasswordInput {...field("confirm")} autoComplete="new-password" />
          <FieldError id="confirm-error" text={shown("confirm")} />
        </div>

        {error && (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
      </form>
    </AuthShell>
  );
}

function FieldError({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return (
    <p id={id} className="flex items-center gap-1.5 text-xs text-destructive">
      <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
      {text}
    </p>
  );
}
