import { jsPDF } from "jspdf";

const FONT_URL =
  "https://cdn.jsdelivr.net/gh/googlefonts/roboto-2@main/src/hinted/Roboto-Regular.ttf";

let fontBase64: string | null = null;

async function loadFont(): Promise<string | null> {
  if (fontBase64) return fontBase64;
  try {
    const res = await fetch(FONT_URL);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    fontBase64 = btoa(binary);
    return fontBase64;
  } catch {
    return null;
  }
}

export async function downloadAnalysisPdf(analysis: string, criteria: string[], source: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const font = await loadFont();
  if (font) {
    doc.addFileToVFS("Roboto-Regular.ttf", font);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.setFont("Roboto", "normal");
  }

  const margin = 48;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = margin;

  const write = (text: string, size: number, gap = 6) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, width) as string[];
    for (const line of lines) {
      if (y > pageHeight - margin) {
        doc.addPage();
        if (font) doc.setFont("Roboto", "normal");
        y = margin;
      }
      doc.text(line, margin, y);
      y += size * 1.4;
    }
    y += gap;
  };

  write("Анализ звонка", 20, 10);
  write(`Источник: ${source}`, 10, 2);
  write(`Критерии: ${criteria.join(", ") || "—"}`, 10, 14);
  write(analysis, 11);

  doc.save("analiz-zvonka.pdf");
}
