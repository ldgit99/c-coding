-- =============================================================================
-- profiles.status — 교사 대시보드 회원 관리 (활성/비활성/제적)
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'profile_status') then
    create type public.profile_status as enum ('active', 'inactive', 'removed');
  end if;
end $$;

alter table public.profiles
  add column if not exists status public.profile_status not null default 'active';

create index if not exists idx_profiles_status on public.profiles(status);

comment on column public.profiles.status is '회원 상태 — active(수강) / inactive(휴강) / removed(제적)';
