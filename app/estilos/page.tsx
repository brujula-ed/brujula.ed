import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { StateBar } from "@/components/state-bar";
import { StateChip } from "@/components/state-chip";
import { StatTile } from "@/components/stat-tile";
import { EmptyState } from "@/components/empty-state";
import { ActionBar } from "@/components/action-bar";
import { BrandMark } from "@/components/brand-mark";

// Muestrario de la base visual (docs/PRINCIPIOS-DE-DISENO.md, secciones 3 y 4), solo en desarrollo: para revisar
// tokens y componentes mirándolos. En producción no existe. Las cifras son de ejemplo.
export default function Estilos() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 pt-8 pb-28 md:px-8 md:pb-12">
      <PageHeader
        crumbs={[{ label: "Inicio", href: "/" }, { label: "Estilos" }]}
        title="Base visual de brújula.ed"
        next="Muestrario de tokens y componentes. Las cifras son de ejemplo."
        action={<Button>Acción principal</Button>}
      />

      <Section title="Tipografía">
        <div className="flex flex-col gap-3">
          <p className="font-heading text-display">Portada · Hola, Camila</p>
          <p className="font-heading text-title">Título de página</p>
          <p className="font-heading text-section">Sección de la página</p>
          <p className="font-heading text-subsection">Subsección o título de tarjeta</p>
          <p className="font-heading text-figure">7 / 11</p>
          <p className="text-eyebrow uppercase text-primary">Etiqueta · Tu siguiente paso</p>
          <p className="text-base">Cuerpo (16 px): texto de lectura con Figtree.</p>
          <p className="text-sm text-muted-foreground">Secundario (14 px): apoyo, nunca menos.</p>
        </div>
      </Section>

      <Section title="Botones">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Principal</Button>
          <Button variant="outline">Secundario</Button>
          <Button variant="ghost">Terciario</Button>
          <Button variant="link">Enlace</Button>
          <Button variant="destructive">Borrar</Button>
          <Button disabled>Deshabilitado</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm">Compacto</Button>
          <Button size="sm" variant="outline">Compacto</Button>
          <Button size="lg">Grande</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-panel bg-primary p-6">
          <Button variant="sun">Empezar (sobre verde azulado)</Button>
          <Button variant="outline">Ver por qué</Button>
        </div>
      </Section>

      <Section title="Superficies">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Tarjeta</CardTitle>
              <CardDescription>Contenido agrupado, con sombra suave.</CardDescription>
            </CardHeader>
          </Card>
          <Card tone="featured">
            <CardHeader>
              <p className="text-eyebrow uppercase">Tu siguiente paso</p>
              <CardTitle className="text-section">Límites laterales</CardTitle>
              <CardDescription>Destacada: una por pantalla como máximo.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="sun">Empezar</Button>
            </CardContent>
          </Card>
          <Card tone="deep">
            <CardHeader>
              <CardTitle>Panel profundo</CardTitle>
              <CardDescription>Bloques de contraste y navegación.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Section>

      <Section title="Cifras clave">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatTile tone="featured" label="Por validar" value={14} context="en 3 asignaturas" />
          <StatTile label="Estudiantes con brechas" value={23} context="de 61" />
          <StatTile label="Brechas cerradas" value="7 / 11" context="en esta asignatura" />
        </div>
      </Section>

      <Section title="Estados de conocimiento">
        <div className="flex flex-wrap gap-2">
          <StateChip state="dominado" />
          <StateChip state="en_desarrollo" />
          <StateChip state="brecha" />
          <StateChip state="sin_evidencia" />
        </div>
        <div className="mt-6 max-w-xl">
          <StateBar counts={{ dominado: 34, en_desarrollo: 18, brecha: 9, sin_evidencia: 19 }} />
        </div>
      </Section>

      <Section title="Formulario">
        <div className="flex max-w-md flex-col gap-2">
          <Label htmlFor="estilos-campo">Nombre de la asignatura</Label>
          <Input id="estilos-campo" placeholder="Cálculo I" />
          <Label htmlFor="estilos-error" className="mt-3">Campo con error</Label>
          <Input id="estilos-error" aria-invalid defaultValue="algo mal escrito" />
          <p className="text-sm text-destructive">Escribe un nombre de al menos 2 letras.</p>
        </div>
      </Section>

      <Section title="Marca y estado vacío">
        <div className="mb-6 flex items-center gap-6">
          <BrandMark size={56} tone="on-light" />
          <BrandMark size={56} tone="on-light" gap={8} />
          <BrandMark size={56} tone="on-light" gap={0} />
          <p className="text-sm text-muted-foreground">Rayo separado, acercándose y unido (brecha cerrada).</p>
        </div>
        <EmptyState
          title="Todavía no hay material"
          text="Sube los apuntes, guías o presentaciones de tu asignatura y la IA propondrá sus conceptos."
          action={<Button>Subir material</Button>}
        />
      </Section>

      <Section title="Barra de acciones (fija abajo en el celular)">
        <ActionBar>
          <Button variant="ghost">Descartar</Button>
          <Button variant="outline">Editar</Button>
          <Button>Aceptar</Button>
        </ActionBar>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 text-section">{title}</h2>
      {children}
    </section>
  );
}
