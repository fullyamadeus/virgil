-- Replace the original palette while preserving each existing course's assigned hue.
alter table public.enrollments drop constraint enrollments_color_palette;
update public.enrollments set color = case color
  when '#28796D' then '#1B8B5A'
  when '#4169A8' then '#2764C5'
  when '#8D5AA8' then '#7C3DBB'
  when '#B65C69' then '#E63946'
  when '#A66B35' then '#795548'
  when '#4A7890' then '#ED7A22'
  when '#6B7F3A' then '#D8B400'
  when '#A34F88' then '#6D163A'
  else color end;
alter table public.enrollments alter column color set default '#2764C5';
alter table public.enrollments add constraint enrollments_color_palette
  check (color in ('#2764C5','#E63946','#7C3DBB','#1B8B5A','#795548',
                  '#ED7A22','#D8B400','#6D163A','#D35A9B','#A97816'));

-- Existing personal events become review sessions.
alter table public.events drop constraint events_kind_check;
update public.events set kind = 'review_session' where kind = 'personal';
alter table public.events add constraint events_kind_check
  check (kind in ('exam','assignment','review_session','lecture','lab'));
