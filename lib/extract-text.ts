import mammoth from "mammoth";

// Un trozo del documento con su lugar de origen, para poder citarlo ("pág. 12", "sección Límites laterales").
// page: número de página (solo PDF); section: título más cercano (solo Word con estilos de título).
export type TextBlock = { page: number | null; section: string | null; text: string };

export async function extractBlocks(buffer: Buffer, fileName: string): Promise<TextBlock[]> {
  const ext = fileName.toLowerCase().split(".").pop();

  if (ext === "pdf") {
    // El worker debe cargarse antes que pdf-parse: trae lo que necesita (DOMMatrix)
    const { CanvasFactory } = await import("pdf-parse/worker");
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer, CanvasFactory });
    try {
      const result = await parser.getText();
      const texts = removeRepeatedEdgeLines(result.pages.map((p) => p.text));
      // Un PDF no marca sus títulos: la sección queda vacía
      return result.pages.map((p, i) => ({ page: p.num, section: null, text: texts[i] }));
    } finally {
      await parser.destroy();
    }
  }

  if (ext === "docx") {
    // En HTML se conservan los títulos (si el documento usa estilos de título); el texto plano los perdería
    const { value: html } = await mammoth.convertToHtml({ buffer });
    return htmlToBlocks(html);
  }

  throw new Error("Formato no soportado. Sube un PDF con texto o un Word (.docx).");
}

// Líneas del principio y del final de cada página donde se buscan encabezados y pies. Con 2 alcanza para un
// encabezado y su número de página, y en páginas cortas (portadas, finales de capítulo) no se toca el texto del medio.
const EDGE_LINES = 2;

// Quita encabezados y pies de página: líneas al borde de la página que se repiten en al menos la mitad de las páginas
// (comparadas sin sus números, para que "Título 8" y "Título 9" cuenten como la misma). Ensuciaban la búsqueda, las
// citas y el contexto de la IA. Con menos de 3 páginas no se toca nada.
function removeRepeatedEdgeLines(pages: string[]): string[] {
  if (pages.length < 3) return pages;
  const key = (line: string) => line.replace(/\d+/g, "#").replace(/\s+/g, " ").trim().toLowerCase();
  const lines = pages.map((text) => text.split("\n"));

  // Índices de las líneas no vacías del borde de cada página
  const edges = lines.map((page) => {
    const filled = page.map((l, i) => (l.trim() ? i : -1)).filter((i) => i >= 0);
    return new Set([...filled.slice(0, EDGE_LINES), ...filled.slice(-EDGE_LINES)]);
  });

  const pagesWith = new Map<string, number>();
  lines.forEach((page, p) => {
    const keys = new Set([...edges[p]].map((i) => key(page[i])));
    keys.forEach((k) => pagesWith.set(k, (pagesWith.get(k) ?? 0) + 1));
  });
  const minPages = Math.max(3, Math.ceil(pages.length / 2));

  return lines.map((page, p) =>
    page.filter((line, i) => !(edges[p].has(i) && (pagesWith.get(key(line)) ?? 0) >= minPages)).join("\n")
  );
}

// Un bloque por sección: cada título h1–h3 abre una sección nueva y su texto encabeza el bloque.
function htmlToBlocks(html: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  let current: TextBlock = { page: null, section: null, text: "" };
  // Elementos de texto en orden; el contenido de una celda o lista se toma entero (con lo que tenga dentro)
  const element = /<(h[1-6]|p|li|td|th)\b[^>]*>([\s\S]*?)<\/\1>/g;

  for (const [, tag, inner] of html.matchAll(element)) {
    const text = decodeEntities(inner.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (/^h[1-3]$/.test(tag)) {
      if (current.text) blocks.push(current);
      current = { page: null, section: text, text };
    } else {
      current.text += (current.text ? "\n" : "") + text;
    }
  }
  if (current.text) blocks.push(current);
  return blocks;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}
