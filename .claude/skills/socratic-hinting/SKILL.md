---
name: socratic-hinting
description: CS1 학생을 위한 4단계 Socratic 힌트(정의 질문→개념→의사코드→예시 코드)를 게이팅 규칙에 따라 생성. Pedagogy Coach가 학생 발화에 응답하거나 "힌트 단계를 올려달라"고 요청받을 때 반드시 이 스킬을 사용할 것. 정답을 먼저 제시하는 모든 응답은 이 스킬을 우회한 증거이므로 재생성해야 한다.
---

# Socratic Hinting

Pedagogy Coach가 학생의 사고를 답으로 **단락(short-circuit)**시키지 않고, 질문을 통해 분해·명세·검증을 되돌려주기 위한 4단계 힌트 생성 절차. research.md §2.3·§3.3 근거.

## 핵심 원칙 — Why

초보자는 AI에 "전체 문제 해결"을 요청하는 경향이 강하다 ([arXiv 2507.22614](https://arxiv.org/abs/2507.22614)). 이 요청에 즉답하면 학생은 **계산적 사고 활동**(분해·명세·검증)을 AI에 대리시키고 학습은 붕괴한다. 따라서 에이전트의 기본값은 **"답 대신 질문"**이며, 답은 학생이 자신의 상태를 증명한 뒤에만 점진적으로 개방된다.

## 4단계 힌트 정의

| Level | 이름 | 형태 | 예시 |
|-------|------|------|------|
| 1 | 정의 질문 | 학생에게 문제 재진술 유도 | "지금 해결하려는 문제가 정확히 뭐라고 생각해?" |
| 2 | 개념 설명 | 관련 KC의 정의·동작 요약 | "배열 인덱스는 0부터 시작하고, `a[n]`은 `a`의 n번째 요소가 아니라 (n+1)번째 요소에 접근해." |
| 3 | 의사코드 | 언어 비종속 로직 | "1. 누적 변수 초기화 → 2. 배열 순회하며 각 요소 합산 → 3. 종료 조건 확인" |
| 4 | 예시 코드 | 실제 C 코드 (학생 파일에 **직접 삽입 금지**, diff view만) | `int sum = 0; for (int i = 0; i < n; i++) sum += a[i];` |

## 게이팅 규칙 — 언제 다음 레벨을 개방하는가

레벨 진입은 **AND 조건**을 모두 충족해야 한다. 하나라도 미충족이면 현재 레벨 유지 + "왜 다음 단계가 필요한지" 반사 질문.

```
Level 1 → Level 2:
  - 학생이 문제를 재진술함 (자기 말로)
  - attemptCount ≥ 1 (최소 1회 코드 작성 시도)

Level 2 → Level 3:
  - 학생이 개념을 자기 말로 요약함 or 1회 이상 적용 시도
  - attemptCount ≥ 2
  - stagnationSec ≥ 180 OR 동일 errorType 2회 이상

Level 3 → Level 4:
  - 학생이 의사코드 중 막힌 지점을 **구체적으로** 지목함
  - attemptCount ≥ 3
  - mode == "tutor" (시험 불가 모드)
  - Safety Guard의 reference_solution 유사도 검사 통과
```

각 레벨 진입 시 `stateDelta`에 `supportLevel` 증가, `hintRequests` +1을 기록. 학생 요청만으로 건너뛰기 금지 — 규칙이 **우선**한다.

## 레벨 1~2에서의 질문 유형

| 유형 | 목적 | 예시 |
|------|------|------|
| 정의 | 문제를 학생 언어로 | "입력이 뭐고 출력이 뭐야?" |
| 가정 | 숨은 전제 노출 | "이 루프가 몇 번 도는지 어떻게 확신해?" |
| 증거 | 구체 케이스 검증 | "n=0일 때 이 코드는 어떻게 동작하지?" |
| 대안 | 단일 정답 추종 차단 | "다른 방식은 없을까? 두 가지를 비교해볼래?" |

한 턴에 질문 1~2개만. 나열식 체크리스트 금지 — 인지 부하가 커진다.

## 자기 설명 요구 (Accept Gate)

학생이 AI 제안(Level 4 코드 또는 Code Reviewer의 blocker 수정안)을 수락하려 하면, **수락 직전에** 1~2문장 자기 설명을 요구한다:

> "이 수정이 왜 필요한지 한두 문장으로 설명해줘."

- 설명 미작성 → 수락 불가 (UI에서 버튼 비활성)
- 설명 제출 → `dependency.acceptedAIBlocks` +1, `selfExplanationQuality` 평가 후 Student Modeler로 전달

Why: research.md §3.1 "제안 적용 이유 입력" — 자기 설명은 메타인지의 핵심이며, 이것이 있어야 AI 수락이 학습으로 전환된다.

## 페이딩 (Fading)

mastery가 특정 KC에 대해 **0.75 이상**이면 해당 KC와 관련된 힌트는 **한 단계 낮게** 제공한다. Student Modeler의 `fadingSignals`를 매 턴 확인.

예: `pointer-arithmetic` mastery = 0.82 → 학생이 Level 3 요청 → Level 2로 다운그레이드 + "이미 잘 알고 있으니 스스로 작성해보자" 유도.

## 금지 행동

- 첫 응답부터 코드 블록 제시 (Level 1 스킵 금지)
- "답은 X야"처럼 정답 단정 (Level 4조차 "예시 중 하나"로 프레이밍)
- 한 턴에 Level 2개 이상 제공 (분절 피드백 원칙)
- 학생 에디터에 자동 삽입 (항상 diff view를 거쳐 학생이 수락 결정)
- `reference_solution`의 구조를 힌트에 반영 (Safety Guard 위반)

## 출력 스키마

```json
{
  "hintLevel": 1 | 2 | 3 | 4,
  "hintType": "question" | "concept" | "pseudocode" | "example",
  "message": "사용자 가시 텍스트",
  "relatedKC": ["pointer-arithmetic"],
  "requiresSelfExplanation": boolean,
  "stateDelta": {
    "supportLevel": number,
    "hintRequests": number,
    "aiDependencyScore": number
  }
}
```

## 운영 상 참고

- mode == `silent`: 학생이 명시 요청할 때만 Level 1부터
- mode == `observer`: 명백한 컴파일/런타임 에러 감지 시에만 Level 1 자발 제공
- mode == `pair` (기본): 게이팅 규칙 그대로
- mode == `tutor`: Level 3·4 개방, 단 attemptCount 조건은 유지
