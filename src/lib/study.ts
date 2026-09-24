import { z } from "zod";

export const generationInput = z.object({
  enrollmentId: z.uuid(),
  documentIds: z.array(z.uuid()).min(1).max(8),
  kind: z.enum(["quiz", "flashcards"]),
  count: z.number().int().min(3).max(15),
  difficulty: z.enum(["easy", "medium", "hard"]),
  language: z.enum(["en", "mk"]),
  topic: z.string().trim().max(160).default(""),
  requestKey: z.uuid(),
});

export const generatedItem = z.object({
  prompt: z.string().trim().min(8).max(1200),
  options: z.array(z.string().trim().min(1).max(400)).max(4),
  answer: z.string().trim().min(1).max(800),
  explanation: z.string().trim().min(1).max(1600),
  citations: z.array(z.object({
    chunk_id: z.uuid(),
    quote: z.string().trim().min(12).max(450),
  })).min(1).max(3),
});

export type Chunk = { id: string; document_id: string; page_number: number | null; content: string };

export function validateGeneratedItems(value: unknown, kind: "quiz" | "flashcards", count: number, chunks: Chunk[]) {
  const parsed = z.object({ items: z.array(generatedItem).length(count) }).parse(value);
  const chunkMap = new Map(chunks.map(chunk => [chunk.id, chunk]));
  for (const item of parsed.items) {
    if (kind === "quiz") {
      if (item.options.length !== 4 || new Set(item.options).size !== 4 || !item.options.includes(item.answer)) {
        throw new Error("The model returned invalid answer options.");
      }
    } else if (item.options.length !== 0) {
      throw new Error("Flashcards must not include answer options.");
    }
    for (const citation of item.citations) {
      const chunk = chunkMap.get(citation.chunk_id);
      if (!chunk || !chunk.content.includes(citation.quote)) {
        throw new Error("The model returned an unsupported source quote.");
      }
    }
  }
  return parsed.items;
}

export function chunkText(text: string, pageNumber: number | null, maxChars = 1800) {
  const clean = text.replace(/\s+/g, " ").trim();
  const pieces: { page_number: number | null; content: string }[] = [];
  for (let at = 0; at < clean.length; at += maxChars) {
    pieces.push({ page_number: pageNumber, content: clean.slice(at, at + maxChars) });
  }
  return pieces;
}
