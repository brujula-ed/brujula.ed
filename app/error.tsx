"use client"; // Las pantallas de error de Next deben ser componentes de cliente

import { useEffect } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";

// Error inesperado al cargar una página. En producción Next no manda el mensaje original al navegador (podría tener
// datos sensibles): solo un código (digest) que permite encontrar el error en los registros de Vercel.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12 md:py-16">
      <EmptyState
        title="Algo salió mal"
        text="No pudimos cargar esta página. Puede ser un problema de conexión: vuelve a intentarlo en un momento."
        action={
          <div className="flex flex-col items-center gap-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => retry()}>Reintentar</Button>
              <Link href="/" className={buttonVariants({ variant: "outline" })}>
                Ir al inicio
              </Link>
            </div>
            {error.digest && <p className="text-xs text-muted-foreground">Código del error: {error.digest}</p>}
          </div>
        }
      />
    </main>
  );
}
