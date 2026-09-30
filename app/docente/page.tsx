import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Docente() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "docente") redirect("/");

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-xl font-medium mb-1">Panel docente</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Hola {profile.full_name ?? "docente"} — aquí vas a validar contenido y ver resultados de tus estudiantes
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Programación I</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Pendiente de conectar con datos reales — por ahora este es solo el esqueleto de la pantalla.
        </CardContent>
      </Card>
    </main>
  );
}