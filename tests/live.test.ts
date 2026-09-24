import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

test("local Supabase keeps two students isolated through PDF upload and practice", { skip: process.env.RUN_LIVE_TESTS !== "1", timeout: 120_000 }, async () => {
  const status = execFileSync("./node_modules/.bin/supabase", ["status", "-o", "env"], { encoding: "utf8" });
  const values = Object.fromEntries(status.split("\n").filter(line => /^[A-Z_]+=/.test(line)).map(line => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1).replace(/^"|"$/g, "")]; }));
  const url = values.API_URL;
  const anon = values.ANON_KEY;
  const service = values.SERVICE_ROLE_KEY;
  assert.ok(url && anon && service, "Local Supabase must be running");
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anon;
  process.env.AI_TEST_MODE = "true";

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const users: string[] = [];
  const paths: string[] = [];
  try {
    const suffix = randomUUID().slice(0, 8);
    const password = `Test-only-${randomUUID()}`;
    const makeUser = async (name: string) => {
      const email = `${name}-${suffix}@example.invalid`;
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error || !created.data.user) throw created.error || new Error("Could not create test user");
      users.push(created.data.user.id);
      const client = createClient(url, anon, { auth: { persistSession: false } });
      const signed = await client.auth.signInWithPassword({ email, password });
      if (signed.error || !signed.data.session) throw signed.error || new Error("Could not sign in test user");
      return { client, user: created.data.user, token: signed.data.session.access_token };
    };
    const a = await makeUser("virgil-a");
    const b = await makeUser("virgil-b");
    const term = await a.client.from("terms").insert({ user_id: a.user.id, label: "Test semester", starts_on: "2026-09-01", ends_on: "2027-08-31" }).select("id").single();
    assert.ifError(term.error);
    const enrollment = await a.client.from("enrollments").insert({ user_id: a.user.id, term_id: term.data!.id, course_id: "4cf05bf0-fded-4e5f-95f5-c23bd478d511" }).select("id").single();
    assert.ifError(enrollment.error);
    const deniedTerm = await b.client.from("terms").select("id").eq("id", term.data!.id);
    assert.equal(deniedTerm.data?.length, 0);
    const forged = await b.client.from("enrollments").insert({ user_id: b.user.id, term_id: term.data!.id, course_id: "4cf05bf0-fded-4e5f-95f5-c23bd478d511" });
    assert.ok(forged.error, "A second user cannot enroll in another user's term");

    const { POST: upload } = await import("../src/app/api/upload/route");
    const pdf = await readFile("node_modules/pdf-parse/test/data/04-valid.pdf");
    const form = new FormData();
    form.set("enrollmentId", enrollment.data!.id);
    form.set("file", new File([pdf], "lesson.pdf", { type: "application/pdf" }));
    const uploaded = await upload(new Request("http://localhost/api/upload", { method: "POST", headers: { Authorization: `Bearer ${a.token}` }, body: form }));
    assert.equal(uploaded.status, 200, await uploaded.clone().text());
    const documentId = (await uploaded.json()).id as string;
    const doc = await a.client.from("documents").select("storage_path,status,page_count").eq("id", documentId).single();
    assert.equal(doc.data?.status, "ready");
    assert.equal(doc.data?.page_count, 5);
    paths.push(doc.data!.storage_path);
    const deniedDoc = await b.client.from("documents").select("id").eq("id", documentId);
    assert.equal(deniedDoc.data?.length, 0);
    const deniedFile = await b.client.storage.from("study-materials").createSignedUrl(doc.data!.storage_path, 60);
    assert.ok(deniedFile.error, "A second user cannot get a signed URL for another user's file");

    const { POST: generate } = await import("../src/app/api/generate/route");
    const generated = await generate(new Request("http://localhost/api/generate", { method: "POST", headers: { Authorization: `Bearer ${a.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ enrollmentId: enrollment.data!.id, documentIds: [documentId], kind: "quiz", count: 3, difficulty: "easy", language: "en", topic: "speed exercise", requestKey: randomUUID() }) }));
    assert.equal(generated.status, 200, await generated.clone().text());
    const setId = (await generated.json()).setId as string;
    const studyItems = await a.client.from("study_items").select("id,citations,answer").eq("set_id", setId);
    assert.equal(studyItems.data?.length, 3);
    const sourceChunks = await a.client.from("source_chunks").select("id,page_number,content").eq("document_id", documentId);
    assert.ifError(sourceChunks.error);
    const chunksById = new Map(sourceChunks.data!.map(chunk => [chunk.id, chunk]));
    for (const item of studyItems.data!) {
      for (const citation of item.citations as { chunk_id: string; quote: string }[]) {
        const source = chunksById.get(citation.chunk_id);
        assert.ok(source?.page_number, "Every PDF citation retains a page number");
        assert.ok(source.content.includes(citation.quote), "Every quote appears in the cited page chunk");
      }
    }
    const attempt = await a.client.from("attempts").insert({ user_id: a.user.id, set_id: setId, answers: { [studyItems.data![0].id]: studyItems.data![0].answer }, score: 1, total: 3 });
    assert.ifError(attempt.error);
    const deniedSet = await b.client.from("study_sets").select("id").eq("id", setId);
    assert.equal(deniedSet.data?.length, 0);
    const deniedChunks = await b.client.from("source_chunks").select("id").eq("document_id", documentId);
    assert.equal(deniedChunks.data?.length, 0);
    const deniedAttempt = await b.client.from("attempts").select("id").eq("set_id", setId);
    assert.equal(deniedAttempt.data?.length, 0);
    const freshClient = createClient(url, anon, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${a.token}` } } });
    const persisted = await freshClient.from("study_sets").select("id").eq("id", setId).single();
    assert.equal(persisted.data?.id, setId);
  } finally {
    if (paths.length) await admin.storage.from("study-materials").remove(paths);
    for (const id of users) await admin.auth.admin.deleteUser(id);
  }
});
