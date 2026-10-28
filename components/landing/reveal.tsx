"use client";

import { useEffect, useRef } from "react";

// Aparición al bajar (docs/LANDING-PARA-CODE.md, 4.3). Solo se oculta lo que está fuera de la pantalla al cargar,
// y la clase que oculta se pone desde aquí: si el observador falla o no hay JavaScript, todo queda visible.
// Las reglas .reveal y .reveal-line están en app/globals.css (bloque "Landing").
export function Reveal({
  children,
  index = 0,
  variant = "fade",
  className = "",
}: {
  children?: React.ReactNode;
  index?: number; // posición entre tarjetas vecinas: 90 ms de retraso por cada una
  variant?: "fade" | "line";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top <= window.innerHeight * 0.92) return;

    el.classList.add("is-pre");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.remove("is-pre");
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      el.classList.remove("is-pre");
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden={variant === "line" ? true : undefined}
      className={`${variant === "line" ? "reveal-line" : "reveal"} ${className}`}
      style={{ "--reveal-i": index } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
