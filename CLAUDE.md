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
