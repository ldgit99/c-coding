---
name: xapi-event
description: 모든 학습 상호작용(hint_request, compile_error, ai_suggestion_accept 등)을 xAPI(Experience API) 스테이트먼트로 빌드하고 LRS에 기록. 전 에이전트가 학생·교사 행동을 로깅할 때 반드시 이 스킬을 사용. PII는 learner ID로 치환하여 최소화.
---

# xAPI Event Logging

research.md §4.4 근거. 모든 학습 이벤트를 **표준화된 3요소(actor, verb, object)**로 기록해 LRS(Learning Record Store) 호환을 유지한다.

## 핵심 원칙 — Why

학습 분석의 가치는 **비교 가능한 포맷**에 있다. 각 에이전트가 자유 형식으로 로그를 쌓으면 Teacher Copilot과 Student Modeler는 매번 파싱 로직을 새로 짜야 한다. xAPI 스테이트먼트 표준은 외부 LRS·연구 데이터셋·다음 학기 이전 모두에 호환된다.

동시에 FERPA/개인정보 이슈를 막기 위해 PII는 **원본 이름이 아닌 learner ID**로 치환한다. 교사 세션에서만 ID ↔ 이름 매핑을 복호화.

## 스테이트먼트 구조

```json
{
  "actor": {
    "account": { "name": "learner_042", "homePage": "https://cvibe.app" }
  },
  "verb": {
    "id": "https://cvibe.app/verbs/requested-hint",
    "display": { "en": "requested hint", "ko": "힌트 요청" }
  },
  "object": {
    "id": "https://cvibe.app/kc/pointer-arithmetic",
    "definition": {
      "type": "https://cvibe.app/activitytypes/knowledge-component",
      "name": { "en": "Pointer Arithmetic" }
    }
  },
  "result": {
    "extensions": {
      "https://cvibe.app/ext/hintLevel": "weak",
      "https://cvibe.app/ext/attemptNo": 3,
      "https://cvibe.app/ext/stagnationSec": 240
    }
  },
  "context": {
    "extensions": {
      "https://cvibe.app/ext/assignmentId": "A03_arrays_basic",
      "https://cvibe.app/ext/mode": "pair",
      "https://cvibe.app/ext/sessionId": "sess_..."
    }
  },
  "timestamp": "2026-04-20T10:22:11Z"
}
```

## 핵심 Verb 카탈로그

| verb | 발행 에이전트 | 주요 extensions |
|------|----------------|------------------|
| `requested-hint` | Pedagogy Coach | hintLevel, attemptNo, stagnationSec |
| `received-hint` | Pedagogy Coach | hintLevel, hintType |
| `compile-error` | Runtime Debugger | errorMessage, kc |
| `runtime-error` | Runtime Debugger | exitCode, errorType |
| `submission-passed` | Assessment | testsPassedRatio, rubricScores |
| `submission-failed` | Assessment | failedTestIds, partialScore |
| `ai-suggestion-accepted` | Pedagogy Coach | suggestionId, hadRationale, rationaleQuality |
| `ai-suggestion-rejected` | Pedagogy Coach | suggestionId, reason |
| `self-explanation-submitted` | Pedagogy Coach | quality(0~1), wordCount |
| `reflection-submitted` | Assessment | completedPrompts, avgQuality |
| `blocked-by-safety` | Safety Guard | reason, similarityScore |
| `teacher-intervened` | Teacher Copilot | interventionType, level |
| `mode-changed` | Supervisor | from, to, initiator (student/teacher) |
| `mastery-updated` | Student Modeler | kc, oldValue, newValue, delta |
| `intervention-flagged` | Student Modeler | flagType, reason |

## 필드 빌드 규칙

### actor
- 학생: `learner_{studentId_hash}` — studentId는 SHA-256 해시 첫 12자
- 교사: `teacher_{teacherId_hash}`
- 시스템(에이전트 자동): `agent:{agentName}` (homePage 생략)

### verb.id
URI 스펙 준수: `https://cvibe.app/verbs/{kebab-case}`. 신규 verb 추가 시 본 카탈로그를 먼저 업데이트.

### object
우선순위:
1. 상호작용이 특정 KC에 귀속 → `https://cvibe.app/kc/{kc-slug}`
2. 과제에 귀속 → `https://cvibe.app/assignment/{assignment-id}`
3. 코드 조각 → `https://cvibe.app/code/{submission-id}`

### timestamp
항상 UTC ISO 8601. 브라우저 클럭 신뢰하지 않고 서버 수신 시각으로 덮어쓴다.

### context.extensions
세션 메타데이터는 모두 `context`에 넣고 `result`와 분리 — `result`는 **측정 가능한 성과만**.

## PII 최소화

다음 값은 **절대** 스테이트먼트에 포함하지 않는다:

- 학생 실명, 이메일, 학번
- 교실 위치, IP 주소
- 학생 코드의 주석 중 자유 서술 텍스트 (prompt injection 위험)
- reference_solution의 전문이나 부분 (Safety Guard가 검사)

학생 코드 자체는 필요 시 `object`의 `submission-id`로 참조하고, 실체는 별도 DB에 RLS(Row Level Security)로 저장.

## 배치 쓰기

단일 스테이트먼트당 network round-trip 비용이 크므로 버퍼링:

- 버퍼 크기: 50개 또는 10초 경과 시 flush
- 장애 시 localStorage에 큐잉 후 재시도 (최대 3회)
- Supervisor가 세션 종료 이벤트에서 강제 flush

## 출력 스키마 (스킬 반환)

```json
{
  "statement": { ... 위 구조 ... },
  "bufferStatus": "queued" | "flushed",
  "warnings": ["pii_redacted:free_text"]
}
```

## 금지 행동

- `result.extensions`에 학생 자유 서술 텍스트 원문 저장 (요약·점수만)
- 타임스탬프에 브라우저 로컬 시간 사용
- verb를 카탈로그 외 임의 문자열로 발행 (LRS 호환성 파괴)
- learner ID를 해시 없이 원본 사용

## 재실행 지침

재연결 시 `localStorage` 큐를 먼저 flush한 뒤 새 이벤트를 쌓는다. 중복 스테이트먼트는 `id` 필드 UUID로 dedup.
