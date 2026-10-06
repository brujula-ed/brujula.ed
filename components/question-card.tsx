"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type Question = {
  id: string;
  prompt: string;
  options: string[];
  correct_index: number;
  status: string;
  conceptName: string;
};

export function QuestionCard({ question }: { question: Question }) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(question.prompt);
  const [options, setOptions] = useState(question.options);
  const [correctIndex, setCorrectIndex] = useState(question.correct_index);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    await supabase
      .from("questions")
      .update({ prompt, options, correct_index: correctIndex })
      .eq("id", question.id);
    setLoading(false);
    setEditing(false);
    router.refresh();
  }

  async function handleValidate() {
    setLoading(true);
    await supabase.from("questions").update({ status: "validado" }).eq("id", question.id);
    setLoading(false);
    router.refresh();
  }

  async function handleDiscard() {
    if (!confirm("¿Descartar esta pregunta sugerida?")) return;
    await supabase.from("questions").delete().eq("id", question.id);
    router.refresh();
  }

  if (editing) {
    return (
      <Card>
        <CardContent className="pt-6 flex flex-col gap-3">
          <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Pregunta" />
          <p className="text-xs text-muted-foreground -mb-1">Marca cuál opción es la correcta:</p>
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name={`correct-${question.id}`}
                checked={correctIndex === i}
                onChange={() => setCorrectIndex(i)}
                className="shrink-0"
              />
              <Input
                value={opt}
                onChange={(e) => {
                  const next = [...options];
                  next[i] = e.target.value;
                  setOptions(next);
                }}
                placeholder={`Opción ${i + 1}`}
              />
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={loading}>Guardar</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs text-muted-foreground">{question.conceptName}</p>
          <span
            className={`text-xs px-2 py-1 rounded shrink-0 ${
              question.status === "validado" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {question.status === "validado" ? "Validada" : "Sugerida por IA"}
          </span>
        </div>
        <p className="text-sm font-medium mb-2">{question.prompt}</p>
        <ul className="text-sm text-muted-foreground mb-3 list-disc list-inside">
          {question.options.map((opt, i) => (
            <li key={i} className={i === question.correct_index ? "text-green-700 font-medium" : ""}>
              {opt}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          {question.status === "sugerido" && (
            <Button size="sm" onClick={handleValidate} disabled={loading}>Validar</Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Editar</Button>
          <Button size="sm" variant="ghost" onClick={handleDiscard}>Descartar</Button>
        </div>
      </CardContent>
    </Card>
  );
}