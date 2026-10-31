"use client";

import { useState } from "react";
import { cn } from "cn";

// Código de clase con un clic para copiarlo
export function CopyCodeButton({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      title="Copiar el código de clase"
      className={cn(
        "rounded-control bg-muted px-2.5 py-1 font-mono text-xs transition-colors duration-(--duration-instant) hover:bg-secondary",
        className
      )}
    >
      {copied ? "¡Copiado!" : `Código ${code}`}
    </button>
  );
}
