# CVibe — C Vibe Coding Multi-Agent Project

> 대학교 1학년 C언어 입문 학습자를 위한 학생–AI 짝프로그래밍 플랫폼

## 프로젝트 컨텍스트

- **도메인 설계 문서**: [research.md](research.md) — 멀티 에이전트 아키텍처, 기술 스택, 배포 전략 전체 정의
- **초안**: [참고자료.txt](참고자료.txt)
- **배포 타깃**: GitHub + Vercel (학생/교사 앱 분리)

신규 세션에서 작업을 시작할 때는 반드시 `research.md`를 먼저 로드해 도메인 맥락을 파악한다.

## 하네스(Harness) 트리거 규칙

이 프로젝트는 [revfactory/harness](https://github.com/revfactory/harness) 기반 팀 아키텍처 메타스킬을 사용한다. 스킬은 [.claude/skills/harness/SKILL.md](.claude/skills/harness/SKILL.md)에 설치되어 있다.

다음 요청이 들어오면 **반드시 `harness` 스킬을 먼저 호출**한다.

- "하네스 구성/구축/설계해줘"
- "에이전트 팀 만들어줘"
- "멀티 에이전트 스캐폴드해줘"
- "하네스 점검/감사/동기화"
- 새 전문 에이전트(예: Pedagogy Coach, Code Reviewer) 추가 요청
- `research.md` §5 (멀티 에이전트 카탈로그)를 구현 시작할 때

하네스 실행 시 도메인 입력으로 **[research.md](research.md)의 §5, §6, §7을 사용**한다. 하네스는 그 설계를 바탕으로 `.claude/agents/` 와 `.claude/skills/` 하위에 실제 에이전트 정의 및 스킬을 생성한다.

## 실행 환경 요구사항

- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` — 에이전트 팀 실행 모드. [.claude/settings.json](.claude/settings.json)에 설정됨.
- `Agent` 도구 호출 시 `model: "opus"` 명시 권장 (추론 품질).

## 디렉토리 규칙 (하네스 산출물)

```
.claude/
├── agents/          # 하네스가 생성할 에이전트 정의 (.md)
├── skills/
│   ├── harness/     # 메타스킬 본체 (이미 설치됨)
│   └── <domain>/    # 하네스가 생성할 도메인 스킬
└── settings.json
.claude-plugin/
└── plugin.json      # 하네스 플러그인 메타데이터
```

`.claude/commands/`는 사용하지 않는다 — 하네스 규약.

## 하네스: CVibe Multi-Agent Platform

**목표:** research.md §5의 9개 플랫폼 런타임 에이전트(Supervisor, Pedagogy Coach, Code Reviewer, Runtime Debugger, Assessment, Student Modeler, Problem Architect, Teacher Copilot, Safety Guard)를 Claude Code 정의로 스캐폴드하여, 시스템 프롬프트·페이싱 규칙을 세션 내에서 반복 개선 가능한 형태로 운용한다.

**트리거:** CVibe 관련 도메인 작업(힌트 응답 생성, 제출 채점, 과제 생성, 대시보드 요약, 에이전트 재실행 등) 요청 시 `cvibe-orchestrator` 스킬을 사용한다. 시나리오는 오케스트레이터가 자동 분류(A: 학생 상호작용 / B: 평가 / C: 과제 출제 / D: 교사 대시보드).

---

## 운영 플레이북

### 1. 과제 카탈로그 교체 (A02·A03 에서 검증된 절차)

**한 과제의 문제 본문·starter·hidden test·reference solution 을 통째로 갈아끼울 때.**

#### 단계별

1. **[packages/db/src/seeds/assignments.ts](packages/db/src/seeds/assignments.ts) 의 해당 entry 수정**
   - `code` 슬러그는 **그대로 유지** (예: `A02_pointer_swap_fn`). DB FK·기존 submissions 보존 위함.
   - `version` 을 `+1` (예: 1→2). DB upsert 시 카탈로그 교체 신호.
   - `title`·`template`·`kcTags`·`difficulty`·`starterCode`·`visibleTests`·`hiddenTests`·`referenceSolution` 갱신.
   - hidden test `expected` 는 lenient normalize 적용됨 ([run-hidden-tests.ts:142](packages/wasm-runtime/src/run-hidden-tests.ts#L142)): 라인 trim · 연속 빈줄 squash · trailing newline 제거. printf 끝 `\n` 유무는 영향 없음.

2. **seed 파일 재생성**
   ```powershell
   cd D:\OneDrive\Agent\c-coding\packages\db
   npx tsx scripts/export-seed.ts
   ```
   → `supabase/seed.sql` + `supabase/seed-private/{prefix}_hidden.json` + `{prefix}_ref.c` 자동 갱신.

3. **테스트 단정 갱신** (CI 빨갛게 되는 흔한 두 군데)
   - [packages/db/src/seeds/assignments.test.ts](packages/db/src/seeds/assignments.test.ts) — `getAssignmentByCode("<code>")?.title` 단정.
   - [apps/student/lib/seed-private.test.ts](apps/student/lib/seed-private.test.ts) — `loadReferenceSolution("<code>")` 가 새 본문의 핵심 토큰 포함하는지.

4. **잠금 정책 확인** ([apps/student/components/AssignmentPanel.tsx](apps/student/components/AssignmentPanel.tsx) 의 `UNLOCKED_PREFIXES`)
   - 교체 대상 prefix 가 리스트에 없으면 학생 화면에 "순차적 공개" 잠금으로 표시됨. 새 과제 공개하려면 추가.

5. **commit + push** → GitHub Actions (`.github/workflows/deploy.yml`) 가 두 앱 자동 배포 (약 5분).

6. **DB 측 동기화** — 빌드 완료 후 교사 앱 `/settings` 페이지:
   - **Catalog Drift** 섹션 → **Reseed Assignments** 버튼 1회 클릭 → `ASSIGNMENTS` 정적 카탈로그 → DB upsert.
   - 옛 코드(예: 옛 A02 swap) 가 DB 에 남아 있으면 `extraInDb` 에 표시되고 자동으로 `active=false` 처리됨.

7. **옛 학생 기록 정리** — 같은 `/settings` 페이지:
   - **옛 카탈로그 기록 정리** 섹션 → **대상 코드** 입력 (예: `A02_pointer_swap_fn`) + **컷오프** (자동 채워진 오늘 KST 00:00 그대로) → **Dry-run (count)** 클릭 → 표 본 뒤 **Delete (영구)** 클릭.
   - 컷오프는 새 배포 *이전* 시각이라 신규 starter 로 작성된 draft 는 자동 보호됨.

8. **학생 검증** — 학생이 학생 앱 강제 새로고침 (Ctrl+Shift+R) 후 해당 과제 클릭. 새 starter + 새 본문 보여야 함.
   - 옛 starter 가 그대로 보이면 → 7단계 drafts cleanup 안 함. 다시 실행.
   - 사이드바에 "순차적 공개" 잠금이면 → 4단계 `UNLOCKED_PREFIXES` 누락.

#### 주의사항

- **code 슬러그 절대 바꾸지 말 것**. 바꾸면 기존 submissions/conversations/events 의 assignment_id FK 가 깨져 학생 진행 이력이 모두 끊김.
- **DEMO_STUDENTS** (`packages/db/src/seeds/demo-cohort.ts`) 가 옛 code 를 참조 중이면 같이 정리. 데모 모드에서만 영향.
- **AI 에이전트들은 자동 반영**: Pedagogy Coach·Code Reviewer·Assessment·Safety Guard·Student Modeler 가 모두 `getAssignmentByCode(code)` 로 catalog 를 읽으므로 별도 수정 불필요.

### 2. 학생 앱 배포가 안 될 때 (Vercel webhook 깨짐 대응)

GitHub Actions 가 자동 배포하지만, 만약 그것도 실패하면 로컬에서 직접:

```powershell
cd D:\OneDrive\Agent\c-coding\apps\student
vercel --prod

cd D:\OneDrive\Agent\c-coding\apps\teacher
vercel --prod
```

처음 1회만 `vercel link` 필요 (프로젝트 선택). 이후 동일 디렉토리에서 `vercel --prod` 만 호출.

### 3. Admin endpoint 인증

`/api/admin/*` (reseed-assignments, purge-assignment-history) 와 `/api/debug/db-status`·`/api/health` 는 [`requireTeacher`](apps/teacher/lib/guard.ts) 가드 적용. 두 방식 중 하나:

- **교사 로그인 세션**: 브라우저에서 교사 계정으로 로그인 후 `/settings` UI 사용. 별도 시크릿 불필요.
- **ADMIN_SECRET 헤더**: CI·스크립트용. Vercel env 에 `ADMIN_SECRET` 설정 + `x-admin-secret` 또는 `Authorization: Bearer <secret>` 헤더.

### 4. Vercel Hobby plan 제약

- Cron 은 **하루 1회 한도**. `*/15 * * * *` 같은 다중 실행 불가. 현재 두 cron 은 일배치 (`0 3 * * *`, `0 9 * * *`).
- Pro plan 으로 업그레이드하면 `*/15` 회복 가능.

### 5. 데이터 흐름 무결성 체크리스트 (운영 중 점검 항목)

| 증상 | 확인 위치 |
|---|---|
| 학생 제출이 submissions 테이블에 안 들어옴 | `/api/debug/db-status` (교사) — `missingInDb` 비어야 함. 비어있지 않으면 reseed. |
| events.student_id NULL 누적 | `recordEvent(stmt, ctx)` 호출부에 ctx 누락 — `apps/student/app/api/{chat,run,submit,review,debug,drafts,...}` 라우트 grep. |
| KC mastery·misconceptions 0 건 | `/api/cron/student-modeler` 가 매일 03:00 UTC 호출되는지 Vercel Cron Logs 확인. CRON_SECRET 일치도 점검. |
| 교사 대시보드가 멈춤 (5초+) | 학생 앱 HTTP 프록시 의존성 — `fetchAnalyticsFromDb` 로 이미 제거됨. 새 라우트 추가 시 학생 앱 호출 금지. |
| 옛 과제 본문이 학생 화면에 잔존 | 7단계 drafts cleanup 누락. |
| 사이드바에 새 과제 "순차적 공개" 잠금 | `UNLOCKED_PREFIXES` 누락. |

### 6. 자주 막히는 부분

- **컷오프 시각 ISO 형식**: `2026-05-12T15:00:00.000Z` (UTC). 한국시간 자정 = UTC 15:00 전날. settings UI 가 자동 채움.
- **lenient normalize 와 expected 형식**: `printf("문자열 입력: ")` 다음 줄바꿈 없이 `printf("결과: %s\n", s)` 호출 시 stdout 은 *한 줄로* `"문자열 입력: 결과: hello\n"`. expected 도 한 줄로 작성.
- **vercel.json `ignoreCommand`**: `turbo-ignore` 가 monorepo 의 transitive dep 변화를 못 잡으면 모든 push 를 스킵함. 학생 앱은 이미 제거. 재발 시 GitHub Actions 가 backup.

---

**변경 이력:**

| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-04-20 | 프로젝트 초기화, research.md 작성, harness v1.2.0 설치 | 전체 | - |
| 2026-04-20 | 하네스 신규 구축 — 에이전트 9개 + 도메인 스킬 6개 + 오케스트레이터 스킬 1개 생성 | `.claude/agents/`, `.claude/skills/` | research.md §5·§6·§7 구현 진입 |
| 2026-04-20 | Week 1~2 부트스트랩 — 모노리포(apps 3 + packages 5) + Supabase 초기 마이그레이션(RLS 포함) + CI 워크플로우. typecheck·build 10/10 통과 | 루트 설정·`apps/`·`packages/`·`supabase/`·`.github/` | research.md §11 로드맵 착수 |
| 2026-04-20 | Week 3 WASM 파이프라인 + Monaco — Judge0 백엔드, clang-wasm Worker 스캐폴드, Emscripten Dockerfile, `/api/run` + CEditor | `packages/wasm-runtime/`, `apps/student/` | research.md §7.3 C 실행 경로 |
| 2026-04-20 | Week 4~5 Pedagogy Coach MVP — Supervisor 키워드 분류, 4단계 게이팅, Anthropic SDK + prompt caching, AIPanel (API key 미설정 시 mock 응답). 15 단위 테스트 통과 | `packages/agents/src/runtime/`, `apps/student/app/api/chat/` | research.md §11 Week 4~5 마일스톤 |
| 2026-04-20 | Week 6 Code Reviewer + Runtime Debugger — c-code-review 3축 분석, findings JSON UI, /api/review · /api/debug, CEditor 에러 시 "왜 이 에러?" 분석 버튼. 20 단위 테스트 통과 | `packages/agents/src/runtime/{code-reviewer,runtime-debugger}.ts`, `apps/student/{app/api,components}` | research.md §11 Week 6 마일스톤 |
| 2026-04-20 | Week 7 Assessment + Student Modeler — rubric-grading 4축 채점(결정적+LLM reflection 평가), kc-mastery-tracking BKT 스타일 + misconception + fading, /api/submit + SubmitDialog(리플렉션 5문항 + 점수 바). 31 단위 테스트 통과. Dependency Factor는 teacherOnlyNotes 전용, 학생 응답에서 서버가 제거 | `packages/agents/src/runtime/{assessment,student-modeler}.ts`, `apps/student/app/api/submit`, `apps/student/components/SubmitDialog.tsx` | research.md §11 Week 7 · §6.1 · §6.3 |
| 2026-04-20 | Week 8 Problem Architect + 과제 10개 — CS1 필수 KC 10개를 1:1로 커버하는 정적 카탈로그, seeded PRNG variant 파생, /api/assignments + AssignmentPanel. 45 단위 테스트 | `packages/db/src/seeds/assignments.ts`, `packages/agents/src/runtime/problem-architect.ts`, `apps/student/{app/api/assignments,components/AssignmentPanel.tsx}` | research.md §11 Week 8 · §6.1 |
| 2026-04-20 | Week 9 Teacher Copilot + 대시보드 v1 — Classroom heatmap, Intervention Queue(research.md §6.4 트리거), Common Misconceptions 집계. `/api/classroom`, `/api/student/[id]`. 교사 앱 3단 뷰 (Classroom / Student detail). DEMO_STUDENTS 3명 mock 데이터로 동작. | `packages/agents/src/runtime/teacher-copilot.ts`, `packages/db/src/seeds/demo-cohort.ts`, `apps/teacher/app/` | research.md §4 · §11 Week 9 |
| 2026-04-20 | Week 10 Safety Guard 통합 — 결정론적 필터(reference_solution Jaccard 유사도, PII 정규식, 욕설, 프롬프트 인젝션 격리, 시험 모드 코드 금지), `/api/chat`에 inbound/outbound 사전 검사 체인 연결. | `packages/agents/src/runtime/safety-guard.ts`, `apps/student/app/api/chat/route.ts` | research.md §5.7 · §11 Week 10 |
| 2026-04-20 | Week 11 E2E + Promptfoo + Lighthouse — Playwright golden-path 2 시나리오, agents promptfoo.config.yaml(회귀 3건), `.github/workflows/lighthouse.yml`(LCP<2.5s 어설션). | `apps/student/{playwright.config.ts,e2e/}`, `packages/agents/promptfoo.config.yaml`, `.github/workflows/lighthouse.yml` | research.md §8.2 PR 체크 |
| 2026-04-20 | Week 12 교사 매뉴얼 + docs 앱 — apps/docs에 Teacher Manual, Student Onboarding, Pilot Retrospective 3개 문서 라우트. 운영 루프·보안 체크리스트·낙인 방지 원칙 명시화. | `apps/docs/app/` | research.md §10.1 반복 개선 |
| 2026-04-20 | 운영 이터레이션 1 — xAPI in-memory 스토어 + 학생 API 훅(`/api/{chat,run,submit}`에서 이벤트 자동 기록). 교사 앱 Live Events 패널(5초 폴링) + Intervention Actions(모드 강경/쪽지). 학생 앱 `/api/{events,interventions}` + CORS + InterventionBanner. 교사→학생 프록시 라우트 `/api/{intervene,events}`. 52 단위 테스트(xapi 3 신규). | `packages/xapi/src/store.ts`, `apps/student/{app/api/events,interventions,components/InterventionBanner.tsx}`, `apps/teacher/{app/api/{intervene,events},components/{LiveEvents,InterventionActions}.tsx}` | 파일럿 전 교사↔학생 쌍방향 통신 구축 |
| 2026-04-20 | 운영 이터레이션 2 — ModeSwitch(silent/observer/pair/tutor + 교사 잠금), mode_change 개입 수신 시 즉시 전환+락. AIPanel Level 4 수락 전 자기 설명 모달(§3.1) + `/api/self-explanation` + xAPI `selfExplanationSubmitted`·`aiSuggestionAccepted`. shared-ui Button/Badge(cva variants). 누적 63 단위 테스트. | `apps/student/{components/ModeSwitch.tsx,components/AIPanel.tsx,app/api/self-explanation}`, `packages/shared-ui/src/components/` | §3.1·§3.2 설계 원칙 UI 연결 |
| 2026-04-20 | 운영 이터레이션 3 — Auth 스텁(`packages/db/src/auth.ts` AppUser + resolveUserFromCookies/Request). 학생·교사 앱 Server Component 전환(`page.tsx` = RSC → `StudentWorkspace`·`TeacherDashboard` Client에 user 주입). `/api/{run,submit}`의 `demo-student-001` 하드코딩 제거 → resolveUserFromRequest. @supabase/ssr 의존성 추가, Supabase env 있으면 실제 getUser(), 없으면 DEMO_*_USER fallback. 누적 68 단위 테스트(auth 5 신규). | `packages/db/src/{auth,seeds/demo-users}.ts`, `apps/student/{lib/session.ts,app/page.tsx,components/StudentWorkspace.tsx}`, `apps/teacher/{lib/session.ts,components/TeacherDashboard.tsx}` | 하드코딩 제거, Supabase Auth 전환 준비 |
| 2026-04-20 | 운영 이터레이션 4 — Langfuse 관측성 스텁. `packages/agents/src/runtime/observability.ts` (startTrace/recordGeneration/flushTrace, env 미설정 시 전부 no-op). pedagogy-coach·code-reviewer·runtime-debugger의 Anthropic 호출을 trace 래핑(모델·usage·latency·metadata 기록). 누적 73 단위 테스트(observability 5 신규). | `packages/agents/src/runtime/observability.ts`, `pedagogy-coach.ts`, `code-reviewer.ts`, `runtime-debugger.ts` | LLM 비용·품질 추적 토대, research.md §8.6 |
| 2026-04-20 | 운영 이터레이션 5 — Supabase seed 스크립트. `packages/db/src/seeds/sql.ts` (PostgreSQL dollar-quoted 문자열로 한국어·JSONB 안전 직렬화 + conflict upsert). `packages/db/scripts/export-seed.ts` → `supabase/seed.sql`(15k 문자, 10 과제). tsx 의존성 추가, `pnpm --filter @cvibe/db seed:export` 명령. 누적 79 단위 테스트(sql 6 신규). | `packages/db/{src/seeds/sql.ts,scripts/export-seed.ts}`, `supabase/seed.sql` | `supabase db reset` 시 자동 seed 적용 준비 |
| 2026-04-20 | 운영 이터레이션 6 — SSE 실시간 스트림 + Supabase client helper. xapi store subscribe/publish + `/api/events/stream` SSE(snapshot+event+ping), 교사 LiveEvents를 EventSource로 교체(5초 폴링→실시간 🟢 배지). `packages/db/src/queries.ts` fetchClassroomData — Supabase env 있으면 4-table 조인, 없으면 DEMO fallback + `source` 필드 노출. 누적 84 단위 테스트(xapi+3 · db+2). | `packages/xapi/src/store.ts`, `apps/student/app/api/events/stream`, `apps/teacher/components/LiveEvents.tsx`, `packages/db/src/queries.ts`, `apps/teacher/app/api/classroom/route.ts` | 실시간 스트림 + 실DB 전환 준비 |
| 2026-04-20 | 운영 이터레이션 7 — 결정적 variant 배정 + Self-explanation LLM 평가. `packages/db/src/variant-assignment.ts` — FNV-1a 해시 기반 `pickVariantIndex(studentId, assignmentCode, variantCount, cohortSeed?)` + `variantDistribution`. `packages/agents/src/runtime/self-explanation.ts` — 3축(specificity/causality/transfer) Claude Haiku 평가 + heuristic mock fallback. `/api/self-explanation`이 heuristic → `evaluateSelfExplanation`으로 교체, axes·strengths·improvements 응답 포함. 누적 97 단위 테스트(variant 9 + self-explanation 4). | `packages/db/src/variant-assignment.ts`, `packages/agents/src/runtime/self-explanation.ts`, `apps/student/app/api/self-explanation/route.ts` | §3.1 Accept Gate 정밀화 + §6.1 variant 결정적 배정 |
| 2026-04-20 | 운영 이터레이션 8 — variant UI 연결 + ModeSwitch unlock 흐름. AssignmentSeed에 `variantCount?` 필드(A03=6, A05=4, A07=5). `/api/assignments`가 resolveUserFromRequest로 학생 ID 얻고 `pickVariantIndex` 호출해 `variantIndex` 응답. AssignmentPanel이 "variant v3 / 6" 배지 표시. 교사 InterventionActions에 🔓 "잠금 해제" 버튼(unlock 플래그). 학생 InterventionBanner가 payload.unlock 수신 시 `onModeChange(next, true)` → ModeSwitch 잠금 해제. 테스트 수 유지(97). | `packages/db/src/seeds/assignments.ts`, `apps/student/{app/api/assignments,components/{AssignmentPanel,InterventionBanner,StudentWorkspace}.tsx}`, `apps/teacher/components/InterventionActions.tsx` | §6.1 variant 학생 가시화 + 교사 개입 반대 방향 |
| 2026-04-20 | 이터레이션 9 — 파일럿 배포 블로커 3건 해결. Supabase magic-link auth(`/login` + `/auth/callback` 학생·교사 각각), Next.js middleware(PUBLIC_PATHS 외에는 `sb-*-auth-token` 쿠키 확인, env 없으면 통과), 토큰 버킷 rate limit(학생 앱 `/api/chat` 분당 20건). 누적 101 단위 테스트(rate-limit 4 신규). | `apps/{student,teacher}/{middleware,app/{login,auth/callback}}.ts`, `packages/shared-ui/src/lib/rate-limit.ts` | Supabase env 주입 시 실제 인증 흐름 동작 |
| 2026-04-20 | 이터레이션 10 — hidden test 실행기 + 10개 reference solutions. `packages/wasm-runtime/src/run-hidden-tests.ts` (Backend 인터페이스로 Judge0/clang-wasm 모두 지원, 순차 실행, 타임아웃·trailing newline 정규화). `supabase/seed-private/{A01~A10}_ref.c` + `_hidden.json` 10쌍(3~6 경계 케이스). `.gitignore` 주석 처리로 파일럿용 커밋. 누적 106 단위 테스트(run-hidden-tests 5 신규). | `packages/wasm-runtime/src/run-hidden-tests.ts`, `supabase/seed-private/` | Assessment의 `hiddenTestResults` 생성 경로 확보 |
| 2026-04-20 | 이터레이션 11 — DEPLOY.md 작성. 4단계 배포 플레이북(로컬 검증 12단계 시나리오 → 남은 블로커 → Vercel/Supabase 배포 → 파일럿 1회·회고). env 매트릭스, 보안 체크리스트, 문제 해결 표. 총 2~3일로 파일럿 가능 명시. | `DEPLOY.md`, `README.md`에 링크 | 실제 인프라 붙이는 순서 고정화 |
| 2026-04-20 | 이터레이션 12 — 마지막 코드 블로커 2건 해결. `apps/student/lib/seed-private.ts` 로더(prefix 추출 + env override). `/api/submit`: Judge0 env + hidden tests 파일 있으면 서버가 `runHiddenTests` 실행해 `hiddenTestResults` 생성 → Assessment correctness 실제 값. `/api/chat`: `loadReferenceSolution` 호출 후 `checkSafety({ referenceSolution })`로 Safety Guard 유사도 검사 활성화. AIPanel에 `assignmentCode` prop. `next.config` outputFileTracingIncludes로 Vercel 빌드 포함. 누적 110 단위 테스트(seed-private 4 신규). | `apps/student/{lib/seed-private.ts,app/api/{submit,chat}/route.ts,components/{AIPanel,StudentWorkspace}.tsx,next.config.ts}`, `packages/wasm-runtime/src/index.ts` | 채점 파이프라인 end-to-end 완결 + reference 유출 차단 |
| 2026-04-21 | Genesis 디자인 시스템 전면 적용 — Indigo primary #6366F1, General Sans(display) + DM Sans + JetBrains Mono, shadow/radius 토큰, 버튼·배지 cva 변형, 학생 + 교사 레이아웃 재작성. ModeSwitch/LiveEvents/TeacherDashboard 등 UI 재스타일. | `apps/{student,teacher}/{tailwind.config.ts,globals.css,components/*,app/login}`, `packages/shared-ui/src/components/{Button,Badge}.tsx` | 파일럿 시각적 정체성 확립 |
| 2026-04-21 | 대화 로그 교사 전용 열람 + 학습목표 + 헤더 제목 변경 + reflection 2→3→5문항 흐름. `conversations` 테이블(turn-level, RLS teacher-only), 교사 `/student/[id]` 대화 로그 10초 폴링, AssignmentPanel 상단 학습목표 2개, 헤더 CVibe → 경북대학교 프로그래밍1. | `packages/xapi/src/conversation-store.ts`, `supabase/migrations/20260421000000_conversations.sql`, `apps/{student,teacher}/{app/api,components}` | 교사 개별 지도 기반 마련 |
| 2026-04-21 | 논문용 Research Lab 레이어 분리 + Paper 1·3 대시보드. `packages/xapi/src/analytics/{cascade,offloading,linguistic}.ts` 순수 함수 10 단위테스트. 교사 `/research/{cascade,offloading}` 페이지 — Sankey 전환표, 4-cluster histogram, latency eCDF, dependency trajectory sparkline, gaming/struggling scatter, Korean 언어 특징 프로파일. Figure 별 variable 정의·formula 주석 명시. | `packages/xapi/src/analytics/*`, `apps/student/app/api/analytics/dump`, `apps/teacher/app/{api/research,research}` | 교사 실시간 vs 연구 분석 레이어 분리 |
| 2026-04-21 | Supabase 실 DB 전환 — turn-level conversations 스키마 마이그레이션, 교사 `/api/classroom` + `/api/student/[id]` fetchClassroomData + createServiceRoleClientIfAvailable, 학생 `/api/chat` + `/api/submit` Supabase INSERT, `/api/analytics/dump` events + conversations SELECT. `SUPABASE.md` 7단계 플레이북 문서화(프로젝트 생성 → 키 수집 → migrations → auth + profile 트리거 → Vercel env 매트릭스 → 검증). `packages/db/src/writes.ts` service_role 기반 insertConversationTurn · insertSubmission. | `supabase/migrations/20260421000000_conversations.sql`, `packages/db/src/{writes,queries}.ts`, `apps/{student,teacher}/app/api/**`, `SUPABASE.md` | env 주입만으로 실DB 전환 자동화 |
| 2026-04-21 | 이터레이션 — Supabase 연결 문제 해결. (1) profiles FK → auth.users 제약 드롭해 seed teacher 허용, (2) cohort UUID 통일 DEMO_COHORT_ID='00000000-0000-4000-8000-000000000010', (3) seed.sql 의 `cohort-2026-spring-cs1` 문자열 → UUID 치환, (4) 디버그 엔드포인트 /api/debug/env 도입 후 제거, (5) turbo.json globalEnv 에 DATABASE_URL·STUDENT_APP_INTERNAL_URL 등 6개 추가. Resend Custom SMTP 연동 안내 + 비밀번호 로그인 UI 추가(`/login` 에 매직링크/비밀번호 토글). | `packages/db/src/seeds/demo-cohort.ts`, `supabase/migrations/*`, `turbo.json`, `apps/{student,teacher}/app/login/page.tsx` | 파일럿 시 블로커 제거 |
| 2026-04-22 | 학생 대시보드 교육자 제안 7종 반영 — Progress Tracker(좌측 진행 막대 + 과제 상태 배지), 제출 이력 MyLearningDialog, Focus Mode 15분 타이머 오버레이, Stuck Diagnostic 4선택지 접이식 패널, Microcelebration 토스트(컴파일/제출 통과), Walkthrough Prompt(30분 정체 시 KC self-check), 실시간 경과 타이머 + 통과 카운트. `/api/my/submissions` Supabase submissions + assignments JOIN. | `apps/student/app/api/my/submissions`, `apps/student/components/{MyLearningDialog,FocusMode,Celebration,StuckDiagnostic,WalkthroughPrompt}.tsx`, `apps/student/components/{AssignmentPanel,StudentWorkspace,AIPanel,SubmitDialog}.tsx` | 학생 자기주도 학습 도구 강화 |
| 2026-04-22 | 평가 UX 재설계 — 5단계 Proficiency(🏆 탁월/✨ 능숙/📘 발전 중/🌱 시작/🛠 진행) + 3구역 Diagnostic Report(문제 해결/코드 품질/성찰 깊이). 시도 delta("↑8p"), Dependency flag(🎯 Independent/👣 Guided/🤝 Assisted), 주간 성장 비교(자기 과거와만). 교사 UI 는 원 rubricScores 유지. reflection 5→3문항 단순화(시안 A: 통합 Q1 + 대안 Q3 + 전이 Q5). | `apps/student/lib/proficiency.ts`, `apps/student/components/{SubmitDialog,MyLearningDialog}.tsx`, `packages/agents/src/runtime/assessment.ts` | 점수 → 성장 프레임 전환, 낙인 방지 |
| 2026-04-22 | AI 모드 4→3 재설계 + 교육학적 실질화 — silent/observer/tutor → solo/pair/coach. HINT_CEILING(solo=1·pair=3·coach=4), Safety 유사도 임계 차등(0.10/0.25/0.40), mode 전환 시 시스템 메시지 턴 자동 주입, Coach 모드 컴파일 실패 시 AI 선제 개입(errorType별 친근한 메시지), 입력창 placeholder 모드별. ModeSwitch UI 스펙트럼 시각화, 레거시 DB 값 normalizeMode 로 자동 정규화. | `packages/agents/src/state.ts`, `packages/agents/src/runtime/{gating,safety-guard}.ts`, `apps/student/components/{ModeSwitch,AIPanel,StudentWorkspace}.tsx`, `apps/teacher/components/InterventionActions.tsx` | 모드가 이름만이 아니라 실제 동작 차이 확보 |
| 2026-04-22 | exam 모드 정식 도입 + SRL novel indicator + 실시간 모드 도넛. HINT_CEILING[exam]=0 전면 차단, 교사 전용 활성(🔒 시험 버튼), AIPanel 전체 오버레이. Verbs.modeDecreased/examStarted/examEnded xAPI verb 추가, `/api/events/record` whitelist 엔드포인트. StudentWorkspace MODE_RANK 기반 자발적 하향 감지(Coach→Pair→Solo). 교사 TeacherDashboard 에 ModeDonut(SVG 도넛, 20초 폴링, 최근 100턴 집계). | `packages/agents/src/state.ts`, `packages/xapi/src/verbs.ts`, `apps/student/app/api/events/record`, `apps/teacher/{components/ModeDonut,app/api/classroom/modes}` | 교사 Orchestration Cockpit + Paper 3 연구 데이터 완비 |
| 2026-04-22 | 버그/CI 정리 — Celebration 토스트 useEffect deps 에 onDismiss 포함돼 부모 리렌더마다 타이머 리셋되던 버그 수정(ref + message.id 만 deps). GitHub Actions `pnpm/action-setup@v4` Multiple versions 에러(workflow version:9 + package.json packageManager 충돌) 해결 — version:9 줄 제거. 디버그 엔드포인트 `/api/debug/env` 삭제. | `apps/student/components/Celebration.tsx`, `.github/workflows/{ci,e2e,lighthouse}.yml`, `apps/teacher/app/api/debug/env` 삭제 | 파일럿 전 안정화 |
| 2026-05-01 | 학생 데이터 파이프라인 보강 (12회 commit) — events DB persist + run/AI 분석 영구 저장, code-reviewer 환각 BLOCKER 차단(정답·통과 신호 주입), A01 5x4 행·열 합산 문제로 교체, hiddenTests + referenceSolution 을 assignments.ts 인라인 (seed-private 자동 export), 제출 매트릭스 셀 클릭 모달, AI 분석 탭, 사용성 6종(starter TODO 완화 등), AssignmentPanel 마지막 작업 과제 자동 복원·통과 시 다음 과제 자동 진입. | `apps/student/app/api/{run,submit,chat,review,debug}`, `apps/teacher/components/SubmissionCodeModal.tsx`, `packages/db/src/seeds/assignments.ts`, `packages/agents/src/runtime/code-reviewer.ts` | 데이터 영속성·UX 안정화 |
| 2026-05-12 | 데이터 파이프라인 #1~#11 보강 + A02·A03 카탈로그 교체 + Vercel 배포 회복. (1) Student Modeler cron (매일 03:00 UTC) → mastery/misconceptions 갱신, (2) events.student_id ctx 결정적 채움, (3) conversations.assignment_id text→uuid, (4) DB write counters + `/api/health/db-writes`, (5) 교사앱 fetchAnalyticsFromDb 직접 SELECT (학생앱 프록시 제거), (6) status='removed' 학생 모든 집계에서 제외, (7) admin endpoint requireTeacher 가드, (8) dump dependency/transfer 실DB 기반, (9) submissions.evidence 에 hidden test 결과 저장, (10) drift-check cron + `/settings` Reseed Assignments 버튼, (11) `/api/health` 통합. A02: 포인터 함수 swap → 포인터 산술 순회+max/min. A03: 배열 합산 → fgets+tolower 문자열 처리. `UNLOCKED_PREFIXES` 에 A02, A03 추가. **Vercel webhook 11일 끊김 사고** — `.github/workflows/deploy.yml` (GitHub Actions Vercel CLI 직접 배포) 로 영구 우회. `/api/admin/purge-assignment-history` (dry-run + confirm 2단계) + `/settings` UI 추가. | 광범위 (변경 이력 자세히는 git log 참조) | 운영 안정성 + 데이터 무결성 + 카탈로그 교체 플레이북 검증 |
