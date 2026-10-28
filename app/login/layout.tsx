import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Con sesión activa no tiene sentido ver el login: "/" manda al panel del rol.
export default async function LoginLayout({ children }: LayoutProps<"/login">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect("/");

  return children;
}
