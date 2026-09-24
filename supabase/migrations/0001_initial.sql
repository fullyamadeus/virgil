-- Run with the Supabase SQL editor or CLI. All student data is private by default.
create extension if not exists pgcrypto;

create table public.terms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 2 and 80),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  unique (id, user_id)
);

create table public.courses (
  id uuid primary key,
  code text not null unique,
  name_mk text not null,
  source_url text not null,
  program_code text,
  recommended_semester integer,
  created_at timestamptz not null default now()
);

create table public.course_programs (
  course_id uuid not null references public.courses(id) on delete cascade,
  program_code text not null,
  recommended_semester integer,
  source_url text not null,
  primary key (course_id, program_code)
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  term_id uuid not null,
  course_id uuid not null references public.courses(id),
  created_at timestamptz not null default now(),
  foreign key (term_id, user_id) references public.terms(id, user_id) on delete cascade,
  unique (term_id, course_id),
  unique (id, user_id)
);

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid not null,
  parent_id uuid,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  foreign key (enrollment_id, user_id) references public.enrollments(id, user_id) on delete cascade,
  unique (id, enrollment_id, user_id),
  foreign key (parent_id, enrollment_id, user_id) references public.folders(id, enrollment_id, user_id) on delete cascade,
  check (id is distinct from parent_id)
);

create or replace function public.prevent_folder_cycle() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.parent_id is not null and exists (
    with recursive ancestors as (
      select id, parent_id from public.folders where id = new.parent_id
      union all
      select f.id, f.parent_id from public.folders f join ancestors a on f.id = a.parent_id
    ) select 1 from ancestors where id = new.id
  ) then raise exception 'A folder cannot be moved inside itself'; end if;
  return new;
end $$;
create trigger folders_no_cycle before insert or update of parent_id on public.folders
for each row execute function public.prevent_folder_cycle();

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid not null,
  folder_id uuid,
  filename text not null check (char_length(filename) between 1 and 200),
  storage_path text not null unique,
  mime_type text not null,
  byte_size integer not null check (byte_size > 0),
  status text not null default 'processing' check (status in ('processing','ready','failed')),
  error_message text,
  page_count integer,
  created_at timestamptz not null default now(),
  foreign key (enrollment_id, user_id) references public.enrollments(id, user_id) on delete cascade,
  foreign key (folder_id, enrollment_id, user_id) references public.folders(id, enrollment_id, user_id) on delete set null (folder_id),
  unique (id, enrollment_id, user_id)
);

create table public.source_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid not null,
  document_id uuid not null,
  page_number integer,
  chunk_index integer not null,
  content text not null,
  foreign key (document_id, enrollment_id, user_id) references public.documents(id, enrollment_id, user_id) on delete cascade,
  unique (document_id, chunk_index),
  unique (id, user_id)
);

create table public.study_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid not null,
  title text not null,
  kind text not null check (kind in ('quiz','flashcards')),
  language text not null check (language in ('en','mk')),
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  topic text,
  source_document_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  foreign key (enrollment_id, user_id) references public.enrollments(id, user_id) on delete cascade,
  unique (id, user_id)
);

create table public.study_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  set_id uuid not null,
  position integer not null,
  prompt text not null,
  options jsonb,
  answer text not null,
  explanation text not null,
  citations jsonb not null default '[]',
  flag_reason text,
  created_at timestamptz not null default now(),
  foreign key (set_id, user_id) references public.study_sets(id, user_id) on delete cascade,
  unique (set_id, position),
  unique (id, user_id)
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  set_id uuid not null,
  answers jsonb not null default '{}',
  score integer not null default 0,
  total integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (set_id, user_id) references public.study_sets(id, user_id) on delete cascade
);

create table public.card_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null,
  state text not null check (state in ('remembered','missed')),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id),
  foreign key (item_id, user_id) references public.study_items(id, user_id) on delete cascade
);

create table public.archive_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid not null,
  title text not null check (char_length(title) between 1 and 160),
  url text not null,
  exam_year integer,
  exam_type text,
  created_at timestamptz not null default now(),
  foreign key (enrollment_id, user_id) references public.enrollments(id, user_id) on delete cascade
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid,
  title text not null check (char_length(title) between 1 and 160),
  kind text not null check (kind in ('exam','assignment','personal')),
  all_day boolean not null,
  on_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (enrollment_id, user_id) references public.enrollments(id, user_id) on delete set null (enrollment_id),
  check ((all_day and on_date is not null and starts_at is null) or (not all_day and on_date is null and starts_at is not null)),
  check (ends_at is null or ends_at >= starts_at)
);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid not null,
  request_key uuid not null,
  status text not null default 'running' check (status in ('running','done','failed')),
  set_id uuid,
  input_tokens integer,
  output_tokens integer,
  error_message text,
  created_at timestamptz not null default now(),
  foreign key (enrollment_id, user_id) references public.enrollments(id, user_id) on delete cascade,
  foreign key (set_id, user_id) references public.study_sets(id, user_id),
  unique (user_id, request_key)
);

create index documents_enrollment_idx on public.documents(enrollment_id);
create index chunks_document_idx on public.source_chunks(document_id);
create index events_user_date_idx on public.events(user_id, on_date, starts_at);
create index sets_enrollment_idx on public.study_sets(enrollment_id, created_at desc);
create index jobs_user_date_idx on public.generation_jobs(user_id, created_at desc);
create unique index one_running_generation_per_user on public.generation_jobs(user_id) where status = 'running';

alter table public.terms enable row level security;
alter table public.courses enable row level security;
alter table public.course_programs enable row level security;
alter table public.enrollments enable row level security;
alter table public.folders enable row level security;
alter table public.documents enable row level security;
alter table public.source_chunks enable row level security;
alter table public.study_sets enable row level security;
alter table public.study_items enable row level security;
alter table public.attempts enable row level security;
alter table public.card_progress enable row level security;
alter table public.archive_links enable row level security;
alter table public.events enable row level security;
alter table public.generation_jobs enable row level security;

revoke all on all tables in schema public from anon;
grant select on public.courses to anon, authenticated;
grant select on public.course_programs to anon, authenticated;
grant select, insert, update, delete on public.terms, public.enrollments, public.folders,
  public.documents, public.source_chunks, public.study_sets, public.study_items,
  public.attempts, public.card_progress, public.archive_links, public.events,
  public.generation_jobs to authenticated;

create policy courses_read on public.courses for select to anon, authenticated using (true);
create policy course_programs_read on public.course_programs for select to anon, authenticated using (true);

do $$ declare table_name text; begin
  foreach table_name in array array[
    'terms','enrollments','folders','documents','source_chunks','study_sets',
    'study_items','attempts','card_progress','archive_links','events','generation_jobs'
  ] loop
    execute format('create policy own_select on public.%I for select to authenticated using (user_id = (select auth.uid()))', table_name);
    execute format('create policy own_insert on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', table_name);
    execute format('create policy own_update on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', table_name);
    execute format('create policy own_delete on public.%I for delete to authenticated using (user_id = (select auth.uid()))', table_name);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('study-materials', 'study-materials', false, 12582912,
  array['application/pdf','text/plain']) on conflict (id) do nothing;

create policy study_upload on storage.objects for insert to authenticated
with check (bucket_id = 'study-materials' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy study_read on storage.objects for select to authenticated
using (bucket_id = 'study-materials' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy study_delete on storage.objects for delete to authenticated
using (bucket_id = 'study-materials' and (storage.foldername(name))[1] = (select auth.uid())::text);
