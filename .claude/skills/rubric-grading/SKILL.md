---
name: rubric-grading
description: 학생 C 제출물을 4축 루브릭(correctness 0.5 / style 0.15 / memory_safety 0.2 / reflection 0.15)으로 채점하고 AI 의존도 지표를 계산. Assessment 에이전트가 제출물을 평가할 때 반드시 이 스킬을 사용. Dependency Factor는 최종 점수 감점에 사용하지 않을 것.
---

# Rubric Grading

research.md §6.1 / §6.2 / §6.3의 자동 채점 절차. 루브릭 가중치를 엄격히 적용하고, 모든 점수에 **증거 인용**을 첨부한다.

## 핵심 원칙 — Why

1. **보수적 평가** — 애매한 코드는 낮은 점수 대신 "증거 불충분" 플래그. 학생이 시스템 때문에 불이익을 받지 않아야 한다.
2. **증거 없는 점수 금지** — 모든 점수는 `evidence.lineRanges`로 검증 가능해야 한다. LLM 환각을 막는 유일한 방법.
3. **의존도 낙인 금지** — Dependency Factor는 교사 내부 지표일 뿐, **최종 점수에 감점으로 반영하면 학습 의지를 꺾는다** ([Springer 10.1007/s10639-024-12523-3](https://link.springer.com/article/10.1007/s10639-024-12523-3)).

## 루브릭 가중치 (기본값)

research.md §6.1 명시 — 과제별 override 가능하지만 총합 1.0 유지:

```yaml
correctness: 0.5      # 스펙 준수, hidden test 통과
style: 0.15           # 코스 스타일 가이드
memory_safety: 0.2    # UB/leak/OOB 없음
reflection: 0.15      # 메타인지 답변 품질
```

## 축별 채점 규칙

### (1) Correctness (0.5)

```
correctness = passed_tests / total_tests  (0~1 비율)
```

- **hidden test 우선**: Runtime Debugger의 `hiddenTestResults` 사용
- 부분 통과 인정: 5개 중 4개 통과 → 0.8
- 타임아웃·runtime error는 해당 테스트만 0 처리 (전체 무효화 금지)
- `evidence.lineRanges`: 실패한 테스트의 첫 발생 라인

### (2) Style (0.15)

`clang-tidy`/스타일 린터의 `warning` 카운트 기반:

```
style = max(0, 1 - warnings * 0.1)  # 10회 위반 시 0
```

- `evidence.lineRanges`: 각 warning 위치
- 네이밍·들여쓰기·함수 길이 기준은 `courseStyleGuide` 인자 참조

### (3) Memory Safety (0.2)

Code Reviewer의 `findings` 중 `category: "memory-safety"` 개수와 severity로 계산:

```
deductions = (blocker × 0.5) + (major × 0.25) + (minor × 0.1)
memory_safety = max(0, 1 - deductions)
```

- `evidence.lineRanges`: 각 finding 위치
- `lintC` 실행 실패 → `memory_safety: null`, `evidence.partial: true`

### (4) Reflection (0.15)

학생 리플렉션 텍스트(research.md §3.4 5개 질문 응답)의 품질을 LLM 판정:

| 품질 요소 | 기준 | 가중치 |
|-----------|------|--------|
| 구체성 | 특정 라인·변수·에러 언급 | 0.3 |
| 메타인지 | "왜 그렇게 생각했는가" 답변 존재 | 0.3 |
| 대안 비교 | 두 개 이상 해결안 비교 | 0.2 |
| 자기 평가 | AI 의존 수준 인지 | 0.2 |

```
reflection = sum(각 요소 점수 * 가중치)
```

**리플렉션 누락 시 전체 제출 무효** — `passed: false`로 반송.

## Final Score

```
finalScore = 
  correctness * 0.5 +
  style * 0.15 +
  memory_safety * 0.2 +
  reflection * 0.15
```

`null` 축은 해당 가중치만큼 `finalScore`도 비례 축소 후 `evidence.partial: true`.

## Dependency Factor 계산

research.md §6.3 공식 — 0~1 값, **최종 점수 영향 금지**:

```
dependencyFactor = normalize(
  0.3 * (hintRequests_L3_L4 / totalInteractions) +
  0.3 * (acceptedAIBlocks_without_rationale / totalAccepts) +
  0.2 * (1 - avg_question_depth) +   # follow-up 수 역수
  0.2 * (1 - reflectionQuality)
)
```

- 값 구간: 0 (완전 자립) ~ 1 (완전 의존)
- 해석은 교사에게만 (`teacherOnlyNotes` 필드)
- 여러 과제에 걸친 추세는 Student Modeler가 분석 (`dependencyFactorHistory`)

## KC Delta 산출

Assessment는 Student Modeler가 쓸 `kcDelta`를 부산물로 생성:

- 성공한 hidden test에 태깅된 KC → `+correctness / (2 * len(kc_tags))`
- 실패한 test의 KC → `-0.05` (과하지 않게)
- memory_safety blocker의 KC → `-0.08`

상한: 각 KC당 `|delta| ≤ 0.15`.

## 출력 스키마

```json
{
  "rubricScores": {
    "correctness": 0.9,
    "style": 0.7,
    "memory_safety": 0.8,
    "reflection": 0.85
  },
  "finalScore": 0.83,
  "passed": true,
  "evidence": [
    { "criterion": "correctness",
      "lineRanges": [[12,15]],
      "note": "test #3 input=0 failed: expected 0, got -1",
      "partial": false }
  ],
  "kcDelta": { "pointer-arithmetic": +0.08, "arrays-indexing": +0.12 },
  "dependencyFactor": 0.42,
  "teacherOnlyNotes": "의존도 중간, 강한 힌트 2회 사용"
}
```

## 금지 행동

- `dependencyFactor`를 `finalScore` 계산에 포함
- 리플렉션 통과 없이 `passed: true` 반환
- `evidence` 없는 점수 발행
- 학생에게 `dependencyFactor` 노출 (teacher-only)

## 재실행 지침

재채점 시 이전 `rubricScores`를 로드. 학생이 리플렉션만 보완한 경우 reflection 축만 재계산하고 나머지는 유지. 코드 수정 재제출이면 전체 재평가.
