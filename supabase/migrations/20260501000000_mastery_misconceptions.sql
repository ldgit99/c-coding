-- Student Modeler cron 가 idempotent 하게 동작하기 위한 마커 컬럼,
-- misconceptions 의 (student_id, kc, pattern) 유일성 보장.

-- mastery: last_processed 마커 추가 (해당 학생까지 처리 완료한 events 의 timestamp).
alter table public.mastery
  add column if not exists last_updated timestamptz,
  add column if not exists last_processed timestamptz;

-- misconceptions: (student_id, kc, pattern) 에 unique index 를 만들어 upsert
-- onConflict 키로 사용. 기존 중복 row 가 있다면 occurrences 합산은 수동 정리
-- 권장.
create unique index if not exists misconceptions_unique_pattern
  on public.misconceptions (student_id, kc, pattern);

-- service_role 가 mastery·misconceptions 에 자유롭게 INSERT/UPDATE 할 수
-- 있도록 RLS policy. 이미 존재 시 no-op.
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='mastery' and policyname='mastery_service_all'
  ) then
    create policy mastery_service_all on public.mastery
      for all to service_role using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='misconceptions' and policyname='misconceptions_service_all'
  ) then
    create policy misconceptions_service_all on public.misconceptions
      for all to service_role using (true) with check (true);
  end if;
end $$;

-- 학생/교사 SELECT 정책은 init_schema.sql 에 이미 정의됨.
