---
name: kc-mastery-tracking
description: CS1 학생의 KC(Knowledge Component) 숙련도 벡터를 BKT/DKT/LLM-KT 혼합 방법으로 누적 갱신. Student Modeler가 kcDelta를 받거나 이벤트 로그를 배치 처리할 때 반드시 이 스킬을 사용. 단일 관찰로 mastery를 크게 움직이지 말 것 (|delta| ≤ 0.15).
---

# KC Mastery Tracking

학생의 개념 숙련도를 **불확실성을 보존한 채** 누적 갱신하는 방법론. research.md §2.2 / §5.2 / §5.4 근거.

## 핵심 원칙 — Why

Knowledge Tracing은 노이즈가 많은 신호(제출 성공/실패, 힌트 요청, 에러 유형)에서 잠재된 개념 숙련도를 추정하는 문제다. 단일 관찰로 mastery를 0.3 → 0.8로 올리면 **과적합**되어 다음 실수에서 급락하는 불안정한 모델이 된다. 따라서:

1. 한 번에 큰 변화 금지
2. point estimate와 함께 **confidence**를 유지 (데이터 부족은 모델이 알아야 한다)
3. BKT의 간결함 + LLM의 미세 해석을 결합 ([arXiv 2409.16490](https://arxiv.org/html/2409.16490v2))

## KC 카탈로그 (CS1 C 기초)

| KC | 관련 에러 유형 | 평가 이벤트 |
|----|----------------|--------------|
| `variables-types` | 미선언, 타입 불일치 | 선언·대입 성공 |
| `control-flow-if` | 조건 누락, else 누락 | 분기 정확성 |
| `control-flow-loop` | 무한루프, 경계 오류 | 루프 종료 정확성 |
| `arrays-indexing` | OOB, off-by-one | 인덱스 산술 |
| `pointer-basics` | NULL 역참조, 주소 연산 | `*`, `&` 용법 |
| `pointer-arithmetic` | 포인터 증분 오류 | `p+i` 계산 |
| `memory-allocation` | malloc 후 free 누락, size 오류 | 동적 할당 |
| `functions-params` | 값/참조 혼동, 반환 누락 | 함수 호출 |
| `recursion` | 기저 조건 누락, 스택 폭발 | 재귀 호출 |
| `io-formatting` | printf/scanf 포맷 | 입출력 |

KC는 `domain_model.yaml` (별도 파일)에 확장 가능. 본 문서는 MVP 기준.

## 상태 구조

```json
{
  "mastery": {
    "pointer-arithmetic": {
      "value": 0.62,
      "confidence": 0.8,
      "observations": 14,
      "lastUpdated": "2026-04-20T10:22:00Z"
    }
  },
  "misconceptions": [
    {
      "kc": "pointer-arithmetic",
      "pattern": "NULL 체크 누락 반복",
      "occurrences": 4
    }
  ]
}
```

## 업데이트 규칙

### (A) Assessment의 `kcDelta` 수신 시

단일 제출의 성공/실패에서 파생된 델타를 가중 평균으로 반영:

```
new_value = old_value + delta * (1 - old_confidence)
new_confidence = min(1.0, old_confidence + 0.05)
```

- `(1 - old_confidence)` 가중치 → confidence가 높을수록 단일 관찰의 영향 감소
- `delta` 상한: `|delta| ≤ 0.15`
- `observations` +1

### (B) 이벤트 로그 배치 처리 시

xAPI 이벤트 버퍼에서 KC 태그가 달린 이벤트를 모아 배치 업데이트:

| verb | 해석 | 델타 방향 |
|------|------|------------|
| `compile_success` | 정상 빌드 | +0.03 |
| `compile_error` | 같은 KC 반복 시 | -0.05 |
| `hint_request` Level 1~2 | 탐색적 학습 | 0 (중립) |
| `hint_request` Level 3~4 | 외부 의존 | -0.02 |
| `ai_suggestion_accept` without rationale | 맹목 수락 | -0.04 |
| `ai_suggestion_reject` with reason | 검증 능력 | +0.02 |
| `self_explanation_submitted` quality>0.7 | 메타인지 | +0.05 |
| `submission_passed` hidden test | 검증된 숙련 | +0.08 |

배치 전체의 누적 델타를 최종 적용할 때도 `|total| ≤ 0.15` 상한을 지킨다.

### (C) Misconception 탐지

같은 `(kc, errorType)` 페어가 **3회 이상** 반복되면 `misconceptions` 리스트에 추가:

```json
{ "kc": "pointer-arithmetic",
  "pattern": "malloc 후 free 누락",
  "occurrences": 3,
  "firstSeen": "...",
  "lastSeen": "..." }
```

`misconceptions`는 Teacher Copilot의 Common Misconception Panel로 전달된다.

## Fading Signal

`mastery[kc].value >= 0.75 AND confidence >= 0.7` → `fadingSignals`에 `{ kc, action: "reduce-support" }` 추가. Pedagogy Coach가 해당 KC의 힌트 Level을 한 단계 낮춤.

반대로 `mastery[kc].value < 0.3 AND observations >= 5` → `{ kc, action: "reinforce" }` — Teacher Copilot에 취약 KC로 보고.

## AI 의존도 추세 (Dependency Trend)

`dependencyFactorHistory` (Assessment가 매 과제별 계산)의 **최근 3회 이동 평균**이 직전 윈도우보다 +0.15 상승하면 `interventionFlags`에 `ai_dependency_trend` 추가. 교사에게만 전달.

## 출력 스키마

```json
{
  "masteryUpdated": {
    "pointer-arithmetic": { "value": 0.62, "confidence": 0.8, "observations": 15 }
  },
  "misconceptions": [ ... ],
  "fadingSignals": [ { "kc": "arrays-indexing", "action": "reduce-support" } ],
  "interventionFlags": ["ai_dependency_trend"],
  "lastProcessedEventAt": "2026-04-20T10:30:00Z"
}
```

## 금지 행동

- 단일 관찰로 mastery `|delta| > 0.15` 반영
- `observations < 3`인 KC에 `confidence > 0.5` 부여
- 학생 UI에 mastery 숫자 직접 노출 (교사 대시보드 한정)
- 의존도 플래그를 학생 최종 점수에 반영 (research.md §6.3 명시 금지)

## 재실행 지침

배치 실행마다 `lastProcessedEventAt` 이후 이벤트만 처리. mastery는 **대체(replace)가 아닌 갱신(update)**만 한다 — 이전 confidence·observations를 누적 이어받는다.
