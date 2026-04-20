-- CVibe 초기 스키마
-- research.md §7.4 데이터 모델 기반
-- 모든 테이블에 RLS 적용: 학생=자기 것만, 교사=담당 cohort만

set check_function_bodies = off;

-- =============================================================================
-- 확장
-- =============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "vector";  -- KC 지식 그래프 RAG용 (research.md §7.1)

-- =============================================================================
-- 열거 타입
-- =============================================================================

create type public.user_role as enum ('student', 'teacher', 'admin');

create type public.interaction_mode as enum ('silent', 'observer', 'pair', 'tutor');

create type public.intervention_level as enum ('weak', 'medium', 'strong');

create type public.submission_status as enum (
  'draft', 'submitted', 'evaluating', 'passed', 'failed', 'needs_review'
);

-- =============================================================================
-- 코호트 (학급 단위)
-- =============================================================================

create table public.cohorts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  term text not null,               -- 예: "2026-Spring"
  teacher_id uuid not null,         -- students 테이블 생성 후 FK 추가 (순환 의존)
  created_at timestamptz not null default now()
);

comment on table public.cohorts is '학급(코호트) — 교사가 관리하는 학생 그룹 단위';

-- =============================================================================
-- 학생·교사 (공용 users 뷰는 Supabase Auth 이용)
-- =============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role public.user_role not null,
  display_name text,
  cohort_id uuid references public.cohorts(id) on delete set null,
  created_at timestamptz not null default now(),
  last_active_at timestamptz
);

comment on table public.profiles is '학생·교사 프로필 — auth.users 확장';

create index idx_profiles_cohort on public.profiles(cohort_id);
create index idx_profiles_role on public.profiles(role);

alter table public.cohorts
  add constraint cohorts_teacher_fk
  foreign key (teacher_id) references public.profiles(id) on delete restrict;

-- =============================================================================
-- 과제 (Problem Architect 산출물)
-- =============================================================================

create table public.assignments (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,            -- 예: "A03_arrays_basic"
  version integer not null default 1,
  title text not null,
  template text not null,
  kc_tags jsonb not null default '[]',
  difficulty integer not null check (difficulty between 1 and 5),
  rubric jsonb not null,                -- {correctness: 0.5, style: 0.15, ...}
  constraints jsonb not null default '{}',
  starter_code text,
  visible_tests jsonb not null default '[]',
  reflection_prompts jsonb not null default '[]',
  cohort_id uuid references public.cohorts(id) on delete cascade,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.assignments.rubric is
  'research.md §6.1: correctness 0.5 / style 0.15 / memory_safety 0.2 / reflection 0.15 — 총합 1.0 유지';

create index idx_assignments_cohort on public.assignments(cohort_id);
create index idx_assignments_active on public.assignments(active) where active = true;

-- 과제 변형 (variants) — 학생마다 다른 파라미터 배정
create table public.assignment_variants (
  id uuid primary key default uuid_generate_v4(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  variant_code text not null,           -- 예: "A03_v1"
  params jsonb not null,                -- {N: 5, seed: 42, ...}
  hidden_tests jsonb not null,          -- 학생 경로에 절대 노출되지 않음
  reference_solution_path text,         -- _workspace/private/ 경로
  created_at timestamptz not null default now(),
  unique(assignment_id, variant_code)
);

comment on column public.assignment_variants.reference_solution_path is
  'Safety Guard에 registerProtected()로 등록된 파일 경로. 학생 경로 에이전트 접근 금지.';

-- =============================================================================
-- 제출물 (Assessment 채점 대상)
-- =============================================================================

create table public.submissions (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id),
  variant_id uuid references public.assignment_variants(id),
  code text not null,
  reflection jsonb not null default '{}',
  status public.submission_status not null default 'draft',
  rubric_scores jsonb,                  -- {correctness, style, memory_safety, reflection}
  final_score numeric(5,4),             -- 0.0000 ~ 1.0000
  evidence jsonb,                       -- evidence[].lineRanges
  kc_delta jsonb,                       -- {pointer-arithmetic: +0.08, ...}
  dependency_factor numeric(5,4),       -- 교사 전용, finalScore 반영 금지
  teacher_only_notes text,
  submitted_at timestamptz,
  evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_submissions_student on public.submissions(student_id);
create index idx_submissions_assignment on public.submissions(assignment_id);
create index idx_submissions_status on public.submissions(status);
create index idx_submissions_submitted_at on public.submissions(submitted_at desc);

comment on column public.submissions.dependency_factor is
  'research.md §6.3 — AI 의존도 0~1. 최종 점수 감점 금지, 교사 대시보드 전용.';

-- =============================================================================
-- 대화 로그 (에이전트 ↔ 학생 interaction)
-- =============================================================================

create table public.conversations (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  assignment_id uuid references public.assignments(id),
  messages jsonb not null default '[]',
  mode public.interaction_mode not null default 'pair',
  support_level smallint not null default 0 check (support_level between 0 and 3),
  session_state jsonb,                  -- research.md §5.4 SessionState
  started_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index idx_conversations_student on public.conversations(student_id);
create index idx_conversations_assignment on public.conversations(assignment_id);
create index idx_conversations_last_msg on public.conversations(last_message_at desc);

-- =============================================================================
-- KC 숙련도 (Student Modeler 출력)
-- =============================================================================

create table public.mastery (
  student_id uuid not null references public.profiles(id) on delete cascade,
  kc text not null,                     -- 예: "pointer-arithmetic"
  value numeric(5,4) not null check (value between 0 and 1),
  confidence numeric(5,4) not null default 0 check (confidence between 0 and 1),
  observations integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (student_id, kc)
);

comment on table public.mastery is
  'KC별 학생 숙련도 + confidence. |delta| ≤ 0.15 상한, observations 누적.';

create index idx_mastery_kc on public.mastery(kc);
create index idx_mastery_low_confidence on public.mastery(student_id) where confidence < 0.3;

-- =============================================================================
-- 오개념 (반복 오류 패턴)
-- =============================================================================

create table public.misconceptions (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  kc text not null,
  pattern text not null,
  occurrences integer not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create index idx_misconceptions_student_kc on public.misconceptions(student_id, kc);

-- =============================================================================
-- xAPI 이벤트 스트림 (research.md §4.4)
-- =============================================================================

create table public.events (
  id bigserial primary key,
  actor jsonb not null,                 -- { account: { name: "learner_042" } }
  verb jsonb not null,                  -- { id: "https://cvibe.app/verbs/..." }
  object jsonb not null,
  result jsonb,
  context jsonb,
  student_id uuid references public.profiles(id) on delete cascade,
  assignment_id uuid references public.assignments(id),
  timestamp timestamptz not null default now()
);

create index idx_events_student_ts on public.events(student_id, timestamp desc);
create index idx_events_assignment_ts on public.events(assignment_id, timestamp desc);
create index idx_events_verb on public.events((verb->>'id'));

comment on table public.events is
  'research.md §4.4 — xAPI 표준 스테이트먼트. PII는 learner ID로 해시 치환.';

-- =============================================================================
-- 교사 개입 기록 (Teacher Copilot + 수동)
-- =============================================================================

create table public.interventions (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id),
  type text not null,                   -- "mode_change", "direct_hint", "message", "difficulty_patch"
  level public.intervention_level,
  payload jsonb not null default '{}',
  reasons jsonb,                        -- Teacher Copilot 권고 근거
  applied boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_interventions_student on public.interventions(student_id, created_at desc);
create index idx_interventions_teacher on public.interventions(teacher_id, created_at desc);

-- =============================================================================
-- updated_at 자동 갱신 트리거
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_assignments_updated_at
  before update on public.assignments
  for each row execute function public.set_updated_at();

create trigger trg_submissions_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security (RLS) — research.md §7.4 핵심 요구사항
-- =============================================================================

-- 헬퍼: 현재 사용자의 role·cohort_id 조회
create or replace function public.current_role()
returns public.user_role language sql stable as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_cohort_id()
returns uuid language sql stable as $$
  select cohort_id from public.profiles where id = auth.uid();
$$;

create or replace function public.teaches_cohort(c_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.cohorts
    where id = c_id and teacher_id = auth.uid()
  );
$$;

-- profiles
alter table public.profiles enable row level security;

create policy "본인 프로필 읽기" on public.profiles
  for select using (id = auth.uid());
create policy "교사는 담당 cohort 학생 프로필 읽기" on public.profiles
  for select using (
    public.current_role() = 'teacher'
    and cohort_id in (select id from public.cohorts where teacher_id = auth.uid())
  );
create policy "본인 프로필 수정" on public.profiles
  for update using (id = auth.uid());

-- cohorts
alter table public.cohorts enable row level security;
create policy "본인 소속 코호트 읽기" on public.cohorts
  for select using (id = public.current_cohort_id() or teacher_id = auth.uid());
create policy "교사만 코호트 생성·수정" on public.cohorts
  for all using (public.current_role() in ('teacher', 'admin'))
  with check (public.current_role() in ('teacher', 'admin'));

-- assignments
alter table public.assignments enable row level security;
create policy "학생은 자기 cohort 활성 과제 읽기" on public.assignments
  for select using (
    active = true
    and (cohort_id = public.current_cohort_id() or cohort_id is null)
  );
create policy "교사는 본인 생성 과제 전체 관리" on public.assignments
  for all using (created_by = auth.uid() or public.teaches_cohort(cohort_id))
  with check (public.current_role() in ('teacher', 'admin'));

-- assignment_variants — reference_solution_path 노출 방지: 학생은 variant 자체를 볼 수 없음
alter table public.assignment_variants enable row level security;
create policy "교사만 variants 접근" on public.assignment_variants
  for all using (
    exists (
      select 1 from public.assignments a
      where a.id = assignment_id
      and (a.created_by = auth.uid() or public.teaches_cohort(a.cohort_id))
    )
  );

-- submissions
alter table public.submissions enable row level security;
create policy "학생은 본인 제출물만" on public.submissions
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "교사는 담당 cohort 제출물 읽기" on public.submissions
  for select using (
    public.current_role() = 'teacher'
    and student_id in (
      select p.id from public.profiles p
      where p.cohort_id in (select id from public.cohorts where teacher_id = auth.uid())
    )
  );

-- conversations
alter table public.conversations enable row level security;
create policy "학생은 본인 대화만" on public.conversations
  for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "교사는 담당 cohort 대화 읽기" on public.conversations
  for select using (
    public.current_role() = 'teacher'
    and student_id in (
      select p.id from public.profiles p
      where p.cohort_id in (select id from public.cohorts where teacher_id = auth.uid())
    )
  );

-- mastery
alter table public.mastery enable row level security;
create policy "학생은 본인 mastery만 읽기" on public.mastery
  for select using (student_id = auth.uid());
create policy "교사는 담당 cohort mastery 읽기" on public.mastery
  for select using (
    public.current_role() = 'teacher'
    and student_id in (
      select p.id from public.profiles p
      where p.cohort_id in (select id from public.cohorts where teacher_id = auth.uid())
    )
  );
-- mastery 쓰기는 service_role만 (Student Modeler 배치) — RLS 정책 미부여로 일반 사용자 차단

-- misconceptions — 교사만 조회, 학생 UI 노출 금지 (research.md §5 낙인 방지)
alter table public.misconceptions enable row level security;
create policy "교사만 misconceptions 조회" on public.misconceptions
  for select using (
    public.current_role() = 'teacher'
    and student_id in (
      select p.id from public.profiles p
      where p.cohort_id in (select id from public.cohorts where teacher_id = auth.uid())
    )
  );

-- events — 학생 본인 이벤트 읽기 가능, 교사는 cohort 단위
alter table public.events enable row level security;
create policy "학생 본인 이벤트 읽기" on public.events
  for select using (student_id = auth.uid());
create policy "교사는 담당 cohort 이벤트 읽기" on public.events
  for select using (
    public.current_role() = 'teacher'
    and student_id in (
      select p.id from public.profiles p
      where p.cohort_id in (select id from public.cohorts where teacher_id = auth.uid())
    )
  );
-- events 쓰기는 service_role만 (에이전트 서버 경로에서 기록)

-- interventions
alter table public.interventions enable row level security;
create policy "학생은 본인 개입 내역만 읽기" on public.interventions
  for select using (student_id = auth.uid());
create policy "교사는 본인이 수행한 개입 관리" on public.interventions
  for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- =============================================================================
-- Realtime (교사 대시보드 SSE 대응)
-- =============================================================================

-- 주의: ALTER PUBLICATION은 Supabase에서 이미 존재. 채널별 활성화는 UI에서 설정.
-- 대시보드 Live Code Stream·Progress Overview에 사용되는 테이블:
-- submissions, conversations, events, interventions
