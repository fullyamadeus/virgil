import { NextResponse } from "next/server";
import { z } from "zod";
import { userClient } from "@/lib/supabase";
import { chunkText } from "@/lib/study";
import { extractPages } from "@/lib/extract";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await userClient(request);
  if (!auth) return NextResponse.json({ error: "Sign in to upload." }, { status: 401 });
  const body = await request.formData();
  const enrollmentId = z.uuid().safeParse(body.get("enrollmentId"));
  const folderId = body.get("folderId") ? z.uuid().safeParse(body.get("folderId")) : null;
  const file = body.get("file");
  const materialKind = z.enum(["past_exam", "single_question", "study_guide", "other", "lecture"]).safeParse(body.get("materialKind") || "other");
  const displayName = z.string().trim().min(1).max(200).safeParse(body.get("displayName") || (file instanceof File ? file.name : ""));
  const examDate = body.get("examDate") || null;
  const validExamDate = examDate === null || (typeof examDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(examDate));
  if (!enrollmentId.success || (folderId && !folderId.success) || !(file instanceof File) || !materialKind.success || !displayName.success || !validExamDate || (materialKind.success && (materialKind.data === "past_exam") !== Boolean(examDate))) {
    return NextResponse.json({ error: "Choose a valid course, material name, category, exam date, and file." }, { status: 400 });
  }
  const { client, user } = auth;
  const { data: enrollment } = await client.from("enrollments").select("id").eq("id", enrollmentId.data).eq("user_id", user.id).single();
  if (!enrollment) return NextResponse.json({ error: "Course workspace not found." }, { status: 404 });
  if (folderId?.success) {
    const { data: folder } = await client.from("folders").select("id").eq("id", folderId.data).eq("enrollment_id", enrollmentId.data).single();
    if (!folder) return NextResponse.json({ error: "Folder not found in this course." }, { status: 404 });
  }
  const maxBytes = Number(process.env.MAX_UPLOAD_MB || 12) * 1024 * 1024;
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isText = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");
  if ((!isPdf && !isText) || file.size === 0 || file.size > maxBytes) {
    return NextResponse.json({ error: `Upload a PDF or TXT file up to ${process.env.MAX_UPLOAD_MB || 12} MB.` }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (isPdf && buffer.subarray(0, 5).toString() !== "%PDF-") {
    return NextResponse.json({ error: "This is not a readable PDF file." }, { status: 400 });
  }
  const id = crypto.randomUUID();
  const path = `${user.id}/${enrollmentId.data}/${id}/${file.name.replace(/[^\p{L}\p{N}._-]/gu, "_").slice(0, 140)}`;
  const mime = isPdf ? "application/pdf" : "text/plain";
  const uploaded = await client.storage.from("study-materials").upload(path, buffer, { contentType: mime, upsert: false });
  if (uploaded.error) return NextResponse.json({ error: uploaded.error.message }, { status: 400 });
  const inserted = await client.from("documents").insert({
    id, user_id: user.id, enrollment_id: enrollmentId.data,
    folder_id: folderId?.success ? folderId.data : null,
    filename: file.name.slice(0, 200), storage_path: path, mime_type: mime, byte_size: file.size,
    display_name: displayName.data, material_kind: materialKind.data, exam_date: examDate,
  }).select("id").single();
  if (inserted.error) {
    await client.storage.from("study-materials").remove([path]);
    return NextResponse.json({ error: inserted.error.message }, { status: 400 });
  }
  try {
    const pages = await extractPages(buffer, mime, Number(process.env.MAX_PDF_PAGES || 50));
    const chunks = pages.flatMap(page => chunkText(page.text, page.number));
    if (chunks.reduce((sum, item) => sum + item.content.length, 0) < 120) {
      throw new Error("This file has too little extractable text. Scanned PDFs are not supported yet.");
    }
    const rows = chunks.map((chunk, index) => ({ ...chunk, chunk_index: index, document_id: id, enrollment_id: enrollmentId.data, user_id: user.id }));
    const saved = await client.from("source_chunks").insert(rows);
    if (saved.error) throw new Error(saved.error.message);
    await client.from("documents").update({ status: "ready", page_count: isPdf ? pages.length : null }).eq("id", id);
    return NextResponse.json({ id, status: "ready" });
  } catch (error) {
    await client.from("documents").update({ status: "failed", error_message: error instanceof Error ? error.message.slice(0, 300) : "Extraction failed." }).eq("id", id);
    return NextResponse.json({ id, status: "failed", error: error instanceof Error ? error.message : "Extraction failed." }, { status: 422 });
  }
}
