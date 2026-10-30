import type { TextBlock } from "@/lib/extract-text";

// Fragmento listo para guardar en document_chunks, con su lugar en el documento (para citarlo).
export type Chunk = {
  content: string;
  pageStart: number | null;
  pageEnd: number | null;
  section: string | null;
  position: number; // 0, 1, 2… en el orden del documento
};

const TARGET = 1200; // caracteres por fragmento, aproximado
const OVERLAP = 200; // contexto que se arrastra del fragmento anterior (oraciones enteras)
const MIN_LENGTH = 50; // se descartan los fragmentos muy pequeños

// Arma fragmentos oración por oración, sin cortar oraciones (salvo las que solas superan TARGET). Un fragmento puede
// cruzar páginas; una sección nueva (título de Word) empieza siempre un fragmento nuevo, sin arrastre.
export function chunkBlocks(blocks: TextBlock[]): Chunk[] {
  const chunks: Chunk[] = [];
  let parts: { text: string; page: number | null }[] = [];
  let length = 0;
  let fresh = false; // hay texto nuevo además del arrastre
  let section: string | null = null;

  function flush(keepOverlap: boolean) {
    if (fresh) {
      const content = parts.map((p) => p.text).join(" ");
      if (content.length >= MIN_LENGTH) {
        chunks.push({
          content,
          pageStart: parts[0].page,
          pageEnd: parts[parts.length - 1].page,
          section,
          position: chunks.length,
        });
      }
    }
    // Arrastre: las últimas oraciones que quepan en OVERLAP
    const kept: typeof parts = [];
    let keptLength = 0;
    if (keepOverlap) {
      for (let i = parts.length - 1; i >= 0; i--) {
        if (keptLength + parts[i].text.length + 1 > OVERLAP) break;
        kept.unshift(parts[i]);
        keptLength += parts[i].text.length + 1;
      }
    }
    parts = kept;
    length = keptLength;
    fresh = false;
  }

  for (const block of blocks) {
    if (block.section !== section) {
      flush(false);
      section = block.section;
    }
    for (const sentence of splitSentences(block.text)) {
      for (const piece of splitLong(sentence)) {
        if (fresh && length + piece.length + 1 > TARGET) flush(true);
        parts.push({ text: piece, page: block.page });
        length += piece.length + 1;
        fresh = true;
      }
    }
  }
  flush(false);
  return chunks;
}

function splitSentences(text: string): string[] {
  const clean = text
    .replace(/-\n(?=\p{Ll})/gu, "") // palabra cortada con guion al final de una línea del PDF
    .replace(/\s+/g, " ")
    .trim();
  return clean ? clean.split(/(?<=[.!?…])\s+/) : [];
}

// Una "oración" sin puntuación (listas, tablas, fórmulas) puede ser enorme: se corta en un espacio cerca de TARGET
function splitLong(sentence: string): string[] {
  const pieces: string[] = [];
  let rest = sentence;
  while (rest.length > TARGET) {
    const cut = rest.lastIndexOf(" ", TARGET);
    const at = cut > TARGET / 2 ? cut : TARGET;
    pieces.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) pieces.push(rest);
  return pieces;
}
