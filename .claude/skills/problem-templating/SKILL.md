---
name: problem-templating
description: C 과제를 KC 태그 + 파라미터 + variants(표절 방지용 변형) 구조의 YAML로 설계. Problem Architect가 신규 과제를 생성하거나 기존 과제 세트에 variants를 추가할 때 반드시 이 스킬을 사용. reference_solution은 _workspace/private/에만 저장하고 Safety Guard에 등록.
---

# Problem Templating

research.md §6.1 형식의 과제 템플릿 생성기. 같은 KC·난이도를 유지하면서 **파라미터만 흔들어 변형 과제**를 대량 파생시키는 구조.

## 핵심 원칙 — Why

학생 간 답안 공유·GPT 복붙·재응시 부정을 막으려면 **같은 개념, 다른 입력**이 필요하다. Problem Architect는 하나의 템플릿과 파라미터 시드로 variants 6+ 개를 파생시켜, 학생별/재응시별로 서로 다른 문항을 배정할 수 있어야 한다.

동시에 **reference_solution**은 플랫폼에서 가장 민감한 자산이다. 이것이 Pedagogy Coach나 Code Reviewer의 컨텍스트에 주입되면 Socratic 힌트가 정답을 유출하게 된다. 따라서 템플릿 단계에서부터 접근 격리 설계가 필수다.

## 템플릿 YAML 스키마

```yaml
assignment_id: A05_pointer_swap        # 불변 고유 ID
version: 1                              # rubric/template 변경 시 증가
kc_tags:                                # research.md §5.4 KC 카탈로그와 매칭
  - pointer-arithmetic
  - functions-params
  - indirection
difficulty: 3                           # 1~5
estimated_time_min: 20

template: |
  두 정수 포인터 `a`, `b`를 받아 두 값을 교환하는 함수
  `void swap(int *a, int *b)`를 작성하라.
  다음 입력에 대해 동작해야 한다: {N_PAIRS}쌍의 값.

params:
  N_PAIRS: [2, 3, 5]                   # variants로 흔들 값

variants: 6                             # 파생할 변형 개수
variant_seed: 42                        # 재현 가능성

rubric:                                 # 총합 1.0 유지
  correctness: 0.5
  style: 0.15
  memory_safety: 0.2
  reflection: 0.15

constraints:
  time_limit_s: 2
  mem_limit_mb: 64
  allowed_headers: [stdio.h, stdlib.h]
  banned_functions: []                  # 특정 학습 목표 시 제한

hidden_tests:
  - input: "3 7"
    expected: "7 3"
  - input: "-1 0"
    expected: "0 -1"

visible_tests:                          # 학생에게 공개
  - input: "1 2"
    expected: "2 1"

reference_solution_path: "_workspace/private/solutions/A05_ref.c"
starter_code: |                         # 학생 에디터 초기 상태
  #include <stdio.h>

  void swap(int *a, int *b) {
      // TODO: 구현하라
  }

reflection_prompts:                     # research.md §3.4
  - "이 코드에서 가장 어려웠던 부분은?"
  - "AI의 어떤 힌트가 결정적이었나?"
  - "가능했던 두 가지 해결안은?"
```

## 파라미터화 규칙

### Variants 생성

`variant_seed`를 시작으로 `params`의 각 배열에서 값을 순열 조합:

```
variant 1: N_PAIRS=2 (seed 42)
variant 2: N_PAIRS=3 (seed 43)
variant 3: N_PAIRS=5 (seed 44)
variant 4: N_PAIRS=2 (seed 45, 다른 테스트 입력)
...
```

- 동일 입력 중복 감지 → seed 증분 후 재생성 (최대 3회)
- `hidden_tests`는 variant마다 다르게 파생 (같은 로직 다른 값)
- `visible_tests`는 공유 가능 (변형마다 재생성하지 않아도 됨)

### KC 커버리지 보정

Teacher Copilot이 "학생 세트가 약한 KC"를 지목하면 Problem Architect는 해당 KC를 **주 태그**로 하는 과제를 우선 생성한다. KC 중복은 허용하되, 과제 세트 전체가 CS1 필수 KC 10개를 최소 1회 이상 커버해야 한다.

### Difficulty 곡선

과제 세트 배치 시 난이도는 평균 **+0.5씩 상승**. 연속 2개 이상의 같은 난이도 허용하되, 3개 이상은 교사 경고.

## reference_solution 격리

`reference_solution_path`의 파일은 다음 규칙을 따른다:

1. **저장 경로**: `_workspace/private/solutions/{assignment_id}_ref.c` — 앞에 `private/` 세그먼트 필수
2. **Safety Guard 등록**: Problem Architect가 생성 직후 Safety Guard에 `registerProtected(path)` 호출
3. **접근 허용 에이전트**: Assessment, Runtime Debugger (hidden test 실행 전용)
4. **접근 금지 에이전트**: Pedagogy Coach, Code Reviewer, Supervisor, Student Modeler
5. **유출 탐지**: Safety Guard가 모든 outbound에 대해 reference_solution과 Levenshtein < 30% 또는 AST 부분 일치 검사

## 출력 스키마

Problem Architect는 YAML 원본 + 파생 JSON 두 형식을 반환:

```json
{
  "assignment": { ...YAML 파싱 결과 },
  "variants": [
    { "variantId": "A05_v1",
      "params": { "N_PAIRS": 2 },
      "hidden_tests": [...],
      "reference_solution_path": "_workspace/private/solutions/A05_v1_ref.c" },
    ...
  ],
  "registered_protected_paths": [...],
  "coverage": { "kc_tags": [...], "difficulty_avg": 3.0 }
}
```

## 금지 행동

- `reference_solution`을 `starter_code`에 포함 (학생 UI 노출)
- `banned_functions`에 `main` 포함 (동작 불가)
- rubric 총합 ≠ 1.0
- `reference_solution_path` 미지정 → Safety Guard가 보호 등록 불가

## 재실행 지침

기존 과제의 variants만 추가할 때는 `assignment_id` 유지하고 `variants` 숫자만 증가. rubric·template 변경 시 `version` +1. 기존 제출물은 이전 version에 바인딩 유지.
