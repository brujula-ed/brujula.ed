export function chunkText(text: string, chunkSize = 1500, overlap = 200): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    const end = Math.min(start + chunkSize, clean.length);
    chunks.push(clean.slice(start, end));
    start += chunkSize - overlap;
  }

  return chunks.filter((c) => c.length > 50); // descarta fragmentos muy pequeños al final
}