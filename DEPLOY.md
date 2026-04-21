# CVibe 배포 가이드

파일럿 수업까지 가는 운영 플레이북. research.md §8(배포 전략)의 구현판이자
코드가 실제 인프라에 붙는 순서대로 정렬했다.

**기본 전제**:
- 본 repo는 env 주입만으로 mock→실응답 전환되도록 추상화돼 있다.
- 이 문서는 **순서**와 **체크리스트**를 담당. 각 단계가 끝나면 다음으로.

## 현재 배포 URL (파일럿)

| 앱 | URL | Vercel 프로젝트 |
|---|---|---|
| 학생 | <https://c-coding-student.vercel.app> | `c-coding-student` |
| 교사 | <https://c-coding-teacher.vercel.app> | `c-coding-teacher` |
| GitHub | <https://github.com/ldgit99/c-coding> (private) | — |

Vercel env의 `TEACHER_APP_ORIGIN` / `NEXT_PUBLIC_STUDENT_APP_URL` /
`STUDENT_APP_INTERNAL_URL`은 위 URL을 **trailing slash 없이** 주입.
코드의 CORS 비교가 `===` exact match라 slash 하나로 SSE 끊긴다.

---

## Step 1 — 로컬 통합 검증 (반일)

Docker와 Supabase CLI가 필요. 실제 배포 전에 **한 번은 로컬에서 end-to-end로
돌려봐야** 한다.

### 1-1. 전제 조건

```bash
node --version      # ≥ 20.11 (.nvmrc)
pnpm --version      # ≥ 9
docker --version    # Supabase local stack
supabase --version  # CLI
```

### 1-2. 의존성 설치

```bash
pnpm install
```

> OneDrive 경로에서 `pnpm install` 후 `.next` 빌드 시 readlink EINVAL이
> 반복되면, `rm -rf apps/*/.next` 후 재빌드. 프로덕션 Vercel에선 Linux라
> 발생 안 함.

### 1-3. Supabase 로컬 기동

```bash
supabase start          # Postgres + Auth + Realtime + Studio (포트 54321~54324)
pnpm db:push            # 초기 마이그레이션 적용
supabase db reset       # seed.sql 자동 실행 (10 과제 + 데모 코호트)
```

Studio: <http://localhost:54323>

### 1-4. env 파일 생성

```bash
cp .env.example apps/student/.env.local
cp .env.example apps/teacher/.env.local
```

채워야 할 최소 키:
- `NEXT_PUBLIC_SUPABASE_URL` — `supabase start` 출력의 API URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — 출력의 anon key
- `SUPABASE_SERVICE_ROLE_KEY` — 교사 앱에서 classroom 집계 쿼리용
- `ANTHROPIC_API_KEY` — 선택. 없으면 mock 응답 유지.
- `JUDGE0_API_URL` — 선택. 없으면 `/api/run`이 환경 안내만.
- `TEACHER_APP_ORIGIN` — 학생 앱의 CORS 허용 origin (기본 `http://localhost:3001`)

### 1-5. 개발 서버 기동

```bash
pnpm dev                # 세 앱 병렬 (student 3000, teacher 3001, docs 3002)
```

### 1-6. 검증 시나리오 (수동)

1. <http://localhost:3000> 접속 → `StudentWorkspace` 렌더, 데모 학생으로 자동 로그인.
2. 상단 "제출" 비활성 확인 → 과제 드롭다운에서 `[A03]` 선택 → starter_code
   에디터에 주입 → variant 배지 `v{N} / 6` 표시.
3. "AI 모드" 스위치 토글 → silent/observer/pair/tutor 순환.
4. 우측 AI 패널 "힌트" 탭 → L1 버튼 클릭 → Pedagogy Coach 반사 질문
   (mock 또는 실제 Claude).
5. 에디터에 `for (int i = 0; i <= n; i++)` 같은 off-by-one 만들고 "▶ 실행" → Judge0 결과
   또는 환경 안내.
6. 에러 발생 시 "왜 이 에러?" 버튼 → hypotheses 패널.
7. "코드리뷰" 탭 → "현재 코드 검토 요청" → blocker finding 렌더.
8. 5문항 리플렉션 → "제출하기" → 4축 rubric 바 + finalScore.
9. <http://localhost:3001> 접속 → 교사 대시보드 → Classroom heatmap,
   Intervention Queue에 `이학생` (의존도 상승 트리거) 표시.
10. LiveEvents 패널에 🟢 연결됨 + 위 이벤트가 실시간 스트리밍.
11. 교사: `이학생` 옆 "🔴 tutor로 상승" 클릭 → 학생 브라우저에서 헤더 모드
    배지가 자동 전환 + 🔒 잠금.
12. 교사: "🔓 잠금 해제" → 학생 모드 재선택 가능.

**이 12단계가 끝까지 돌지 않으면 파일럿 배포 금지.** 실패 지점이 어떤
레이어인지(middleware·CORS·Supabase 마이그레이션·env)를 먼저 해결.

---

## Step 2 — 남은 블로커 (현재 상태)

이터레이션 9·10에서 대부분 해결됨. 아직 남은 것:

### 2-1. Next.js middleware 상세 검증

- `apps/student/middleware.ts`와 `apps/teacher/middleware.ts`가 Supabase
  세션 쿠키 이름(`sb-<project-ref>-auth-token`)을 정확히 찾는지,
  배포 후 실제 project-ref로 확인.
- 학생이 `/login` 건너뛰고 `/`에 들어올 때 `?next=/`로 올바르게 보존되는지.

### 2-2. Rate limiting 운영 업그레이드

- 현재 in-memory (`packages/shared-ui/src/lib/rate-limit.ts`).
- Vercel serverless는 인스턴스 간 상태 공유 X → **실제 프로덕션에서는
  Upstash Ratelimit 또는 Vercel KV로 교체 필수**. 개발·파일럿 수준에만 적합.

### 2-3. Supabase Auth 설정

- Supabase Dashboard → Authentication → URL Configuration →
  Site URL과 Redirect URLs에 학생/교사 origin 모두 추가.
- Magic link 이메일 템플릿 한국어화 (선택).

### 2-4. Safety Guard reference 업로드

- `supabase/seed-private/`의 `.c` 파일을 `packages/agents/src/runtime/
  safety-guard.ts`의 `checkSafety({ referenceSolution })` 입력에 실제로
  묶어야 유사도 차단이 작동한다. 현재는 함수 인터페이스만 있고 호출부가
  ref를 주입하지 않음 → 이터레이션 12에서 처리.

### 2-5. Hidden tests 실행 연결

- `runHiddenTests`는 있지만 `/api/submit`에서 실제로 불러 쓰지 않는다.
- Next 이터레이션에서 `/api/submit`이 `getAssignmentByCode(id)`로 과제를
  찾은 후, `supabase/seed-private/A{n}_hidden.json`을 로드해 runHiddenTests로
  실행하고 결과를 gradeSubmission에 전달하도록 연결.

---

## Step 3 — 파일럿 배포 (반일)

### 3-1. Supabase 프로젝트 생성

```bash
supabase projects create cvibe-pilot
supabase link --project-ref <ref>
pnpm db:push            # 마이그레이션 원격 적용
# seed는 supabase migration의 일부로 자동 실행되지 않음 →
supabase db execute --file supabase/seed.sql
```

Supabase Dashboard에서:
- Database → Extensions → `vector` 활성화 확인
- Database → Roles → RLS 상태 확인(모든 테이블 `enabled`)
- Auth → Providers → Email 활성화

### 3-2. Vercel 2개 프로젝트

```bash
# 학생 앱
cd apps/student && vercel link --project cvibe-student

# 교사 앱
cd apps/teacher && vercel link --project cvibe-teacher
```

Vercel Dashboard → Environment Variables에:

| 키 | 학생 앱 | 교사 앱 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | ✓ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | — | ✓ |
| `ANTHROPIC_API_KEY` | ✓ | — |
| `JUDGE0_API_URL` · `JUDGE0_API_KEY` | ✓ | — |
| `LANGFUSE_PUBLIC_KEY` · `LANGFUSE_SECRET_KEY` | ✓ | ✓ |
| `TEACHER_APP_ORIGIN` | `https://teacher.cvibe.app` | — |
| `NEXT_PUBLIC_STUDENT_APP_URL` | — | `https://student.cvibe.app` |
| `STUDENT_APP_INTERNAL_URL` | — | `https://student.cvibe.app` |

### 3-3. 도메인 · CORS

- `student.cvibe.app` / `teacher.cvibe.app` 서브도메인 구성.
- 학생 앱의 `apps/student/next.config.ts` CORS 헤더가 `TEACHER_APP_ORIGIN`
  env를 참조하는지 확인.
- Supabase Auth Redirect URLs에 배포 URL 추가.

### 3-4. 비용 상한

- Anthropic 월 한도: 파일럿 1회 기준 $20~50 권장 (Claude Usage 대시보드).
- Judge0: RapidAPI 무료 티어 50 req/day → 학생 수 × 시도 횟수 고려해 유료 전환 검토.
- Vercel 함수: 학생 앱 /api/chat의 timeout `maxDuration` 기본 10s로 충분.

### 3-5. 관측성

- Langfuse self-host 또는 Cloud — `LANGFUSE_HOST` 주입.
- Sentry 등록 (선택) — `@sentry/nextjs` 추가.
- Vercel Analytics 활성화.

### 3-6. 배포 실행

```bash
pnpm build              # 로컬에서 한 번 더 build 5/5 확인
vercel --prod           # 각 앱에서
```

### 3-7. smoke test (배포 직후)

Step 1-6의 12단계 시나리오를 **배포 URL에서 재실행**. 특히:
- `/login` 매직 링크 실제 이메일 도착
- 교사↔학생 cross-origin SSE 연결(🟢 배지)
- `/api/chat` rate limit 29초 내 20회 초과 시 429 + Retry-After

---

## Step 4 — 파일럿 수업 1회

### 4-1. 수업 전 (1일 전)

- 학생 계정 일괄 생성 (Supabase Auth Admin API): 20~30명
- 각 학생을 cohort에 배정 (`profiles.cohort_id`)
- 교사 계정 생성 + `cohort.teacher_id` 설정
- 교사에게 [apps/docs/teacher-manual](apps/docs/app/teacher-manual/page.tsx)
  전달 + 5분 온보딩

### 4-2. 수업 중 관찰

- 교사 대시보드의 Intervention Queue와 Live Events를 **동시에** 열어둔다.
- Dependency Factor가 `medium` 이상인 학생은 우선 확인.
- 모드 `tutor` 남발 금지 — L3/L4 힌트가 필요한 순간이 확실할 때만.

### 4-3. 수업 후 회고 (30분)

[apps/docs/pilot-retrospective](apps/docs/app/pilot-retrospective/page.tsx)
템플릿을 **그날 안에** 채우기. 미루면 신호가 흐려진다.

수집할 핵심 수치:
- 제출률 / KC별 평균 숙련도 / 개입 수용률 / 의존도 분포
- Socratic L1~L4 호출 비율 vs 과제 난이도 정합성
- 리플렉션 Q3(대안 비교) 품질 평균
- Safety Guard 차단 건수와 사유
- Promptfoo 회귀 실패 시나리오

### 4-4. 다음 이터레이션 반영

검증된 프롬프트·규칙은:
- `packages/agents/src/prompts/` → Claude Agent SDK 런타임
- `.claude/skills/` → 하네스 반복 개선

두 경로 모두에 커밋해 이후 세션에서 재사용.

---

## 배포 타임라인 요약

| 단계 | 소요 | 산출물 |
|------|------|--------|
| Step 1 로컬 검증 | 반일 | 12단계 시나리오 pass |
| Step 2-4·2-5 연결 | 1일 | Safety ref 주입 + hidden tests 실행 연결 |
| Step 3 배포 | 반일 | https://student.cvibe.app + teacher.cvibe.app |
| Step 4 파일럿 | 수업 1회 + 반일 회고 | pilot-retrospective.md |

총 **2~3일**로 파일럿 배포 가능. 학생 Auth 대량 생성 스크립트가 필요하면
`packages/db/scripts/create-cohort.ts`를 추가하면 된다 (이터레이션 12+).

---

## 문제 해결

| 증상 | 원인 · 해결 |
|------|-----|
| `/api/chat` 429 | rate limit (20/min). Upstash로 교체하거나 config 조정 |
| 학생이 `/teacher/*` 접근됨 | middleware에서 role 검증 추가 필요 (현재는 session cookie만) |
| LiveEvents 🔴 연결 오류 | 학생 앱 `TEACHER_APP_ORIGIN` CORS 헤더 누락 |
| variant index가 재접속마다 바뀜 | studentId가 일관되지 않음 — Supabase Auth UUID 확인 |
| Claude 응답 JSON 파싱 실패 | `pedagogy-coach.ts`의 `parseHintResponse` fallback이 동작 (message만 사용) |
| Judge0 timeout | backend 자체 timeout vs 학생 코드 timeout 구분 — `runHiddenTests`가 처리 |
| supabase db reset 실패 | seed.sql의 `profiles.id` FK가 auth.users 선행 생성 필요 — 데모는 UUID 직접 삽입 |

---

## 보안 체크리스트 (배포 전 반드시)

- [ ] `.env*` 파일들 repo에 없는지 확인
- [ ] `supabase/seed-private/`가 프로덕션 Vercel 빌드에 포함되지 않는지 확인 (Build command로 exclude 또는 별도 저장소로 이전)
- [ ] Anthropic API key는 서버 env만, 학생 브라우저 번들에 노출 X
- [ ] Supabase service_role key는 교사 앱 서버 경로만
- [ ] 학생의 실제 이메일·이름이 xAPI 이벤트에 들어가지 않는지 (hashLearnerId 동작 확인)
- [ ] RLS 정책이 교사 cohort 교차 접근을 차단하는지 (다른 cohort 학생 조회 시도 → 빈 결과)
