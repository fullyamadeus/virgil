"use client";

import { useState, type FormEvent } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { ChevronRight, CircleHelp, ExternalLink, FileText, Folder, Link2, Plus, Trash2, X } from "lucide-react";

export type MaterialKind = "past_exam" | "single_question" | "study_guide" | "other";
export type StudyFolder = { id: string; enrollment_id: string; parent_id: string | null; name: string };
export type Document = { id: string; enrollment_id: string; folder_id: string | null; filename: string; display_name: string; material_kind: MaterialKind | "lecture"; exam_date: string | null; storage_path: string; status: string; error_message: string | null; page_count: number | null; byte_size: number; created_at: string };
export type MaterialLink = { id: string; enrollment_id: string; folder_id: string | null; title: string; url: string; material_kind: MaterialKind; exam_date: string | null; created_at: string };
type Run = (action: () => Promise<{ error?: { message: string } | null } | void>, message?: string) => Promise<void>;
const labels: Record<MaterialKind, string> = { past_exam: "Past exam", single_question: "Single question", study_guide: "Study guide", other: "Other" };

export default function Materials({ client, session, enrollmentId, folders, documents, links, folderId, setFolderId, run, busy }: {
  client: SupabaseClient;
  session: Session;
  enrollmentId: string;
  folders: StudyFolder[];
  documents: Document[];
  links: MaterialLink[];
  folderId: string | null;
  setFolderId: (id: string | null) => void;
  run: Run;
  busy: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [source, setSource] = useState<"upload" | "link">("upload");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<MaterialKind>("other");
  const [examDate, setExamDate] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const currentFolder = folders.find(folder => folder.id === folderId);
  const childFolders = folders.filter(folder => folder.parent_id === folderId);
  const entries = [
    ...documents.filter(doc => doc.folder_id === folderId && doc.material_kind !== "lecture").map(doc => ({ type: "document" as const, created: doc.created_at, doc })),
    ...links.filter(link => link.folder_id === folderId).map(link => ({ type: "link" as const, created: link.created_at, link })),
  ].sort((a, b) => b.created.localeCompare(a.created));
  const crumbs: StudyFolder[] = []; let at = currentFolder;
  while (at) { crumbs.unshift(at); at = folders.find(folder => folder.id === at?.parent_id); }

  function resetForm() { setAdding(false); setName(""); setKind("other"); setExamDate(""); setUrl(""); setFile(null); setSource("upload"); }
  function descendantOf(candidateId: string, targetId: string): boolean { let cursor = folders.find(folder => folder.id === candidateId); while (cursor) { if (cursor.id === targetId) return true; cursor = folders.find(folder => folder.id === cursor?.parent_id); } return false; }
  async function createFolder() { const folderName = window.prompt("Folder name")?.trim(); if (folderName) await run(async () => client.from("folders").insert({ user_id: session.user.id, enrollment_id: enrollmentId, parent_id: folderId, name: folderName }), "Folder created."); }

  async function save(event: FormEvent) {
    event.preventDefault();
    const title = name.trim();
    if (!title || (kind === "past_exam" && !examDate)) return;
    if (source === "link") {
      let parsed: URL;
      try { parsed = new URL(url); if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(); }
      catch { window.alert("Enter an HTTP or HTTPS link."); return; }
      await run(async () => {
        const result = await client.from("material_links").insert({ user_id: session.user.id, enrollment_id: enrollmentId, folder_id: folderId, title, url: parsed.toString(), material_kind: kind, exam_date: kind === "past_exam" ? examDate : null });
        if (!result.error) resetForm();
        return result;
      }, "Link added.");
      return;
    }
    if (!file) return;
    await run(async () => {
      const body = new FormData();
      body.append("file", file);
      body.append("enrollmentId", enrollmentId);
      body.append("displayName", title);
      body.append("materialKind", kind);
      if (kind === "past_exam") body.append("examDate", examDate);
      if (folderId) body.append("folderId", folderId);
      const token = (await client.auth.getSession()).data.session?.access_token;
      const response = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      resetForm();
    }, "Material uploaded and indexed.");
  }

  async function openDoc(doc: Document) { const { data, error } = await client.storage.from("study-materials").createSignedUrl(doc.storage_path, 60); if (error || !data) { window.alert(error?.message || "Could not open file."); return; } window.open(data.signedUrl, "_blank", "noopener,noreferrer"); }
  async function retryDoc(doc: Document) { await run(async () => { const token = (await client.auth.getSession()).data.session?.access_token; const response = await fetch("/api/retry", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ documentId: doc.id }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); }, "Material indexed."); }
  async function deleteDoc(doc: Document) { if (!window.confirm(`Delete ${doc.display_name}? Existing study sets will keep their saved questions and quotes.`)) return; await run(async () => { const removed = await client.storage.from("study-materials").remove([doc.storage_path]); if (removed.error) return removed; return client.from("documents").delete().eq("id", doc.id); }, "Material deleted."); }

  return <div className="workspace-stack">
    <div className="section-top"><div><h2>Materials</h2><p>Keep past exams, questions, study guides, and other resources together.</p></div><div className="button-row"><button className="secondary" onClick={createFolder} disabled={busy}><Folder size={16}/> New folder</button><button className="primary" onClick={() => setAdding(true)}><Plus size={16}/> Add material</button></div></div>
    <div className="file-panel">
      <div className="folder-breadcrumb"><button onClick={() => setFolderId(null)}>All materials</button>{crumbs.map(folder => <span key={folder.id}><ChevronRight size={15}/><button onClick={() => setFolderId(folder.id)}>{folder.name}</button></span>)}</div>
      {childFolders.map(folder => <div className="file-row" key={folder.id}><button className="file-main" onClick={() => setFolderId(folder.id)}><span className="file-icon folder"><Folder size={20}/></span><span><strong>{folder.name}</strong><small>Folder</small></span></button><select className="move-select" aria-label={`Move ${folder.name}`} value={folder.parent_id || ""} onChange={event => void run(async () => client.from("folders").update({ parent_id: event.target.value || null }).eq("id", folder.id))}><option value="">Top level</option>{folders.filter(candidate => !descendantOf(candidate.id, folder.id)).map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select><button className="icon-button" title="Rename folder" onClick={() => { const value = window.prompt("Rename folder", folder.name)?.trim(); if (value) void run(async () => client.from("folders").update({ name: value }).eq("id", folder.id)); }}>✎</button><button className="icon-button danger" title="Delete folder" onClick={() => { if (window.confirm(`Delete folder ${folder.name}? Its subfolders will be deleted; resources move to the top level.`)) void run(async () => client.from("folders").delete().eq("id", folder.id)); }}><Trash2 size={16}/></button></div>)}
      {entries.map(entry => entry.type === "document" ? <div className="file-row" key={`doc-${entry.doc.id}`}>
        <button className="file-main" onClick={() => void openDoc(entry.doc)}><span className="file-icon"><FileText size={20}/></span><span><strong>{entry.doc.display_name}</strong><small>{labels[entry.doc.material_kind as MaterialKind]}{entry.doc.exam_date ? ` · ${entry.doc.exam_date}` : ""} · {entry.doc.status === "ready" ? `${entry.doc.page_count ? `${entry.doc.page_count} pages · ` : ""}${(entry.doc.byte_size / 1024).toFixed(0)} KB` : entry.doc.error_message || entry.doc.status}</small></span></button>
        <span className={`status ${entry.doc.status}`}>{entry.doc.status}</span>{entry.doc.status === "failed" && <button className="icon-button" title="Retry text extraction" onClick={() => void retryDoc(entry.doc)}>↻</button>}
        <select className="move-select" aria-label={`Move ${entry.doc.display_name}`} value={entry.doc.folder_id || ""} onChange={event => void run(async () => client.from("documents").update({ folder_id: event.target.value || null }).eq("id", entry.doc.id))}><option value="">Top level</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
        <button className="icon-button" title="Rename material" onClick={() => { const value = window.prompt("Rename material", entry.doc.display_name)?.trim(); if (value) void run(async () => client.from("documents").update({ display_name: value }).eq("id", entry.doc.id)); }}>✎</button><button className="icon-button danger" title="Delete material" onClick={() => void deleteDoc(entry.doc)}><Trash2 size={16}/></button>
      </div> : <div className="file-row" key={`link-${entry.link.id}`}>
        <a className="file-main material-link" href={entry.link.url} target="_blank" rel="noopener noreferrer"><span className="file-icon"><Link2 size={20}/></span><span><strong>{entry.link.title} <ExternalLink size={12}/></strong><small>{labels[entry.link.material_kind]}{entry.link.exam_date ? ` · ${entry.link.exam_date}` : ""} · Link</small></span></a>
        <select className="move-select" aria-label={`Move ${entry.link.title}`} value={entry.link.folder_id || ""} onChange={event => void run(async () => client.from("material_links").update({ folder_id: event.target.value || null }).eq("id", entry.link.id))}><option value="">Top level</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
        <button className="icon-button" title="Rename link" onClick={() => { const value = window.prompt("Rename material", entry.link.title)?.trim(); if (value) void run(async () => client.from("material_links").update({ title: value }).eq("id", entry.link.id)); }}>✎</button><button className="icon-button danger" title="Delete link" onClick={() => { if (window.confirm(`Delete ${entry.link.title}?`)) void run(async () => client.from("material_links").delete().eq("id", entry.link.id)); }}><Trash2 size={16}/></button>
      </div>)}
      {!childFolders.length && !entries.length && <div className="empty-small centered">This folder is empty. Add a file, link, or folder.</div>}
    </div>
    <div className="hint-strip"><CircleHelp size={17}/> Uploaded files can feed practice after text extraction. Links open externally and are not used for AI practice.</div>
    {adding && <div className="modal-backdrop" onClick={resetForm}><div className="modal" onClick={event => event.stopPropagation()}><div className="modal-head"><h2>Add material</h2><button className="icon-button" aria-label="Close" onClick={resetForm}><X size={19}/></button></div><form className="stack-form" onSubmit={save}>
      <label>Material name<input required maxLength={200} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. January 2025 exam"/></label>
      <label>Category<select value={kind} onChange={event => setKind(event.target.value as MaterialKind)}><option value="past_exam">Past exam</option><option value="single_question">Single question</option><option value="study_guide">Study guide</option><option value="other">Other</option></select></label>
      {kind === "past_exam" && <label>Exam date<input required type="date" value={examDate} onChange={event => setExamDate(event.target.value)}/></label>}
      <div className="source-switch"><button type="button" className={source === "upload" ? "active" : ""} onClick={() => setSource("upload")}>Upload document</button><button type="button" className={source === "link" ? "active" : ""} onClick={() => setSource("link")}>Add link</button></div>
      {source === "upload" ? <label key="upload-file">PDF or TXT file<input type="file" required accept=".pdf,.txt,application/pdf,text/plain" onChange={event => setFile(event.target.files?.[0] || null)}/></label> : <label key="external-url">URL<input type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://youtube.com/…"/></label>}
      <button className="primary" disabled={busy}>{busy ? "Saving…" : "Save material"}</button>
    </form></div></div>}
  </div>;
}
