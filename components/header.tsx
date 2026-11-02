import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";
import { BrandMark, BrandWord } from "@/components/brand-mark";

const NAV_LINK = "whitespace-nowrap rounded-sm text-white/80 hover:text-white";

// Encabezado de la app (en la landing no se muestra: components/header-gate.tsx). Mismo ancho que las páginas
// (1280 px) y la misma marca que la cabecera de la landing. En el celular "Cerrar sesión" queda solo como ícono para que
// nada se encime.
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
      <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Link href="/" aria-label="brújula.ed, inicio" className="flex shrink-0 items-center gap-2.5 rounded-sm">
          <BrandMark size={36} tone="on-dark" />
          <BrandWord className="text-[20px] sm:text-[24px]" />
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-2 text-sm font-medium sm:gap-4">
          {role === "docente" && (
            <Link href="/docente" className={NAV_LINK}>
              Mis asignaturas
            </Link>
          )}
          {role === "estudiante" && (
            <Link href="/estudiante" className={NAV_LINK}>
              Mis asignaturas
            </Link>
          )}
          {user ? (
            <LogoutButton />
          ) : (
            <Link href="/login" className={NAV_LINK}>
              Iniciar sesión
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
