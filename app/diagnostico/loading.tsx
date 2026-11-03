import { PageSkeleton } from "@/components/page-skeleton";

// Pantalla de foco (sin el encabezado de la app): mismo ancho que el diagnóstico de un tema
export default function Loading() {
  return <PageSkeleton width="max-w-xl" />;
}
