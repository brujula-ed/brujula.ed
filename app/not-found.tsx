import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";

// Página no encontrada: direcciones que no existen y notFound() de las páginas (una asignatura o un concepto que no
// existe o al que no tienes acceso). "/" lleva al panel según el rol, o a la landing sin sesión.
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12 md:py-16">
      <EmptyState
        title="No encontramos esta página"
        text="Puede que el enlace esté mal escrito, que ya no exista o que no tengas acceso a ella."
        action={
          <Link href="/" className={buttonVariants()}>
            Ir al inicio
          </Link>
        }
      />
    </main>
  );
}
