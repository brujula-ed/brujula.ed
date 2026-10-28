"use client";

import { useSyncExternalStore } from "react";

// En el servidor ambos devuelven el estado quieto, así que sin JavaScript la página se ve completa.

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false
  );
}

function subscribeScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  window.addEventListener("resize", onChange);
  return () => {
    window.removeEventListener("scroll", onChange);
    window.removeEventListener("resize", onChange);
  };
}

export function useScrolledPast(px: number) {
  return useSyncExternalStore(subscribeScroll, () => window.scrollY > px, () => false);
}

// Separación del rayo que falta según el scroll: 16 arriba, 0 al llegar al final (docs/LANDING-PARA-CODE.md, 4.2).
function readRayGap() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
  const gap = 16 * (1 - Math.min(1, progress / 0.97));
  return Math.round(gap * 100) / 100; // redondeo: evita volver a pintar por cambios invisibles
}

export function useScrollRayGap() {
  return useSyncExternalStore(subscribeScroll, readRayGap, () => 16);
}
