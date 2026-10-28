// Clases que se repiten en la landing. Breakpoints de docs/LANDING-PARA-CODE.md:
// una columna hasta 960 px y tarjetas apiladas hasta 560 px.

export const WRAP = "mx-auto w-full max-w-[1280px] px-6";

export const EYEBROW = "text-[13px] font-bold uppercase tracking-[0.12em]";

// Anillo de foco de 3 px: amarillo sobre fondos oscuros o verde azulado; verde azulado sobre fondos claros,
// porque el amarillo sobre niebla o blanco casi no se ve.
export const FOCUS_ON_DARK =
  "focus-visible:outline-solid focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand-ray";
export const FOCUS_ON_LIGHT =
  "focus-visible:outline-solid focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-primary";

// Elevación al pasar el mouse: 2 px en botones y 4 px en tarjetas. Sin elevación con "reducir movimiento".
export const LIFT =
  "transition-[translate,box-shadow] duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-[0_10px_22px] hover:shadow-foreground/18";
export const CARD_LIFT =
  "transition-[translate,box-shadow] duration-250 motion-safe:hover:-translate-y-1 hover:shadow-[0_18px_40px] hover:shadow-foreground/10";

export const BTN = `inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-transparent px-[26px] text-base font-bold leading-none ${LIFT}`;
export const BTN_PRIMARY = `${BTN} bg-primary text-primary-foreground ${FOCUS_ON_LIGHT}`;
export const BTN_OUTLINE = `${BTN} border-primary bg-card text-primary ${FOCUS_ON_LIGHT}`;
// Amarillo solo sobre fondos oscuros o verde azulado.
export const BTN_SUN = `${BTN} bg-brand-ray text-foreground ${FOCUS_ON_DARK}`;
