-- 에디터 자동 저장 (drafts) — 제출 전 학생 코드 보존
-- "하나도 놓치지 않는다" 운영 원칙. 새로고침·세션 끊김에도 복구 가능.
-- (student_id, assignment_id) 가 PK 복합 — 학생당 과제 1개의 가장 최근 draft 만 유지.
-- 제출(submissions 테이블 INSERT) 시 draft 는 보존 — 별도 housekeeping 으로 정리.

create table if not exists public.drafts (
  student_id uuid not null references public.profiles(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  code text not null default '',
  updated_at timestamptz not null default now(),
  primary key (student_id, assignment_id)
);

create index if not exists drafts_student_updated_idx
  on public.drafts (student_id, updated_at desc);

-- RLS
alter table public.drafts enable row level security;

-- service_role 은 모든 행 (학생 본인 토큰으로는 student_id == auth.uid() 매칭만 허용).
create policy if not exists "drafts_service_all"
  on public.drafts
  for all
  to service_role
  using (true)
  with check (true);

-- 학생 본인만 SELECT (자기 draft 복구 시).
create policy if not exists "drafts_student_select_own"
  on public.drafts
  for select
  to authenticated
  using (auth.uid() = student_id);

-- 학생 본인만 INSERT/UPDATE (자기 draft 자동 저장 시).
create policy if not exists "drafts_student_upsert_own"
  on public.drafts
  for insert
  to authenticated
  with check (auth.uid() = student_id);

create policy if not exists "drafts_student_update_own"
  on public.drafts
  for update
  to authenticated
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

comment on table public.drafts is
  '학생 에디터 코드 자동 저장 — 제출 전 작업 손실 방지. PK = (student_id, assignment_id).';
