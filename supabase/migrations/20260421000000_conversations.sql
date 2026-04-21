-- 대화 로그 — turn-level로 재설계
-- research.md §10.2 + 이터레이션 14(2026-04-21) — 교사 전용 열람.
-- 초기 마이그레이션(20260420)의 session-level conversations 테이블을 교체한다:
-- row = 1 turn (student 발화 또는 AI 응답) 이어야 Paper 3 Cognitive Offloading
-- 분석과 /api/analytics/dump 스키마가 맞는다.

-- 기존 session-level 테이블 제거 (RLS·인덱스 함께 cascade).
drop table if exists public.conversations cascade;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  assignment_id text,                    -- seed code ("A01_hello_variables") 또는 null
  role text not null check (role in ('student', 'ai')),
  text text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index conversations_student_created_idx
  on public.conversations (student_id, created_at desc);

create index conversations_student_assignment_idx
  on public.conversations (student_id, assignment_id, created_at desc);

-- RLS
alter table public.conversations enable row level security;

-- 서버(service_role)만 INSERT — 학생 브라우저에서 직접 쓸 수 없다.
create policy "conversations_service_insert"
  on public.conversations
  for insert
  to service_role
  with check (true);

-- 교사(role=teacher)만 SELECT.
-- cohort 범위 좁힘은 교사 앱 쿼리에서 한 번 더 적용한다.
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

comment on table public.conversations is
  'Student-AI chat log (turn-level). Teacher-only via RLS. See research.md §10.2.';
