import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LandingPage, landingMetadata } from "@/components/landing/landing-page";

export const metadata = landingMetadata;

// Sin sesión: landing. Con sesión: directo al panel del rol (no se muestra la landing).
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return <LandingPage />;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "docente") redirect("/docente");
  redirect("/estudiante");
}
