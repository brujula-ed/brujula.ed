export type Question = {
  id: string;
  concept: string;
  prompt: string;
  options: string[];
  correctIndex: number;
};

export const subject = {
  name: "Programación I",
  topic: "Estructuras de control",
};

export const questions: Question[] = [
  { id: "q1", concept: "Condicionales", prompt: "¿Qué estructura ejecuta un bloque solo si una condición es verdadera?", options: ["for", "if", "while", "switch"], correctIndex: 1 },
  { id: "q2", concept: "Condicionales", prompt: "¿Qué palabra se usa para el caso contrario de un 'if'?", options: ["else", "then", "loop", "case"], correctIndex: 0 },
  { id: "q3", concept: "Bucles", prompt: "¿Qué estructura repite un bloque mientras una condición sea verdadera?", options: ["if / else", "while", "switch", "function"], correctIndex: 1 },
  { id: "q4", concept: "Bucles", prompt: "¿Qué bucle es ideal cuando ya sabes cuántas veces se repetirá?", options: ["while", "do-while", "for", "if"], correctIndex: 2 },
  { id: "q5", concept: "Funciones", prompt: "¿Qué permite reutilizar un bloque de código con un nombre?", options: ["una variable", "una función", "un array", "un comentario"], correctIndex: 1 },
  { id: "q6", concept: "Funciones", prompt: "¿Qué palabra clave devuelve un valor desde una función?", options: ["print", "return", "exit", "break"], correctIndex: 1 },
];

export const levelingContent: Record<string, string> = {
  Condicionales: "Un condicional evalúa una expresión y decide qué camino tomar. 'if' ejecuta un bloque si la condición es verdadera; 'else' cubre el caso contrario. Piensa en un semáforo: si está en verde (condición verdadera), avanzas; si no, te detienes (else).",
  Bucles: "Un bucle repite un bloque de código varias veces. Usa 'for' cuando sabes de antemano cuántas repeticiones necesitas (ej. recorrer una lista), y 'while' cuando repites hasta que se cumpla una condición, sin saber cuántas veces será de antemano.",
  Funciones: "Una función agrupa código bajo un nombre para reutilizarlo sin reescribirlo. Recibe datos de entrada (parámetros) y puede devolver un resultado con 'return', como una máquina a la que le das ingredientes y te devuelve un plato.",
};