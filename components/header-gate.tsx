"use client";

import { usePathname } from "next/navigation";

// La landing trae su propia cabecera; en esas rutas no se muestra la de la app. Entrar y crear cuenta llevan la marca
// en su panel (components/auth-shell.tsx). El diagnóstico es una pantalla de foco (docs/DISENO-DEL-ESTUDIANTE.md 2.4):
// tampoco la lleva, y tiene su propio "Salir".
const LANDING_PATHS = ["/", "/inicio", "/login", "/registro"];
const FOCUS_PREFIX = "/diagnostico/";

export function HeaderGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return LANDING_PATHS.includes(pathname) || pathname.startsWith(FOCUS_PREFIX) ? null : children;
}
