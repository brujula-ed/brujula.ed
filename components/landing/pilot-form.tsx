"use client";

import { useActionState } from "react";
import Link from "next/link";
import { submitPilotRequest, type PilotRequestState } from "@/app/actions/pilot-request";
import type { AccountLink } from "@/components/landing/landing-header";
import { BTN_SUN, FOCUS_ON_DARK } from "@/components/landing/styles";

const FIELD = `w-full rounded-xl border-0 bg-card px-4 py-3.5 text-base font-medium text-foreground ${FOCUS_ON_DARK}`;
const LABEL = "flex flex-col gap-1.5 text-sm font-semibold";

const NOTES: Record<PilotRequestState["status"], string> = {
  idle: "",
  ok: "Gracias. Te escribimos pronto.",
  invalid: "Revisa los campos marcados.",
  error: "No pudimos enviar tu solicitud. Intenta de nuevo en unos minutos.",
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span id={id} className="text-sm font-semibold text-white">
      {message}
    </span>
  );
}

export function PilotForm({ account }: { account: AccountLink }) {
  const [state, formAction, pending] = useActionState(submitPilotRequest, { status: "idle" });
  const errors = state.errors ?? {};
  const values = state.values ?? {};

  // aria-invalid y aria-describedby solo cuando el campo tiene error.
  const a11y = (field: keyof typeof errors, errorId: string) =>
    errors[field] ? { "aria-invalid": true, "aria-describedby": errorId } : {};

  return (
    <form
      action={formAction}
      noValidate
      className="flex flex-col gap-4 rounded-[26px] bg-foreground p-6 min-[561px]:p-[34px]"
    >
      <label htmlFor="f-nombre" className={LABEL}>
        Nombre
        <input
          id="f-nombre"
          name="nombre"
          autoComplete="name"
          defaultValue={values.name}
          className={`${FIELD} min-h-[52px]`}
          {...a11y("name", "f-nombre-error")}
        />
        <FieldError id="f-nombre-error" message={errors.name} />
      </label>
      <label htmlFor="f-uni" className={LABEL}>
        Universidad y carrera
        <input
          id="f-uni"
          name="universidad"
          autoComplete="organization"
          defaultValue={values.university}
          className={`${FIELD} min-h-[52px]`}
          {...a11y("university", "f-uni-error")}
        />
        <FieldError id="f-uni-error" message={errors.university} />
      </label>
      <label htmlFor="f-correo" className={LABEL}>
        Correo
        <input
          id="f-correo"
          name="correo"
          type="email"
          autoComplete="email"
          defaultValue={values.email}
          className={`${FIELD} min-h-[52px]`}
          {...a11y("email", "f-correo-error")}
        />
        <FieldError id="f-correo-error" message={errors.email} />
      </label>
      <label htmlFor="f-msg" className={LABEL}>
        Mensaje (opcional)
        <textarea
          id="f-msg"
          name="mensaje"
          defaultValue={values.message}
          className={`${FIELD} min-h-24 resize-y`}
          {...a11y("message", "f-msg-error")}
        />
        <FieldError id="f-msg-error" message={errors.message} />
      </label>

      {/* Campo trampa contra spam: fuera de la vista, fuera del orden de tabulación y oculto a lectores de pantalla. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="f-sitio">Sitio web</label>
        <input id="f-sitio" name="sitio_web" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <button type="submit" disabled={pending} className={`${BTN_SUN} disabled:opacity-70`}>
        {pending ? "Enviando..." : "Pedir información"}
      </button>
      <p role="status" className="min-h-5 text-sm text-secondary">
        {pending ? "" : NOTES[state.status]}
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
