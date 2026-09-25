import { NextResponse } from "next/server";
import { z } from "zod";
import { userClient } from "@/lib/supabase";
import { chunkText } from "@/lib/study";
import { extractPages } from "@/lib/extract";
import { materialStoragePath } from "@/lib/material-upload";

export const runtime = "nodejs";

const uploadInput = z.object({
  id: z.uuid(),
  enrollmentId: z.uuid(),
  folderId: z.uuid().nullable(),
  filename: z.string().min(1).max(200),
  displayName: z.string().trim().min(1).max(200),
  materialKind: z.enum(["past_exam", "single_question", "study_guide", "other", "lecture"]),
  examDate: z.iso.date().nullable(),
}).refine(input => (input.materialKind === "past_exam") === Boolean(input.examDate));

export async function POST(request: Request) {
  const auth = await userClient(request);
  if (!auth) return NextResponse.json({ error: "Sign in to upload." }, { status: 401 });
  const parsed = uploadInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a valid course, material name, category, exam date, and file." }, { status: 400 });
  }
  const input = parsed.data;
  const { client, user } = auth;
  const { data: enrollment } = await client.from("enrollments").select("id").eq("id", input.enrollmentId).eq("user_id", user.id).single();
  if (!enrollment) return NextResponse.json({ error: "Course workspace not found." }, { status: 404 });
  if (input.folderId) {
    const { data: folder } = await client.from("folders").select("id").eq("id", input.folderId).eq("enrollment_id", input.enrollmentId).single();
    if (!folder) return NextResponse.json({ error: "Folder not found in this course." }, { status: 404 });
  }
  const isPdf = input.filename.toLowerCase().endsWith(".pdf");
  const isText = input.filename.toLowerCase().endsWith(".txt");
  if (!isPdf && !isText) return NextResponse.json({ error: "Upload a PDF or TXT file." }, { status: 400 });
  const path = materialStoragePath(user.id, input.enrollmentId, input.id, input.filename);
  const downloaded = await client.storage.from("study-materials").download(path);
  if (downloaded.error || !downloaded.data) return NextResponse.json({ error: "Uploaded file not found." }, { status: 404 });
  const buffer = Buffer.from(await downloaded.data.arrayBuffer());
  const maxBytes = Number(process.env.MAX_UPLOAD_MB || 12) * 1024 * 1024;
  if (!buffer.length || buffer.length > maxBytes) return NextResponse.json({ error: `Upload a PDF or TXT file up to ${process.env.MAX_UPLOAD_MB || 12} MB.` }, { status: 400 });
  if (isPdf && buffer.subarray(0, 5).toString() !== "%PDF-") {
    return NextResponse.json({ error: "This is not a readable PDF file." }, { status: 400 });
  }
  const mime = isPdf ? "application/pdf" : "text/plain";
  const inserted = await client.from("documents").insert({
    id: input.id, user_id: user.id, enrollment_id: input.enrollmentId,
    folder_id: input.folderId,
    filename: input.filename, storage_path: path, mime_type: mime, byte_size: buffer.length,
    display_name: input.displayName, material_kind: input.materialKind, exam_date: input.examDate,
  }).select("id").single();
  if (inserted.error) return NextResponse.json({ error: inserted.error.message }, { status: 400 });
  try {
    const pages = await extractPages(buffer, mime, Number(process.env.MAX_PDF_PAGES || 50));
    const chunks = pages.flatMap(page => chunkText(page.text, page.number));
    if (chunks.reduce((sum, item) => sum + item.content.length, 0) < 120) {
      throw new Error("This file has too little extractable text. Scanned PDFs are not supported yet.");
    }
    const rows = chunks.map((chunk, index) => ({ ...chunk, chunk_index: index, document_id: input.id, enrollment_id: input.enrollmentId, user_id: user.id }));
    const saved = await client.from("source_chunks").insert(rows);
    if (saved.error) throw new Error(saved.error.message);
    await client.from("documents").update({ status: "ready", page_count: isPdf ? pages.length : null }).eq("id", input.id);
    return NextResponse.json({ id: input.id, status: "ready" });
  } catch (error) {
    await client.from("documents").update({ status: "failed", error_message: error instanceof Error ? error.message.slice(0, 300) : "Extraction failed." }).eq("id", input.id);
    return NextResponse.json({ id: input.id, status: "failed", error: error instanceof Error ? error.message : "Extraction failed." }, { status: 422 });
  }
}
