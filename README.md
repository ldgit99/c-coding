# CVibe — Collaborative Vibe Coding Agent for C

> 대학교 1학년 C언어 입문 학습자를 위한 학생–AI 짝프로그래밍 플랫폼

## 프로젝트 개요

- **도메인 설계 문서**: [research.md](research.md) — 교육학적 기반, 에이전트 아키텍처, 기술 스택, 배포 전략 전체
- **하네스 가이드**: [CLAUDE.md](CLAUDE.md) — Claude Code 기반 멀티 에이전트 개발 환경
- **설계 제1 원칙**: *Navigator Agent, Not Driver Agent* — 학생이 운전대를 잡고 AI는 옆자리에서 질문·안내·리뷰만 한다.

## 저장소 구조

```
cvibe/
├── apps/
│   ├── student/         # Next.js — 학생 에디터/챗 (port 3000)
│   ├── teacher/         # Next.js — 교사 대시보드 (port 3001)
│   └── docs/            # 학습 가이드·교사 매뉴얼 (port 3002)
├── packages/
│   ├── agents/          # Claude Agent SDK 정의 + 프롬프트 (9개 에이전트)
│   ├── shared-ui/       # 공용 컴포넌트 (shadcn/ui)
│   ├── db/              # Drizzle ORM 스키마 + 클라이언트
│   ├── wasm-runtime/    # C → WASM 브라우저 실행 래퍼
│   └── xapi/            # xAPI 이벤트 스테이트먼트 빌더
├── supabase/
│   ├── migrations/      # SQL 마이그레이션 (§7.4 테이블 + RLS)
│   └── config.toml
├── .claude/
│   ├── agents/          # 9개 에이전트 정의 (research.md §5)
│   └── skills/          # 도메인 스킬 + 오케스트레이터 (cvibe-orchestrator)
├── .github/workflows/
│   ├── ci.yml           # lint · typecheck · test · build
│   └── e2e.yml          # Playwright
├── turbo.json
└── pnpm-workspace.yaml
```

## 빠른 시작

### 1. 전제 조건

| 도구 | 최소 버전 | 용도 |
|------|-----------|------|
| Node.js | 20.11+ | 런타임 (`.nvmrc` 참조) |
| pnpm | 9+ | 모노리포 패키지 매니저 |
| Supabase CLI | 1.200+ | 로컬 DB·마이그레이션 |
| Docker | 최신 | Supabase 로컬 스택 |

### 2. 의존성 설치

```bash
pnpm install
```

### 3. 환경 변수

```bash
cp .env.example .env.local
# Supabase·Anthropic·Langfuse 키 채우기
```

### 4. Supabase 로컬 시작

```bash
supabase start           # Postgres + Auth + Realtime + Studio
pnpm db:push             # migrations/ 적용
```

Supabase Studio: <http://localhost:54323>

### 5. 개발 서버

```bash
pnpm dev                 # 모든 앱 병렬 실행 (Turborepo)
```

- 학생 앱: <http://localhost:3000>
- 교사 앱: <http://localhost:3001>
- 문서: <http://localhost:3002>

## 스크립트

| 명령 | 설명 |
|------|------|
| `pnpm dev` | 전 앱 개발 모드 |
| `pnpm build` | 전 앱 프로덕션 빌드 |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript strict |
| `pnpm test` | Vitest 단위 테스트 |
| `pnpm test:e2e` | Playwright E2E |
| `pnpm promptfoo` | 에이전트 프롬프트 회귀 테스트 |
| `pnpm db:push` | Supabase 마이그레이션 적용 |
| `pnpm db:reset` | 로컬 DB 리셋 |

## 하네스 — 멀티 에이전트 개발 환경

이 저장소는 [revfactory/harness](https://github.com/revfactory/harness) 기반으로 구성된 **Claude Code 멀티 에이전트 하네스**를 탑재한다.

- **9개 에이전트** 정의: [.claude/agents/](.claude/agents/)
- **7개 스킬** (도메인 6 + 오케스트레이터 1): [.claude/skills/](.claude/skills/)
- **진입점 스킬**: `cvibe-orchestrator` — 학생 상호작용/평가/과제 출제/교사 대시보드 4개 시나리오로 팀 자동 재구성

Claude Code 세션에서 "이 학생한테 힌트 줘봐", "제출 채점", "과제 variants 추가" 같은 요청을 하면 오케스트레이터가 알아서 팀을 꾸린다. 자세한 규약은 [CLAUDE.md](CLAUDE.md).

## 기술 스택 요약

| 레이어 | 선택 |
|--------|------|
| 프런트엔드 | Next.js 15 App Router + React 19 |
| 에디터 | `@monaco-editor/react` |
| C 실행 | Emscripten → WASM (Web Worker 격리, 2s/64MB 상한), Judge0 fallback |
| AI 오케스트레이션 | Vercel AI SDK 5 + Claude Agent SDK (TS) |
| DB/Auth | Supabase (Postgres + Auth + Realtime, RLS 적용) |
| 벡터 저장 | Supabase pgvector (KC 지식 그래프 RAG) |
| 관측성 | Langfuse (self-host) + Vercel Analytics + Sentry |

자세한 선택 근거는 [research.md §7](research.md#7-기술-스택-선정-및-근거).

## 보안·교육 원칙

### 에이전트 I/O 경계

- **Safety Guard**가 모든 outbound를 사전 검사 (정답 유출·프롬프트 인젝션·PII)
- `reference_solution`은 `supabase/seed-private/` 또는 `_workspace/private/`에만 저장하며 **절대 커밋 금지** (`.gitignore` 등재)
- 학생 경로 에이전트 (Pedagogy Coach, Code Reviewer)는 reference_solution에 구조적으로 접근 불가

### RLS 정책

- 학생은 **본인 데이터만** (profiles, submissions, conversations, mastery, events)
- 교사는 **담당 cohort 학생만** (select 한정)
- 쓰기는 service_role (서버 측 에이전트 경로)에서만 — 학생 브라우저는 anon + JWT

## 로드맵

[research.md §11 12주 스프린트](research.md#11-구현-로드맵-12주-스프린트) 참조.

| 주차 | 마일스톤 | 상태 |
|------|---------|------|
| 1–2 | 모노리포 부트스트랩, Supabase 스키마 | **진행 중** ← *지금 여기* |
| 3 | WASM C 실행 파이프라인 | 대기 |
| 4–5 | Supervisor + Pedagogy Coach MVP | 대기 |
| 6 | Code Reviewer + Runtime Debugger | 대기 |
| 7 | Assessment + Student Modeler | 대기 |
| 8 | Problem Architect + 과제 10개 | 대기 |
| 9 | 교사 대시보드 v1 | 대기 |
| 10 | Safety Guard + Dependency Factor + 리플렉션 | 대기 |
| 11 | E2E/Promptfoo/Lighthouse CI | 대기 |
| 12 | 교사 매뉴얼 + 파일럿 수업 | 대기 |

## 라이선스

미정 (교육 연구 프로젝트).
