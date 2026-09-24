# FINKI Study App — implementation prompt

Copy everything below into a new coding chat with access to the project folder.

---

Act as my product-minded full-stack engineer. Build a working MVP of a study web app for students at FINKI, the Faculty of Computer Science and Engineering in Skopje. Working name: Virgil. This is an independent student project, not an official faculty service.

Start by inspecting the repository and any project instructions. Preserve existing work and use an established stack if one exists. If the repository is empty, scaffold the application. Give me a brief implementation plan, then start coding in the same turn. Make reasonable, reversible implementation decisions; ask only about genuinely blocking choices. Do not stop after producing a plan or a static UI.

## Product and scope

The app brings together a student's current courses, personal study material, links to past exams, AI-generated practice, and deadlines. Its central workflow is:

Select a course → upload a lecture PDF → generate a quiz or flashcards from selected material → study with source references → revisit missed questions before an exam.

Build for a small pilot with 5–10 students and 2–3 courses. The data model should support more courses later. Prioritize a complete, reliable study workflow over breadth. Do not train a model or attempt to reproduce all of NotebookLM.

## Recommended implementation

For an empty repository, use Next.js App Router, TypeScript, Tailwind, and Supabase for PostgreSQL, authentication, and private file storage. This is a default, not a requirement to rewrite existing code. Check current official documentation for dependencies you use, choose compatible stable versions, and include a lockfile.

Keep one application with straightforward server-side modules for file processing and AI generation. Use one configurable AI provider behind a small adapter; choose it based on available credentials and document the choice. Keep provider credentials server-side. Avoid microservices, a separate vector database, or a complex agent framework in the MVP.

Use local Supabase if the environment supports it, or a configured development project. If credentials or infrastructure are missing, continue with migrations, implementation, and clearly marked fixtures for development; explain the exact remaining setup. Never silently replace persistence or live AI with mock behavior and call the feature complete.

## MVP requirements

### 1. Accounts, semesters, and courses

- Implement sign-in and persistent private accounts using the chosen auth provider. Do not require university SSO.
- Let students create/select an academic term and select courses from a searchable catalog.
- Seed a small verified subset from official FINKI program pages. Preserve Macedonian names, course codes, source URLs, and curriculum/program information where available. Label catalog coverage clearly; do not invent a complete catalog. Add a simple seed/import mechanism for expanding it.
- Use stable internal course IDs. Allow a course to appear in multiple programs or semesters without duplicating its identity. A student's enrollment in a term is separate from the catalog course.
- Selecting a course creates a private workspace for that student and term. Support returning to older terms.

### 2. Materials and folders

- Each course workspace supports folders/subfolders and upload, rename, move, and delete operations. Validate ownership and prevent folder cycles or cross-course parent references.
- Initially support text-based PDF and TXT files, with configurable size/page limits enforced on the server. Defer slides, Word documents, handwriting, and OCR.
- Store files privately; persist metadata, extracted text, and source locations. Show processing, ready, and failed states with useful errors and retry where appropriate.
- For PDFs, preserve actual page numbers. Detect documents with little usable text and explain that scanned pages are not yet supported. Do not silently generate from unreadable or truncated content.
- Let users open/download their original files. Make deletion remove the corresponding stored content and define what happens to study sets whose sources are deleted.

### 3. AI study workflow

- The student explicitly selects ready materials, output type, question/card count, difficulty, optional topic, and output language: Macedonian or English.
- Generate multiple-choice quizzes and question/answer flashcards using only the selected content. Do not mix in other courses or users' documents.
- Each item includes its answer, an explanation where appropriate, and references to stored source IDs, page/section locations, and a supporting excerpt. Allow opening the cited location or viewing the excerpt.
- Extract documents once, then use bounded source chunks with retained provenance. For large selections, ask the student to narrow the scope or use an explicit chunk-selection strategy; disclose coverage. Do not resend an entire course library on every request.
- Validate structured output, source IDs, locations, and excerpt correspondence on the server. Check that multiple-choice answers are well formed. Citation existence is not proof of factual correctness: label generated material, allow reporting/editing/deleting bad items, and avoid unsupported answer claims.
- If an exam lacks solutions or the selected material cannot support an answer, do not invent an authoritative answer key. Explain the limitation or omit that question.
- Treat uploaded text as untrusted source data, not as instructions to the application. Safely render generated text and code snippets.
- Implement a usable quiz player with scoring and missed-question review, plus flip-style flashcards with remembered/missed controls. Persist generated sets, attempts, and progress across refreshes.
- Make generation explicit and bounded: configurable per-user quotas, concurrency limits, token/input limits, timeouts, and limited retries. Prevent duplicate submission from causing duplicate paid work. Record provider usage when available.
- If no AI credential is configured, show an honest unavailable state. Any fixture mode must be explicit and separate from live generation.

### 4. FINKI ARHIVA

ARHIVA is described as a large Google Drive archive of past exams and tests. Its actual URL, permissions, structure, and suitability for automated ingestion are not yet verified. Do not invent its contents or assume access.

- In the MVP, provide a course-associated archive area for saved Google Drive file/folder links, with title, optional year/exam type, and an “Open in Drive” action. Keep personal bookmarks private.
- Allow students to manually associate links with courses. Do not assume matching filenames establish the correct curriculum or course.
- Label links as external; do not imply that linked content has been imported, indexed, or made available to AI. AI initially uses explicitly uploaded material.
- Keep full Drive browsing, synchronization, and AI ingestion as a later milestone. Document the missing archive URL/access details. Before implementing that milestone, verify permitted access and reuse, API scopes, file restrictions, and handling of revoked access. Do not mirror the archive or bypass permissions.

### 5. Calendar and dashboard

- Add a calendar and upcoming-events list. Students can create, edit, and delete exams, assignments, and personal events; optionally link them to a course and mark assignments complete.
- Support both all-day dates and timed events correctly. Default the timezone to Europe/Skopje and preserve timezone-aware behavior.
- The dashboard shows current courses, upcoming deadlines, and recent study sets with a clear way to resume studying.
- Keep dates manually entered initially. Defer university schedule scraping, Google Calendar sync, recurring events, and push/email reminders.

## UX and data quality

Create a calm, polished, responsive study workspace that works on a phone and laptop. Use clear navigation for Dashboard, Courses, Calendar, and Settings; inside a course, expose Materials, Practice, and Archive. Include accessible controls, keyboard operation, and meaningful loading, empty, and error states. Avoid fake statistics and decorative features that delay the study workflow.

Keep interface strings ready for localization, preserve Cyrillic throughout storage/search/display, and implement the interface in English initially. Source material and generated practice must support Macedonian and English. Display code clearly; never execute uploaded code. Treat flashcards as concept review, not a replacement for programming exercises or mathematical problem solving.

Use migrations and a compact relational model covering accounts/profiles, terms, catalog courses, enrollments, folders, documents/source chunks, study sets/items, attempts/progress, archive bookmarks, calendar events, and generation usage/jobs as needed. Avoid speculative tables.

Enforce account isolation for database records, file access, source retrieval, generation, and nested ownership references. With Supabase, implement appropriate grants and row-level policies for both application data and storage. Never expose privileged keys in the client. Explain in the UI when selected material is sent to an external AI provider.

## Implementation order and verification

1. Scaffold the app, persistence, authentication, course selection, and course workspaces.
2. Complete one real end-to-end path: upload a small PDF → extract text → generate a cited quiz → answer it → save and reopen the result.
3. Add flashcards, folder organization, archive bookmarks, and calendar/dashboard integration.
4. Complete relevant checks and setup documentation.

Use meaningful automated checks for account isolation, document-processing failures, invalid AI output/citations, quiz scoring/persistence, and calendar date handling. Include an end-to-end smoke test of the main study workflow with an explicit deterministic test provider; verify live AI separately when credentials are available. Manually inspect desktop and mobile layouts if browser tools are available. Do not claim a live integration was verified using only mocks.

Provide a README, `.env.example` without secrets, database migrations, seed instructions, commands to run/test/build, and a concise list of verified behavior and remaining limitations. Document how to measure API usage/cost without promising a particular free tier or inventing costs.

The MVP is ready for a pilot when a student can select courses, organize uploaded material, generate and revisit cited practice, open saved archive links, and manage deadlines with data preserved across sessions—and a second account cannot access that student's private data.

Defer full archive synchronization, OCR, AI chat, audio/video generation, automatic grading of code or proofs, advanced spaced repetition, social features, payments, native apps, and university-system integrations.

Start now with repository inspection, a short plan, and implementation of the first working study path. Continue through the scoped MVP as the environment permits; report genuine blockers precisely and complete independent work while blocked.
