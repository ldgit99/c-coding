-- conversations.assignment_id 를 text(코드) → uuid(FK) 로 정합화.
-- submissions/drafts/events 와 동일한 타입을 갖게 해 통합 timeline 분석을
-- 단일 JOIN 으로 가능하게 만든다.
--
-- 기존 데이터 마이그레이션:
--   1) 새 컬럼 assignment_uuid uuid 추가.
--   2) assignment_id(text=code) 를 assignments.code 와 매칭해 id 복사.
--   3) 기존 컬럼 드롭 후 새 컬럼 이름 swap.
--
-- 이미 적용된 환경에서 두 번 돌려도 안전하도록 가드한다.

do $$
declare
  has_text_col boolean;
  has_uuid_col boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'conversations'
      and column_name = 'assignment_id'
      and data_type = 'text'
  ) into has_text_col;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'conversations'
      and column_name = 'assignment_id'
      and data_type = 'uuid'
  ) into has_uuid_col;

  if has_uuid_col then
    raise notice 'conversations.assignment_id 가 이미 uuid 입니다 — 마이그레이션 skip.';
    return;
  end if;

  if not has_text_col then
    raise notice 'conversations.assignment_id 컬럼이 없거나 예상치 못한 타입 — skip.';
    return;
  end if;

  -- 새 컬럼
  alter table public.conversations add column assignment_uuid uuid;

  -- 기존 text(code) → uuid 변환
  update public.conversations c
     set assignment_uuid = a.id
    from public.assignments a
   where a.code = c.assignment_id;

  -- 매칭 안 된 row 는 NULL 로 둔다 (drift 발생한 코드들 — 손실 없이 유지).
  -- 옛 컬럼 드롭 + 새 컬럼 rename.
  alter table public.conversations drop column assignment_id;
  alter table public.conversations rename column assignment_uuid to assignment_id;

  -- FK 추가 (drift 데이터가 있어도 NULL 이면 OK).
  alter table public.conversations
    add constraint conversations_assignment_id_fkey
    foreign key (assignment_id) references public.assignments(id)
    on delete set null;

  -- 인덱스 재생성
  drop index if exists conversations_student_assignment_idx;
  create index conversations_student_assignment_idx
    on public.conversations (student_id, assignment_id, created_at desc);
end $$;
