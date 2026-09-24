-- Organize course resources and semester calendar rules.
alter table public.documents add column display_name text;
alter table public.documents add column material_kind text not null default 'other'
  check (material_kind in ('past_exam', 'single_question', 'study_guide', 'other', 'lecture'));
alter table public.documents add column exam_date date;
alter table public.documents add constraint documents_exam_date_kind
  check ((material_kind = 'past_exam' and exam_date is not null) or (material_kind <> 'past_exam' and exam_date is null));
update public.documents set display_name = filename where display_name is null;
alter table public.documents alter column display_name set not null;
alter table public.documents add constraint documents_display_name_length check (char_length(display_name) between 1 and 200);

create table public.material_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid not null,
  folder_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  url text not null check (url ~* '^https?://[^[:space:]]+$'),
  material_kind text not null check (material_kind in ('past_exam', 'single_question', 'study_guide', 'other')),
  exam_date date,
  created_at timestamptz not null default now(),
  foreign key (enrollment_id, user_id) references public.enrollments(id, user_id) on delete cascade,
  foreign key (folder_id, enrollment_id, user_id) references public.folders(id, enrollment_id, user_id) on delete set null (folder_id),
  check ((material_kind = 'past_exam' and exam_date is not null) or (material_kind <> 'past_exam' and exam_date is null))
);
create index material_links_enrollment_idx on public.material_links(enrollment_id);
alter table public.material_links enable row level security;
grant select, insert, update, delete on public.material_links to authenticated;
create policy material_links_own_select on public.material_links for select to authenticated using (user_id = (select auth.uid()));
create policy material_links_own_insert on public.material_links for insert to authenticated with check (user_id = (select auth.uid()));
create policy material_links_own_update on public.material_links for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy material_links_own_delete on public.material_links for delete to authenticated using (user_id = (select auth.uid()));

-- Keep previously saved archive bookmarks visible after the Archive tab is removed.
insert into public.material_links (id, user_id, enrollment_id, title, url, material_kind)
select id, user_id, enrollment_id, title, url, 'other' from public.archive_links
on conflict (id) do nothing;

alter table public.events drop constraint events_kind_check;
alter table public.events add constraint events_kind_check
  check (kind in ('exam', 'assignment', 'personal', 'lecture', 'lab'));

alter table public.enrollments add constraint enrollments_id_term_user_unique unique (id, term_id, user_id);

create table public.course_timetable (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  term_id uuid not null,
  enrollment_id uuid not null,
  weekday integer not null check (weekday between 1 and 7),
  starts_at time not null,
  ends_at time not null,
  ends_on date not null,
  kind text not null default 'lecture' check (kind in ('lecture', 'lab')),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  foreign key (term_id, user_id) references public.terms(id, user_id) on delete cascade,
  foreign key (enrollment_id, term_id, user_id) references public.enrollments(id, term_id, user_id) on delete cascade,
  check (ends_at > starts_at)
);
create index course_timetable_term_idx on public.course_timetable(term_id, weekday);
alter table public.course_timetable enable row level security;
grant select, insert, update, delete on public.course_timetable to authenticated;
create policy course_timetable_own_select on public.course_timetable for select to authenticated using (user_id = (select auth.uid()));
create policy course_timetable_own_insert on public.course_timetable for insert to authenticated with check (user_id = (select auth.uid()));
create policy course_timetable_own_update on public.course_timetable for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy course_timetable_own_delete on public.course_timetable for delete to authenticated using (user_id = (select auth.uid()));

create table public.exam_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  term_id uuid not null,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  foreign key (term_id, user_id) references public.terms(id, user_id) on delete cascade,
  check (ends_on >= starts_on)
);
create index exam_weeks_term_idx on public.exam_weeks(term_id, starts_on);
alter table public.exam_weeks enable row level security;
grant select, insert, update, delete on public.exam_weeks to authenticated;
create policy exam_weeks_own_select on public.exam_weeks for select to authenticated using (user_id = (select auth.uid()));
create policy exam_weeks_own_insert on public.exam_weeks for insert to authenticated with check (user_id = (select auth.uid()));
create policy exam_weeks_own_update on public.exam_weeks for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy exam_weeks_own_delete on public.exam_weeks for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.check_exam_week() returns trigger
language plpgsql set search_path = public as $$
declare term_start date; term_end date;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.term_id::text, 0));
  select starts_on, ends_on into term_start, term_end from public.terms
  where id = new.term_id and user_id = new.user_id;
  if term_start is null or new.starts_on < term_start or new.ends_on > term_end then
    raise exception 'Exam week must be within the selected semester';
  end if;
  if (select count(*) from public.exam_weeks where term_id = new.term_id and id <> new.id) >= 3 then
    raise exception 'A semester can have at most three exam weeks';
  end if;
  if exists (select 1 from public.exam_weeks where term_id = new.term_id and id <> new.id
    and daterange(starts_on, ends_on, '[]') && daterange(new.starts_on, new.ends_on, '[]')) then
    raise exception 'Exam weeks cannot overlap';
  end if;
  return new;
end $$;
create trigger exam_weeks_check before insert or update on public.exam_weeks
for each row execute function public.check_exam_week();

create or replace function public.check_timetable_end() returns trigger
language plpgsql set search_path = public as $$
declare term_start date; term_end date;
begin
  select starts_on, ends_on into term_start, term_end from public.terms
  where id = new.term_id and user_id = new.user_id;
  if term_start is null or new.ends_on < term_start or new.ends_on > term_end then
    raise exception 'Last class date must be within the selected semester';
  end if;
  return new;
end $$;
create trigger timetable_end_check before insert or update on public.course_timetable
for each row execute function public.check_timetable_end();
