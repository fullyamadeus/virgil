import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase";
import { generationInput, validateGeneratedItems, type Chunk } from "@/lib/study";
import { generateStudyItems } from "@/lib/generator";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await userClient(request);
  if (!auth) return NextResponse.json({ error: "Sign in to generate practice." }, { status: 401 });
  if (!process.env.OPENAI_API_KEY && process.env.AI_TEST_MODE !== "true") return NextResponse.json({ error: "AI generation is unavailable until the server has an OpenAI API key." }, { status: 503 });
  const parsed = generationInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check your study settings and selected files." }, { status: 400 });
  const input = parsed.data;
  const { client, user } = auth;
  const { data: enrollment } = await client.from("enrollments").select("id,course_id,courses(name_mk)").eq("id", input.enrollmentId).single();
  if (!enrollment) return NextResponse.json({ error: "Course workspace not found." }, { status: 404 });
  const uniqueIds = [...new Set(input.documentIds)];
  if (uniqueIds.length !== input.documentIds.length) return NextResponse.json({ error: "Select each document once." }, { status: 400 });
  const { data: documents } = await client.from("documents").select("id,status,filename").eq("enrollment_id", input.enrollmentId).in("id", uniqueIds);
  if (!documents || documents.length !== uniqueIds.length || documents.some(doc => doc.status !== "ready")) {
    return NextResponse.json({ error: "Select only ready documents from this course." }, { status: 400 });
  }
  const { data: chunks, error: chunksError } = await client.from("source_chunks").select("id,document_id,page_number,content").eq("enrollment_id", input.enrollmentId).in("document_id", uniqueIds).order("document_id").order("chunk_index").limit(300);
  if (chunksError || !chunks?.length) return NextResponse.json({ error: "No extractable text found." }, { status: 400 });
  const typedChunks = chunks as Chunk[];
  const chars = typedChunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
  if (chunks.length >= 300 || chars > 28_000) {
    return NextResponse.json({ error: "Too much source text. Select fewer files or smaller documents; no content was silently omitted." }, { status: 400 });
  }
  const staleBefore = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  await client.from("generation_jobs").update({ status: "failed", error_message: "The previous generation timed out." }).eq("user_id", user.id).eq("status", "running").lt("created_at", staleBefore);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const { count } = await client.from("generation_jobs").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", today.toISOString());
  const limit = Number(process.env.MAX_GENERATIONS_PER_DAY || 10);
  if ((count || 0) >= limit) return NextResponse.json({ error: `Daily generation limit reached (${limit}).` }, { status: 429 });
  const job = await client.from("generation_jobs").insert({ user_id: user.id, enrollment_id: input.enrollmentId, request_key: input.requestKey }).select("id").single();
  if (job.error) {
    const { data: prior } = await client.from("generation_jobs").select("status,set_id").eq("request_key", input.requestKey).maybeSingle();
    return NextResponse.json({ error: prior?.status === "done" ? "This request already completed." : "This request is already running.", setId: prior?.set_id }, { status: 409 });
  }
  try {
    const generated = await generateStudyItems({ ...input, chunks: typedChunks });
    const items = validateGeneratedItems(generated.data, input.kind, input.count, typedChunks);
    const title = `${process.env.AI_TEST_MODE === "true" ? "TEST · " : ""}${input.kind === "quiz" ? "Quiz" : "Flashcards"}${input.topic ? ` · ${input.topic}` : ""}`;
    const set = await client.from("study_sets").insert({ user_id: user.id, enrollment_id: input.enrollmentId, title, kind: input.kind, language: input.language, difficulty: input.difficulty, topic: input.topic, source_document_ids: uniqueIds }).select("id").single();
    if (set.error || !set.data) throw new Error(set.error?.message || "Could not save the study set.");
    const rows = items.map((item, position) => ({ user_id: user.id, set_id: set.data.id, position, prompt: item.prompt, options: item.options, answer: item.answer, explanation: item.explanation, citations: item.citations }));
    const saved = await client.from("study_items").insert(rows);
    if (saved.error) {
      await client.from("study_sets").delete().eq("id", set.data.id);
      throw new Error(saved.error.message);
    }
    await client.from("generation_jobs").update({ status: "done", set_id: set.data.id, input_tokens: generated.usage?.input_tokens ?? null, output_tokens: generated.usage?.output_tokens ?? null }).eq("id", job.data.id);
    return NextResponse.json({ setId: set.data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    await client.from("generation_jobs").update({ status: "failed", error_message: message.slice(0, 300) }).eq("id", job.data.id);
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
