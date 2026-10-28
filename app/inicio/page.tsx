import { createClient } from "@/lib/supabase/server";
import { LandingPage, landingMetadata } from "@/components/landing/landing-page";

export const metadata = landingMetadata;

// Muestra siempre la landing, también con sesión (para enseñársela a un colega).
export default async function Inicio() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return <LandingPage loggedIn={!!user} />;
}
