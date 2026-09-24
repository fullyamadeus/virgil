import pdf from "pdf-parse";

export async function extractPages(buffer: Buffer, mime: "application/pdf" | "text/plain", maxPdfPages: number) {
  if (mime === "text/plain") return [{ number: null as number | null, text: buffer.toString("utf8") }];
  if (buffer.subarray(0, 5).toString() !== "%PDF-") throw new Error("This is not a readable PDF file.");
  const pages: { number: number | null; text: string }[] = [];
  const parsed = await pdf(buffer, {
    max: maxPdfPages + 1,
    pagerender: async (page: { getTextContent: () => Promise<{ items: Array<{ str?: string }> }> }) => {
      const content = await page.getTextContent();
      const text = content.items.map(item => item.str || "").join(" ");
      pages.push({ number: pages.length + 1, text });
      return text;
    },
  });
  if (parsed.numpages > maxPdfPages) throw new Error(`PDFs are limited to ${maxPdfPages} pages.`);
  if (pages.length !== parsed.numpages) throw new Error("PDF page references could not be preserved. Please upload another PDF or a text file.");
  return pages;
}
