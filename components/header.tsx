import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";

export async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    role = profile?.role ?? null;
  }

  return (
    <header className="border-b">
      <div className="max-w-2xl mx-auto px-8 py-4 flex items-center justify-between">
        <Link href="/" className="text-sm font-medium tracking-tight">
          BRÚJULA.ED
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {role === "docente" && (
            <Link href="/docente" className="text-muted-foreground hover:text-foreground">
              Panel docente
            </Link>
          )}
          {user ? (
            <LogoutButton />
          ) : (
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              Iniciar sesión
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}