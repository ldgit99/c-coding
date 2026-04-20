---
name: cvibe-orchestrator
description: CVibe 학생-AI 짝프로그래밍 플랫폼의 멀티 에이전트 워크플로우를 조율하는 오케스트레이터. 학생 상호작용/평가/과제 출제/교사 대시보드 4개 시나리오(A~D)에 따라 팀을 재구성한다. 학생 코드 피드백·힌트 응답 생성, 제출 채점, 신규 과제 생성, 대시보드 요약, "멀티 에이전트 실행/재실행/업데이트" 등 CVibe 도메인 작업 전반을 트리거. research.md §5 카탈로그를 실행하라는 요청에도 반드시 호출.
---

# CVibe Orchestrator

research.md §5.3의 Supervisor 중심 오케스트레이션 그래프를 Claude Code 에이전트 팀으로 실행하는 조율 스킬. 9개 에이전트는 상황에 따라 **4개 시나리오 팀**으로 재구성된다.

## 핵심 원칙

1. **에이전트 팀 + Phase별 재구성** — 9명이 한 팀이 되지 않는다. 각 시나리오에서 필요한 3~5명만 팀을 구성하고, 시나리오 종료 시 `TeamDelete` 후 다음 팀으로 전환.
2. **Safety Guard는 모든 팀 기본 멤버** — 시나리오 A/B/C 모두에 포함.
3. **Supervisor가 시나리오 선택** — 학생·교사 발화 분류 결과에 따라 라우팅.
4. **모든 에이전트 호출에 `model: "opus"` 명시** — CLAUDE.md 규약.

## Phase 0: 컨텍스트 확인

워크플로우 시작 시 다음을 판별해 실행 모드를 결정한다:

- `_workspace/session_{studentId}.json` **존재 + 사용자가 부분 수정 요청** → **부분 재실행** (해당 에이전트만 재호출, 이전 상태 이어받음)
- `_workspace/session_{studentId}.json` **존재 + 새 과제/새 학생 시작** → **새 실행** (기존 workspace를 `_workspace_prev/`로 이동)
- `_workspace/` 미존재 → **초기 실행** (새 세션 상태 생성)

세션 상태 파일 포맷은 `references/session-state.md` 참조 (research.md §5.4 `SessionState` 타입).

## Phase 1: 발화 분류 및 시나리오 선택

Supervisor가 입력을 다음 시나리오 중 하나로 분류:

| 시나리오 | 트리거 | 팀 구성 |
|---------|--------|---------|
| **A. 학생 상호작용** | 학생 발화(힌트 요청, 질문, 에러 문의, 코드 제출 외 일반) | Supervisor · Pedagogy Coach · Code Reviewer · Runtime Debugger · Safety Guard |
| **B. 평가/채점** | 학생의 명시적 "제출" 액션 | Supervisor · Code Reviewer · Runtime Debugger · Assessment · Student Modeler · Safety Guard |
| **C. 과제 출제** | 교사 발화 중 "과제 생성/추가/변형" | Problem Architect · Safety Guard · Teacher Copilot |
| **D. 교사 대시보드** | 교사 발화 중 "요약/개입 큐/분석" | Teacher Copilot · Student Modeler |

분류 불명확 → 시나리오 A로 기본 라우팅 (질문-먼저 원칙).

## Phase 2~5: 시나리오별 워크플로우

### 시나리오 A — 학생 상호작용

**실행 모드:** 에이전트 팀

```
1. TeamCreate(
     name: "cvibe-student-interaction",
     members: [supervisor, pedagogy-coach, code-reviewer, runtime-debugger, safety-guard],
     leader: supervisor
   )

2. Supervisor → TaskCreate({
     type: "classify_and_route",
     input: { utterance, sessionState, editorSnapshot }
   })

3. 분류 결과:
   - hint_request → Pedagogy Coach 호출 (socratic-hinting 스킬)
   - run_request → Runtime Debugger 호출
   - code_view_request → Code Reviewer 호출
   - 일반 대화 → Pedagogy Coach (Level 1 질문)

4. Pedagogy Coach가 응답 생성 전 Safety Guard에 outbound 검사 요청
   Safety Guard verdict:
   - allow → 학생 UI 반환
   - sanitize → 정제된 payload 반환
   - block → Pedagogy Coach 재생성 (최대 3회)

5. 모든 에이전트가 xapi-event 스킬로 이벤트 기록
   버퍼 flush: Supervisor가 턴 종료 시 일괄 처리

6. SessionState delta 머지 후 _workspace/session_{studentId}.json 저장

7. TeamDelete("cvibe-student-interaction") — 다음 턴에 재구성
```

### 시나리오 B — 평가/채점

**실행 모드:** 에이전트 팀 + 비동기 Student Modeler

```
1. TeamCreate(
     name: "cvibe-assessment",
     members: [supervisor, code-reviewer, runtime-debugger, assessment, safety-guard],
     leader: supervisor
   )

2. 병렬 실행 (TaskCreate):
   - Runtime Debugger: hidden_tests 실행
   - Code Reviewer: 정적 분석 (c-code-review 스킬)

3. Assessment 호출 (rubric-grading 스킬):
   input: {
     submission, assignment, hiddenTestResults,
     codeReviewerFindings, dependencyLog
   }

4. Safety Guard가 Assessment 출력을 검사 (reference_solution 유사도)

5. 결과를 2개 경로로 분기:
   - 학생 UI → finalScore, passed, 공개 피드백
   - Student Modeler 큐 → kcDelta (TaskCreate 비동기)

6. TeamDelete("cvibe-assessment")

7. (비동기) Student Modeler 단독 실행:
   - kc-mastery-tracking 스킬 사용
   - mastery 갱신, misconceptions 업데이트
   - Teacher Copilot에 interventionFlags 전송
```

### 시나리오 C — 과제 출제

**실행 모드:** 서브 에이전트 (단순 파이프라인)

```
1. Problem Architect 호출 (problem-templating 스킬):
   input: { kc, difficulty, variantCount, seed }

2. Problem Architect가 Safety Guard에 reference_solution 등록:
   registerProtected(reference_solution_path)

3. Safety Guard가 variants 전체를 검사 (참고 솔루션 유출 위험 탐지)

4. Teacher Copilot에 YAML 반환 → 교사 승인 대기

5. 교사 승인 후 assignments DB에 저장 (Assessment가 채점 시 이 rubric 사용)
```

### 시나리오 D — 교사 대시보드

**실행 모드:** 서브 에이전트 (집계 중심)

```
1. Teacher Copilot 호출:
   input: { request, cohortId, timeWindow, filters }

2. Teacher Copilot이 Student Modeler에 배치 실행 요청 (캐시 ≥ 5분이면 재실행)

3. Student Modeler가 mastery + misconceptions + flags 집계

4. Teacher Copilot이 위젯 JSON 생성 (widget: classroom_summary | intervention_queue | ...)

5. Safety Guard가 PII 유출 최종 검사

6. SSE 스트림으로 교사 UI 전송
```

## Phase 6: 에러 핸들링

| 에러 | 전략 |
|------|------|
| Pedagogy Coach 생성 3회 연속 block | Supervisor가 "일반 응답 실패, 재시도 필요" 메시지 반환 + Teacher Copilot에 경보 |
| Runtime Debugger 실행 타임아웃 | Judge0 API fallback 시도, 그것도 실패면 "실행 환경 오류" + 교사 수동 채점 경로 안내 |
| Assessment rubric 계산 실패 | 제출 상태를 `evaluating` 유지, 5분 후 재시도, 재실패 시 교사 큐로 이동 |
| Student Modeler 데이터 부족 | mastery 갱신 보류, 교사 대시보드에 "데이터 부족" 배지 |
| Safety Guard reference_solution 접근 불가 | **안전 쪽으로** (outbound 허용), Teacher Copilot에 경보 로그 |
| 상태 병합 충돌 | `_workspace/state_conflict_{ts}.json` 양 버전 보존, Supervisor가 후입 우선 + 교사 알림 |

## 데이터 전달 프로토콜

| 전략 | 용도 |
|------|------|
| **SendMessage** | 에이전트 간 실시간 조율 (Pedagogy↔Code Reviewer 협업) |
| **TaskCreate** | 비동기 Student Modeler 큐잉, 병렬 작업 (Runtime+Code Reviewer) |
| **파일 기반** | `_workspace/session_{id}.json` (SessionState), `_workspace/run_{ts}.log` (실행 결과), `_workspace/private/solutions/` (reference_solution) |
| **xAPI 이벤트** | 모든 상호작용은 xapi-event 스킬로 LRS에 기록 |

**중간 산출물 경로 컨벤션:**
- `_workspace/session_{studentId}.json` — 세션 상태
- `_workspace/submissions/{submissionId}.json` — 제출물 + 채점 결과
- `_workspace/private/solutions/{assignmentId}_ref.c` — 보호된 참고 솔루션
- `_workspace/events/buffer.ndjson` — xAPI 버퍼
- `_workspace/state_conflict_{ts}.json` — 충돌 백업

## 팀 크기 가이드

- 시나리오 A: 5명 — 권장 상한 근접, 팀원당 1~2 태스크 유지
- 시나리오 B: 5~6명 (Student Modeler 비동기면 5)
- 시나리오 C: 3명 — 소규모 집중
- 시나리오 D: 2명 — 집계 중심

## 테스트 시나리오

### 정상 흐름 (시나리오 A)

1. 학생이 A03 과제 편집 중 "힌트 줘" 발화
2. Supervisor가 `hint_request`로 분류 → 시나리오 A 팀 구성
3. Pedagogy Coach: attemptCount=1 → Level 1 정의 질문 생성
4. Safety Guard allow → 학생 UI 반환
5. xAPI 이벤트 `requested-hint`, `received-hint` 기록
6. SessionState `supportLevel: 1`, `hintRequests: 1` 저장
7. 팀 해체

### 에러 흐름 (시나리오 B)

1. 학생 제출 → 시나리오 B 팀 구성
2. Runtime Debugger 실행 중 2초 타임아웃
3. Judge0 fallback 시도 → 성공
4. Assessment 채점 수행, `evidence.partial: true`
5. 학생에게 "일부 테스트는 환경 문제로 검증 불가, 교사 검토 요청 중" 메시지
6. Teacher Copilot 큐에 `manual_review_needed` 플래그

## 후속 작업 지원

다음 요청이 들어오면 이 스킬을 재호출:
- "다시 힌트 줘", "재실행", "업데이트"
- "이전 제출 다시 채점"
- "대시보드 새로고침"
- "과제 variants 추가 생성"
- "이 학생 세션 이어서"

Phase 0의 컨텍스트 확인에서 이전 `_workspace/` 상태를 로드하여 자연스럽게 이어받는다.

## 금지 행동

- 9명을 한 팀으로 구성 (권장 상한 7 초과)
- Safety Guard 없이 학생에게 outbound 전송
- reference_solution을 Pedagogy Coach 컨텍스트에 주입
- Dependency Factor를 학생 UI에 노출
- 시나리오 C/D를 학생 발화로 트리거
