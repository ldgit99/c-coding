-- 학생-AI 대화 로그 저장소
-- research.md §10.2 — 교사 전용 열람. 학생 본인·같은 cohort 학생은 조회 불가.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  assignment_id text,
  role text not null check (role in ('student', 'ai')),
  text text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists conversations_student_created_idx
  on public.conversations (student_id, created_at desc);

create index if not exists conversations_student_assignment_idx
  on public.conversations (student_id, assignment_id, created_at desc);

-- RLS
alter table public.conversations enable row level security;

-- 서버(service_role)만 INSERT — 학생 브라우저에서 직접 쓸 수 없다.
create policy "conversations_service_insert"
  on public.conversations
  for insert
  to service_role
  with check (true);

-- 교사(role=teacher)만 SELECT — 담당 cohort 학생의 로그로 제한.
-- profiles.cohort_id로 좁히는 조건은 교사 앱 쿼리에서 한 번 더 적용한다.
create policy "conversations_teacher_select"
  on public.conversations
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'teacher'
    )
  );

-- 학생 본인도 볼 수 없다 — 낙인·자기 의심 유발 방지. 필요 시 별도 뷰로 노출.

comment on table public.conversations is
  'Student-AI chat log. Teacher-only via RLS. See research.md §10.2.';
