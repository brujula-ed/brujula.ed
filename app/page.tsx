import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { subject } from "@/lib/data";

export default function Home() {
  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-xl font-medium mb-1">Tus asignaturas</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Elige un tema para diagnosticar tus brechas
      </p>
      <Link href="/diagnostico">
        <Card className="hover:border-foreground/30 transition-colors cursor-pointer">
          <CardHeader>
            <CardTitle className="text-base">{subject.name}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {subject.topic}
          </CardContent>
        </Card>
      </Link>
    </main>
  );
}