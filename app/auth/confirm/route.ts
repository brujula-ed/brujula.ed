import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Enlace de los correos de Supabase (confirmar la cuenta y recuperar la contraseña; plantillas en supabase/templates/).
// Se usa token_hash y no el código PKCE: así funciona aunque el correo se abra en otro navegador o dispositivo.
// verifyOtp abre la sesión (cookies) y se redirige a "next", solo a rutas propias.
const TYPES: EmailOtpType[] = ["signup", "email", "recovery"];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/";
  // Solo rutas internas: "/algo", nunca "//otro-sitio" ni una dirección completa
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  // Enlace vencido, ya usado o incompleto
  return NextResponse.redirect(new URL(`/login?aviso=${type === "recovery" ? "recuperacion" : "enlace"}`, origin));
}
