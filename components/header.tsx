import Image from "next/image";
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
    <header className="bg-primary">
      <div className="max-w-2xl mx-auto px-8 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-heading text-lg font-bold tracking-[-0.04em]">
          <Image src="/brand/brujula-ed_marca-sobre-verde.svg" alt="" width={28} height={28} />
          <span>
            <span className="text-white">brújula</span><span className="text-brand-ray">.ed</span>
          </span>
        </Link>
        <div className="flex items-center gap-4 text-sm text-white">
          {role === "docente" && (
            <Link href="/docente" className="text-white/80 hover:text-white">
              Panel docente
            </Link>
          )}
          {role === "estudiante" && (
            <Link href="/estudiante" className="text-white/80 hover:text-white">
              Mis asignaturas
            </Link>
          )}
          {user ? (
            <LogoutButton />
          ) : (
            <Link href="/login" className="text-white/80 hover:text-white">
              Iniciar sesión
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}