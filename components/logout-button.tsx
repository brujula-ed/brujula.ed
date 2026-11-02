"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Va en el encabezado verde: texto blanco. En el celular, solo el ícono (el nombre queda para lectores de pantalla).
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      aria-label="Cerrar sesión"
      className="text-white hover:bg-white/10 hover:text-white"
    >
      <LogOut aria-hidden="true" />
      <span className="hidden sm:inline">Cerrar sesión</span>
    </Button>
  );
}