import Link from "next/link";
import { ClipboardCheck, FileText, Sparkle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ACTIVITY_DAYS, type Activity } from "@/lib/recent-activity";

const MAX_ITEMS = 6;
const dateFormat = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });

// "Actividad reciente" del inicio del docente: lo que pasó en sus asignaturas en los últimos días (lib/recent-activity.ts).
// Cada evento lleva a la parte de la asignatura donde se ve.
export function RecentActivity({ items }: { items: Activity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividad reciente</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nada nuevo en los últimos {ACTIVITY_DAYS} días. Aquí verás los diagnósticos completados, las brechas cerradas
            y el material que subas.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.slice(0, MAX_ITEMS).map((a, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <Icon kind={a.kind} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link href={hrefFor(a)} className="break-words hover:underline">
                    <Text activity={a} />
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {a.subject.name} · {dateFormat.format(new Date(a.at))}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {items.length > MAX_ITEMS && (
          <p className="mt-3 text-xs text-muted-foreground">
            Y {items.length - MAX_ITEMS} más en los últimos {ACTIVITY_DAYS} días.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function hrefFor(a: Activity): string {
  return a.kind === "material" ? `/docente/${a.subject.id}?paso=material` : `/docente/${a.subject.id}?vista=estudiantes`;
}

function Text({ activity: a }: { activity: Activity }) {
  if (a.kind === "diagnosticos") {
    return (
      <>
        <strong className="font-semibold">
          {a.students} {a.students === 1 ? "estudiante" : "estudiantes"}
        </strong>{" "}
        {a.students === 1 ? "completó" : "completaron"} el diagnóstico.
      </>
    );
  }
  if (a.kind === "cierre") {
    return (
      <>
        <strong className="font-semibold">{a.student}</strong>{" "}
        {a.concepts.length === 1 ? "cerró su brecha en " : `cerró ${a.concepts.length} brechas: `}
        {a.concepts.map((c, i) => (
          <span key={c}>
            {i > 0 && (i === a.concepts.length - 1 ? " y " : ", ")}
            <strong className="font-semibold">{c}</strong>
          </span>
        ))}
        .
      </>
    );
  }
  return a.files.length === 1 ? (
    <>
      Subiste <strong className="font-semibold">{a.files[0]}</strong>.
    </>
  ) : (
    <>
      Subiste <strong className="font-semibold">{a.files.length} documentos</strong>.
    </>
  );
}

function Icon({ kind }: { kind: Activity["kind"] }) {
  const Glyph = kind === "diagnosticos" ? ClipboardCheck : kind === "cierre" ? Sparkle : FileText;
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
    >
      <Glyph className="size-4" />
    </span>
  );
}
