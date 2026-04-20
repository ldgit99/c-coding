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
