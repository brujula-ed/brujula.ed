import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { PriorityGap, NextChallenge } from "@/lib/knowledge-graph";

export function NextSteps({
  subjectId,
  gap,
  challenge,
  challengeHasQuestions,
}: {
  subjectId: string;
  gap: PriorityGap | null;
  challenge: NextChallenge;
  challengeHasQuestions: boolean;
}) {
  const focusHref = (name: string) =>
    `/diagnostico/${subjectId}?concepto=${encodeURIComponent(name)}`;

  let text = "";
  let href: string | null = null;
  let cta = "";

  switch (challenge.kind) {
    case "ubicarse":
      text = "Empieza con el diagnóstico completo para ubicar dónde estás.";
      href = `/diagnostico/${subjectId}`;
      cta = "Hacer diagnóstico";
      break;
    case "nivelar":
      text = `Repasa «${challenge.concept.name}» y comprueba si ya lo dominas.`;
      href = focusHref(challenge.concept.name);
      cta = "Practicar este concepto";
      break;
    case "consolidar":
      text = `«${challenge.concept.name}» va mejorando. Practícalo otra vez para consolidarlo.`;
      href = focusHref(challenge.concept.name);
      cta = "Practicar de nuevo";
      break;
    case "diagnosticar":
      text = `Aún no hay evidencia sobre «${challenge.concept.name}». Es un buen siguiente paso.`;
      href = focusHref(challenge.concept.name);
      cta = "Empezar";
      break;
    case "completo":
      text = "Dominas todos los conceptos con evidencia. Buen trabajo.";
      break;
  }

  const canPractice = href !== null && challengeHasQuestions;
  const blockedNames = gap ? gap.blocked.slice(0, 4).map((c) => c.name) : [];
  const moreBlocked = gap ? gap.blocked.length - blockedNames.length : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 mb-8">
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground mb-2">Tu brecha prioritaria</p>
          {gap ? (
            <>
              <p className="text-sm font-medium mb-1">{gap.concept.name}</p>
              <p className="text-sm text-muted-foreground">
                {gap.blocked.length > 0
                  ? `Está bloqueando ${gap.blocked.length} concepto(s) que aún no dominas: ${blockedNames.join(", ")}${moreBlocked > 0 ? ` y ${moreBlocked} más` : ""}.`
                  : "Ningún otro concepto depende de él, pero conviene cerrarlo."}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No hay brechas detectadas por ahora.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground mb-2">Tu próximo desafío</p>
          <p className="text-sm mb-3">{text}</p>
          {canPractice && href && (
            <Link
              href={href}
              className="inline-block rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium"
            >
              {cta}
            </Link>
          )}
          {href && !challengeHasQuestions && (
            <p className="text-xs text-muted-foreground">
              Tu docente aún no publicó preguntas para este concepto.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}