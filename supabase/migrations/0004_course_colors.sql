-- A course has one color across its timetable entries and calendar events.
alter table public.enrollments add column color text not null default '#28796D';

with ranked as (
  select id, row_number() over (partition by term_id order by created_at, id) - 1 as position
  from public.enrollments
)
update public.enrollments e
set color = (array['#28796D','#4169A8','#8D5AA8','#B65C69','#A66B35','#4A7890','#6B7F3A','#A34F88'])[ranked.position % 8 + 1]
from ranked where e.id = ranked.id;

alter table public.enrollments add constraint enrollments_color_palette
check (color in ('#28796D','#4169A8','#8D5AA8','#B65C69','#A66B35','#4A7890','#6B7F3A','#A34F88'));

-- The color and end date are derived from the enrollment and semester season.
drop trigger timetable_end_check on public.course_timetable;
drop function public.check_timetable_end();
alter table public.course_timetable drop column color;
alter table public.course_timetable drop column ends_on;
