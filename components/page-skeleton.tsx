// Esqueleto de carga (loading.tsx): la forma de una página común (título, línea de "qué sigue" y tarjetas) mientras
// llegan los datos. Late suave; con "reducir movimiento", quieto.
export function PageSkeleton({ width = "max-w-[1120px]" }: { width?: string }) {
  const block = "rounded-card bg-muted motion-safe:animate-pulse";
  return (
    <main className={`mx-auto w-full ${width} px-4 py-6 md:px-8 md:py-8`}>
      <div role="status" className="flex flex-col gap-8">
        <span className="sr-only">Cargando…</span>
        <div aria-hidden="true" className="flex flex-col gap-3">
          <div className={`${block} h-4 w-40`} />
          <div className={`${block} h-9 w-3/4 max-w-md`} />
          <div className={`${block} h-5 w-full max-w-lg`} />
        </div>
        <div aria-hidden="true" className="grid gap-4 lg:grid-cols-2">
          <div className={`${block} h-40`} />
          <div className={`${block} h-40`} />
        </div>
        <div aria-hidden="true" className="flex flex-col gap-3">
          <div className={`${block} h-24`} />
          <div className={`${block} h-24`} />
        </div>
      </div>
    </main>
  );
}
