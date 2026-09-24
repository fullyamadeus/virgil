-- Verified subset from https://finki.ukim.mk/program/SIIS23/
insert into public.courses (id, code, name_mk, source_url, program_code, recommended_semester) values
('4cf05bf0-fded-4e5f-95f5-c23bd478d511','F23L1W020','Структурно програмирање','https://finki.ukim.mk/program/SIIS23/','SIIS23',1),
('a41ce541-2efa-4c8f-886c-3374abbcb033','F23L2W001','Алгоритми и податочни структури','https://finki.ukim.mk/program/SIIS23/','SIIS23',3),
('667e46ee-5150-4ce9-bb7f-4300a7b4202f','F23L3W004','Бази на податоци','https://finki.ukim.mk/program/SIIS23/','SIIS23',5)
on conflict (id) do nothing;

insert into public.course_programs (course_id, program_code, recommended_semester, source_url)
select id, 'SIIS23', recommended_semester, 'https://finki.ukim.mk/program/SIIS23/'
from public.courses where code in ('F23L1W020','F23L2W001','F23L3W004')
on conflict (course_id, program_code) do nothing;
