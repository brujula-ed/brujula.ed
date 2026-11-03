import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Se llega con la sesión que abre el enlace de recuperación (app/auth/confirm). Sin sesión, el enlace no sirvió.
export default async function NuevaContrasenaLayout({ children }: LayoutProps<"/nueva-contrasena">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?aviso=recuperacion");
  return children;
}
