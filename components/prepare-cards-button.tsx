"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkingDialog, type WorkStep } from "@/components/working-dialog";

type Result = { ok: boolean; text: string };

// "Continuar y preparar fichas y recursos" (paso Estructura): un solo botón para la IA del paso siguiente, en dos
// llamadas seguidas (cada una con su propio tiempo límite en Vercel):
//   1. /api/generate-concept-cards: una ficha para cada concepto validado que aún no tenga;
//   2. /api/generate-resources: completa hasta 3 recursos abiertos por concepto, con los enlaces verificados.
// Las dos solo completan lo que falta, así que repetirlo no duplica. La 2 no depende de la 1: corre aunque la 1 falle.
export function PrepareCardsButton({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const [active, setActive] = useState<0 | 1 | null>(null); // etapa en curso
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);

  async function post(url: string): Promise<{ ok: boolean; data: { error?: string; notice?: string; count?: number } }> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectId }),
    });
    const data = await res.json().catch(() => ({ error: "Respuesta inesperada del servidor." }));
    return { ok: res.ok, data };
  }

  async function handleGenerate() {
    setResults([]);
    setOpen(true);

    setActive(0);
    const cards = await post("/api/generate-concept-cards");
    const cardsResult: Result = cards.ok
      ? { ok: true, text: cards.data.notice ?? `${cards.data.count} fichas nuevas.` }
      : { ok: false, text: `Fichas: ${cards.data.error ?? "no se pudieron generar."}` };
    setResults([cardsResult]);

    setActive(1);
    const resources = await post("/api/generate-resources");
    const resourcesResult: Result = resources.ok
      ? { ok: true, text: resources.data.notice ?? `${resources.data.count} recursos nuevos.` }
      : { ok: false, text: `Recursos: ${resources.data.error ?? "no se pudieron buscar."}` };
    setResults([cardsResult, resourcesResult]);

    setActive(null);
    router.refresh();
  }

  const working = active !== null;
  const stepState = (i: 0 | 1): WorkStep["state"] =>
    results[i] ? (results[i].ok ? "done" : "error") : active === i ? "active" : "pending";
  const anyOk = results.some((r) => r.ok);
  const allOk = results.length === 2 && results.every((r) => r.ok);

  return (
    <>
      <Button size="lg" onClick={handleGenerate} disabled={working}>
        <Sparkles aria-hidden="true" />
        Continuar y preparar fichas y recursos
      </Button>

      <WorkingDialog
        open={open}
        title={working ? "Preparando fichas y recursos" : allOk ? "Fichas y recursos listos para revisar" : "Terminó con avisos"}
        steps={[
          { label: "Escribiendo las fichas con tu material y el mapa", state: stepState(0) },
          { label: "Buscando recursos abiertos y verificando los enlaces", state: stepState(1) },
        ]}
        working={working}
      >
        <div role="status" className="flex flex-col gap-2 text-left text-sm">
          {results.map((r, i) => (
            <p key={i} className={r.ok ? "" : "flex items-start gap-2 text-destructive"}>
              {!r.ok && <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
              {r.text}
            </p>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {anyOk && (
            <Button
              onClick={() => {
                setOpen(false);
                router.push(`/docente/${subjectId}?paso=fichas`);
              }}
            >
              Revisar fichas y recursos
              <ArrowRight aria-hidden="true" />
            </Button>
          )}
          <Button variant={anyOk ? "ghost" : "default"} onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </div>
      </WorkingDialog>
    </>
  );
}
