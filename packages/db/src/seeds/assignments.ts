/**
 * CVibe 초기 과제 카탈로그 — research.md §6.1 구조.
 *
 * CS1 필수 KC 10개를 1:1로 커버. 난이도는 1→5로 점진 상승.
 * starter_code, visible_tests는 학생에게 노출되며, hidden_tests는
 * _workspace/private/ 경로에서만 관리 (Safety Guard 보호 대상).
 *
 * reference_solution은 별도 파일로 커밋하지 않는다 (supabase/seed-private/).
 */

export interface HiddenTest {
  id: number;
  input: string;
  expected: string;
}

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
  /**
   * Hidden tests — 학생에게 노출되지 않는 채점용 케이스. 이 필드가
   * single source of truth. `supabase/seed-private/{prefix}_hidden.json`
   * 파일은 `pnpm --filter @cvibe/db seed:export` 로 자동 재생성된다.
   */
  hiddenTests?: HiddenTest[];
  /**
   * Reference solution — Safety Guard 유사도 검사 및 Code Reviewer 비교용.
   * 학생 응답에 절대 포함되지 않음. 파일로도 export 됨.
   */
  referenceSolution?: string;
  /** @deprecated hiddenTests 필드가 source of truth. 2026-04 이후 제거 예정. */
  hiddenTestsPath?: string;
  reflectionPrompts: string[];
  /**
   * 표절 방지·재응시용 variant 개수. Problem Architect가 파라미터 시드로
   * 파생한다. 기본 1(단일). research.md §6.1 variants 필드와 매핑.
   */
  variantCount?: number;
}

/**
 * assignment.code 에서 seed-private 파일명 prefix 를 추출.
 * `A02_pointer_swap_fn` → `A02`.
 */
export function filePrefixForCode(code: string): string {
  const m = code.match(/^A\d{2}/);
  return m ? m[0] : code.split("_")[0] ?? code;
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
    code: "A00_pilot_average",
    version: 1,
    title: "파일럿 문항",
    template:
      "코드에 이미 선언된 배열 `int base[5] = {3, 7, 2, 4, 5};` 의 **평균을 계산하는** `double average(int x[])` 함수를 작성하라. main 은 그대로 두고, `average` 함수 내부만 채우면 된다.\n\n**출력 형식**:\n\n```\nbase average = 4.200\n```\n\n- 소수점 **3자리** (`printf` 형식 `%.3f`) 로 출력\n- 합을 5.0 으로 나눠 double 로 반환 (정수 나눗셈 주의)\n- 이 과제는 **파일럿(시범) 문항** 입니다. 가볍게 사용성을 익혀보고, 이후 A01 부터 본격 진행하세요.",
    kcTags: ["functions-params", "arrays-indexing", "io-formatting"],
    difficulty: 1,
    rubric: DEFAULT_RUBRIC,
    constraints: DEFAULT_CONSTRAINTS,
    starterCode: `#include <stdio.h>

double average(int x[]);

int main(void) {
    double avg;
    int base[5] = {3, 7, 2, 4, 5};

    avg = average(base);
    printf("base average = %.3f\\n", avg);

    return 0;
}

double average(int x[]) {
    // TODO: 배열의 평균을 double 로 반환해보세요.
    return 0.0;
}
`,
    visibleTests: [
      {
        input: "",
        expected: "base average = 4.200\n",
        note: "배열 {3,7,2,4,5} 의 평균 = 4.2",
      },
    ],
    hiddenTests: [
      { id: 1, input: "", expected: "base average = 4.200\n" },
    ],
    referenceSolution: `#include <stdio.h>

double average(int x[]);

int main(void) {
    double avg;
    int base[5] = {3, 7, 2, 4, 5};

    avg = average(base);
    printf("base average = %.3f\\n", avg);

    return 0;
}

double average(int x[]) {
    int sum = 0;
    for (int i = 0; i < 5; i++) sum += x[i];
    return sum / 5.0;
}
`,
    reflectionPrompts: DEFAULT_REFLECTION_PROMPTS,
  },
  {
    code: "A01_array_2d_sum",
    version: 1,
    title: "2차원 배열 행·열 합산",
    template:
      "5×4 정수 배열이 다음과 같이 초기화되어 있다.\n\n```\n  1   2   3   0\n  5   6   7   0\n  9  10  11   0\n 13  14  15   0\n  0   0   0   0\n```\n\n- 마지막 **열**(j=3)에는 각 행(0~3)의 합을 저장\n- 마지막 **행**(i=4)에는 각 열(0~3)의 합을 저장 (마지막 행은 행합까지 포함된 결과의 열 합)\n- 채운 뒤 전체 5×4 배열을 `%3d` 포맷으로 출력 (각 행 끝에 줄바꿈)\n\n**채워야 할 두 부분**:\n\n1. 각 행 i(0~3)에 대해 arr[i][0..2]의 합을 arr[i][3] 에 저장\n2. 각 열 j(0~3)에 대해 arr[0..3][j]의 합을 arr[4][j] 에 저장\n\n출력 예시 (`%3d`로 폭 3):\n\n```\n  1  2  3  6\n  5  6  7 18\n  9 10 11 30\n 13 14 15 42\n 28 32 36 96\n```\n\n입력은 없다. 배열 초기값과 출력 형식은 starter 코드에 이미 작성되어 있다.",
    kcTags: ["arrays-indexing", "control-flow-loop"],
    difficulty: 2,
    rubric: DEFAULT_RUBRIC,
    constraints: DEFAULT_CONSTRAINTS,
    starterCode: `#include <stdio.h>

int main() {

    int i, j;
    int arr[5][4] = {
        {1, 2, 3, 0},
        {5, 6, 7, 0},
        {9, 10, 11, 0},
        {13, 14, 15, 0},
        {0, 0, 0, 0}
    };

    // TODO 1: 각 행 i (0~3) 에 대해, arr[i][0]~arr[i][2] 를 더해 arr[i][3] 에 저장하세요.


    // TODO 2: 각 열 j (0~3) 에 대해, arr[0][j]~arr[3][j] 를 더해 arr[4][j] 에 저장하세요.


    for (i = 0; i < 5; i++) {
        for (j = 0; j < 4; j++) {
            printf("%3d", arr[i][j]);
        }
        printf("\\n");
    }

    return 0;
}
`,
    visibleTests: [
      {
        input: "",
        expected:
          "  1  2  3  6\n  5  6  7 18\n  9 10 11 30\n 13 14 15 42\n 28 32 36 96\n",
        note: "고정 입력 — 행합·열합이 마지막 열·행에 채워져야 함",
      },
    ],
    hiddenTests: [
      {
        id: 1,
        input: "",
        expected:
          "  1  2  3  6\n  5  6  7 18\n  9 10 11 30\n 13 14 15 42\n 28 32 36 96\n",
      },
    ],
    referenceSolution: `#include <stdio.h>

int main() {

    int i, j;
    int arr[5][4] = {
        {1, 2, 3, 0},
        {5, 6, 7, 0},
        {9, 10, 11, 0},
        {13, 14, 15, 0},
        {0, 0, 0, 0}
    };

    for (i = 0; i < 4; i++) {
        int sumrow = 0;
        for (j = 0; j < 3; j++) {
            sumrow += arr[i][j];
        }
        arr[i][3] = sumrow;
    }

    for (j = 0; j < 4; j++) {
        int sumcol = 0;
        for (i = 0; i < 4; i++) {
            sumcol += arr[i][j];
        }
        arr[4][j] = sumcol;
    }

    for (i = 0; i < 5; i++) {
        for (j = 0; j < 4; j++) {
            printf("%3d", arr[i][j]);
        }
        printf("\\n");
    }

    return 0;
}
`,
    reflectionPrompts: DEFAULT_REFLECTION_PROMPTS,
  },
  {
    code: "A02_pointer_swap_fn",
    version: 2,
    title: "포인터 순회로 배열 최댓값·최솟값",
    template:
      "정수 배열 `arr` 가 이미 선언돼 있고, 포인터 `p` 가 `arr` 의 첫 원소를 가리킨다. 빈 `for` 문 안을 채워 배열의 10 개 원소를 **포인터로 순회**하며 다음 세 가지를 한 번에 처리하라.\n\n1. 각 원소를 `printf(\"%d \", ...)` 로 한 칸 띄어 출력.\n2. `max` 가 지금까지의 최댓값이 되도록 갱신.\n3. `min` 이 지금까지의 최솟값이 되도록 갱신.\n\n반드시 인덱스 표기(`arr[i]`) 가 아닌 포인터 산술 (`*(p + i)`) 로 접근하라. `max`·`min` 은 첫 원소(`*arr`) 로 이미 초기화돼 있으니 그대로 사용하면 된다.\n\n## 예상 출력\n\n```\narr[] = { -8 9 -20 21 -26 -41 45 -51 78 90 }\n\n최댓값: 90\n최솟값: -51\n```",
    kcTags: ["pointer-basics", "pointer-arithmetic", "control-flow-loop"],
    difficulty: 2,
    rubric: DEFAULT_RUBRIC,
    constraints: DEFAULT_CONSTRAINTS,
    starterCode: `#include <stdio.h>

int main(void) {
    int arr[] = { -8, 9, -20, 21, -26, -41, 45, -51, 78, 90 };
    int max, min;

    int *p;

    p = arr;
    max = *arr;
    min = *arr;

    printf("arr[] = { ");

    // TODO: 포인터 p 를 사용해 arr 의 10 개 원소를 순회하며
    //       (1) "%d " 형식으로 출력, (2) max 갱신, (3) min 갱신.
    for (int i = 0; i < 10; i++) {

    }

    printf("}\\n\\n");
    printf("최댓값: %d\\n", max);
    printf("최솟값: %d", min);

    return 0;
}
`,
    visibleTests: [
      {
        input: "",
        expected:
          "arr[] = { -8 9 -20 21 -26 -41 45 -51 78 90 }\n\n최댓값: 90\n최솟값: -51",
        note: "고정 배열 — 입력 없음. for 문이 비어 있으면 \"arr[] = { }\" 와 max/min 초기값만 찍힌다.",
      },
    ],
    hiddenTests: [
      {
        id: 1,
        input: "",
        expected:
          "arr[] = { -8 9 -20 21 -26 -41 45 -51 78 90 }\n\n최댓값: 90\n최솟값: -51",
      },
      {
        id: 2,
        input: "",
        expected:
          "arr[] = { -8 9 -20 21 -26 -41 45 -51 78 90 }\n\n최댓값: 90\n최솟값: -51",
      },
      {
        id: 3,
        input: "",
        expected:
          "arr[] = { -8 9 -20 21 -26 -41 45 -51 78 90 }\n\n최댓값: 90\n최솟값: -51",
      },
    ],
    referenceSolution: `#include <stdio.h>

int main(void) {
    int arr[] = { -8, 9, -20, 21, -26, -41, 45, -51, 78, 90 };
    int max, min;

    int *p;

    p = arr;
    max = *arr;
    min = *arr;

    printf("arr[] = { ");

    for (int i = 0; i < 10; i++) {
        printf("%d ", *(p + i));

        if (*(p + i) > max) {
            max = *(p + i);
        }

        if (*(p + i) < min) {
            min = *(p + i);
        }
    }

    printf("}\\n\\n");
    printf("최댓값: %d\\n", max);
    printf("최솟값: %d", min);

    return 0;
}
`,
    reflectionPrompts: DEFAULT_REFLECTION_PROMPTS,
  },
  {
    code: "A03_arrays_basic",
    version: 3,
    title: "문자 입력 반복과 대문자 변환",
    template:
      "표준 입력에서 **한 글자씩** 읽어 대문자로 변환해 출력하는 프로그램을 작성하라. 한 번 글자를 처리한 뒤에는 같은 줄에 남아 있는 나머지 문자를 모두 버린(입력 버퍼 비우기) 다음, 다시 다음 글자 입력을 기다린다. `EOF`(Ctrl+Z) 가 들어오면 반복을 종료한다.\n\n다음 두 부분을 직접 작성해야 한다.\n\n1. **대문자 변환 후 출력** — `toupper(ch)` 의 결과를 `putchar()` 로 출력하고, 그 뒤에 `printf(\"\\n\")` 으로 줄바꿈.\n2. **입력 버퍼 비우기** — `while ((ch = getchar()) != '\\n' && ch != EOF) { }` 로 같은 줄에 남아 있는 글자를 모두 소진. 이 루프가 없으면 다음 반복에서 `getchar()` 가 이전 줄의 잔여 문자를 읽어 버린다.\n\n프롬프트 출력, `getchar()` 호출, EOF 검사, 종료 메시지는 starter 코드에 이미 포함되어 있다.\n\n## 입출력 예시\n\n```\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> a\nA\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> ^Z\nEOF가 입력되어 반복 종료함\n```\n\n## 힌트\n\n- `toupper(c)` 는 소문자만 변환하고 대문자·숫자·공백·특수문자는 그대로 둔다 (`#include <ctype.h>`).\n- `putchar()` 는 정수를 받아 그에 해당하는 문자 한 글자를 출력한다.\n- 입력 버퍼 비우기 루프는 본문(`{}`) 가 비어 있어도 된다. **조건식이 핵심**.\n- `getchar()` 는 입력의 끝(EOF) 에서 `EOF` 매크로(보통 `-1`) 를 반환한다.",
    kcTags: ["io-formatting", "control-flow-loop", "control-flow-if"],
    difficulty: 2,
    rubric: DEFAULT_RUBRIC,
    constraints: DEFAULT_CONSTRAINTS,
    starterCode: `#include <stdio.h>
#include <ctype.h>

int main() {
    int ch;

    while (1) {
        printf("\\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> ");

        ch = getchar();

        // EOF 입력 시 반복 종료
        if (ch == EOF) {
            break;
        }

        // TODO 1: ch 를 대문자로 변환해 한 글자 출력하고, 줄바꿈도 출력하세요.
        //         (toupper(ch) 의 결과를 putchar 로, 그 뒤에 printf("\\n"))


        // TODO 2: 같은 줄에 남아 있는 문자들을 모두 버려 입력 버퍼를 비우세요.
        //         (getchar() 의 반환값이 '\\n' 또는 EOF 가 될 때까지 반복)


    }

    printf("\\nEOF가 입력되어 반복 종료함");

    return 0;
}
`,
    visibleTests: [
      {
        input: "a\n",
        expected:
          "\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> A\n\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> \nEOF가 입력되어 반복 종료함",
        note: "기본 — 'a' 입력 한 번 후 Ctrl+Z(EOF)",
      },
      {
        input: "Hello\n",
        expected:
          "\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> H\n\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> \nEOF가 입력되어 반복 종료함",
        note: "한 줄에 여러 글자가 와도 첫 글자만 처리 — 나머지는 버퍼 비우기로 버려짐",
      },
    ],
    hiddenTests: [
      {
        id: 1,
        input: "a\n",
        expected:
          "\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> A\n\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> \nEOF가 입력되어 반복 종료함",
      },
      {
        id: 2,
        input: "Z\n",
        expected:
          "\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> Z\n\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> \nEOF가 입력되어 반복 종료함",
      },
      {
        id: 3,
        input: "5\n",
        expected:
          "\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> 5\n\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> \nEOF가 입력되어 반복 종료함",
      },
      {
        id: 4,
        input: "a\nb\nc\n",
        expected:
          "\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> A\n\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> B\n\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> C\n\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> \nEOF가 입력되어 반복 종료함",
      },
      {
        id: 5,
        input: "Hello\n",
        expected:
          "\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> H\n\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> \nEOF가 입력되어 반복 종료함",
      },
    ],
    referenceSolution: `#include <stdio.h>
#include <ctype.h>

int main() {
    int ch;

    while (1) {
        printf("\\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> ");

        ch = getchar();

        // EOF 입력 시 반복 종료
        if (ch == EOF) {
            break;
        }

        // 대문자로 변환 후 출력
        putchar(toupper(ch));
        printf("\\n");

        // 입력 버퍼 비우기
        while ((ch = getchar()) != '\\n' && ch != EOF) {
        }
    }

    printf("\\nEOF가 입력되어 반복 종료함");

    return 0;
}
`,
    reflectionPrompts: DEFAULT_REFLECTION_PROMPTS,
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
    // TODO: 최댓값과 그 인덱스를 형식에 맞춰 출력해보세요.
    return 0;
}
`,
    visibleTests: [
      { input: "5\n3 1 4 1 5", expected: "max=5 idx=4\n" },
      { input: "4\n2 2 2 2", expected: "max=2 idx=0\n" },
    ],
    hiddenTests: [
      { id: 1, input: "5\n3 1 4 1 5", expected: "max=5 idx=4\n" },
      { id: 2, input: "4\n2 2 2 2", expected: "max=2 idx=0\n" },
      { id: 3, input: "3\n-1 -2 -3", expected: "max=-1 idx=0\n" },
      { id: 4, input: "6\n1 9 5 9 3 9", expected: "max=9 idx=1\n" },
    ],
    referenceSolution: `#include <stdio.h>

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 1;
    int arr[100];
    for (int i = 0; i < n; i++) scanf("%d", &arr[i]);
    int maxVal = arr[0];
    int maxIdx = 0;
    for (int i = 1; i < n; i++) {
        if (arr[i] > maxVal) {
            maxVal = arr[i];
            maxIdx = i;
        }
    }
    printf("max=%d idx=%d\\n", maxVal, maxIdx);
    return 0;
}
`,
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
    hiddenTests: [
      { id: 1, input: "3 7", expected: "7 3\n" },
      { id: 2, input: "-1 0", expected: "0 -1\n" },
      { id: 3, input: "5 5", expected: "5 5\n" },
      { id: 4, input: "100 200", expected: "200 100\n" },
    ],
    referenceSolution: `#include <stdio.h>

void swap(int *a, int *b) {
    int tmp = *a;
    *a = *b;
    *b = tmp;
}

int main(void) {
    int x, y;
    if (scanf("%d %d", &x, &y) != 2) return 1;
    swap(&x, &y);
    printf("%d %d\\n", x, y);
    return 0;
}
`,
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
    // TODO: 포인터로 배열을 탐색하며 결과를 출력해보세요.
    return 0;
}
`,
    visibleTests: [
      { input: "4\n1 2 3 4", expected: "4 3 2 1\n" },
      { input: "1\n42", expected: "42\n" },
    ],
    hiddenTests: [
      { id: 1, input: "4\n1 2 3 4", expected: "4 3 2 1\n" },
      { id: 2, input: "1\n42", expected: "42\n" },
      { id: 3, input: "5\n10 20 30 40 50", expected: "50 40 30 20 10\n" },
      { id: 4, input: "3\n-1 0 -1", expected: "-1 0 -1\n" },
    ],
    referenceSolution: `#include <stdio.h>

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 1;
    int arr[100];
    for (int i = 0; i < n; i++) scanf("%d", &arr[i]);
    int *p = arr;
    for (int i = n - 1; i >= 0; i--) {
        printf("%d", *(p + i));
        if (i > 0) printf(" ");
    }
    printf("\\n");
    return 0;
}
`,
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
    // TODO: 동적 메모리를 할당하고 결과를 출력한 뒤 정리해보세요.
    return 0;
}
`,
    visibleTests: [
      { input: "3\n1 2 3", expected: "3 2 1\n" },
      { input: "5\n10 20 30 40 50", expected: "50 40 30 20 10\n" },
    ],
    hiddenTests: [
      { id: 1, input: "3\n1 2 3", expected: "3 2 1\n" },
      { id: 2, input: "5\n10 20 30 40 50", expected: "50 40 30 20 10\n" },
      { id: 3, input: "1\n99", expected: "99\n" },
      { id: 4, input: "6\n-1 -2 -3 -4 -5 -6", expected: "-6 -5 -4 -3 -2 -1\n" },
    ],
    referenceSolution: `#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 1;
    int *arr = malloc(sizeof(int) * n);
    if (!arr) return 1;
    for (int i = 0; i < n; i++) scanf("%d", &arr[i]);
    for (int i = n - 1; i >= 0; i--) {
        printf("%d", arr[i]);
        if (i > 0) printf(" ");
    }
    printf("\\n");
    free(arr);
    return 0;
}
`,
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
    kcTags: ["functions-params", "control-flow-loop", "control-flow-if", "variables-types"],
    difficulty: 3,
    rubric: DEFAULT_RUBRIC,
    constraints: DEFAULT_CONSTRAINTS,
    starterCode: `#include <stdio.h>

long factorial_iter(int n) {
    // TODO: 반복문으로 n! 을 계산해보세요.
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
    hiddenTests: [
      { id: 1, input: "0", expected: "1\n" },
      { id: 2, input: "1", expected: "1\n" },
      { id: 3, input: "5", expected: "120\n" },
      { id: 4, input: "10", expected: "3628800\n" },
      { id: 5, input: "12", expected: "479001600\n" },
    ],
    referenceSolution: `#include <stdio.h>

long factorial_iter(int n) {
    long result = 1;
    for (int i = 2; i <= n; i++) result *= i;
    return result;
}

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 1;
    printf("%ld\\n", factorial_iter(n));
    return 0;
}
`,
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
    // TODO: 재귀 호출로 n! 을 계산해보세요.
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
    hiddenTests: [
      { id: 1, input: "1", expected: "1\n" },
      { id: 2, input: "3", expected: "6\n" },
      { id: 3, input: "5", expected: "120\n" },
      { id: 4, input: "7", expected: "5040\n" },
      { id: 5, input: "10", expected: "3628800\n" },
    ],
    referenceSolution: `#include <stdio.h>

long factorial_rec(int n) {
    if (n <= 1) return 1;
    return n * factorial_rec(n - 1);
}

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 1;
    printf("%ld\\n", factorial_rec(n));
    return 0;
}
`,
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
    // TODO: n 단 구구단을 형식에 맞춰 출력해보세요.
    return 0;
}
`,
    visibleTests: [
      { input: "2", expected: "2 x 1 =  2\n2 x 2 =  4\n2 x 3 =  6\n2 x 4 =  8\n2 x 5 = 10\n2 x 6 = 12\n2 x 7 = 14\n2 x 8 = 16\n2 x 9 = 18\n" },
    ],
    hiddenTests: [
      { id: 1, input: "2", expected: "2 x 1 =  2\n2 x 2 =  4\n2 x 3 =  6\n2 x 4 =  8\n2 x 5 = 10\n2 x 6 = 12\n2 x 7 = 14\n2 x 8 = 16\n2 x 9 = 18\n" },
      { id: 2, input: "5", expected: "5 x 1 =  5\n5 x 2 = 10\n5 x 3 = 15\n5 x 4 = 20\n5 x 5 = 25\n5 x 6 = 30\n5 x 7 = 35\n5 x 8 = 40\n5 x 9 = 45\n" },
      { id: 3, input: "9", expected: "9 x 1 =  9\n9 x 2 = 18\n9 x 3 = 27\n9 x 4 = 36\n9 x 5 = 45\n9 x 6 = 54\n9 x 7 = 63\n9 x 8 = 72\n9 x 9 = 81\n" },
    ],
    referenceSolution: `#include <stdio.h>

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 1;
    for (int i = 1; i <= 9; i++) {
        printf("%d x %d = %2d\\n", n, i, n * i);
    }
    return 0;
}
`,
    hiddenTestsPath: "supabase/seed-private/A10_hidden.json",
    reflectionPrompts: DEFAULT_REFLECTION_PROMPTS,
  },
];

export function getAssignmentByCode(code: string): AssignmentSeed | undefined {
  return ASSIGNMENTS.find((a) => a.code === code);
}
