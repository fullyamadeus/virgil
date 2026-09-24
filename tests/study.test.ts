import assert from "node:assert/strict";
import test from "node:test";
import { chunkText, validateGeneratedItems, type Chunk } from "../src/lib/study";
import { skopjeDateKey, skopjeLocalToUtc } from "../src/lib/time";
import { extractPages } from "../src/lib/extract";
import { readFile } from "node:fs/promises";

const chunk: Chunk = {
  id: "f7e7366d-3576-4b36-b5f3-dad76f771811",
  document_id: "764755be-c192-4c73-8ae3-dca57bd0b113",
  page_number: 3,
  content: "Binary search repeatedly halves a sorted search interval until the target is found.",
};

function item(overrides: Record<string, unknown> = {}) {
  return { prompt: "What does binary search do to the interval?", options: ["Halves it", "Doubles it", "Shuffles it", "Deletes it"], answer: "Halves it", explanation: "It halves the sorted interval each step.", citations: [{ chunk_id: chunk.id, quote: "repeatedly halves a sorted search interval" }], ...overrides };
}

test("accepts a cited question with exact source support", () => {
  const result = validateGeneratedItems({ items: [item()] }, "quiz", 1, [chunk]);
  assert.equal(result[0].answer, "Halves it");
});

test("rejects invented citations and malformed answer options", () => {
  assert.throws(() => validateGeneratedItems({ items: [item({ citations: [{ chunk_id: chunk.id, quote: "The algorithm is always optimal" }] })] }, "quiz", 1, [chunk]));
  assert.throws(() => validateGeneratedItems({ items: [item({ answer: "An unsupported option" })] }, "quiz", 1, [chunk]));
});

test("rejects a citation to material outside the selected source chunks", () => {
  const other = { ...chunk, id: "5ca88dcc-c366-4d67-97af-38c15158f284" };
  assert.throws(() => validateGeneratedItems({ items: [item({ citations: [{ chunk_id: other.id, quote: "repeatedly halves a sorted search interval" }] })] }, "quiz", 1, [chunk]));
});

test("keeps page numbers while chunking long text", () => {
  const pieces = chunkText("a".repeat(4000), 7);
  assert.equal(pieces.length, 3);
  assert.ok(pieces.every(piece => piece.page_number === 7 && piece.content.length <= 1800));
});

test("extracts actual PDF pages in their original order and enforces the page limit", async () => {
  const sample = await readFile("node_modules/pdf-parse/test/data/02-valid.pdf");
  const pages = await extractPages(sample, "application/pdf", 5);
  assert.equal(pages.length, 5);
  assert.equal(pages[0].number, 1);
  assert.equal(pages[4].number, 5);
  assert.match(pages[0].text, /solar cell structure/);
  await assert.rejects(() => extractPages(sample, "application/pdf", 4), /limited to 4 pages/);
});

test("converts winter and summer Skopje times to UTC", () => {
  assert.equal(skopjeLocalToUtc("2026-01-15", "12:30"), "2026-01-15T11:30:00.000Z");
  assert.equal(skopjeLocalToUtc("2026-07-15", "12:30"), "2026-07-15T10:30:00.000Z");
  assert.equal(skopjeDateKey("2026-07-15T22:30:00.000Z"), "2026-07-16");
});

test("rejects a nonexistent time during the spring daylight-saving change", () => {
  assert.throws(() => skopjeLocalToUtc("2026-03-29", "02:30"));
});
