import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import type { NextStep } from "@/lib/next-step";

const dayFormat = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long" });

type Described = { title: string; why: string; cta: string | null; href: string | null };

// Texto y destino de cada siguiente paso (lib/next-step.ts). Lo usan Mi Brújula (tarjeta) y Mis asignaturas (una línea).
export function describeNextStep(step: NextStep, subjectId: string): Described {
  const conceptHref = (id: string) => `/estudiante/${subjectId}/concepto/${id}`;
  switch (step.kind) {
    case "final":
      return {
        title: `Comprobación final de «${step.concept.name}»`,
        why: "Ya puedes hacerla: si la superas, cierras la brecha.",
        cta: "Hacer la comprobación final",
        href: conceptHref(step.concept.id),
      };
    case "comprobar":
      return {
        title: `Comprueba «${step.concept.name}»`,
        why: "Ya lo practicaste. Compruébalo para salir de la brecha.",
        cta: "Comprobar ahora",
        href: conceptHref(step.concept.id),
      };
    case "brecha":
      return {
        title: `Cierra la brecha de «${step.concept.name}»`,
        why:
          step.blocked > 0
            ? `Bloquea ${step.blocked === 1 ? "1 concepto que viene" : `${step.blocked} conceptos que vienen`} después.`
            : "Es la brecha que conviene atender primero.",
        cta: "Empieza el repaso",
        href: conceptHref(step.concept.id),
      };
    case "confirmar":
      return {
        title: `Confirma «${step.concept.name}»`,
        why: "Vas bien, pero con poca evidencia: unas preguntas más lo confirman.",
        cta: "Ponte a prueba",
        href: conceptHref(step.concept.id),
      };
    case "tema":
      return {
        title: `Ponte a prueba en «${step.topic.name}»`,
        why: "Aún no sabemos cuánto dominas este tema. Son entre 5 y 10 preguntas.",
        cta: "Ponme a prueba",
        href: `/diagnostico/${subjectId}/tema/${step.topic.id}`,
      };
    case "nuevo":
      return {
        title: `Empieza con «${step.concept.name}»`,
        why: "Aún no respondiste preguntas de este concepto.",
        cta: "Ponte a prueba",
        href: conceptHref(step.concept.id),
      };
    case "esperar":
      return {
        title: `Vuelve el ${dayFormat.format(step.from)} para la comprobación final de «${step.concept.name}»`,
        why: "Recordarlo días después demuestra que lo aprendiste. Mientras, repasa lo que quieras.",
        cta: "Ir al concepto",
        href: conceptHref(step.concept.id),
      };
    case "repasar":
      return {
        title: `Repasa «${step.concept.name}»`,
        why: "Estás al día. Es lo que llevas más tiempo sin comprobar.",
        cta: "Repasar",
        href: conceptHref(step.concept.id),
      };
    case "sin_preguntas":
      return {
        title: "Aún no hay preguntas",
        why: "Tu docente todavía no publicó preguntas para esta asignatura. Mientras, puedes explorar tus temas.",
        cta: null,
        href: null,
      };
  }
}

// "Tu siguiente paso" (docs/DISENO-DEL-ESTUDIANTE.md 2.2): la única acción destacada de Mi Brújula. Verde azulado con
// el botón en amarillo (regla del amarillo, docs/PRINCIPIOS-DE-DISENO.md 9).
export function NextStepCard({ step, subjectId }: { step: NextStep; subjectId: string }) {
  const { title, why, cta, href } = describeNextStep(step, subjectId);
  return (
    <Card tone="featured">
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm font-medium text-primary-foreground/85">Tu siguiente paso</p>
        <h2 className="text-section break-words">{title}</h2>
        <p className="text-sm text-primary-foreground/85">{why}</p>
        {cta && href && (
          <Link href={href} className={`${buttonVariants({ variant: "sun", size: "lg" })} w-full sm:w-auto sm:self-start`}>
            {cta}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
