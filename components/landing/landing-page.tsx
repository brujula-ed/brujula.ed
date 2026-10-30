import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark, BrandWord } from "@/components/brand-mark";
import { HeroMap } from "@/components/landing/hero-map";
import { LandingHeader, type AccountLink } from "@/components/landing/landing-header";
import { PilotForm } from "@/components/landing/pilot-form";
import { Reveal } from "@/components/landing/reveal";
import {
  BTN_OUTLINE,
  BTN_PRIMARY,
  CARD_LIFT,
  EYEBROW,
  FOCUS_ON_DARK,
  WRAP,
} from "@/components/landing/styles";

// Landing para universidades (docs/LANDING-PARA-CODE.md). Textos finales: no inventar cifras, testimonios ni logos.

export const landingMetadata: Metadata = {
  title: "brújula.ed · Aprende con rumbo",
  description:
    "Herramienta asistida por IA para universidades: muestra qué base le falta a cada estudiante y su siguiente paso. La IA propone; el docente valida.",
};

const PROBLEMS = [
  {
    title: "Brechas invisibles",
    text: "Un estudiante llega a un curso avanzado sin la base del anterior, y el vacío aparece recién en los exámenes.",
  },
  {
    title: "Diagnóstico a mano",
    text: "Preparar y corregir evaluaciones diagnósticas consume horas que el docente no tiene.",
  },
  {
    title: "Un solo ritmo",
    text: "El curso avanza para todos igual, aunque cada estudiante necesite repasar algo distinto.",
  },
];

const STEPS = [
  { title: "El docente sube su material", text: "Apuntes, guías o presentaciones de su asignatura." },
  { title: "La IA propone", text: "Conceptos, prerrequisitos y preguntas de diagnóstico." },
  { title: "El docente valida", text: "Corrige y aprueba. La decisión pedagógica sigue siendo suya." },
  { title: "El estudiante avanza", text: "Recibe su diagnóstico, su mapa y el siguiente paso." },
];

const COMMITMENTS = [
  {
    title: "La IA propone, el docente decide",
    text: "Nada llega a los estudiantes sin que el docente lo valide.",
  },
  {
    title: "Estados orientativos",
    text: "El mapa orienta el repaso. No son notas ni diagnósticos clínicos.",
  },
  {
    title: "Premiamos cerrar brechas",
    text: "No hay rankings ni puntos de vanidad: se reconoce lo que el estudiante recupera.",
  },
];

const SECTION = "scroll-mt-20 py-16 min-[561px]:py-24";
const H2 = "max-w-[17em] text-balance text-[clamp(32px,4.4vw,44px)] leading-[1.08] tracking-[-0.03em]";
const H3 = "text-[22px] leading-[1.2] tracking-[-0.02em]";
const CARD = "flex h-full flex-col gap-3 rounded-[22px] border border-border p-8";

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <Reveal className="mb-10 flex flex-col gap-3.5">
      <p className={`${EYEBROW} text-primary`}>{eyebrow}</p>
      <h2 className={H2}>{title}</h2>
    </Reveal>
  );
}

function CardGrid({ items, cardBg }: { items: { title: string; text: string }[]; cardBg: string }) {
  return (
    <div className="grid gap-6 min-[961px]:grid-cols-3">
      {items.map((item, i) => (
        <Reveal key={item.title} index={i}>
          <div className={`${CARD} ${CARD_LIFT} ${cardBg}`}>
            <h3 className={H3}>{item.title}</h3>
            <p className="text-base text-muted-foreground">{item.text}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

// loggedIn: solo en /inicio, donde la landing se ve también con sesión.
export function LandingPage({ loggedIn = false }: { loggedIn?: boolean }) {
  const account: AccountLink = loggedIn
    ? { href: "/", label: "Ir a mi panel" }
    : { href: "/login", label: "Iniciar sesión" };

  return (
    <>
      <LandingHeader account={account} />

      <main data-landing className="text-[17px] leading-[1.55]">
        {/* 1. Portada */}
        <div className="pt-12 pb-16 min-[561px]:pt-[72px] min-[561px]:pb-24">
          <div
            className={`${WRAP} grid items-center gap-10 min-[961px]:grid-cols-[minmax(0,1fr)_minmax(0,560px)] min-[961px]:gap-14`}
          >
            <div>
              <p className={`${EYEBROW} text-primary`}>Para universidades</p>
              <h1 className="mt-3.5 mb-[22px] text-balance text-[clamp(46px,7vw,80px)] leading-[1.02] tracking-[-0.04em]">
                Aprende
                <br />
                con rumbo
              </h1>
              <p className="max-w-[33em] text-lg text-muted-foreground min-[561px]:text-[21px]">
                Una herramienta asistida por IA que muestra qué base le falta a cada estudiante y cuál es su
                siguiente paso. La IA propone; el docente valida.
              </p>
              <div className="mt-[30px] flex flex-wrap gap-3.5">
                <a href="#contacto" className={BTN_PRIMARY}>
                  Pedir un piloto
                </a>
                <a href="#como" className={BTN_OUTLINE}>
                  Ver cómo funciona
                </a>
              </div>
            </div>
            <HeroMap />
          </div>
        </div>

        {/* 2. El problema */}
        <section className={`${SECTION} bg-card`}>
          <div className={WRAP}>
            <SectionHead eyebrow="El problema" title="Las brechas llegan al siguiente curso sin que nadie las vea" />
            <CardGrid items={PROBLEMS} cardBg="bg-background" />
          </div>
        </section>

        {/* 3. Cómo funciona: secuencia real, por eso va numerada */}
        <section id="como" className={SECTION}>
          <div className={WRAP}>
            <SectionHead eyebrow="Cómo funciona" title="Del material del docente al siguiente paso" />
            <div className="relative">
              <Reveal
                variant="line"
                className="absolute inset-x-[6%] top-[52px] hidden h-[3px] rounded-sm bg-secondary min-[961px]:block"
              />
              <ol role="list" className="relative grid gap-5 min-[561px]:grid-cols-2 min-[961px]:grid-cols-4">
                {STEPS.map((step, i) => (
                  <li key={step.title}>
                    <Reveal index={i}>
                      <div className={`${CARD} ${CARD_LIFT} bg-card`}>
                        <span className="font-heading text-[44px] font-bold leading-none text-primary">{i + 1}</span>
                        <h3 className={H3}>{step.title}</h3>
                        <p className="text-base text-muted-foreground">{step.text}</p>
                      </div>
                    </Reveal>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* 4. Para el docente / para el estudiante */}
        <section id="universidades" className="scroll-mt-20 pb-16 min-[561px]:pb-24">
          <div className={WRAP}>
            <h2 className="sr-only">Para universidades</h2>
            <div className="grid gap-6 min-[961px]:grid-cols-2">
              <Reveal className="flex flex-col gap-4 rounded-[26px] bg-foreground p-[30px] min-[561px]:p-11">
                <p className={`${EYEBROW} text-brand-ray`}>Para el docente</p>
                <h3 className="text-[32px] leading-[1.08] tracking-[-0.03em] text-white">
                  Menos tiempo diagnosticando, más tiempo enseñando
                </h3>
                <p className="leading-[1.6] text-secondary">
                  Sube lo que ya tiene, revisa lo que propone la IA y ve en un mapa dónde está cada estudiante.
                  Siempre decide el docente.
                </p>
              </Reveal>
              <Reveal index={1} className="flex flex-col gap-4 rounded-[26px] bg-primary p-[30px] text-white min-[561px]:p-11">
                <p className={EYEBROW}>Para el estudiante</p>
                <h3 className="text-[32px] leading-[1.08] tracking-[-0.03em]">Saber qué repasar antes de avanzar</h3>
                <p className="leading-[1.6]">
                  Un diagnóstico corto, un mapa claro y un siguiente paso concreto. Sin puntos ni rankings: lo que
                  cuenta es cerrar la brecha.
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* 5. Nuestros compromisos */}
        <section className={`${SECTION} bg-card`}>
          <div className={WRAP}>
            <SectionHead eyebrow="Nuestros compromisos" title="Una herramienta de apoyo, no de calificación" />
            <CardGrid items={COMMITMENTS} cardBg="bg-background" />
          </div>
        </section>

        {/* 6. Contacto */}
        <section id="contacto" className={`${SECTION} bg-primary text-white`}>
          <div
            className={`${WRAP} grid items-center gap-10 min-[961px]:grid-cols-[minmax(0,1fr)_minmax(0,520px)] min-[961px]:gap-16`}
          >
            <Reveal>
              <p className={EYEBROW}>Pedir un piloto</p>
              <h2 className="mt-4 mb-5 text-balance text-[clamp(34px,4.6vw,48px)] leading-[1.08] tracking-[-0.03em]">
                Probemos brújula.ed en una de tus asignaturas
              </h2>
              <p className="text-[19px]">
                Cuéntanos tu universidad y la asignatura. Te escribimos para coordinar un piloto y resolver tus dudas.
              </p>
            </Reveal>
            <Reveal index={1}>
              <PilotForm account={account} />
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="bg-foreground py-9 text-sm text-secondary">
        <div className={`${WRAP} flex flex-wrap items-center justify-between gap-x-6 gap-y-3.5`}>
          <a href="#top" aria-label="brújula.ed, inicio" className={`flex items-center gap-2.5 ${FOCUS_ON_DARK}`}>
            <BrandMark size={30} tone="on-dark" />
            <BrandWord className="text-[22px]" />
          </a>
          <span>Aprende con rumbo</span>
          {/* Correo y dominio provisionales */}
          <span>correo@brujulaed.com · La Paz, Bolivia · © 2026</span>
          <Link
            href={account.href}
            className={`inline-flex min-h-11 items-center font-semibold text-white underline underline-offset-4 ${FOCUS_ON_DARK}`}
          >
            {account.label}
          </Link>
        </div>
      </footer>
    </>
  );
}
