-- SEIS23 course names from https://oldsite.finki.ukim.mk/program/SEIS23/en
-- Codes and semesters are retained internally to deduplicate courses and preserve catalog ordering.
with catalog(code, name, semester) as (values
('F23L1W004','Sport and Health',1),
('F23L1W005','Business and Management',1),
('F23L1W007','Introduction to computer science',1),
('F23L1W018','Professional skills',1),
('F23L1W020','Structured programming',1),
('F23L2W002','Mathematics 1',1),
('F23L1S003','Computer Architecture and Organization',2),
('F23L1S016','Object-oriented programming',2),
('F23L2S001','Mathematics 2',2),
('F23L2S015','Object-oriented analysis and design',2),
('F23L2W001','Algorithms and data structures',3),
('F23L2W014','Computer Networks and Security',3),
('F23L3W001','Mathematics 3',3),
('F23L2S002','Software requirements analysis',4),
('F23L2S017','Operating systems',4),
('F23L2S030','Artificial Intelligence',4),
('F23L3S100','Business practice',4),
('F23L3W004','Databases',5),
('F23L3W008','Introduction to data science',5),
('F23L3W009','Software design and architecture',5),
('F23L3W140','Advanced programming',5),
('F23L3S010','Human-computer interaction design',6),
('F23L3S012','System Integration',6),
('F23L3S019','Software quality and testing',6),
('F23L3S138','Advanced databases',6),
('F23L3W021','Team project',7),
('F23L3S022','ICT Projects Management',8),
('F23L3S028','Entrepreneurship',8),
('F23L3S168','Diploma thesis',8),
('F23L1S052','E-learning',2),
('F23L1S116','Computer components',2),
('F23L1S120','Creative skills for problem solving',2),
('F23L1S146','Fundamentals of Web design',2),
('F23L2S066','Cybersecurity fundamentals',2),
('F23L1S026','Marketing',4),
('F23L2S042','Electrical Circuits',4),
('F23L2S051','Computational thinking in education',4),
('F23L2S061','Wireless and mobile systems',4),
('F23L2S082','Visual Programming',4),
('F23L2S084','Introduction to Ecoinformatics',4),
('F23L2S090','Introduction to random processes',4),
('F23L2S095','Digital image processing',4),
('F23L2S097','Algorithm design',4),
('F23L2S099','E-government',4),
('F23L2S110','Internet technologies',4),
('F23L2S114','Computer graphics',4),
('F23L2S119','Concepts of information society',4),
('F23L2S124','Media and communication',4),
('F23L2S164','Information theory and digital communication',4),
('F23L2W006','Probability and statistics',3),
('F23L2W055','Multimedia technologies',3),
('F23L2W067','Foundations of Information Theory',3),
('F23L2W096','Digitization',3),
('F23L2W100','Economy for ICT engineers',3),
('F23L2W104','Mathematics for engineers',3),
('F23L2W109','Client-side internet programming',3),
('F23L2W147','Fundamentals of communication systems',3),
('F23L2W165','Technical support management',3),
('F23L2W167','User Interface Design Patterns',3),
('F23L3S025','E-commerce',6),
('F23L3S036','Machine learning',6),
('F23L3S039','Basics of theory of computing',6),
('F23L3S040','Embedded microprocessor systems',6),
('F23L3S047','Signal processing',6),
('F23L3S057','Working with gifted students',6),
('F23L3S059','Network administration',6),
('F23L3S062','Virtualization',6),
('F23L3S071','Psychology of school age students',6),
('F23L3S073','Agent-based systems',6),
('F23L3S087','Introduction to network science',6),
('F23L3S091','Geographic Information Systems',6),
('F23L3S093','Digital forensics',6),
('F23L3S094','Digital libraries',6),
('F23L3S113','Computer Animation',6),
('F23L3S115','Computer sounds, music and speech',6),
('F23L3S118','Continuous integration and delivery',6),
('F23L3S122','Cryptography',6),
('F23L3S125','Measurements and analysis of Internet traffic',6),
('F23L3S135','Multimedia systems',6),
('F23L3S149','Parallel programming',6),
('F23L3S150','Data Mining',6),
('F23L3S153','AI for Games',6),
('F23L3S155','Service-oriented architectures',6),
('F23L3S157','Data warehouses and analytics',6),
('F23L3S159','Software defined security',6),
('F23L3S163','Automated machine learning',6),
('F23L3S166','Distance learning',6),
('F23L3S054','Methods in teaching informatics',8),
('F23L3S063','Computer network design',8),
('F23L3S069','Adaptive and Interactive Web Information Systems',8),
('F23L3S070','Macedonian language',8),
('F23L3S078','Biologically inspired computing',8),
('F23L3S080','Web search systems',8),
('F23L3S083','Virtual Reality',8),
('F23L3S086','Introduction to cognitive sciences',8),
('F23L3S101','Ethical hacking',8),
('F23L3S102','ICT for development',8),
('F23L3S106','Deep learning for knowledge discovery',8),
('F23L3S107','Intelligent Systems',8),
('F23L3S111','Infrastructural programming',8),
('F23L3S112','Programming languages and compilers',8),
('F23L3S127','Mobile applications',8),
('F23L3S130','Business process modeling and management',8),
('F23L3S131','Modeling and simulation',8),
('F23L3S132','Modern trends in robotics',8),
('F23L3S139','Web3 applications',8),
('F23L3S141','Unstructured databases',8),
('F23L3S144','Operations research',8),
('F23L3S160','Software defined networks',8),
('F23L3S162','Crowd-sourcing and human computing',8),
('F23L3W024','Web programming',5),
('F23L3W035','Linear algebra and Applications',5),
('F23L3W037','Parallel and distributed processing',5),
('F23L3W043','Information security',5),
('F23L3W044','Computer electronics',5),
('F23L3W050','Educational Software Design',5),
('F23L3W053','Computer ethics',5),
('F23L3W056','Personalized learning',5),
('F23L3W060','System administration',5),
('F23L3W065','Cybersecurity',5),
('F23L3W081','Visualization',5),
('F23L3W134','Multimedia networks',5),
('F23L3W136','Advanced Web Design',5),
('F23L3W142','Natural language understanding and generation',5),
('F23L3W148','Introduction to robotics',5),
('F23L3W158','Modern Computer Architectures',5),
('F23L3W161','Graph theory and social media',5),
('F23L3W027','Management Information Systems',7),
('F23L3W038','Programming paradigms',7),
('F23L3W048','Software for Embedded Systems',7),
('F23L3W064','Distributed systems',7),
('F23L3W068','Cloud computing',7),
('F23L3W072','Autonomous robotics',7),
('F23L3W074','Database administration',7),
('F23L3W075','Analysis and design of IS',7),
('F23L3W076','Introduction to time series analysis',7),
('F23L3W079','Web Based Systems',7),
('F23L3W085','Introduction to bioinformatics',7),
('F23L3W088','Introduction to Smart Cities',7),
('F23L3W089','Introduction to pattern recognition',7),
('F23L3W092','Digital Postproduction',7),
('F23L3W098','Distributed data storage',7),
('F23L3W103','Implementation of free and open source software systems',7),
('F23L3W105','Innovations in ICT',7),
('F23L3W108','Internet of things',7),
('F23L3W117','Computer Aided Manufacturing',7),
('F23L3W121','Blockchains and crypto currencies',7),
('F23L3W123','Machine Vision',7),
('F23L3W126','Research methodologies in ICT',7),
('F23L3W128','Mobile information systems',7),
('F23L3W129','Mobile platforms and programming',7),
('F23L3W133','Network and mobile forensics',7),
('F23L3W137','Advanced human-computer interaction',7),
('F23L3W145','Optical networks',7),
('F23L3W152','Video Games Programming',7),
('F23L3W154','Introduction to mining massive dataset',7),
('F23L3W156','Decision support systems',7),
('F23L3W162','Quantum computing',7),
('F23L3W200','Sensor systems',7)
)
insert into public.courses (id, code, name_mk, source_url, program_code, recommended_semester)
select gen_random_uuid(), code, name, 'https://oldsite.finki.ukim.mk/program/SEIS23/en', 'SEIS23', semester
from catalog
on conflict (code) do update set name_mk = excluded.name_mk;

insert into public.course_programs (course_id, program_code, recommended_semester, source_url)
select id, 'SEIS23', recommended_semester, 'https://oldsite.finki.ukim.mk/program/SEIS23/en'
from public.courses where code in (
  select code from public.courses where source_url = 'https://oldsite.finki.ukim.mk/program/SEIS23/en' or code in ('F23L1W020','F23L2W001','F23L3W004')
)
on conflict (course_id, program_code) do update set recommended_semester = excluded.recommended_semester;

create table public.lectures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid not null,
  title text not null check (char_length(title) between 1 and 160),
  lecture_date date not null,
  notes text,
  document_id uuid,
  created_at timestamptz not null default now(),
  foreign key (enrollment_id, user_id) references public.enrollments(id, user_id) on delete cascade,
  foreign key (document_id, enrollment_id, user_id) references public.documents(id, enrollment_id, user_id) on delete set null (document_id)
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  storage_path text not null unique,
  byte_size integer not null check (byte_size > 0 and byte_size <= 52428800),
  created_at timestamptz not null default now(),
  foreign key (enrollment_id, user_id) references public.enrollments(id, user_id) on delete cascade
);

create index lectures_enrollment_idx on public.lectures(enrollment_id, lecture_date);
create index books_enrollment_idx on public.books(enrollment_id);
alter table public.lectures enable row level security;
alter table public.books enable row level security;
grant select, insert, update, delete on public.lectures, public.books to authenticated;

create policy lectures_own_select on public.lectures for select to authenticated using (user_id = (select auth.uid()));
create policy lectures_own_insert on public.lectures for insert to authenticated with check (user_id = (select auth.uid()));
create policy lectures_own_update on public.lectures for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy lectures_own_delete on public.lectures for delete to authenticated using (user_id = (select auth.uid()));
create policy books_own_select on public.books for select to authenticated using (user_id = (select auth.uid()));
create policy books_own_insert on public.books for insert to authenticated with check (user_id = (select auth.uid()));
create policy books_own_update on public.books for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy books_own_delete on public.books for delete to authenticated using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-books', 'course-books', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;
create policy book_upload on storage.objects for insert to authenticated
with check (bucket_id = 'course-books' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy book_read on storage.objects for select to authenticated
using (bucket_id = 'course-books' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy book_delete on storage.objects for delete to authenticated
using (bucket_id = 'course-books' and (storage.foldername(name))[1] = (select auth.uid())::text);
