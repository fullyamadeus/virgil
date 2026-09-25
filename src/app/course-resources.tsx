"use client";

import { useState, type FormEvent } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { BookOpen, FileText, Plus, Trash2, X } from "lucide-react";
import { uploadMaterial } from "@/lib/material-upload";
import { skopjeDateKey } from "@/lib/time";

type Book = { id: string; title: string; storage_path: string; byte_size: number };
type Lecture = { id: string; title: string; lecture_date: string; notes: string | null; document_id: string | null };
type Document = { id: string; filename: string; storage_path: string };
type Run = (action: () => Promise<{ error?: { message: string } | null } | void>, message?: string) => Promise<void>;

export default function CourseResources({ client, session, enrollmentId, books, lectures, documents, run, busy, section }: {
  client: SupabaseClient;
  session: Session;
  enrollmentId: string;
  books: Book[];
  lectures: Lecture[];
  documents: Document[];
  run: Run;
  busy: boolean;
  section: "books" | "lectures";
}) {
  const [dialog, setDialog] = useState<"book" | "lecture" | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => skopjeDateKey(new Date()));
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  function close() { setDialog(null); setTitle(""); setNotes(""); setFile(null); }

  async function openFile(bucket: string, path: string) {
    const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 60);
    if (error || !data) { window.alert(error?.message || "Could not open file."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function saveBook(event: FormEvent) {
    event.preventDefault();
    if (!file || !title.trim()) return;
    if (file.size > 50 * 1024 * 1024 || file.size === 0 || !file.name.toLowerCase().endsWith(".pdf")) {
      window.alert("Choose a PDF no larger than 50 MB. Larger books can be added when Virgil uses local files.");
      return;
    }
    await run(async () => {
      const path = `${session.user.id}/${enrollmentId}/${crypto.randomUUID()}.pdf`;
      const uploaded = await client.storage.from("course-books").upload(path, file, { contentType: "application/pdf", upsert: false });
      if (uploaded.error) return uploaded;
      const inserted = await client.from("books").insert({ user_id: session.user.id, enrollment_id: enrollmentId, title: title.trim(), storage_path: path, byte_size: file.size });
      if (inserted.error) { await client.storage.from("course-books").remove([path]); return inserted; }
      close();
    }, "Book added.");
  }

  async function saveLecture(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    await run(async () => {
      let documentId: string | null = null;
      if (file) {
        const uploaded = await uploadMaterial(client, session.user.id, enrollmentId, file, { materialKind: "lecture" });
        documentId = uploaded.id;
      }
      const inserted = await client.from("lectures").insert({ user_id: session.user.id, enrollment_id: enrollmentId, title: title.trim(), lecture_date: date, notes: notes.trim() || null, document_id: documentId });
      if (inserted.error) return inserted;
      close();
    }, "Lecture added.");
  }

  async function deleteBook(book: Book) {
    if (!window.confirm(`Delete ${book.title}?`)) return;
    await run(async () => {
      const removed = await client.storage.from("course-books").remove([book.storage_path]);
      if (removed.error) return removed;
      return client.from("books").delete().eq("id", book.id);
    }, "Book deleted.");
  }

  return <div className="course-resources">
    {section === "books" && <section className="resource-section">
      <div className="resource-heading"><h2>BOOKS</h2><button className="primary" onClick={() => setDialog("book")}><Plus size={16}/> Add book</button></div>
      {books.length ? <div className="resource-list">{books.map(book => <div className="resource-entry" key={book.id}>
        <button className="resource-open" onClick={() => void openFile("course-books", book.storage_path)}><BookOpen size={18}/><span><strong>Book: {book.title}</strong><small>Open PDF · {(book.byte_size / 1024 / 1024).toFixed(1)} MB</small></span></button>
        <button className="icon-button danger" aria-label={`Delete ${book.title}`} onClick={() => void deleteBook(book)}><Trash2 size={16}/></button>
      </div>)}</div> : <p className="resource-empty">Add a course book to keep it one click away.</p>}
    </section>}
    {section === "lectures" && <section className="resource-section">
      <div className="resource-heading"><h2>LECTURES</h2><button className="secondary" onClick={() => setDialog("lecture")}><Plus size={16}/> Add lecture</button></div>
      {lectures.length ? <div className="resource-list">{lectures.map(lecture => { const slides = documents.find(doc => doc.id === lecture.document_id); return <div className="resource-entry lecture-entry" key={lecture.id}>
        <div className="lecture-details"><strong>{lecture.title}</strong><small>{lecture.lecture_date}</small>{lecture.notes && <p>{lecture.notes}</p>}{slides && <button className="lecture-file" onClick={() => void openFile("study-materials", slides.storage_path)}><FileText size={15}/> Open slides: {slides.filename}</button>}</div>
        <button className="icon-button danger" aria-label={`Delete ${lecture.title}`} onClick={() => { if (window.confirm(`Delete lecture ${lecture.title}? Its slides will move to Materials.`)) void run(async () => { if (lecture.document_id) { const moved = await client.from("documents").update({ material_kind: "other" }).eq("id", lecture.document_id); if (moved.error) return moved; } return client.from("lectures").delete().eq("id", lecture.id); }, "Lecture deleted."); }}><Trash2 size={16}/></button>
      </div>; })}</div> : <p className="resource-empty">No lectures yet. Add the first one with its slides and notes.</p>}
    </section>}
    {dialog && <div className="modal-backdrop" onClick={close}><div className="modal" onClick={event => event.stopPropagation()}><div className="modal-head"><h2>{dialog === "book" ? "Add book" : "Add lecture"}</h2><button className="icon-button" onClick={close} aria-label="Close"><X size={19}/></button></div>
      <form className="stack-form" onSubmit={dialog === "book" ? saveBook : saveLecture}>
        <label>{dialog === "book" ? "Book title" : "Lecture title"}<input required maxLength={dialog === "book" ? 200 : 160} value={title} onChange={event => setTitle(event.target.value)} placeholder={dialog === "book" ? "Computer Networking: A Top Down Approach 8th Edition" : "Lecture 1: Introduction"}/></label>
        {dialog === "lecture" && <><label>Date<input type="date" required value={date} onChange={event => setDate(event.target.value)}/></label><label>Notes<textarea value={notes} onChange={event => setNotes(event.target.value)} rows={4} placeholder="What did you learn?"/></label></>}
        <label>{dialog === "book" ? "Book PDF (up to 50 MB)" : "Slides PDF or TXT (optional; current material limits apply)"}<input type="file" required={dialog === "book"} accept={dialog === "book" ? ".pdf,application/pdf" : ".pdf,.txt,application/pdf,text/plain"} onChange={event => setFile(event.target.files?.[0] || null)}/></label>
        <button className="primary" disabled={busy}>{busy ? "Saving…" : dialog === "book" ? "Add book" : "Add lecture"}</button>
      </form>
    </div></div>}
  </div>;
}
