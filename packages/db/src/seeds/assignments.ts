/**
 * CVibe 초기 과제 카탈로그 — research.md §6.1 구조.
 *
 * CS1 필수 KC 10개를 1:1로 커버. 난이도는 1→5로 점진 상승.
 * starter_code, visible_tests는 학생에게 노출되며, hidden_tests는
 * _workspace/private/ 경로에서만 관리 (Safety Guard 보호 대상).
 *
 * reference_solution은 별도 파일로 커밋하지 않는다 (supabase/seed-private/).
 */

export interface AssignmentSeed {
  code: string;
  version: number;
  title: string;
  template: string;
  kcTags: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  rubric: {
    correctness: number;
    style: number;
    memory_safety: number;
    reflection: number;
  };
  constraints: {
    timeLimitMs: number;
    memLimitMb: number;
    allowedHeaders: string[];
  };
  starterCode: string;
  visibleTests: Array<{ input: string; expected: string; note?: string }>;
  hiddenTestsPath: string; // supabase/seed-private/ 하위
  reflectionPrompts: string[];
  /**
   * 표절 방지·재응시용 variant 개수. Problem Architect가 파라미터 시드로
   * 파생한다. 기본 1(단일). research.md §6.1 variants 필드와 매핑.
   */
  variantCount?: number;
}

/**
 * KC slug → 학생이 바로 이해할 수 있는 한국어 학습 목표 문장.
 * AssignmentPanel에서 과제별로 kcTags 앞 2개를 꺼내 목표로 노출한다.
 */
const KC_OBJECTIVES: Record<string, string> = {
  "variables-types": "정수·실수·문자 변수를 선언하고 적절한 자료형을 선택한다",
  "io-formatting": "printf·scanf 형식 지정자로 값을 입출력한다",
  "control-flow-if": "if·else if·else로 조건 분기를 구성한다",
  "control-flow-loop": "for·while 반복문으로 동일 작업을 효율적으로 반복한다",
  "arrays-indexing": "배열을 선언하고 인덱스로 원소를 안전하게 접근한다",
  "pointer-basics": "포인터 선언·역참조·주소 연산자의 의미를 설명한다",
  "pointer-arithmetic": "포인터 산술로 배열을 순회하고 경계를 넘지 않게 한다",
  "functions-params": "함수 파라미터로 값·포인터 전달 차이를 구분한다",
  "memory-allocation": "malloc·free로 동적 메모리를 안전하게 관리한다",
  recursion: "재귀 함수의 기저 사례와 점화식을 설계한다",
};

export function getLearningObjectives(kcTags: string[], max = 2): string[] {
  const out: string[] = [];
  for (const kc of kcTags) {
    const phrase = KC_OBJECTIVES[kc];
    if (phrase && !out.includes(phrase)) out.push(phrase);
    if (out.length >= max) break;
  }
  return out;
}

const DEFAULT_RUBRIC = { correctness: 0.5, style: 0.15, memory_safety: 0.2, reflection: 0.15 };
const DEFAULT_CONSTRAINTS = {
  timeLimitMs: 2000,
  memLimitMb: 64,
  allowedHeaders: ["stdio.h", "stdlib.h", "string.h"],
};
const DEFAULT_REFLECTION_PROMPTS = [
  "이 과제에서 가장 어려웠던 부분은 무엇이고, 어떻게 해결했나요?",
  "다른 방법으로도 풀 수 있었나요? 그중 왜 이 방식을 택했는지 한 문장으로 적어봐요.",
  "비슷한 문제를 다시 만나면 무엇을 다르게 하겠나요?",
];

export const ASSIGNMENTS: AssignmentSeed[] = [
  {
    code: "A01_sort_five",
    version: 1,
    title: "배열과 정렬",
    template:
      "한 자리 양의 정수(1~9) 5개를 공백으로 구분해 입력받아 오름차순으로 정렬한 뒤, 공백으로 구분해 한 줄로 출력하라. 입력은 항상 5개가 주어지며 중복 값이 있을 수 있다.",
    kcTags: ["arrays-indexing", "control-flow-loop"],
    difficulty: 2,
    rubric: DEFAULT_RUBRIC,
    constraints: DEFAULT_CONSTRAINTS,
    starterCode: `#include <stdio.h>

int main(void) {
    int arr[5];
    for (int i = 0; i < 5; i++) {
        scanf("%d", &arr[i]);
    }
    // TODO: arr 를 오름차순으로 정렬한 뒤 공백으로 구분해 한 줄로 출력한다.
    return 0;
}
`,
    visibleTests: [
      { input: "5 3 1 4 2", expected: "1 2 3 4 5\n", note: "서로 다른 5개" },
      { input: "9 9 1 5 3", expected: "1 3 5 9 9\n", note: "중복 포함" },
    ],
    hiddenTestsPath: "supabase/seed-private/A01_hidden.json",
    reflectionPrompts: DEFAULT_REFLECTION_PROMPTS,
  },
  {
    code: "A02_grade_if",
    version: 1,
    title: "점수 등급 분류",
    template:
      "표준 입력으로 받은 점수(0~100)에 대해 등급을 출력하라. 90+ A, 80+ B, 70+ C, 60+ D, 그 외 F.",
    kcTags: ["control-flow-if", "variables-types", "io-formatting"],
    difficulty: 2,
    rubric: DEFAULT_RUBRIC,
    constraints: DEFAULT_CONSTRAINTS,
    starterCode: `#include <stdio.h>

int main(void) {
    int score;
    scanf("%d", &score);
    // TODO: 등급 분기
    return 0;
}
`,
    visibleTests: [
      { input: "92", expected: "A\n" },
      { input: "78", expected: "C\n" },
      { input: "45", expected: "F\n" },
    ],
    hiddenTestsPath: "supabase/seed-private/A02_hidden.json",
    reflectionPrompts: DEFAULT_REFLECTION_PROMPTS,
  },
  {
    code: "A03_arrays_basic",
    version: 1,
    title: "배열 합산",
    template:
      "길이 N인 정수 배열을 입력 받아 모든 원소의 합을 한 줄로 출력하라. 입력 첫 줄은 N, 둘째 줄은 공백으로 구분된 N개 정수.",
    kcTags: ["arrays-indexing", "control-flow-loop"],
    difficulty: 2,
    rubric: DEFAULT_RUBRIC,
    constraints: DEFAULT_CONSTRAINTS,
    starterCode: `#include <stdio.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int arr[100];
    // TODO: n개 정수 읽기 + 합산
    return 0;
}
`,
    visibleTests: [
      { input: "5\n1 2 3 4 5", expected: "15\n" },
      { input: "3\n10 -5 7", expected: "12\n" },
    ],
    hiddenTestsPath: "supabase/seed-private/A03_hidden.json",
    reflectionPrompts: DEFAULT_REFLECTION_PROMPTS,
    variantCount: 6,
  },
  {
    code: "A04_array_max",
    version: 1,
    title: "배열 최댓값",
    template:
      "길이 N인 정수 배열에서 최댓값과 그 인덱스(0-base)를 출력하라. 최댓값이 여러 번이면 가장 앞의 인덱스.",
    kcTags: ["arrays-indexing", "control-flow-loop", "variables-types"],
    difficulty: 3,
    rubric: DEFAULT_RUBRIC,
    constraints: DEFAULT_CONSTRAINTS,
    starterCode: `#include <stdio.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int arr[100];
    for (int i = 0; i < n; i++) scanf("%d", &arr[i]);
    // TODO: 최댓값과 인덱스 찾기
    return 0;
}
`,
    visibleTests: [
      { input: "5\n3 1 4 1 5", expected: "max=5 idx=4\n" },
      { input: "4\n2 2 2 2", expected: "max=2 idx=0\n" },
    ],
    hiddenTestsPath: "supabase/seed-private/A04_hidden.json",
    reflectionPrompts: DEFAULT_REFLECTION_PROMPTS,
  },
  {
    code: "A05_pointer_swap",
    version: 1,
    title: "포인터로 값 교환",
    template:
      "두 정수 포인터를 받아 값을 교환하는 함수 `void swap(int *a, int *b)`를 구현하고, main에서 두 입력을 받아 swap 후 출력하라.",
    kcTags: ["pointer-basics", "functions-params"],
    difficulty: 3,
    rubric: DEFAULT_RUBRIC,
    constraints: DEFAULT_CONSTRAINTS,
    starterCode: `#include <stdio.h>

void swap(int *a, int *b) {
    // TODO
}

int main(void) {
    int x, y;
    scanf("%d %d", &x, &y);
    swap(&x, &y);
    printf("%d %d\\n", x, y);
    return 0;
}
`,
    visibleTests: [
      { input: "3 7", expected: "7 3\n" },
      { input: "-1 0", expected: "0 -1\n" },
    ],
    hiddenTestsPath: "supabase/seed-private/A05_hidden.json",
    reflectionPrompts: DEFAULT_REFLECTION_PROMPTS,
    variantCount: 4,
  },
  {
    code: "A06_array_reverse",
    version: 1,
    title: "포인터 순회로 배열 역출력",
    template:
      "길이 N인 정수 배열을 포인터 산술로 순회하며 역순으로 한 줄에 공백 구분 출력하라. arr[i] 대신 `*(p+i)` 같은 포인터 표기만 사용.",
    kcTags: ["pointer-arithmetic", "arrays-indexing"],
    difficulty: 3,
    rubric: DEFAULT_RUBRIC,
    constraints: DEFAULT_CONSTRAINTS,
    starterCode: `#include <stdio.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int arr[100];
    for (int i = 0; i < n; i++) scanf("%d", &arr[i]);
    int *p = arr;
    // TODO: 포인터 산술로 역순 출력
    return 0;
}
`,
    visibleTests: [
      { input: "4\n1 2 3 4", expected: "4 3 2 1\n" },
      { input: "1\n42", expected: "42\n" },
    ],
    hiddenTestsPath: "supabase/seed-private/A06_hidden.json",
    reflectionPrompts: DEFAULT_REFLECTION_PROMPTS,
  },
  {
    code: "A07_malloc_resize",
    version: 1,
    title: "malloc과 동적 배열",
    template:
      "입력 N에 대해 malloc으로 N개 정수 배열을 할당, 입력 N개 값을 읽고 뒤집어 출력한 뒤 반드시 free하라. 누수 금지.",
    kcTags: ["memory-allocation", "arrays-indexing", "control-flow-loop"],
    difficulty: 4,
    rubric: { correctness: 0.45, style: 0.1, memory_safety: 0.3, reflection: 0.15 },
    constraints: DEFAULT_CONSTRAINTS,
    starterCode: `#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int n;
    scanf("%d", &n);
    // TODO: malloc + 입력 + 역순 출력 + free
    return 0;
}
`,
    visibleTests: [
      { input: "3\n1 2 3", expected: "3 2 1\n" },
      { input: "5\n10 20 30 40 50", expected: "50 40 30 20 10\n" },
    ],
    hiddenTestsPath: "supabase/seed-private/A07_hidden.json",
    reflectionPrompts: DEFAULT_REFLECTION_PROMPTS,
    variantCount: 5,
  },
  {
    code: "A08_factorial_iter",
    version: 1,
    title: "반복문으로 팩토리얼",
    template:
      "정수 n (0 ≤ n ≤ 12) 을 입력받아 n!을 반복문으로 계산해 출력하라. 재귀 금지.",
    kcTags: ["functions-params", "control-flow-loop", "variables-types"],
    difficulty: 3,
    rubric: DEFAULT_RUBRIC,
    constraints: DEFAULT_CONSTRAINTS,
    starterCode: `#include <stdio.h>

long factorial_iter(int n) {
    // TODO: 반복문으로 구현 (재귀 금지)
    return 1;
}

int main(void) {
    int n;
    scanf("%d", &n);
    printf("%ld\\n", factorial_iter(n));
    return 0;
}
`,
    visibleTests: [
      { input: "5", expected: "120\n" },
      { input: "0", expected: "1\n" },
      { input: "10", expected: "3628800\n" },
    ],
    hiddenTestsPath: "supabase/seed-private/A08_hidden.json",
    reflectionPrompts: DEFAULT_REFLECTION_PROMPTS,
  },
  {
    code: "A09_factorial_rec",
    version: 1,
    title: "재귀로 팩토리얼",
    template:
      "같은 팩토리얼을 이번엔 재귀 함수 `long factorial_rec(int n)`로 작성하라. 기저 조건을 반드시 명시.",
    kcTags: ["recursion", "functions-params"],
    difficulty: 4,
    rubric: DEFAULT_RUBRIC,
    constraints: DEFAULT_CONSTRAINTS,
    starterCode: `#include <stdio.h>

long factorial_rec(int n) {
    // TODO: 재귀로 구현 — 기저 조건 필수
    return 1;
}

int main(void) {
    int n;
    scanf("%d", &n);
    printf("%ld\\n", factorial_rec(n));
    return 0;
}
`,
    visibleTests: [
      { input: "5", expected: "120\n" },
      { input: "1", expected: "1\n" },
      { input: "7", expected: "5040\n" },
    ],
    hiddenTestsPath: "supabase/seed-private/A09_hidden.json",
    reflectionPrompts: DEFAULT_REFLECTION_PROMPTS,
  },
  {
    code: "A10_printf_table",
    version: 1,
    title: "printf 포맷과 구구단",
    template:
      "정수 N(1~9)을 입력 받아 N단 전체를 `%d x %d = %2d` 포맷으로 출력하라. 숫자 폭 정렬 필수.",
    kcTags: ["io-formatting", "control-flow-loop"],
    difficulty: 2,
    rubric: DEFAULT_RUBRIC,
    constraints: DEFAULT_CONSTRAINTS,
    starterCode: `#include <stdio.h>

int main(void) {
    int n;
    scanf("%d", &n);
    // TODO: "n x i = <값>" 포맷으로 i=1..9 출력
    return 0;
}
`,
    visibleTests: [
      { input: "2", expected: "2 x 1 =  2\n2 x 2 =  4\n2 x 3 =  6\n2 x 4 =  8\n2 x 5 = 10\n2 x 6 = 12\n2 x 7 = 14\n2 x 8 = 16\n2 x 9 = 18\n" },
    ],
    hiddenTestsPath: "supabase/seed-private/A10_hidden.json",
    reflectionPrompts: DEFAULT_REFLECTION_PROMPTS,
  },
];

export function getAssignmentByCode(code: string): AssignmentSeed | undefined {
  return ASSIGNMENTS.find((a) => a.code === code);
}
