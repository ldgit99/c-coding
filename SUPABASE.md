# Supabase 연결 플레이북

현재 CVibe는 Supabase env가 없을 때 DEMO_STUDENTS + in-memory 스토어로 동작합니다. 아래 단계를 따라 Supabase를 연결하면 **코드 변경 없이** 자동으로 실데이터 경로로 전환됩니다.

## 연결 시 자동 전환되는 경로

| 위치 | env 없음 | env 있음 |
|---|---|---|
| [apps/teacher/app/api/classroom/route.ts](apps/teacher/app/api/classroom/route.ts) | DEMO_STUDENTS 집계 | profiles·mastery·misconceptions·submissions 4-join |
| [apps/teacher/app/api/student/[id]/route.ts](apps/teacher/app/api/student/%5Bid%5D/route.ts) | DEMO_STUDENTS 조회 | 위 join 결과에서 id 필터 |
| [apps/student/app/api/chat/route.ts](apps/student/app/api/chat/route.ts) | in-memory conversation-store에만 기록 | `conversations` 테이블에 per-turn INSERT (service_role) |
| [apps/student/app/api/submit/route.ts](apps/student/app/api/submit/route.ts) | xAPI 이벤트만 기록 | `submissions` 테이블 INSERT (rubric·kcDelta·dependency_factor 포함) |
| [apps/student/app/api/analytics/dump/route.ts](apps/student/app/api/analytics/dump/route.ts) | listRecentEvents + getConversation | `events` + `conversations` 테이블 SELECT |
| [apps/student/app/login/page.tsx](apps/student/app/login/page.tsx) + middleware | 데모 사용자 자동 로그인 | Supabase magic-link auth + 쿠키 검증 |

모든 경로는 `packages/db/src/queries.ts:createServiceRoleClientIfAvailable` 가 `null`이면 fallback, `SupabaseClient`이면 실 DB로 스위치합니다. 실패 시 silent → 학생 UX에는 영향 없음.

---

## Step 1 — Supabase 프로젝트 생성

1. https://supabase.com/dashboard → **New project**
2. 설정:
   - Name: `cvibe`
   - Region: `Northeast Asia (Seoul)`
   - DB password: 안전한 비밀번호 (반드시 메모)
   - Plan: Free (학생 20명 × 주 30분 범위에서는 충분)
3. 프로비저닝 2~3분 대기

## Step 2 — API 키 4개 수집

**Project Settings → API** 에서 복사:

| 값 | Vercel 환경변수명 | 용도 |
|---|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | 브라우저 + 서버 공용 |
| anon public | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 브라우저 SDK (RLS 적용) |
| service_role ⚠️ | `SUPABASE_SERVICE_ROLE_KEY` | 서버 경로 전용 (RLS 우회) |

**Project Settings → Database → Connection string → URI**:

| 값 | 환경변수명 |
|---|---|
| postgresql://postgres:[PASSWORD]@... | `DATABASE_URL` |

> service_role 키는 **학생 브라우저에 절대 노출 금지**. Vercel에서 Production/Preview 범위에만 주입.

## Step 3 — 스키마 + seed 실행

Supabase 콘솔 → **SQL Editor → New query** 에서 순서대로:

1. [supabase/migrations/20260420000000_init_schema.sql](supabase/migrations/20260420000000_init_schema.sql) 전체 붙여넣기 → Run
2. [supabase/migrations/20260421000000_conversations.sql](supabase/migrations/20260421000000_conversations.sql) 전체 붙여넣기 → Run (turn-level conversations로 교체)
3. [supabase/seed.sql](supabase/seed.sql) 전체 붙여넣기 → Run (10개 과제 + KC + 데모 cohort)

## Step 4 — Auth 설정

**Authentication → URL Configuration**:

- Site URL: `https://c-coding-student.vercel.app`
- Redirect URLs (두 줄 모두):
  - `https://c-coding-student.vercel.app/auth/callback`
  - `https://c-coding-teacher.vercel.app/auth/callback`

**Authentication → Providers → Email**: Magic Link 활성화 (기본값)

## Step 5 — 프로필 자동 생성 트리거

Supabase auth가 새 유저 생성 시 `profiles` 테이블에 row를 자동 삽입하는 트리거. **SQL Editor**에서 실행:

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role, cohort_id)
  values (
    new.id,
    new.email,
    split_part(new.email, '@', 1),
    'student',
    (select id from public.cohorts order by created_at limit 1)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

교사 계정은 이메일로 가입 후 **SQL Editor**에서 role 수동 승격:

```sql
update public.profiles
set role = 'teacher'
where email = 'teacher@school.ac.kr';
```

## Step 6 — Vercel 환경변수 주입

Vercel 대시보드의 **두 프로젝트 모두** (`c-coding-student`, `c-coding-teacher`):

| 변수 | Student | Teacher | Scope |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | All |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | Production + Preview (브라우저 제외) |
| `DATABASE_URL` | ✅ | ✅ | Production + Preview |
| `NEXT_PUBLIC_STUDENT_APP_URL` | — | `https://c-coding-student.vercel.app` | All |
| `STUDENT_APP_INTERNAL_URL` | — | 같은 값 (서버 간 호출 시) | Production + Preview |
| `TEACHER_APP_ORIGIN` | `https://c-coding-teacher.vercel.app` | — | All |

각 프로젝트에서 **Settings → Deployments → Redeploy** 1회.

## Step 7 — 검증

1. 학생 앱 `/login` → 이메일 입력 → 매직 링크 → `/` 리다이렉트 확인
2. 과제 선택 → 코드 작성 → 힌트 요청 → 제출
3. 교사 앱 `/login` → 매직 링크 → `/` 접속
4. Classroom Heatmap에서 방금 제출한 학생의 mastery가 갱신되는지 확인 (Supabase 경로일 때 response의 `source: "supabase"`)
5. `/student/[id]` 페이지에서 대화 로그 섹션에 방금 쓴 발화가 실시간으로 보이는지 확인
6. `/research/cascade` 와 `/research/offloading` 에서 `generatedAt`과 학생 수가 갱신되는지 확인

## 문제 해결

| 증상 | 원인 | 해결 |
|---|---|---|
| Classroom이 여전히 demo 데이터 | env 미주입 또는 재배포 안 함 | Vercel Settings → Environment Variables 확인, Redeploy |
| 제출해도 submissions 안 쌓임 | student UUID가 profiles.id와 불일치 | Step 5 트리거가 돌아서 profiles row가 생성되었는지 확인 |
| conversations 쓰기 실패 | student_id FK 위반 | auth 로그인 없이 제출되었을 가능성. middleware 확인 |
| Research 대시보드 비어있음 | events 테이블 INSERT가 안 됨 | `/api/chat`·`/api/submit` 내 `recordEvent`가 Supabase에도 써야 함 (다음 이터레이션) |
| RLS 거부로 classroom API 500 | service_role 키가 학생 앱에 주입 안 됨 | Vercel env에서 `SUPABASE_SERVICE_ROLE_KEY` scope 확인 |

## 남아있는 작업 (다음 이터레이션)

- **xAPI 이벤트 → Supabase `events` 테이블 INSERT 경로** — 현재 in-memory `recordEvent()` 만 호출, Supabase에는 flush되지 않음. Research 대시보드가 실데이터로 가동되려면 필요.
- **Interventions Supabase INSERT** — teacher 개입이 `interventions` 테이블에 쌓이도록 wiring.
- **Mastery · Misconceptions INSERT/UPDATE** — 제출 후 kcDelta 기반으로 `mastery` 업서트, Code Reviewer findings에서 `misconceptions` 적재.
- **RLS 정책 재검증** — profiles.role='teacher' 조건이 실제로 JWT claim으로 쿼리 시 적용되는지 통합 테스트.
