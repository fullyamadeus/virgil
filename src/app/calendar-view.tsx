"use client";

import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { skopjeDateKey, skopjeLocalToUtc } from "@/lib/time";
import { classDateBounds, recurringClassVisible } from "@/lib/calendar";
import { textOnColor } from "@/lib/course-colors";

export type Term = { id: string; label: string; starts_on: string; ends_on: string };
export type Course = { id: string; name_mk: string };
export type Enrollment = { id: string; term_id: string; course_id: string; color: string };
export type Event = { id: string; enrollment_id: string | null; title: string; kind: "exam" | "assignment" | "review_session" | "lecture" | "lab"; all_day: boolean; on_date: string | null; starts_at: string | null; ends_at: string | null; completed: boolean };
export type TimetableEntry = { id: string; term_id: string; enrollment_id: string; weekday: number; starts_at: string; ends_at: string; kind: "lecture" | "lab" };
export type ExamWeek = { id: string; term_id: string; starts_on: string; ends_on: string };
type Run = (action: () => Promise<{ error?: { message: string } | null } | void>, message?: string) => Promise<void>;
type Slot = { starts_at: string; ends_at: string; kind: "lecture" | "lab" };
const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const defaultSlot = (): Slot => ({ starts_at: "09:00", ends_at: "10:30", kind: "lecture" });
const shortTime = (time: string) => time.slice(0, 5);
const isoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const mondayOf = (date: Date) => addDays(date, -((date.getDay() + 6) % 7));
const eventDate = (event: Event) => event.all_day ? event.on_date || "" : event.starts_at || "";
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Skopje" }).format(new Date(value));
const localTime = (value: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Skopje" }).format(new Date(value));

export default function CalendarView({ client, userId, terms, termId, setTermId, enrollments, courses, events, timetable, examWeeks, month, setMonth, run, busy }: {
  client: SupabaseClient; userId: string; terms: Term[]; termId: string | null; setTermId: (id: string) => void;
  enrollments: Enrollment[]; courses: Course[]; events: Event[]; timetable: TimetableEntry[];
  examWeeks: ExamWeek[]; month: Date; setMonth: (month: Date) => void; run: Run; busy: boolean;
}) {
  const [view, setView] = useState<"month" | "week">("month");
  const [editing, setEditing] = useState<Event | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Event["kind"]>("exam");
  const [allDay, setAllDay] = useState(true);
  const [date, setDate] = useState(() => skopjeDateKey(new Date()));
  const [time, setTime] = useState("12:00");
  const [endTime, setEndTime] = useState("13:30");
  const [course, setCourse] = useState("");
  const [dialog, setDialog] = useState<"schedule" | "examWeek" | null>(null);
  const [scheduleCourse, setScheduleCourse] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [slots, setSlots] = useState<Record<number, Slot>>({});
  const [editingSlot, setEditingSlot] = useState<TimetableEntry | null>(null);
  const [editDay, setEditDay] = useState(1);
  const [editSlot, setEditSlot] = useState<Slot>(defaultSlot);
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");

  const term = terms.find(item => item.id === termId);
  const termEnrollments = enrollments.filter(item => item.term_id === termId);
  const termTimetable = timetable.filter(item => item.term_id === termId);
  const weeks = examWeeks.filter(item => item.term_id === termId).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  const visibleEvents = events.filter(item => !item.enrollment_id || termEnrollments.some(enrollment => enrollment.id === item.enrollment_id));
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const leading = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: leading + daysInMonth }, (_, index) => index < leading ? null : index - leading + 1);
  const weekMonday = mondayOf(month);
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekMonday, index));
  const heading = view === "month"
    ? new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(month)
    : `${dateLabel(isoDay(weekMonday) + "T12:00:00")} – ${dateLabel(isoDay(addDays(weekMonday, 6)) + "T12:00:00")}`;
  const upcoming = visibleEvents.filter(item => !item.completed && (item.all_day ? (item.on_date || "") >= skopjeDateKey(new Date()) : (item.starts_at || "") >= new Date().toISOString())).sort((a, b) => eventDate(a).localeCompare(eventDate(b))).slice(0, 6);
  const courseName = (enrollmentId: string) => courses.find(item => item.id === enrollments.find(enrollment => enrollment.id === enrollmentId)?.course_id)?.name_mk || "Course";
  const courseColor = (enrollmentId: string | null) => enrollments.find(item => item.id === enrollmentId)?.color;
  const eventStyle = (item: Event) => { const color = courseColor(item.enrollment_id); return color ? { backgroundColor: color, color: textOnColor(color) } : undefined; };
  const eventsFor = (iso: string) => visibleEvents.filter(item => item.all_day ? item.on_date === iso : item.starts_at && skopjeDateKey(item.starts_at) === iso);

  function edit(item: Event) { setEditing(item); setTitle(item.title); setKind(item.kind); setAllDay(item.all_day); setDate(item.all_day ? item.on_date || skopjeDateKey(new Date()) : skopjeDateKey(item.starts_at || new Date())); setTime(item.starts_at ? localTime(item.starts_at) : "12:00"); setEndTime(item.ends_at ? localTime(item.ends_at) : "13:30"); setCourse(item.enrollment_id || ""); }
  function resetEvent() { setEditing(null); setTitle(""); setCourse(""); setKind("exam"); setAllDay(true); }
  async function saveEvent(event: FormEvent) {
    event.preventDefault();
    let startsAtUtc: string | null; let endsAtUtc: string | null;
    try { startsAtUtc = allDay ? null : skopjeLocalToUtc(date, time); endsAtUtc = allDay ? null : skopjeLocalToUtc(date, endTime); if (startsAtUtc && endsAtUtc && endsAtUtc <= startsAtUtc) throw new Error("End time must be after start time."); } catch (error) { window.alert(error instanceof Error ? error.message : "Invalid time."); return; }
    await run(async () => {
      const row = { user_id: userId, enrollment_id: course || null, title: title.trim(), kind, all_day: allDay, on_date: allDay ? date : null, starts_at: startsAtUtc, ends_at: endsAtUtc };
      const result = editing ? await client.from("events").update(row).eq("id", editing.id) : await client.from("events").insert(row);
      if (!result.error) resetEvent();
      return result;
    }, editing ? "Event updated." : "Event added.");
  }

  function openSchedule() { setScheduleCourse(termEnrollments[0]?.id || ""); setSelectedDays([]); setSlots({}); setDialog("schedule"); }
  async function saveSchedule(event: FormEvent) {
    event.preventDefault();
    if (!term || !scheduleCourse || !selectedDays.length) { window.alert("Choose a course and at least one weekday."); return; }
    if (selectedDays.some(day => !slots[day]?.starts_at || !slots[day]?.ends_at || slots[day].ends_at <= slots[day].starts_at)) { window.alert("Each class must end after it starts."); return; }
    await run(async () => {
      const rows = selectedDays.map(weekday => ({ user_id: userId, term_id: term.id, enrollment_id: scheduleCourse, weekday, ...slots[weekday] }));
      const result = await client.from("course_timetable").insert(rows);
      if (!result.error) setDialog(null);
      return result;
    }, "Weekly classes added.");
  }
  function openEditSlot(item: TimetableEntry) { setEditingSlot(item); setEditDay(item.weekday); setEditSlot({ starts_at: shortTime(item.starts_at), ends_at: shortTime(item.ends_at), kind: item.kind }); }
  async function saveEditedSlot(event: FormEvent) {
    event.preventDefault();
    if (!editingSlot || editSlot.ends_at <= editSlot.starts_at) { window.alert("End time must be after start time."); return; }
    await run(async () => {
      const result = await client.from("course_timetable").update({ weekday: editDay, ...editSlot }).eq("id", editingSlot.id);
      if (!result.error) setEditingSlot(null);
      return result;
    }, "Class time updated.");
  }
  async function saveExamWeek(event: FormEvent) {
    event.preventDefault();
    if (!term || weeks.length >= 3) return;
    if (weekStart < term.starts_on || weekEnd > term.ends_on || weekEnd < weekStart) { window.alert("Choose a date range inside this semester."); return; }
    await run(async () => {
      const result = await client.from("exam_weeks").insert({ user_id: userId, term_id: term.id, starts_on: weekStart, ends_on: weekEnd });
      if (!result.error) { setDialog(null); setWeekStart(""); setWeekEnd(""); }
      return result;
    }, "Exam week added.");
  }
  async function editSemesterDates() {
    if (!term) return;
    const start = window.prompt("Semester start (YYYY-MM-DD)", term.starts_on)?.trim();
    if (!start) return;
    const end = window.prompt("Semester end (YYYY-MM-DD)", term.ends_on)?.trim();
    if (!end) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start || weeks.some(week => week.starts_on < start || week.ends_on > end)) { window.alert("Enter valid dates that include existing exam weeks."); return; }
    await run(async () => client.from("terms").update({ starts_on: start, ends_on: end }).eq("id", term.id), "Semester dates updated.");
  }
  function move(direction: number) { setMonth(view === "month" ? new Date(month.getFullYear(), month.getMonth() + direction, 1) : addDays(month, direction * 7)); }
  function renderEvent(item: Event, compact = false) { return <button key={item.id} className={`calendar-event ${item.kind}`} style={eventStyle(item)} onClick={() => edit(item)} title={item.enrollment_id ? `${item.title} · ${courseName(item.enrollment_id)}` : item.title}>{!compact && !item.all_day && `${localTime(item.starts_at!)} `}{item.title}{(item.enrollment_id || !compact) && <small>{compact ? courseName(item.enrollment_id!) : `${item.kind === "review_session" ? "Review Session" : item.kind}${item.enrollment_id ? ` · ${courseName(item.enrollment_id)}` : ""}`}</small>}</button>; }

  return <>
    <div className="page-heading calendar-heading"><div><h1>Calendar</h1><p>Events, weekly classes, and exam weeks.</p></div><div className="button-row"><button className="secondary" disabled={!term || !termEnrollments.length} onClick={openSchedule}><Plus size={16}/> Weekly timetable</button><button className="secondary" disabled={!term || weeks.length >= 3} onClick={() => setDialog("examWeek")}><Plus size={16}/> Exam week</button></div></div>
    <div className="toolbar"><div><label className="field-label">Semester</label><select value={termId || ""} disabled={!terms.length} onChange={event => { setTermId(event.target.value); const next = terms.find(item => item.id === event.target.value); if (next) setMonth(new Date(`${next.starts_on}T12:00:00`)); }}>{terms.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>{term && <><small className="term-range">{term.starts_on} to {term.ends_on}</small><button className="text-button term-edit" onClick={() => void editSemesterDates()}>Edit dates</button></>}</div>
    {view === "week" && term && <div className="hint-strip calendar-rule">Regular classes run {classDateBounds(term).starts_on} to {classDateBounds(term).ends_on}. They pause during exam weeks and stop at the second exam week.</div>}
    <div className="calendar-layout"><section className="panel calendar-panel"><div className="calendar-header"><h2>{heading}</h2><div className="calendar-header-actions"><div className="segmented"><button className={view === "month" ? "active" : ""} onClick={() => setView("month")}>Month</button><button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>Week</button></div><button className="icon-button" aria-label={`Previous ${view}`} onClick={() => move(-1)}><ChevronLeft size={18}/></button><button className="icon-button" aria-label={`Next ${view}`} onClick={() => move(1)}><ChevronRight size={18}/></button></div></div>
      {view === "month" ? <div className="calendar-grid">{weekdays.map(day => <div className="week-label" key={day}>{day.slice(0, 3)}</div>)}{cells.map((day, index) => {
        const iso = day ? `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
        const week = weeks.find(item => item.starts_on <= iso && iso <= item.ends_on);
        const dayEvents = eventsFor(iso);
        const weekday = day ? (new Date(month.getFullYear(), month.getMonth(), day).getDay() + 6) % 7 + 1 : 0;
        const classes = term && recurringClassVisible(iso, term, weeks)
          ? termTimetable.filter(item => item.weekday === weekday).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
          : [];
        return <div className={`day-cell ${!day ? "blank" : ""} ${week ? "exam-week-cell" : ""}`} key={index}>{day && <>
          <button className={`day-number ${iso === skopjeDateKey(new Date()) ? "today" : ""}`} onClick={() => { setMonth(new Date(`${iso}T12:00:00`)); setView("week"); }}>{day}</button>
          {week && <span className="exam-week-label">Exam week {weeks.indexOf(week) + 1}</span>}
          {classes.length > 0 && <div className="month-course-list">{classes.map(item => <button key={item.id} className={`calendar-event recurring-class month-recurring-class ${item.kind === "lab" ? "lab-class" : ""}`} style={{ backgroundColor: courseColor(item.enrollment_id), color: textOnColor(courseColor(item.enrollment_id) || "#2764C5") }} onClick={() => openEditSlot(item)} title={`${courseName(item.enrollment_id)} · ${item.kind}`}><strong><span className="month-class-name">{courseName(item.enrollment_id)}</span>{item.kind === "lab" && <span className="lab-badge">LAB</span>}</strong></button>)}</div>}
          {dayEvents.slice(0, 3).map(item => renderEvent(item, true))}
          {dayEvents.length > 3 && <small>+{dayEvents.length - 3} more events</small>}
        </>}</div>;
      })}</div> :
        <div className="week-grid">{weekDates.map((day, index) => { const iso = isoDay(day); const week = weeks.find(item => item.starts_on <= iso && iso <= item.ends_on); const dayEvents = eventsFor(iso); const classes = term && recurringClassVisible(iso, term, weeks) ? termTimetable.filter(item => item.weekday === index + 1) : []; const entries = [...dayEvents.map(item => ({ type: "event" as const, time: item.all_day ? "" : localTime(item.starts_at!), item })), ...classes.map(item => ({ type: "class" as const, time: shortTime(item.starts_at), item }))].sort((a, b) => a.time.localeCompare(b.time)); return <div className={`week-day ${week ? "exam-week-cell" : ""}`} key={iso}><div className="week-day-heading"><strong>{weekdays[index]}</strong><span className={iso === skopjeDateKey(new Date()) ? "today" : ""}>{day.getDate()}</span></div>{week && <span className="exam-week-label">Exam week {weeks.indexOf(week) + 1}</span>}<div className="week-day-entries">{entries.map(entry => entry.type === "event" ? renderEvent(entry.item) : <button key={entry.item.id} className={`calendar-event recurring-class ${entry.item.kind === "lab" ? "lab-class" : ""}`} style={{ backgroundColor: courseColor(entry.item.enrollment_id), color: textOnColor(courseColor(entry.item.enrollment_id) || "#28796D") }} onClick={() => openEditSlot(entry.item)}><strong>{courseName(entry.item.enrollment_id)} {entry.item.kind === "lab" && <span className="lab-badge">LAB</span>}</strong><small>{shortTime(entry.item.starts_at)}–{shortTime(entry.item.ends_at)}</small></button>)}</div></div>; })}</div>}
    </section><aside className="calendar-side"><section className="panel"><div className="eyebrow">ADD TO CALENDAR</div><h3>{editing ? "Edit event" : "New event"}</h3><form className="stack-form" onSubmit={saveEvent}><label>Title<input value={title} onChange={event => setTitle(event.target.value)} maxLength={160} required placeholder="e.g. Algorithms midterm"/></label><label>Type<select value={kind} onChange={event => setKind(event.target.value as Event["kind"])}><option value="exam">Exam</option><option value="assignment">Assignment</option><option value="review_session">Review Session</option><option value="lecture">Lecture</option><option value="lab">Lab</option></select></label><label>Course (optional)<select value={course} onChange={event => setCourse(event.target.value)}><option value="">No course</option>{termEnrollments.map(item => <option key={item.id} value={item.id}>{courseName(item.id)}</option>)}</select></label><label className="checkbox-row"><input type="checkbox" checked={allDay} onChange={event => setAllDay(event.target.checked)}/> All-day event</label><label>Date<input type="date" value={date} onChange={event => setDate(event.target.value)} required/></label>{!allDay && <div className="form-grid"><label>Starts · Skopje<input type="time" value={time} onChange={event => setTime(event.target.value)} required/></label><label>Ends · Skopje<input type="time" value={endTime} onChange={event => setEndTime(event.target.value)} required/></label></div>}<div className="button-row"><button className="primary" disabled={busy}>{editing ? "Save changes" : "Add event"}</button>{editing && <button type="button" className="secondary" onClick={resetEvent}>Cancel</button>}</div></form></section><section className="panel"><div className="panel-title"><h3>Coming up</h3><span>{upcoming.length}</span></div>{upcoming.length ? upcoming.map(item => <div className="upcoming-row" key={item.id}><span className="event-marker" style={{ backgroundColor: courseColor(item.enrollment_id) }}/><div><strong>{item.title}</strong><small>{item.kind === "review_session" ? "Review Session" : item.kind} · {item.all_day ? item.on_date : dateLabel(item.starts_at!)}</small></div>{item.kind === "assignment" && <button title="Mark complete" className="icon-button" onClick={() => void run(async () => client.from("events").update({ completed: !item.completed }).eq("id", item.id))}>○</button>}<button title="Delete event" className="icon-button danger" onClick={() => { if (window.confirm(`Delete ${item.title}?`)) void run(async () => client.from("events").delete().eq("id", item.id)); }}><Trash2 size={15}/></button></div>) : <div className="empty-small">Nothing coming up yet.</div>}</section></aside></div>
    {term && <div className="calendar-management">{view === "week" && <section className="panel"><div className="panel-title"><h3>Weekly timetable</h3><span>{termTimetable.length} slots</span></div>{termEnrollments.filter(item => termTimetable.some(slot => slot.enrollment_id === item.id)).map(enrollment => <div className="schedule-group" key={enrollment.id}><h4><span className="schedule-color" style={{ backgroundColor: enrollment.color }}/>{courseName(enrollment.id)}</h4>{termTimetable.filter(item => item.enrollment_id === enrollment.id).sort((a, b) => a.weekday - b.weekday || a.starts_at.localeCompare(b.starts_at)).map(item => <div className="schedule-row" key={item.id}><span><small>{weekdays[item.weekday - 1]} · {shortTime(item.starts_at)}–{shortTime(item.ends_at)} · {item.kind === "lab" ? "Lab" : "Lecture"}</small></span><button className="icon-button" aria-label="Edit class time" onClick={() => openEditSlot(item)}><Pencil size={15}/></button><button className="icon-button danger" aria-label="Delete class time" onClick={() => { if (window.confirm("Delete this weekly class time?")) void run(async () => client.from("course_timetable").delete().eq("id", item.id)); }}><Trash2 size={15}/></button></div>)}</div>)}{!termTimetable.length && <div className="empty-small">Add a course and its regular class times.</div>}</section>}<section className="panel"><div className="panel-title"><h3>Exam weeks</h3><span>{weeks.length} / 3</span></div>{weeks.length ? weeks.map((week, index) => <div className="schedule-row" key={week.id}><CalendarDays size={18}/><span><strong>Exam week {index + 1}</strong><small>{week.starts_on} to {week.ends_on}</small></span><button className="icon-button danger" aria-label={`Delete exam week ${index + 1}`} onClick={() => { if (window.confirm("Delete this exam week?")) void run(async () => client.from("exam_weeks").delete().eq("id", week.id)); }}><Trash2 size={15}/></button></div>) : <div className="empty-small">No exam weeks for this semester.</div>}</section></div>}
    {dialog && <div className="modal-backdrop" onClick={() => setDialog(null)}><div className="modal" onClick={event => event.stopPropagation()}><div className="modal-head"><h2>{dialog === "schedule" ? "Add weekly classes" : "Add exam week"}</h2><button className="icon-button" aria-label="Close" onClick={() => setDialog(null)}><X size={19}/></button></div>{dialog === "schedule" ? <form className="stack-form" onSubmit={saveSchedule}><label>Course<select required value={scheduleCourse} onChange={event => setScheduleCourse(event.target.value)}>{termEnrollments.map(item => <option key={item.id} value={item.id}>{courseName(item.id)}</option>)}</select></label><fieldset className="weekday-picker"><legend>Days of the week</legend>{weekdays.slice(0, 6).map((day, index) => <label key={day}><input type="checkbox" checked={selectedDays.includes(index + 1)} onChange={event => { const number = index + 1; setSelectedDays(current => event.target.checked ? [...current, number].sort() : current.filter(value => value !== number)); if (event.target.checked) setSlots(current => ({ ...current, [number]: current[number] || defaultSlot() })); }}/>{day}</label>)}</fieldset>{selectedDays.map(day => <div className="schedule-day-form" key={day}><h4>{weekdays[day - 1]}</h4><div className="form-grid"><label>Starts<input type="time" required value={slots[day]?.starts_at || "09:00"} onChange={event => setSlots(current => ({ ...current, [day]: { ...current[day], starts_at: event.target.value } }))}/></label><label>Ends<input type="time" required value={slots[day]?.ends_at || "10:30"} onChange={event => setSlots(current => ({ ...current, [day]: { ...current[day], ends_at: event.target.value } }))}/></label><label>Type<select value={slots[day]?.kind || "lecture"} onChange={event => setSlots(current => ({ ...current, [day]: { ...current[day], kind: event.target.value as Slot["kind"] } }))}><option value="lecture">Lecture</option><option value="lab">Lab</option></select></label></div></div>)}<button className="primary" disabled={busy || !selectedDays.length}>Add weekly classes</button></form> : <form className="stack-form" onSubmit={saveExamWeek}><p>Recurring classes pause during exam weeks. You can add up to three per semester.</p><div className="form-grid"><label>Starts<input type="date" required min={term?.starts_on} max={term?.ends_on} value={weekStart} onChange={event => setWeekStart(event.target.value)}/></label><label>Ends<input type="date" required min={term?.starts_on} max={term?.ends_on} value={weekEnd} onChange={event => setWeekEnd(event.target.value)}/></label></div><button className="primary" disabled={busy}>Add exam week</button></form>}</div></div>}
    {editingSlot && <div className="modal-backdrop" onClick={() => setEditingSlot(null)}><div className="modal" onClick={event => event.stopPropagation()}><div className="modal-head"><h2>Edit {courseName(editingSlot.enrollment_id)} class</h2><button className="icon-button" aria-label="Close" onClick={() => setEditingSlot(null)}><X size={19}/></button></div><form className="stack-form" onSubmit={saveEditedSlot}><label>Day<select value={editDay} onChange={event => setEditDay(Number(event.target.value))}>{weekdays.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></label><div className="form-grid"><label>Starts<input type="time" required value={editSlot.starts_at} onChange={event => setEditSlot(current => ({ ...current, starts_at: event.target.value }))}/></label><label>Ends<input type="time" required value={editSlot.ends_at} onChange={event => setEditSlot(current => ({ ...current, ends_at: event.target.value }))}/></label></div><label>Type<select value={editSlot.kind} onChange={event => setEditSlot(current => ({ ...current, kind: event.target.value as Slot["kind"] }))}><option value="lecture">Lecture</option><option value="lab">Lab</option></select></label><button className="primary" disabled={busy}>Save changes</button></form></div></div>}
  </>;
}
