import { ImageResponse } from "next/og";
import { RAYS } from "@/components/brand-mark";

export const alt = "brújula.ed · Aprende con rumbo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ImageResponse no lee las variables de app/globals.css: valores copiados de los tokens.
const ABETO = "#0B2E33"; // --foreground
const MENTA = "#CDE9E6"; // --secondary
const SOL = "#FFC93C"; // --brand-ray

// Rayo que falta en su posición normal (igual que public/brand/brujula-ed_marca-sobre-verde.svg).
const MISSING_RAY = "M56.62 38.43 Q70.32 28.56 80.78 19.82 Q73.18 31.14 64.79 45.79 Z";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          background: ABETO,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <svg width="160" height="160" viewBox="0 0 100 100">
            {RAYS.map((d) => (
              <path key={d} d={d} fill="#FFFFFF" />
            ))}
            <path d={MISSING_RAY} fill={SOL} />
          </svg>
          <div style={{ display: "flex", fontSize: 120, fontWeight: 700, letterSpacing: "-0.04em" }}>
            <span style={{ color: "#FFFFFF" }}>brújula</span>
            <span style={{ color: SOL }}>.ed</span>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 44, color: MENTA }}>Aprende con rumbo</div>
      </div>
    ),
    size
  );
}
