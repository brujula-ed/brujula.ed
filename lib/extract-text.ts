import mammoth from "mammoth";

export async function extractText(buffer: Buffer, fileName: string): Promise<string> {
  const ext = fileName.toLowerCase().split(".").pop();

  if (ext === "pdf") {
    // El worker debe cargarse antes que pdf-parse: trae lo que necesita (DOMMatrix)
    const { CanvasFactory } = await import("pdf-parse/worker");
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer, CanvasFactory });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error("Formato no soportado. Sube un PDF con texto o un Word (.docx).");
}