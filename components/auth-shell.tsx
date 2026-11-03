import Link from "next/link";
import { BrandMark, BrandWord } from "@/components/brand-mark";
import { Card, CardContent } from "@/components/ui/card";

// Marco de entrar y crear cuenta: panel abeto con la marca a la izquierda y el formulario a la derecha. En el celular,
// la marca queda en una franja corta arriba y el formulario debajo. Sin el encabezado de la app (components/header-gate.tsx).
export function AuthShell({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
  footer?: React.ReactNode; // p. ej. "¿No tienes cuenta? Crea una"
}) {
  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="bg-foreground px-6 py-6 text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <Link href="/inicio" aria-label="brújula.ed, ir a la página de inicio" className="inline-flex items-center gap-2.5 rounded-control">
          <BrandMark size={40} tone="on-dark" />
          <BrandWord className="text-2xl" />
        </Link>
        <div className="mt-4 flex flex-col gap-3 lg:mt-0 lg:gap-5">
          <p className="font-heading text-2xl font-bold leading-[1.05] tracking-[-0.03em] lg:text-[clamp(3rem,5vw,4.5rem)]">
            Aprende con rumbo
          </p>
          <p className="hidden max-w-md text-lg text-primary-foreground/80 lg:block">
            Aprender también es encontrar el camino.
          </p>
        </div>
        <p className="hidden text-sm text-primary-foreground/60 lg:block">brujulaed.com</p>
      </aside>

      <main className="flex flex-1 items-start justify-center px-4 py-8 lg:items-center lg:px-8 lg:py-12">
        <div className="flex w-full max-w-md flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-6 p-6 md:p-8">
              <div className="flex flex-col gap-1.5">
                <h1 className="text-title">{title}</h1>
                {intro && <p className="text-sm text-muted-foreground">{intro}</p>}
              </div>
              {children}
            </CardContent>
          </Card>
          {footer && <p className="text-center text-sm text-muted-foreground">{footer}</p>}
        </div>
      </main>
    </div>
  );
}
