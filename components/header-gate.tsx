"use client";

import { usePathname } from "next/navigation";

// La landing trae su propia cabecera; en esas rutas no se muestra la de la app.
const LANDING_PATHS = ["/", "/inicio"];

export function HeaderGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return LANDING_PATHS.includes(pathname) ? null : children;
}
