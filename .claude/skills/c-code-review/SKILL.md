---
name: c-code-review
description: 학생 C 코드를 정확성·메모리 안전성·스타일 3축으로 정적 분석하고 structured findings JSON을 산출. Code Reviewer 에이전트가 학생 코드를 검수하거나 blocker 여부를 판정할 때 반드시 이 스킬을 사용한다. 교체 코드 제안은 severity=blocker일 때만 허용.
---

# C Code Review

학생의 C 소스를 **수정하지 않고** 구조적으로 지적하는 방법론. research.md §5.5의 Code Reviewer 시스템 프롬프트 근거.

## 핵심 원칙 — Why

학생이 "AI가 고쳐준 코드"를 수락하면 **문제 인식 → 원인 탐색 → 수정 설계**의 학습 순환이 사라진다. 따라서 Code Reviewer는 기본적으로 **지점·질문·제안**만 반환하고, 학생의 editor에 자동 삽입하지 않는다. 교체 코드는 학생이 메모리 안전을 스스로 해결할 수 없는 `blocker`에서만 예외적으로 생성한다.

## 3축 분석

모든 review는 다음 순서로 수행한다 — 상위가 실패하면 하위는 보류한다(인지 부하 최소화).

### (1) 정확성 (Correctness) — 최우선

- 과제 스펙의 `입출력 예시` vs 실제 실행 결과 비교
- 엣지 케이스 (n=0, 빈 입력, 경계값) 동작 확인
- 힌트 테스트와 숨은 테스트의 결과 일치 여부

### (2) 메모리 안전성 (Memory Safety) — 두 번째

- **미정의 동작 (UB)**: 미초기화 변수 읽기, signed overflow, `NULL` 역참조
- **누수**: `malloc` 후 `free` 누락, exit path 중 일부 누수
- **경계 위반**: 배열 OOB, 포인터 증분 후 범위 이탈
- **소유권 혼란**: double free, use-after-free

`lintC(code)` tool (clang-tidy WASM) 실행 결과를 **증거로 인용**하되, LLM 판단으로 false positive를 걸러낸다.

### (3) 스타일 (Style) — 마지막

- 네이밍 (snake_case, 상수 UPPER)
- 들여쓰기 (코스 스타일 가이드 준수)
- 함수 길이 (50라인 초과 경고)
- 주석 (공백 주석, TODO 남김)

스타일 이슈는 상위 축이 모두 통과된 뒤에만 노출. 초보자에게 동시 노출하면 중요도 구분이 흐려진다.

## Severity 스케일

| 등급 | 기준 | 교체 코드 허용 |
|------|------|-----------------|
| `blocker` | 컴파일 불가, UB, crash, 평가 무효 | O (유일) |
| `major` | 정확성 오류, 스펙 미충족, leak | X |
| `minor` | 엣지 케이스 누락, 약한 가정 | X |
| `style` | 스타일 가이드 위반만 | X |

교체 코드를 첨부할 때도 `proposedCode`는 최소 변경만 (≤5라인 diff). 학생 해결 여지를 남긴다.

## Chunk 우선순위

초보자(`studentLevel: "novice"`)에게는 findings 전체 중 **상위 1~2개**만 `topIssues`로 노출. 나머지는 `findings` 배열에 두지만 UI에서 접힘 상태로 전달.

선정 규칙:
1. blocker 우선
2. 같은 severity라면 `kc` 태그가 현재 과제의 주 KC에 매칭되는 것
3. 라인 번호가 작은 것 (상단부터 읽으며 고치도록)

## 출력 스키마

```json
{
  "findings": [
    {
      "id": "f001",
      "severity": "blocker" | "major" | "minor" | "style",
      "line": 12,
      "column": 8,
      "category": "correctness" | "memory-safety" | "style",
      "kc": "pointer-arithmetic",
      "message": "무슨 문제인가 (학생 언어)",
      "suggestion": "확인해볼 질문 형태의 제안",
      "proposedCode": "severity=blocker에서만 포함, ≤5라인 diff",
      "evidence": {
        "lintToolRule": "clang-tidy: bugprone-null-dereference",
        "stdErrExcerpt": "..."
      }
    }
  ],
  "topIssues": ["f001"],
  "analysisMode": "lint+llm" | "llm-only",
  "summary": "반 1~2문장 요약"
}
```

## Pedagogy Coach와의 협업

Code Reviewer는 findings를 **그대로** 학생에게 보내지 않는다. 항상 Pedagogy Coach를 경유하여 질문 형식으로 재작성된다:

```
findings.suggestion: "line 12의 포인터 p는 어디서 할당되었는지 추적해보자"
  ↓ (Pedagogy Coach 변환)
학생 메시지: "line 12의 p를 한 번 볼까? 이 포인터가 처음 값을 받는 위치를 찾을 수 있어?"
```

Code Reviewer가 직접 학생에게 말하는 것은 `blocker` 등급의 긴급 중단 알림뿐이다.

## 금지 행동

- findings 없이 "전반적으로 OK" 반환 (반드시 최소 1개 발견 또는 명시적 `findings: []` + `summary`에 근거)
- 정답 코드와 근사한 교체 코드 생성 (Safety Guard 사전 검사 필수)
- 스타일 이슈를 blocker와 섞어 나열
- 학생 에디터 직접 수정

## 재실행 지침

이전 review의 `findings[i].id`를 유지하고, 수정된 issue는 `resolved: true` 플래그. 신규 issue만 추가. 반복 미해결 issue는 Pedagogy Coach에 "개념 설명 격상" 메시지 전송.
