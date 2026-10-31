"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CircleAlert } from "lucide-react";
import { cn } from "cn";
import { RAYS, MISSING_RAY } from "@/components/brand-mark";

export type WorkStep = { label: string; state: "pending" | "active" | "done" | "error" };

// Ventana para trabajos largos de la IA (más de unos segundos): bloquea la página, muestra las etapas reales con su
// estado, la estrella de la marca con el rayo girando y el tiempo transcurrido. Sin porcentajes inventados: solo lo que
// se sabe (en qué etapa va). Mientras trabaja no se puede cerrar; al terminar, children trae el resultado y las acciones.
export function WorkingDialog({
  open,
  title,
  steps,
  working,
  hint,
  children,
}: {
  open: boolean;
  title: string;
  steps: WorkStep[];
  working: boolean; // true mientras corre: no se puede cerrar
  hint?: string; // p. ej. "Suele tardar 1 o 2 minutos."
  children?: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Reloj: corre solo mientras se trabaja y vuelve a cero en cada trabajo nuevo
  useEffect(() => {
    if (!working) return;
    const start = Date.now();
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => {
      clearInterval(id);
      setSeconds(0);
    };
  }, [working]);

  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <dialog
      ref={dialog}
      aria-labelledby="working-title"
      // Esc no cierra mientras se trabaja: cerrar no detendría el trabajo y el docente no vería el resultado
      onCancel={(e) => {
        if (working) e.preventDefault();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-panel bg-card p-0 shadow-raised backdrop:bg-foreground/50"
    >
      <div className="flex flex-col items-center gap-5 p-6 text-center md:p-8">
        <WorkingStar spinning={working} />
        <h2 id="working-title" className="text-section">{title}</h2>

        <ol className="flex w-full flex-col gap-2 text-left">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-3 text-sm">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full",
                  s.state === "done" && "bg-primary text-primary-foreground",
                  s.state === "active" && "border-2 border-primary",
                  s.state === "pending" && "border border-border",
                  s.state === "error" && "bg-destructive text-white"
                )}
              >
                {s.state === "done" && <Check aria-hidden="true" className="size-3.5" />}
                {s.state === "active" && <span className="size-2 rounded-full bg-primary motion-safe:animate-pulse" />}
                {s.state === "error" && <CircleAlert aria-hidden="true" className="size-3.5" />}
              </span>
              <span
                className={cn(
                  "min-w-0 break-words",
                  s.state === "pending" && "text-muted-foreground",
                  s.state === "active" && "font-semibold"
                )}
              >
                {s.label}
              </span>
              <span className="sr-only">
                {s.state === "done" ? "(hecho)" : s.state === "active" ? "(en curso)" : s.state === "error" ? "(falló)" : ""}
              </span>
            </li>
          ))}
        </ol>

        {working && (
          <p role="status" className="text-sm text-muted-foreground">
            <span className="font-mono text-foreground">{clock}</span>
            {hint && <> · {hint}</>}
            <br />
            No cierres esta pestaña.
          </p>
        )}

        {!working && children && <div className="flex w-full flex-col gap-4">{children}</div>}
      </div>
    </dialog>
  );
}

// La marca con el rayo amarillo girando alrededor de la rosa. Con "reducir movimiento" queda quieta.
function WorkingStar({ spinning }: { spinning: boolean }) {
  return (
    <svg width={72} height={72} viewBox="0 0 100 100" aria-hidden="true">
      {RAYS.map((d) => (
        <path key={d} d={d} className="fill-primary" />
      ))}
      <g
        style={{ transformOrigin: "50px 54px" }}
        className={cn(spinning && "motion-safe:animate-spin motion-safe:[animation-duration:2.4s]")}
      >
        <path d={MISSING_RAY} transform="translate(50 54) rotate(42) translate(0 -16)" className="fill-brand-ray" />
      </g>
    </svg>
  );
}
