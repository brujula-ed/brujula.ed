"use client";

import { useState } from "react";
import Link from "next/link";
import type { AccountLink } from "@/components/landing/landing-header";
import { BTN_SUN, FOCUS_ON_DARK } from "@/components/landing/styles";

const FIELD = `w-full rounded-xl border-0 bg-card px-4 py-3.5 text-base font-medium text-foreground ${FOCUS_ON_DARK}`;
const LABEL = "flex flex-col gap-1.5 text-sm font-semibold";

// Vista previa: el envío a Supabase llega en el paso 4 (docs/LANDING-PARA-CODE.md, sección 5).
export function PilotForm({ account }: { account: AccountLink }) {
  const [note, setNote] = useState("");

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setNote("Vista previa: este formulario todavía no envía datos.");
      }}
      className="flex flex-col gap-4 rounded-[26px] bg-foreground p-6 min-[561px]:p-[34px]"
    >
      <label htmlFor="f-nombre" className={LABEL}>
        Nombre
        <input id="f-nombre" name="nombre" autoComplete="name" className={`${FIELD} min-h-[52px]`} />
      </label>
      <label htmlFor="f-uni" className={LABEL}>
        Universidad y carrera
        <input id="f-uni" name="universidad" autoComplete="organization" className={`${FIELD} min-h-[52px]`} />
      </label>
      <label htmlFor="f-correo" className={LABEL}>
        Correo
        <input id="f-correo" name="correo" type="email" autoComplete="email" className={`${FIELD} min-h-[52px]`} />
      </label>
      <label htmlFor="f-msg" className={LABEL}>
        Mensaje (opcional)
        <textarea id="f-msg" name="mensaje" className={`${FIELD} min-h-24 resize-y`} />
      </label>
      <button type="submit" className={BTN_SUN}>
        Pedir información
      </button>
      <p role="status" className="min-h-5 text-sm text-secondary">
        {note}
      </p>
      <p className="text-sm text-secondary">
        Usaremos estos datos solo para contactarte. ¿Ya tienes cuenta?{" "}
        <Link href={account.href} className={`font-semibold text-white underline underline-offset-4 ${FOCUS_ON_DARK}`}>
          {account.label}
        </Link>
      </p>
    </form>
  );
}
