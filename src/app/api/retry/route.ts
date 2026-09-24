import { NextResponse } from "next/server";
import { z } from "zod";
import { userClient } from "@/lib/supabase";
import { extractPages } from "@/lib/extract";
import { chunkText } from "@/lib/study";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await userClient(request);
  if (!auth) return NextResponse.json({ error: "Sign in to retry extraction." }, { status: 401 });
  const input = z.object({ documentId: z.uuid() }).safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Choose a valid document." }, { status: 400 });
  const { client } = auth;
  const { data: doc } = await client.from("documents").select("*").eq("id", input.data.documentId).eq("status", "failed").maybeSingle();
  if (!doc) return NextResponse.json({ error: "Failed document not found." }, { status: 404 });
  await client.from("documents").update({ status: "processing", error_message: null }).eq("id", doc.id);
  try {
    const downloaded = await client.storage.from("study-materials").download(doc.storage_path);
    if (downloaded.error || !downloaded.data) throw new Error(downloaded.error?.message || "Could not read the stored file.");
    const pages = await extractPages(Buffer.from(await downloaded.data.arrayBuffer()), doc.mime_type, Number(process.env.MAX_PDF_PAGES || 50));
    const chunks = pages.flatMap(page => chunkText(page.text, page.number));
    if (chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) < 120) throw new Error("This file has too little extractable text. Scanned PDFs are not supported yet.");
    const removed = await client.from("source_chunks").delete().eq("document_id", doc.id);
    if (removed.error) throw removed.error;
    const saved = await client.from("source_chunks").insert(chunks.map((chunk, index) => ({ ...chunk, chunk_index: index, document_id: doc.id, enrollment_id: doc.enrollment_id, user_id: doc.user_id })));
    if (saved.error) throw saved.error;
    const updated = await client.from("documents").update({ status: "ready", page_count: doc.mime_type === "application/pdf" ? pages.length : null }).eq("id", doc.id);
    if (updated.error) throw updated.error;
    return NextResponse.json({ id: doc.id, status: "ready" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed.";
    await client.from("documents").update({ status: "failed", error_message: message.slice(0, 300) }).eq("id", doc.id);
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
