import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_MATERIAL_BYTES = 12 * 1024 * 1024;

export function materialStoragePath(userId: string, enrollmentId: string, documentId: string, filename: string) {
  return `${userId}/${enrollmentId}/${documentId}/${filename.replace(/[^\p{L}\p{N}._-]/gu, "_").slice(0, 140)}`;
}

export async function uploadMaterial(client: SupabaseClient, userId: string, enrollmentId: string, file: File, details: {
  displayName?: string;
  materialKind: "past_exam" | "single_question" | "study_guide" | "other" | "lecture";
  folderId?: string | null;
  examDate?: string | null;
}) {
  const filename = file.name.slice(0, 200);
  const mime = filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : filename.toLowerCase().endsWith(".txt") ? "text/plain" : null;
  if (!mime || !file.size || file.size > MAX_MATERIAL_BYTES) throw new Error("Upload a PDF or TXT file up to 12 MB.");

  const id = crypto.randomUUID();
  const path = materialStoragePath(userId, enrollmentId, id, filename);
  const bucket = client.storage.from("study-materials");
  const uploaded = await bucket.upload(path, file, { contentType: mime, upsert: false });
  if (uploaded.error) throw uploaded.error;

  try {
    const token = (await client.auth.getSession()).data.session?.access_token;
    if (!token) throw new Error("Sign in to upload.");
    const response = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, enrollmentId, filename, displayName: details.displayName || filename, materialKind: details.materialKind, folderId: details.folderId || null, examDate: details.examDate || null }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not process the uploaded file.");
    return { id: result.id as string, path };
  } catch (error) {
    const existing = await client.from("documents").select("id").eq("id", id).maybeSingle();
    if (!existing.error && !existing.data) await bucket.remove([path]);
    throw error;
  }
}
