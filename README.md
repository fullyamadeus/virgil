# Virgil

Virgil is a study workspace for organizing courses, semesters, lectures, books, links, and uploaded materials. It is meant as a tool for a student to orginize his courses. In its calendar a student can add dates for assignments, exams, review sessions, recurring lectures and labs, and exam weeks in month and week views.

## Run locally

### Requirements

- Node.js 20.9 or newer
- npm
- The Supabase project URL and publishable key supplied by the project owner
- An OpenAI API key if you need live AI quiz and flashcard generation

### Setup

1. Clone the repository and enter its directory:

   ```bash
   git clone <repository-url>
   cd virgil
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Create your local environment file:

   ```bash
   cp .env.example .env.local
   ```

4. Open `.env.local` and paste the Supabase values sent to you by the project owner:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key
   ```

   Use the Supabase publishable key (or legacy anon key), never a secret or service-role key. These values connect the app to the existing hosted database, so you do not need to create, migrate, or seed your own database; each user can sign up with a separate account and row-level security keeps their data private.

5. To enable live AI-generated quizzes and flashcards, add your own OpenAI API key to `.env.local`:

   ```env
   OPENAI_API_KEY=your-openai-api-key
   ```

   Keep this key private and never commit `.env.local`. If you do not have an OpenAI API key, leave `OPENAI_API_KEY` empty and set `AI_TEST_MODE=true` to use the clearly labelled deterministic test generator.

6. Start the app:

   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000), choose **Sign up**, and create an account. If email confirmation is enabled for the shared Supabase project, confirm the message sent to your email before signing in.

### Useful commands

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

The files in `supabase/migrations/` and `supabase/seed.sql` are kept as the ordered database history for maintaining or recreating the shared backend. A developer using the shared Supabase URL and key does not need to run them.
