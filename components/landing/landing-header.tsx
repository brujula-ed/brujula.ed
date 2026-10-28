import Link from "next/link";
import { BrandMark, BrandWord } from "@/components/landing/brand-mark";
import { FOCUS_ON_DARK, WRAP } from "@/components/landing/styles";

export type AccountLink = { href: string; label: string };

const NAV_LINK = `text-white/95 underline-offset-[6px] hover:text-white hover:underline ${FOCUS_ON_DARK}`;

export function LandingHeader({ account }: { account: AccountLink }) {
  return (
    <header id="top" className="sticky top-0 z-20 bg-primary/94 backdrop-blur-md">
      <div className={`${WRAP} flex items-center justify-between gap-4 py-3.5`}>
        <a href="#top" aria-label="brújula.ed, inicio" className={`flex items-center gap-2.5 ${FOCUS_ON_DARK}`}>
          <BrandMark size={36} tone="on-dark" />
          <BrandWord className="text-[22px] min-[561px]:text-[26px]" />
        </a>
        <nav
          aria-label="Principal"
          className="flex items-center gap-3.5 text-base font-semibold min-[561px]:gap-7.5"
        >
          <a href="#como" className={`hidden min-[961px]:inline ${NAV_LINK}`}>Cómo funciona</a>
          <a href="#universidades" className={`hidden min-[961px]:inline ${NAV_LINK}`}>Para universidades</a>
          <a href="#contacto" className={`hidden min-[961px]:inline ${NAV_LINK}`}>Contacto</a>
          <Link href={account.href} className={`hidden min-[561px]:inline ${NAV_LINK}`}>
            {account.label}
          </Link>
          <a
            href="#contacto"
            className={`inline-flex min-h-11 items-center rounded-[14px] bg-brand-ray px-5 font-bold leading-none text-foreground ${FOCUS_ON_DARK}`}
          >
            Pedir un piloto
          </a>
        </nav>
      </div>
    </header>
  );
}
