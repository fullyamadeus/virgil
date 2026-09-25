"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, CircleHelp, FileText, GraduationCap, LogOut, Moon, Plus, Search, Settings, Sparkles, Sun, Trash2, UserRound, X } from "lucide-react";
import { browserClient, isConfigured } from "@/lib/supabase";
import { COURSE_COLORS, textOnColor } from "@/lib/course-colors";
import CourseResources from "./course-resources";
import Materials, { type Document, type MaterialLink, type StudyFolder } from "./materials";
import CalendarView, { type Event, type TimetableEntry, type ExamWeek } from "./calendar-view";

type Term = { id: string; user_id: string; label: string; starts_on: string; ends_on: string };
type Course = { id: string; code: string; name_mk: string; program_code: string | null; recommended_semester: number | null; source_url: string };
type Enrollment = { id: string; user_id: string; term_id: string; course_id: string; color: string };
type Lecture = { id: string; enrollment_id: string; title: string; lecture_date: string; notes: string | null; document_id: string | null };
type Book = { id: string; enrollment_id: string; title: string; storage_path: string; byte_size: number };
type StudySet = { id: string; enrollment_id: string; title: string; kind: "quiz" | "flashcards"; created_at: string; source_document_ids: string[] };
type Citation = { chunk_id: string; quote: string };
type StudyItem = { id: string; set_id: string; position: number; prompt: string; options: string[]; answer: string; explanation: string; citations: Citation[]; flag_reason: string | null };
type ChunkLocation = { id: string; document_id: string; page_number: number | null };
type View = "dashboard" | "courses" | "calendar" | "settings";
type CourseTab = "materials" | "lectures" | "practice";

const nav = [
  { id: "dashboard" as View, label: "Dashboard", Icon: BookOpen },
  { id: "courses" as View, label: "Courses", Icon: GraduationCap },
  { id: "calendar" as View, label: "Calendar", Icon: CalendarDays },
  { id: "settings" as View, label: "Settings", Icon: Settings },
];

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Skopje" }).format(new Date(value));
}

function eventDate(event: Event) {
  return event.all_day ? event.on_date || "" : event.starts_at || "";
}

function currentAcademicTerm() {
  const now = new Date();
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const winter = now.getMonth() >= 8 || now.getMonth() < 2;
  return { label: `${year}/${year + 1} · ${winter ? "Winter" : "Summer"}`, starts_on: winter ? `${year}-09-01` : `${year + 1}-02-01`, ends_on: winter ? `${year + 1}-02-${new Date(year + 1, 2, 0).getDate()}` : `${year + 1}-08-31` };
}

export default function Page() {
  const client = useMemo(() => browserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(() => Boolean(client));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [aiTestMode, setAiTestMode] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  const [courseTab, setCourseTab] = useState<CourseTab>("materials");
  const [activeEnrollment, setActiveEnrollment] = useState<string | null>(null);
  const [activeSet, setActiveSet] = useState<string | null>(null);
  const [termId, setTermId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [terms, setTerms] = useState<Term[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [folders, setFolders] = useState<StudyFolder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [sets, setSets] = useState<StudySet[]>([]);
  const [items, setItems] = useState<StudyItem[]>([]);
  const [locations, setLocations] = useState<ChunkLocation[]>([]);
  const [materialLinks, setMaterialLinks] = useState<MaterialLink[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [examWeeks, setExamWeeks] = useState<ExamWeek[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [kind, setKind] = useState<"quiz" | "flashcards">("quiz");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [language, setLanguage] = useState<"en" | "mk">("en");
  const [topic, setTopic] = useState("");
  const [month, setMonth] = useState(() => new Date());

  const userId = session?.user.id;
  const selectedTerm = terms.find(term => term.id === termId);
  const termEnrollments = enrollments.filter(item => item.term_id === termId);
  const enrollment = enrollments.find(item => item.id === activeEnrollment);
  const currentCourse = courses.find(course => course.id === enrollment?.course_id);
  const courseDocs = documents.filter(doc => doc.enrollment_id === activeEnrollment);
  const courseLectures = lectures.filter(lecture => lecture.enrollment_id === activeEnrollment);
  const courseBooks = books.filter(book => book.enrollment_id === activeEnrollment);
  const courseFolders = folders.filter(folder => folder.enrollment_id === activeEnrollment);
  const courseSets = sets.filter(set => set.enrollment_id === activeEnrollment);
  const courseLinks = materialLinks.filter(link => link.enrollment_id === activeEnrollment);
  const currentSet = sets.find(set => set.id === activeSet);
  const currentItems = items.filter(item => item.set_id === activeSet).sort((a, b) => a.position - b.position);

  const refresh = useCallback(async () => {
    if (!client || !userId) return;
    const [termRes, courseRes, enrollmentRes, folderRes, documentRes, setRes, itemRes, locationRes, linkRes, eventRes, lectureRes, bookRes, timetableRes, examWeekRes] = await Promise.all([
      client.from("terms").select("*").order("starts_on", { ascending: false }),
      client.from("courses").select("*").order("name_mk"),
      client.from("enrollments").select("*"),
      client.from("folders").select("*").order("name"),
      client.from("documents").select("*").order("created_at", { ascending: false }),
      client.from("study_sets").select("*").order("created_at", { ascending: false }),
      client.from("study_items").select("*").order("position"),
      client.from("source_chunks").select("id,document_id,page_number").limit(1000),
      client.from("material_links").select("*").order("created_at", { ascending: false }),
      client.from("events").select("*").order("created_at", { ascending: false }),
      client.from("lectures").select("*").order("lecture_date", { ascending: false }),
      client.from("books").select("*").order("created_at", { ascending: false }),
      client.from("course_timetable").select("*"),
      client.from("exam_weeks").select("*"),
    ]);
    const firstError = [termRes, courseRes, enrollmentRes, folderRes, documentRes, setRes, itemRes, locationRes, linkRes, eventRes, lectureRes, bookRes, timetableRes, examWeekRes].find(result => result.error)?.error;
    if (firstError) setError(firstError.message);
    setTerms((termRes.data || []) as Term[]);
    setCourses((courseRes.data || []) as Course[]);
    setEnrollments((enrollmentRes.data || []) as Enrollment[]);
    setFolders((folderRes.data || []) as StudyFolder[]);
    setDocuments((documentRes.data || []) as Document[]);
    setSets((setRes.data || []) as StudySet[]);
    setItems((itemRes.data || []) as StudyItem[]);
    setLocations((locationRes.data || []) as ChunkLocation[]);
    setMaterialLinks((linkRes.data || []) as MaterialLink[]);
    setEvents((eventRes.data || []) as Event[]);
    setLectures((lectureRes.data || []) as Lecture[]);
    setBooks((bookRes.data || []) as Book[]);
    setTimetable((timetableRes.data || []) as TimetableEntry[]);
    setExamWeeks((examWeekRes.data || []) as ExamWeek[]);
    setTermId(current => current && termRes.data?.some(term => term.id === current) ? current : termRes.data?.[0]?.id || null);
  }, [client, userId]);

  useEffect(() => {
    if (!client) return;
    let live = true;
    client.auth.getSession().then(({ data }) => { if (live) { setSession(data.session); setBooting(false); } });
    const { data: listener } = client.auth.onAuthStateChange((_event, next) => { if (live) setSession(next); });
    return () => { live = false; listener.subscription.unsubscribe(); };
  }, [client]);
  useEffect(() => { if (!userId) return; const timer = setTimeout(() => void refresh(), 0); return () => clearTimeout(timer); }, [userId, refresh]);
  useEffect(() => { let live = true; fetch("/api/capabilities").then(response => response.json()).then(data => { if (live) { setAiAvailable(Boolean(data.ai)); setAiTestMode(Boolean(data.testMode)); } }).catch(() => { if (live) setAiAvailable(false); }); return () => { live = false; }; }, []);
  useEffect(() => { const timer = setTimeout(() => { setTheme(localStorage.getItem("virgil-theme") === "dark" ? "dark" : "light"); setThemeLoaded(true); }, 0); return () => clearTimeout(timer); }, []);
  useEffect(() => { if (!themeLoaded) return; document.documentElement.dataset.theme = theme; localStorage.setItem("virgil-theme", theme); }, [theme, themeLoaded]);

  async function run(action: () => Promise<{ error?: { message: string } | null } | void>, success?: string) {
    setError(""); setMessage(""); setBusy(true);
    try {
      const result = await action();
      if (result?.error) throw new Error(result.error.message);
      if (success) setMessage(success);
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); }
    finally { setBusy(false); }
  }

  function openCourse(id: string) { setActiveEnrollment(id); setActiveSet(null); setFolderId(null); setSelectedDocs([]); setCourseTab("materials"); setView("courses"); }
  function openSet(id: string) { setActiveSet(id); setCourseTab("practice"); setView("courses"); }

  if (!isConfigured()) return <SetupScreen />;
  if (booting) return <div className="center-screen"><BrandLogo/><p>Opening your workspace…</p></div>;
  if (!session || !client) return <AuthScreen client={client!} />;

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => { setActiveEnrollment(null); setActiveSet(null); setView("dashboard"); }}><BrandLogo/><span><strong>Virgil</strong><small>ARBEIT MACHT FREI.</small></span></button>
      <div className="sidebar-section-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">{nav.map(({ id, label, Icon }) => <button key={id} className={`side-link ${view === id ? "active" : ""}`} onClick={() => { setView(id); setActiveEnrollment(null); setActiveSet(null); }}><Icon size={18}/>{label}</button>)}</nav>
      <div className="sidebar-section-label course-label">MY COURSES</div>
      <div className="side-courses">{termEnrollments.map(item => { const course = courses.find(c => c.id === item.course_id); return course && <button key={item.id} className={`side-course ${activeEnrollment === item.id ? "active" : ""}`} onClick={() => openCourse(item.id)}><span className="course-dot" style={{ backgroundColor: item.color }}/>{course.name_mk}</button>; })}</div>
      <button className="side-add" onClick={() => { setView("courses"); setActiveEnrollment(null); }}><Plus size={16}/> Add a course</button>
      <div className="sidebar-bottom"><div className="account-avatar">{session.user.email?.slice(0, 1).toUpperCase()}</div><div className="account-text"><strong>My workspace</strong><span>{session.user.email}</span></div><button title="Sign out" aria-label="Sign out" className="icon-button" onClick={() => void client.auth.signOut()}><LogOut size={17}/></button></div>
    </aside>
    <main className="main-area">
      <details className="top-account-menu">
        <summary aria-label="Open account menu" title="Account"><UserRound size={19}/></summary>
        <div className="account-popover">
          <span>{session.user.email}</span>
          <button type="button" onClick={() => void client.auth.signOut()}><LogOut size={16}/> Sign out</button>
        </div>
      </details>
      <div className="page-content">
        {error && <div className="notice error"><CircleHelp size={18}/><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={16}/></button></div>}
        {message && <div className="notice success"><span>{message}</span><button onClick={() => setMessage("")} aria-label="Dismiss message"><X size={16}/></button></div>}
        {view === "dashboard" && <Dashboard terms={terms} selectedTerm={selectedTerm} termEnrollments={termEnrollments} courses={courses} sets={sets} events={events} onCourse={openCourse} onSet={openSet} />}
        {view === "courses" && !activeEnrollment && <CoursesHome client={client} userId={userId!} terms={terms} termId={termId} setTermId={setTermId} courses={courses} enrollments={termEnrollments} documents={documents} books={books} search={search} setSearch={setSearch} onCourse={openCourse} run={run} busy={busy} />}
        {view === "courses" && activeEnrollment && currentCourse && <>

          <CourseResources client={client} session={session} enrollmentId={activeEnrollment} books={courseBooks} lectures={courseLectures} documents={courseDocs} run={run} busy={busy} section="books" />
          <div className="tabs" role="tablist">{(["materials", "lectures", "practice"] as CourseTab[]).map(tab => <button role="tab" aria-selected={courseTab === tab} className={courseTab === tab ? "active" : ""} key={tab} onClick={() => { setCourseTab(tab); setActiveSet(null); }}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}</div>
          {courseTab === "materials" && <Materials client={client} session={session} enrollmentId={activeEnrollment} folders={courseFolders} documents={courseDocs} links={courseLinks} folderId={folderId} setFolderId={setFolderId} run={run} busy={busy} />}
          {courseTab === "lectures" && <CourseResources client={client} session={session} enrollmentId={activeEnrollment} books={courseBooks} lectures={courseLectures} documents={courseDocs} run={run} busy={busy} section="lectures" />}
          {courseTab === "practice" && (activeSet && currentSet ? <StudyPlayer client={client} userId={userId!} set={currentSet} items={currentItems} documents={courseDocs} locations={locations} onBack={() => setActiveSet(null)} run={run} /> : <Practice client={client} enrollmentId={activeEnrollment} documents={courseDocs} sets={courseSets} selectedDocs={selectedDocs} setSelectedDocs={setSelectedDocs} kind={kind} setKind={setKind} count={count} setCount={setCount} difficulty={difficulty} setDifficulty={setDifficulty} language={language} setLanguage={setLanguage} topic={topic} setTopic={setTopic} onSet={openSet} refresh={refresh} busy={busy} setBusy={setBusy} setError={setError} aiAvailable={aiAvailable} aiTestMode={aiTestMode} />)}
        </>}
        {view === "calendar" && <CalendarView client={client} userId={userId!} terms={terms} termId={termId} setTermId={setTermId} enrollments={enrollments} courses={courses} events={events} timetable={timetable} examWeeks={examWeeks} month={month} setMonth={setMonth} run={run} busy={busy} />}
        {view === "settings" && <SettingsView session={session} client={client} theme={theme} setTheme={setTheme} />}
      </div>
    </main>
  </div>;
}

function BrandLogo() { return <Image className="brand-logo" src="/assets/virgil-mark.svg" alt="Virgil logo" width={40} height={40} priority/>; }

function SetupScreen() { return <div className="center-screen"><BrandLogo/><h1>Virgil needs a database connection</h1><p>Copy <code>.env.example</code> to <code>.env.local</code>, set the Supabase URL and anon key, then run the migration and seed script. The README has the steps.</p></div>; }

function AuthScreen({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [signUp, setSignUp] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); setMessage(""); const result = signUp ? await client.auth.signUp({ email, password }) : await client.auth.signInWithPassword({ email, password }); if (result.error) setError(result.error.message); else if (signUp) setMessage("Check your inbox if email confirmation is enabled, then sign in."); setBusy(false); }
  return <div className="auth-layout"><div className="auth-visual"><BrandLogo/><div><h2>And you shaw know the truth, and the truth will set you free.</h2><p>Keep your courses, materials, and important dates organized in one place.</p></div></div><div className="auth-panel"><div className="auth-card"><div className="eyebrow">VIRGIL</div><h2>{signUp ? "Create your account" : "Welcome back"}</h2><p>{signUp ? "Start with a private study workspace." : ""}</p><form onSubmit={submit}><label>Email address<input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label><label>Password<input type="password" required minLength={6} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 6 characters" /></label>{error && <div className="form-error">{error}</div>}{message && <div className="form-success">{message}</div>}<button className="primary wide" disabled={busy}>{busy ? "Please wait…" : signUp ? "Create account" : "Sign in"}</button></form><button className="text-button" onClick={() => { setSignUp(!signUp); setError(""); }}>{signUp ? "Already have an account? Sign in" : "New here? Create an account"}</button></div></div></div>;
}

function Dashboard({ terms, selectedTerm, termEnrollments, courses, sets, events, onCourse, onSet }: { terms: Term[]; selectedTerm?: Term; termEnrollments: Enrollment[]; courses: Course[]; sets: StudySet[]; events: Event[]; onCourse: (id: string) => void; onSet: (id: string) => void }) {
  const upcoming = [...events].filter(item => !item.completed && (item.all_day ? (item.on_date || "") >= new Date().toISOString().slice(0, 10) : (item.starts_at || "") >= new Date().toISOString())).sort((a,b) => eventDate(a).localeCompare(eventDate(b))).slice(0, 5);
  return <><div className="page-heading"><div><h1>Welcome back.</h1><p>{selectedTerm ? `${selectedTerm.label} · The fear of the Lord is the beginning of wisdom.` : "Start by creating a semester and adding your courses."}</p></div></div><div className="section-title"><h2>Current courses</h2><span>{termEnrollments.length} courses</span></div><div className="course-grid">{termEnrollments.length ? termEnrollments.map(item => { const course = courses.find(c => c.id === item.course_id); return course && <button className="course-card" key={item.id} onClick={() => onCourse(item.id)}><span className="course-icon" style={{ backgroundColor: item.color, color: textOnColor(item.color) }}><BookOpen size={23}/></span><strong>{course.name_mk}</strong><span className="card-foot">Open workspace <ChevronRight size={16}/></span></button>; }) : <div className="empty-card"><GraduationCap size={30}/><strong>No courses yet</strong><p>Add a course to create its study workspace.</p></div>}</div><div className="dashboard-columns"><section className="panel"><div className="panel-title"><h2>Upcoming</h2><CalendarDays size={18}/></div>{upcoming.length ? upcoming.map(item => <div className="upcoming-row" key={item.id}><span className="event-marker" style={{ backgroundColor: termEnrollments.find(course => course.id === item.enrollment_id)?.color }}/><div><strong>{item.title}</strong><small>{item.kind === "review_session" ? "Review Session" : item.kind} · {item.all_day ? item.on_date : dateLabel(item.starts_at!)}</small></div></div>) : <div className="empty-small">Your upcoming exams and assignments will appear here.</div>}</section><section className="panel"><div className="panel-title"><h2>Recent practice</h2><Sparkles size={18}/></div>{sets.slice(0, 5).length ? sets.slice(0, 5).map(set => <button className="practice-row" key={set.id} onClick={() => { onCourse(set.enrollment_id); onSet(set.id); }}><span className="mini-icon"><Sparkles size={17}/></span><span><strong>{set.title}</strong><small>{set.kind} · {dateLabel(set.created_at)}</small></span><ChevronRight size={16}/></button>) : <div className="empty-small">Generate a quiz or flashcards from your materials to start practicing.</div>}</section></div>{!terms.length && <div className="hint-strip">A good first step: add your current semester and one course.</div>}</>;
}

function CoursesHome({ client, userId, terms, termId, setTermId, courses, enrollments, documents, books, search, setSearch, onCourse, run, busy }: { client: SupabaseClient; userId: string; terms: Term[]; termId: string | null; setTermId: (id: string) => void; courses: Course[]; enrollments: Enrollment[]; documents: Document[]; books: Book[]; search: string; setSearch: (value: string) => void; onCourse: (id: string) => void; run: (action: () => Promise<{ error?: { message: string } | null } | void>, message?: string) => Promise<void>; busy: boolean }) {
  const [showCatalog, setShowCatalog] = useState(false);
  const [showRemove, setShowRemove] = useState(false);
  const [removeEnrollment, setRemoveEnrollment] = useState("");
  const [pendingCourse, setPendingCourse] = useState<Course | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>(COURSE_COLORS[0].value);
  const available = courses.filter(course => !enrollments.some(item => item.course_id === course.id) && course.name_mk.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const removeTarget = enrollments.find(item => item.id === removeEnrollment);
  const removeCourseName = courses.find(item => item.id === removeTarget?.course_id)?.name_mk;
  async function addTerm() { const suggested = currentAcademicTerm(); const label = window.prompt("Semester name", suggested.label)?.trim(); if (!label) return; await run(async () => client.from("terms").insert({ user_id: userId, label, starts_on: suggested.starts_on, ends_on: suggested.ends_on }), "Semester created."); }
  async function deleteCourse() {
    if (!removeTarget || !window.confirm(`Remove ${removeCourseName} and all its materials, books, lectures, practice sets, calendar events, and timetable entries? This cannot be undone.`)) return;
    await run(async () => {
      const documentPaths = documents.filter(item => item.enrollment_id === removeTarget.id).map(item => item.storage_path);
      const bookPaths = books.filter(item => item.enrollment_id === removeTarget.id).map(item => item.storage_path);
      for (let index = 0; index < documentPaths.length; index += 100) {
        const result = await client.storage.from("study-materials").remove(documentPaths.slice(index, index + 100));
        if (result.error) return result;
      }
      for (let index = 0; index < bookPaths.length; index += 100) {
        const result = await client.storage.from("course-books").remove(bookPaths.slice(index, index + 100));
        if (result.error) return result;
      }
      const result = await client.from("enrollments").delete().eq("id", removeTarget.id);
      if (!result.error) { setShowRemove(false); setRemoveEnrollment(""); }
      return result;
    }, "Course removed.");
  }
  return <>
    <div className="page-heading"><div><h1>Courses</h1><p>Choose the classes you are taking and keep everything in its place.</p></div><div className="button-row"><button className="secondary remove-course-trigger" onClick={() => { setRemoveEnrollment(enrollments[0]?.id || ""); setShowRemove(true); }} disabled={!enrollments.length}><Trash2 size={16}/> Remove course</button><button className="primary" onClick={() => setShowCatalog(true)} disabled={!termId}><Plus size={17}/> Add course</button></div></div>
    <div className="toolbar"><div><label className="field-label">Selected semester</label><select value={termId || ""} onChange={event => setTermId(event.target.value)} disabled={!terms.length}>{terms.map(term => <option key={term.id} value={term.id}>{term.label}</option>)}</select></div><button className="secondary" onClick={addTerm} disabled={busy}><Plus size={15}/> New semester</button></div>
    {!terms.length && <div className="empty-card large"><CalendarDays size={31}/><strong>Create a semester first</strong><p>Your course workspaces are grouped by semester, so you can return to older material later.</p><button className="primary" onClick={addTerm}>Create semester</button></div>}
    <div className="course-grid">{enrollments.map(item => { const course = courses.find(c => c.id === item.course_id); return course && <div className="course-card course-card-with-color" key={item.id}><button className="course-card-open" onClick={() => onCourse(item.id)}><span className="course-icon" style={{ backgroundColor: item.color, color: textOnColor(item.color) }}><BookOpen size={23}/></span><strong>{course.name_mk}</strong><span className="card-foot">Open workspace <ChevronRight size={16}/></span></button><div className="course-color-picker" aria-label={`Color for ${course.name_mk}`}>{COURSE_COLORS.map(option => <button key={option.value} type="button" className={item.color.toLowerCase() === option.value.toLowerCase() ? "selected" : ""} style={{ backgroundColor: option.value }} title={option.name} aria-label={`Set ${course.name_mk} color to ${option.name}`} disabled={busy} onClick={() => void run(async () => client.from("enrollments").update({ color: option.value }).eq("id", item.id), "Course color updated.")}/>)}</div></div>; })}</div>
    {terms.length > 0 && <p className="muted-note">Course names from the FINKI SEIS23 program.</p>}
    {showRemove && <div className="modal-backdrop" onClick={() => setShowRemove(false)}><div className="modal" onClick={event => event.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">REMOVE FROM THIS SEMESTER</div><h2>Remove a course</h2></div><button className="icon-button" aria-label="Close" onClick={() => setShowRemove(false)}><X size={19}/></button></div><div className="stack-form"><label>Course<select value={removeEnrollment} onChange={event => setRemoveEnrollment(event.target.value)}>{enrollments.map(item => <option key={item.id} value={item.id}>{courses.find(course => course.id === item.course_id)?.name_mk || "Course"}</option>)}</select></label><div className="remove-course-warning"><strong>Warning: this cannot be undone.</strong><p>Removing {removeCourseName || "this course"} also deletes its uploaded materials and books, lectures, practice sets, calendar events, and timetable entries.</p></div><div className="button-row"><button className="secondary" onClick={() => setShowRemove(false)}>Cancel</button><button className="danger-button" disabled={busy || !removeTarget} onClick={() => void deleteCourse()}><Trash2 size={16}/> Remove course</button></div></div></div></div>}
    {showCatalog && <div className="modal-backdrop" onClick={() => { setShowCatalog(false); setPendingCourse(null); }}><div className="modal" onClick={event => event.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">FINKI COURSE CATALOG</div><h2>{pendingCourse ? "Choose a course color" : "Add a course"}</h2></div><button className="icon-button" onClick={() => { setShowCatalog(false); setPendingCourse(null); }}><X size={19}/></button></div>{pendingCourse ? <div className="stack-form"><strong>{pendingCourse.name_mk}</strong><div className="course-color-options">{COURSE_COLORS.map(option => <button type="button" key={option.value} className={selectedColor === option.value ? "selected" : ""} onClick={() => setSelectedColor(option.value)}><span style={{ backgroundColor: option.value }}/>{option.name}</button>)}</div><div className="button-row"><button className="secondary" onClick={() => setPendingCourse(null)}>Back</button><button className="primary" disabled={busy} onClick={() => void run(async () => { const result = await client.from("enrollments").insert({ user_id: userId, term_id: termId, course_id: pendingCourse.id, color: selectedColor }); if (!result.error) { setShowCatalog(false); setPendingCourse(null); } return result; }, "Course added.")}>Add course</button></div></div> : <><div className="search-field"><Search size={18}/><input autoFocus value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by course name" /></div><div className="catalog-list">{available.map(course => <div className="catalog-row" key={course.id}><div><strong>{course.name_mk}</strong></div><button className="small-primary" disabled={busy} onClick={() => { setSelectedColor(COURSE_COLORS.find(option => !enrollments.some(item => item.color.toLowerCase() === option.value.toLowerCase()))?.value || COURSE_COLORS[0].value); setPendingCourse(course); }}>Choose color</button></div>)}{!available.length && <p className="empty-small">No matching courses.</p>}</div></>}</div></div>}
  </>;
}

function Practice({ client, enrollmentId, documents, sets, selectedDocs, setSelectedDocs, kind, setKind, count, setCount, difficulty, setDifficulty, language, setLanguage, topic, setTopic, onSet, refresh, busy, setBusy, setError, aiAvailable, aiTestMode }: { client: SupabaseClient; enrollmentId: string; documents: Document[]; sets: StudySet[]; selectedDocs: string[]; setSelectedDocs: (docs: string[]) => void; kind: "quiz" | "flashcards"; setKind: (kind: "quiz" | "flashcards") => void; count: number; setCount: (count: number) => void; difficulty: "easy" | "medium" | "hard"; setDifficulty: (difficulty: "easy" | "medium" | "hard") => void; language: "en" | "mk"; setLanguage: (language: "en" | "mk") => void; topic: string; setTopic: (topic: string) => void; onSet: (id: string) => void; refresh: () => Promise<void>; busy: boolean; setBusy: (busy: boolean) => void; setError: (error: string) => void; aiAvailable: boolean | null; aiTestMode: boolean }) {
  const ready = documents.filter(doc => doc.status === "ready");
  async function generate() { if (!selectedDocs.length) { setError("Select at least one ready file."); return; } setBusy(true); setError(""); try { const token = (await client.auth.getSession()).data.session?.access_token; const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ enrollmentId, documentIds: selectedDocs, kind, count, difficulty, language, topic, requestKey: crypto.randomUUID() }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); await refresh(); onSet(data.setId); } catch (err) { setError(err instanceof Error ? err.message : "Generation failed."); } finally { setBusy(false); } }
  return <div className="workspace-stack">
    <div className="section-top"><div><h2>Study practice</h2><p>Turn selected material into a focused review session.</p></div></div>
    {aiAvailable === false && <div className="hint-strip"><CircleHelp size={17}/> AI generation is unavailable until an OpenAI API key is configured on the server. Saved study sets remain available.</div>}
    {aiTestMode && <div className="hint-strip"><CircleHelp size={17}/> Test generator active. Items are deterministic fixtures, not live AI study questions.</div>}
    <div className="practice-layout">
      <section className="panel generator-panel"><div className="eyebrow">CREATE A STUDY SET</div><h3>What would you like to practice?</h3>
        <div className="segmented"><button className={kind === "quiz" ? "active" : ""} onClick={() => setKind("quiz")}>Quiz</button><button className={kind === "flashcards" ? "active" : ""} onClick={() => setKind("flashcards")}>Flashcards</button></div>
        <label className="field-label">Source material</label><div className="source-selector">{ready.length ? ready.map(doc => <label className="checkbox-row" key={doc.id}><input type="checkbox" checked={selectedDocs.includes(doc.id)} onChange={event => setSelectedDocs(event.target.checked ? [...selectedDocs, doc.id] : selectedDocs.filter(id => id !== doc.id))}/><FileText size={17}/><span>{doc.display_name}</span></label>) : <p className="empty-small">Upload a text-based PDF or TXT file in Materials first.</p>}</div>
        <div className="form-grid"><label>Questions/cards<select value={count} onChange={event => setCount(Number(event.target.value))}>{[3,5,8,10,15].map(value => <option key={value}>{value}</option>)}</select></label><label>Difficulty<select value={difficulty} onChange={event => setDifficulty(event.target.value as typeof difficulty)}><option>easy</option><option>medium</option><option>hard</option></select></label><label>Language<select value={language} onChange={event => setLanguage(event.target.value as typeof language)}><option value="en">English</option><option value="mk">Macedonian</option></select></label><label>Topic (optional)<input value={topic} maxLength={160} onChange={event => setTopic(event.target.value)} placeholder="e.g. recursion" /></label></div>
        <button className="primary wide" disabled={busy || !ready.length || aiAvailable !== true} onClick={generate}><Sparkles size={17}/>{busy ? "Generating…" : `Generate ${kind}`}</button>
        <p className="privacy-note">{aiTestMode ? "Fixture mode sends no excerpts to an AI provider." : "Selected excerpts are sent to the configured AI provider. Generated answers may be wrong; check the cited source."}</p>
      </section>
      <section className="panel saved-panel"><div className="panel-title"><h3>Saved study sets</h3><span>{sets.length}</span></div>{sets.length ? sets.map(set => <button key={set.id} className="saved-set" onClick={() => onSet(set.id)}><span className="mini-icon"><Sparkles size={18}/></span><span><strong>{set.title}</strong><small>{set.kind} · {dateLabel(set.created_at)}</small></span><ChevronRight size={17}/></button>) : <div className="empty-small">Your generated quizzes and flashcards will live here.</div>}</section>
    </div>
  </div>;
}

function StudyPlayer({ client, userId, set, items, documents, locations, onBack, run }: { client: SupabaseClient; userId: string; set: StudySet; items: StudyItem[]; documents: Document[]; locations: ChunkLocation[]; onBack: () => void; run: (action: () => Promise<{ error?: { message: string } | null } | void>, message?: string) => Promise<void> }) {
  const [index, setIndex] = useState(0); const [answers, setAnswers] = useState<Record<string,string>>({}); const [revealed, setRevealed] = useState(false); const [finished, setFinished] = useState(false);
  const item = items[index];
  const score = items.filter(it => answers[it.id] === it.answer).length;
  async function openCitation(citation: Citation) { const location = locations.find(loc => loc.id === citation.chunk_id); const doc = documents.find(file => file.id === location?.document_id); if (!doc) { window.alert("The original source has been removed. Its quote is still shown here."); return; } const { data, error } = await client.storage.from("study-materials").createSignedUrl(doc.storage_path, 60); if (error || !data) { window.alert(error?.message || "Could not open source."); return; } window.open(data.signedUrl + (location?.page_number ? `#page=${location.page_number}` : ""), "_blank", "noopener,noreferrer"); }
  async function next() { if (index < items.length - 1) { setIndex(index + 1); setRevealed(false); return; } if (set.kind === "quiz") await run(async () => client.from("attempts").insert({ user_id: userId, set_id: set.id, answers, score, total: items.length }), "Attempt saved."); setFinished(true); }
  if (!items.length) return <div className="empty-card"><strong>No items found in this study set.</strong><button className="secondary" onClick={onBack}>Back to practice</button></div>;
  if (finished) return <div className="study-wrap"><button className="back-link" onClick={onBack}><ChevronLeft size={17}/> Back to practice</button><div className="panel result-card"><div className="eyebrow">SESSION COMPLETE</div><h2>{set.kind === "quiz" ? `${score} of ${items.length} correct` : "Nice work."}</h2><p>{set.kind === "quiz" ? "Review the missed questions and compare the explanations with the cited material." : "Return to these cards whenever you need a refresher."}</p><button className="primary" onClick={() => { setIndex(0); setAnswers({}); setFinished(false); setRevealed(false); }}>Study again</button></div>{set.kind === "quiz" && items.filter(it => answers[it.id] !== it.answer).map(it => <div className="panel review-item" key={it.id}><strong>{it.prompt}</strong><p>Your answer: {answers[it.id] || "No answer"}</p><p>Correct answer: {it.answer}</p><small>{it.explanation}</small></div>)}</div>;
  return <div className="study-wrap"><button className="back-link" onClick={onBack}><ChevronLeft size={17}/> Back to practice</button><div className="study-meta"><div><div className="eyebrow">{set.kind === "quiz" ? "PRACTICE QUIZ" : "FLASHCARD SESSION"}</div><h2>{set.title}</h2></div><span>{index + 1} / {items.length}</span></div><div className="progress-track"><span style={{ width: `${((index + 1) / items.length) * 100}%` }}/></div><div className="panel question-card"><span className="question-number">{set.kind === "quiz" ? `QUESTION ${index + 1}` : `CARD ${index + 1}`}</span><h3>{item.prompt}</h3>{set.kind === "quiz" ? <div className="options">{item.options.map(option => <button key={option} className={`${answers[item.id] === option ? "selected" : ""} ${revealed && option === item.answer ? "correct" : ""} ${revealed && answers[item.id] === option && option !== item.answer ? "incorrect" : ""}`} onClick={() => { if (!revealed) setAnswers({ ...answers, [item.id]: option }); }}>{option}</button>)}</div> : <button className="flip-card" onClick={() => setRevealed(!revealed)}>{revealed ? item.answer : "Tap to reveal answer"}</button>}{revealed && <div className="explanation"><strong>{set.kind === "quiz" ? answers[item.id] === item.answer ? "Correct" : "Answer" : "Explanation"}</strong><p>{set.kind === "quiz" ? `${item.answer}. ${item.explanation}` : item.explanation}</p><div className="citation-list">{item.citations.map((citation, n) => { const loc = locations.find(place => place.id === citation.chunk_id); const doc = documents.find(file => file.id === loc?.document_id); return <button key={n} className="citation" onClick={() => void openCitation(citation)}><FileText size={15}/><span>{doc?.display_name || "Source removed"}{loc?.page_number ? ` · p. ${loc.page_number}` : ""}<em>“{citation.quote}”</em></span></button>; })}</div></div>}</div><div className="study-controls">{set.kind === "quiz" && !revealed && <button className="secondary" disabled={!answers[item.id]} onClick={() => setRevealed(true)}>Check answer</button>}{set.kind === "flashcards" && revealed && <><button className="secondary" onClick={() => void run(async () => client.from("card_progress").upsert({ user_id: userId, item_id: item.id, state: "missed", updated_at: new Date().toISOString() }))}>Missed it</button><button className="secondary" onClick={() => void run(async () => client.from("card_progress").upsert({ user_id: userId, item_id: item.id, state: "remembered", updated_at: new Date().toISOString() }))}>Got it</button></>}<button className="primary" disabled={!revealed} onClick={() => void next()}>{index === items.length - 1 ? "Finish" : "Next"}<ChevronRight size={16}/></button></div><button className="flag-button" onClick={() => { const reason = window.prompt("What is wrong with this item?"); if (reason?.trim()) void run(async () => client.from("study_items").update({ flag_reason: reason.trim().slice(0, 300) }).eq("id", item.id), "Item flagged for review."); }}>Report an issue with this item</button></div>;
}

function SettingsView({ session, client, theme, setTheme }: { session: Session; client: SupabaseClient; theme: "light" | "dark"; setTheme: (theme: "light" | "dark") => void }) {
  return <>
    <div className="page-heading"><div><h1>Settings</h1><p>Adjust how your workspace looks and manage your account.</p></div></div>
    <div className="panel settings-panel"><h2>Appearance</h2><p>Choose a display mode. Your choice is saved in this browser.</p><div className="appearance-options" role="group" aria-label="Display mode"><button type="button" className={theme === "light" ? "active" : ""} aria-pressed={theme === "light"} onClick={() => setTheme("light")}><Sun size={18}/> Light</button><button type="button" className={theme === "dark" ? "active" : ""} aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}><Moon size={18}/> Dark</button></div></div>
    <div className="panel settings-panel"><h2>Account</h2><p>Signed in as <strong>{session.user.email}</strong></p><button className="secondary" onClick={() => void client.auth.signOut()}><LogOut size={16}/> Sign out</button></div>
    <div className="panel settings-panel"><h2>AI and your documents</h2><p>When you choose to generate practice, excerpts from your selected files are sent to the configured AI provider. Your files and saved study sets are private to your account.</p><p>Generated content may be incorrect. Check the source quotes before relying on an answer.</p></div>
    <div className="panel settings-panel"><h2>About Virgil</h2><p>Virgil is an independent student project and is not affiliated with FINKI. The SEIS23 course catalog is available.</p><Image className="about-photo" src="/assets/about-photo.png" alt="Virgil illustration" width={1448} height={1086} sizes="(max-width: 700px) 100vw, 420px" unoptimized/></div>
  </>;
}
