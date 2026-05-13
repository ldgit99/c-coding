-- CVibe Supabase seed — auto-generated. Do NOT edit directly.
-- Regenerate: pnpm --filter @cvibe/db seed:export
--
-- 이 파일은 `supabase db reset` 시 자동 실행된다.
-- profiles/auth 테이블 seed는 auth.users와 엮여 있어 별도 스크립트로 처리.

begin;

-- Seed 교사 프로필 (auth.users는 별도 스크립트로 생성 필요).
insert into public.profiles (id, email, role, display_name)
values ('00000000-0000-4000-8000-000000000001', 'seed-teacher@cvibe.dev', 'teacher', 'Seed Teacher')
on conflict (id) do nothing;

insert into public.cohorts (id, name, term, teacher_id) values
  ('00000000-0000-4000-8000-000000000010', $$2026 Spring CS1$$, $$2026-Spring$$, '00000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

insert into public.assignments (code, version, title, template, kc_tags, difficulty, rubric, constraints, starter_code, visible_tests, reflection_prompts, cohort_id, active, created_by) values (
  'A00_pilot_average',
  1,
  $$파일럿 문항$$,
  $$코드에 이미 선언된 배열 `int base[5] = {3, 7, 2, 4, 5};` 의 **평균을 계산하는** `double average(int x[])` 함수를 작성하라. main 은 그대로 두고, `average` 함수 내부만 채우면 된다.

**출력 형식**:

```
base average = 4.200
```

- 소수점 **3자리** (`printf` 형식 `%.3f`) 로 출력
- 합을 5.0 으로 나눠 double 로 반환 (정수 나눗셈 주의)
- 이 과제는 **파일럿(시범) 문항** 입니다. 가볍게 사용성을 익혀보고, 이후 A01 부터 본격 진행하세요.$$,
  $$["functions-params","arrays-indexing","io-formatting"]$$::jsonb,
  1,
  $${"correctness":0.5,"style":0.15,"memory_safety":0.2,"reflection":0.15}$$::jsonb,
  $${"timeLimitMs":2000,"memLimitMb":64,"allowedHeaders":["stdio.h","stdlib.h","string.h"]}$$::jsonb,
  $$#include <stdio.h>

double average(int x[]);

int main(void) {
    double avg;
    int base[5] = {3, 7, 2, 4, 5};

    avg = average(base);
    printf("base average = %.3f\n", avg);

    return 0;
}

double average(int x[]) {
    // TODO: 배열의 평균을 double 로 반환해보세요.
    return 0.0;
}
$$,
  $$[{"input":"","expected":"base average = 4.200\n","note":"배열 {3,7,2,4,5} 의 평균 = 4.2"}]$$::jsonb,
  $$["이 과제에서 가장 어려웠던 부분은 무엇이고, 어떻게 해결했나요?","다른 방법으로도 풀 수 있었나요? 그중 왜 이 방식을 택했는지 한 문장으로 적어봐요.","비슷한 문제를 다시 만나면 무엇을 다르게 하겠나요?"]$$::jsonb,
  '00000000-0000-4000-8000-000000000010',
  true,
  '00000000-0000-4000-8000-000000000001'
) on conflict (code) do update set
  version = excluded.version,
  title = excluded.title,
  template = excluded.template,
  kc_tags = excluded.kc_tags,
  difficulty = excluded.difficulty,
  rubric = excluded.rubric,
  constraints = excluded.constraints,
  starter_code = excluded.starter_code,
  visible_tests = excluded.visible_tests,
  reflection_prompts = excluded.reflection_prompts;

insert into public.assignments (code, version, title, template, kc_tags, difficulty, rubric, constraints, starter_code, visible_tests, reflection_prompts, cohort_id, active, created_by) values (
  'A01_array_2d_sum',
  1,
  $$2차원 배열 행·열 합산$$,
  $$5×4 정수 배열이 다음과 같이 초기화되어 있다.

```
  1   2   3   0
  5   6   7   0
  9  10  11   0
 13  14  15   0
  0   0   0   0
```

- 마지막 **열**(j=3)에는 각 행(0~3)의 합을 저장
- 마지막 **행**(i=4)에는 각 열(0~3)의 합을 저장 (마지막 행은 행합까지 포함된 결과의 열 합)
- 채운 뒤 전체 5×4 배열을 `%3d` 포맷으로 출력 (각 행 끝에 줄바꿈)

**채워야 할 두 부분**:

1. 각 행 i(0~3)에 대해 arr[i][0..2]의 합을 arr[i][3] 에 저장
2. 각 열 j(0~3)에 대해 arr[0..3][j]의 합을 arr[4][j] 에 저장

출력 예시 (`%3d`로 폭 3):

```
  1  2  3  6
  5  6  7 18
  9 10 11 30
 13 14 15 42
 28 32 36 96
```

입력은 없다. 배열 초기값과 출력 형식은 starter 코드에 이미 작성되어 있다.$$,
  $$["arrays-indexing","control-flow-loop"]$$::jsonb,
  2,
  $${"correctness":0.5,"style":0.15,"memory_safety":0.2,"reflection":0.15}$$::jsonb,
  $${"timeLimitMs":2000,"memLimitMb":64,"allowedHeaders":["stdio.h","stdlib.h","string.h"]}$$::jsonb,
  $$#include <stdio.h>

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
        printf("\n");
    }

    return 0;
}
$$,
  $$[{"input":"","expected":"  1  2  3  6\n  5  6  7 18\n  9 10 11 30\n 13 14 15 42\n 28 32 36 96\n","note":"고정 입력 — 행합·열합이 마지막 열·행에 채워져야 함"}]$$::jsonb,
  $$["이 과제에서 가장 어려웠던 부분은 무엇이고, 어떻게 해결했나요?","다른 방법으로도 풀 수 있었나요? 그중 왜 이 방식을 택했는지 한 문장으로 적어봐요.","비슷한 문제를 다시 만나면 무엇을 다르게 하겠나요?"]$$::jsonb,
  '00000000-0000-4000-8000-000000000010',
  true,
  '00000000-0000-4000-8000-000000000001'
) on conflict (code) do update set
  version = excluded.version,
  title = excluded.title,
  template = excluded.template,
  kc_tags = excluded.kc_tags,
  difficulty = excluded.difficulty,
  rubric = excluded.rubric,
  constraints = excluded.constraints,
  starter_code = excluded.starter_code,
  visible_tests = excluded.visible_tests,
  reflection_prompts = excluded.reflection_prompts;

insert into public.assignments (code, version, title, template, kc_tags, difficulty, rubric, constraints, starter_code, visible_tests, reflection_prompts, cohort_id, active, created_by) values (
  'A02_pointer_swap_fn',
  2,
  $$포인터 순회로 배열 최댓값·최솟값$$,
  $$정수 배열 `arr` 가 이미 선언돼 있고, 포인터 `p` 가 `arr` 의 첫 원소를 가리킨다. 빈 `for` 문 안을 채워 배열의 10 개 원소를 **포인터로 순회**하며 다음 세 가지를 한 번에 처리하라.

1. 각 원소를 `printf("%d ", ...)` 로 한 칸 띄어 출력.
2. `max` 가 지금까지의 최댓값이 되도록 갱신.
3. `min` 이 지금까지의 최솟값이 되도록 갱신.

반드시 인덱스 표기(`arr[i]`) 가 아닌 포인터 산술 (`*(p + i)`) 로 접근하라. `max`·`min` 은 첫 원소(`*arr`) 로 이미 초기화돼 있으니 그대로 사용하면 된다.

## 예상 출력

```
arr[] = { -8 9 -20 21 -26 -41 45 -51 78 90 }

최댓값: 90
최솟값: -51
```$$,
  $$["pointer-basics","pointer-arithmetic","control-flow-loop"]$$::jsonb,
  2,
  $${"correctness":0.5,"style":0.15,"memory_safety":0.2,"reflection":0.15}$$::jsonb,
  $${"timeLimitMs":2000,"memLimitMb":64,"allowedHeaders":["stdio.h","stdlib.h","string.h"]}$$::jsonb,
  $$#include <stdio.h>

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

    printf("}\n\n");
    printf("최댓값: %d\n", max);
    printf("최솟값: %d", min);

    return 0;
}
$$,
  $$[{"input":"","expected":"arr[] = { -8 9 -20 21 -26 -41 45 -51 78 90 }\n\n최댓값: 90\n최솟값: -51","note":"고정 배열 — 입력 없음. for 문이 비어 있으면 \"arr[] = { }\" 와 max/min 초기값만 찍힌다."}]$$::jsonb,
  $$["이 과제에서 가장 어려웠던 부분은 무엇이고, 어떻게 해결했나요?","다른 방법으로도 풀 수 있었나요? 그중 왜 이 방식을 택했는지 한 문장으로 적어봐요.","비슷한 문제를 다시 만나면 무엇을 다르게 하겠나요?"]$$::jsonb,
  '00000000-0000-4000-8000-000000000010',
  true,
  '00000000-0000-4000-8000-000000000001'
) on conflict (code) do update set
  version = excluded.version,
  title = excluded.title,
  template = excluded.template,
  kc_tags = excluded.kc_tags,
  difficulty = excluded.difficulty,
  rubric = excluded.rubric,
  constraints = excluded.constraints,
  starter_code = excluded.starter_code,
  visible_tests = excluded.visible_tests,
  reflection_prompts = excluded.reflection_prompts;

insert into public.assignments (code, version, title, template, kc_tags, difficulty, rubric, constraints, starter_code, visible_tests, reflection_prompts, cohort_id, active, created_by) values (
  'A03_arrays_basic',
  3,
  $$문자 입력 반복과 대문자 변환$$,
  $$표준 입력에서 **한 글자씩** 읽어 대문자로 변환해 출력하는 프로그램을 작성하라. 한 번 글자를 처리한 뒤에는 같은 줄에 남아 있는 나머지 문자를 모두 버린(입력 버퍼 비우기) 다음, 다시 다음 글자 입력을 기다린다. `EOF`(Ctrl+Z) 가 들어오면 반복을 종료한다.

다음 두 부분을 직접 작성해야 한다.

1. **대문자 변환 후 출력** — `toupper(ch)` 의 결과를 `putchar()` 로 출력하고, 그 뒤에 `printf("\n")` 으로 줄바꿈.
2. **입력 버퍼 비우기** — `while ((ch = getchar()) != '\n' && ch != EOF) { }` 로 같은 줄에 남아 있는 글자를 모두 소진. 이 루프가 없으면 다음 반복에서 `getchar()` 가 이전 줄의 잔여 문자를 읽어 버린다.

프롬프트 출력, `getchar()` 호출, EOF 검사, 종료 메시지는 starter 코드에 이미 포함되어 있다.

## 입출력 예시

```
키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> a
A
키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> ^Z
EOF가 입력되어 반복 종료함
```

## 힌트

- `toupper(c)` 는 소문자만 변환하고 대문자·숫자·공백·특수문자는 그대로 둔다 (`#include <ctype.h>`).
- `putchar()` 는 정수를 받아 그에 해당하는 문자 한 글자를 출력한다.
- 입력 버퍼 비우기 루프는 본문(`{}`) 가 비어 있어도 된다. **조건식이 핵심**.
- `getchar()` 는 입력의 끝(EOF) 에서 `EOF` 매크로(보통 `-1`) 를 반환한다.$$,
  $$["io-formatting","control-flow-loop","control-flow-if"]$$::jsonb,
  2,
  $${"correctness":0.5,"style":0.15,"memory_safety":0.2,"reflection":0.15}$$::jsonb,
  $${"timeLimitMs":2000,"memLimitMb":64,"allowedHeaders":["stdio.h","stdlib.h","string.h"]}$$::jsonb,
  $$#include <stdio.h>
#include <ctype.h>

int main() {
    int ch;

    while (1) {
        printf("\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> ");

        ch = getchar();

        // EOF 입력 시 반복 종료
        if (ch == EOF) {
            break;
        }

        // TODO 1: ch 를 대문자로 변환해 한 글자 출력하고, 줄바꿈도 출력하세요.
        //         (toupper(ch) 의 결과를 putchar 로, 그 뒤에 printf("\n"))


        // TODO 2: 같은 줄에 남아 있는 문자들을 모두 버려 입력 버퍼를 비우세요.
        //         (getchar() 의 반환값이 '\n' 또는 EOF 가 될 때까지 반복)


    }

    printf("\nEOF가 입력되어 반복 종료함");

    return 0;
}
$$,
  $$[{"input":"a\n","expected":"\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> A\n\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> \nEOF가 입력되어 반복 종료함","note":"기본 — 'a' 입력 한 번 후 Ctrl+Z(EOF)"},{"input":"Hello\n","expected":"\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> H\n\n키보드로부터 1개의 문자 입력(반복 종료: Ctrl+Z)>> \nEOF가 입력되어 반복 종료함","note":"한 줄에 여러 글자가 와도 첫 글자만 처리 — 나머지는 버퍼 비우기로 버려짐"}]$$::jsonb,
  $$["이 과제에서 가장 어려웠던 부분은 무엇이고, 어떻게 해결했나요?","다른 방법으로도 풀 수 있었나요? 그중 왜 이 방식을 택했는지 한 문장으로 적어봐요.","비슷한 문제를 다시 만나면 무엇을 다르게 하겠나요?"]$$::jsonb,
  '00000000-0000-4000-8000-000000000010',
  true,
  '00000000-0000-4000-8000-000000000001'
) on conflict (code) do update set
  version = excluded.version,
  title = excluded.title,
  template = excluded.template,
  kc_tags = excluded.kc_tags,
  difficulty = excluded.difficulty,
  rubric = excluded.rubric,
  constraints = excluded.constraints,
  starter_code = excluded.starter_code,
  visible_tests = excluded.visible_tests,
  reflection_prompts = excluded.reflection_prompts;

insert into public.assignments (code, version, title, template, kc_tags, difficulty, rubric, constraints, starter_code, visible_tests, reflection_prompts, cohort_id, active, created_by) values (
  'A04_array_max',
  1,
  $$배열 최댓값$$,
  $$길이 N인 정수 배열에서 최댓값과 그 인덱스(0-base)를 출력하라. 최댓값이 여러 번이면 가장 앞의 인덱스.$$,
  $$["arrays-indexing","control-flow-loop","variables-types"]$$::jsonb,
  3,
  $${"correctness":0.5,"style":0.15,"memory_safety":0.2,"reflection":0.15}$$::jsonb,
  $${"timeLimitMs":2000,"memLimitMb":64,"allowedHeaders":["stdio.h","stdlib.h","string.h"]}$$::jsonb,
  $$#include <stdio.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int arr[100];
    for (int i = 0; i < n; i++) scanf("%d", &arr[i]);
    // TODO: 최댓값과 그 인덱스를 형식에 맞춰 출력해보세요.
    return 0;
}
$$,
  $$[{"input":"5\n3 1 4 1 5","expected":"max=5 idx=4\n"},{"input":"4\n2 2 2 2","expected":"max=2 idx=0\n"}]$$::jsonb,
  $$["이 과제에서 가장 어려웠던 부분은 무엇이고, 어떻게 해결했나요?","다른 방법으로도 풀 수 있었나요? 그중 왜 이 방식을 택했는지 한 문장으로 적어봐요.","비슷한 문제를 다시 만나면 무엇을 다르게 하겠나요?"]$$::jsonb,
  '00000000-0000-4000-8000-000000000010',
  true,
  '00000000-0000-4000-8000-000000000001'
) on conflict (code) do update set
  version = excluded.version,
  title = excluded.title,
  template = excluded.template,
  kc_tags = excluded.kc_tags,
  difficulty = excluded.difficulty,
  rubric = excluded.rubric,
  constraints = excluded.constraints,
  starter_code = excluded.starter_code,
  visible_tests = excluded.visible_tests,
  reflection_prompts = excluded.reflection_prompts;

insert into public.assignments (code, version, title, template, kc_tags, difficulty, rubric, constraints, starter_code, visible_tests, reflection_prompts, cohort_id, active, created_by) values (
  'A05_pointer_swap',
  1,
  $$포인터로 값 교환$$,
  $$두 정수 포인터를 받아 값을 교환하는 함수 `void swap(int *a, int *b)`를 구현하고, main에서 두 입력을 받아 swap 후 출력하라.$$,
  $$["pointer-basics","functions-params"]$$::jsonb,
  3,
  $${"correctness":0.5,"style":0.15,"memory_safety":0.2,"reflection":0.15}$$::jsonb,
  $${"timeLimitMs":2000,"memLimitMb":64,"allowedHeaders":["stdio.h","stdlib.h","string.h"]}$$::jsonb,
  $$#include <stdio.h>

void swap(int *a, int *b) {
    // TODO
}

int main(void) {
    int x, y;
    scanf("%d %d", &x, &y);
    swap(&x, &y);
    printf("%d %d\n", x, y);
    return 0;
}
$$,
  $$[{"input":"3 7","expected":"7 3\n"},{"input":"-1 0","expected":"0 -1\n"}]$$::jsonb,
  $$["이 과제에서 가장 어려웠던 부분은 무엇이고, 어떻게 해결했나요?","다른 방법으로도 풀 수 있었나요? 그중 왜 이 방식을 택했는지 한 문장으로 적어봐요.","비슷한 문제를 다시 만나면 무엇을 다르게 하겠나요?"]$$::jsonb,
  '00000000-0000-4000-8000-000000000010',
  true,
  '00000000-0000-4000-8000-000000000001'
) on conflict (code) do update set
  version = excluded.version,
  title = excluded.title,
  template = excluded.template,
  kc_tags = excluded.kc_tags,
  difficulty = excluded.difficulty,
  rubric = excluded.rubric,
  constraints = excluded.constraints,
  starter_code = excluded.starter_code,
  visible_tests = excluded.visible_tests,
  reflection_prompts = excluded.reflection_prompts;

insert into public.assignments (code, version, title, template, kc_tags, difficulty, rubric, constraints, starter_code, visible_tests, reflection_prompts, cohort_id, active, created_by) values (
  'A06_array_reverse',
  1,
  $$포인터 순회로 배열 역출력$$,
  $$길이 N인 정수 배열을 포인터 산술로 순회하며 역순으로 한 줄에 공백 구분 출력하라. arr[i] 대신 `*(p+i)` 같은 포인터 표기만 사용.$$,
  $$["pointer-arithmetic","arrays-indexing"]$$::jsonb,
  3,
  $${"correctness":0.5,"style":0.15,"memory_safety":0.2,"reflection":0.15}$$::jsonb,
  $${"timeLimitMs":2000,"memLimitMb":64,"allowedHeaders":["stdio.h","stdlib.h","string.h"]}$$::jsonb,
  $$#include <stdio.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int arr[100];
    for (int i = 0; i < n; i++) scanf("%d", &arr[i]);
    int *p = arr;
    // TODO: 포인터로 배열을 탐색하며 결과를 출력해보세요.
    return 0;
}
$$,
  $$[{"input":"4\n1 2 3 4","expected":"4 3 2 1\n"},{"input":"1\n42","expected":"42\n"}]$$::jsonb,
  $$["이 과제에서 가장 어려웠던 부분은 무엇이고, 어떻게 해결했나요?","다른 방법으로도 풀 수 있었나요? 그중 왜 이 방식을 택했는지 한 문장으로 적어봐요.","비슷한 문제를 다시 만나면 무엇을 다르게 하겠나요?"]$$::jsonb,
  '00000000-0000-4000-8000-000000000010',
  true,
  '00000000-0000-4000-8000-000000000001'
) on conflict (code) do update set
  version = excluded.version,
  title = excluded.title,
  template = excluded.template,
  kc_tags = excluded.kc_tags,
  difficulty = excluded.difficulty,
  rubric = excluded.rubric,
  constraints = excluded.constraints,
  starter_code = excluded.starter_code,
  visible_tests = excluded.visible_tests,
  reflection_prompts = excluded.reflection_prompts;

insert into public.assignments (code, version, title, template, kc_tags, difficulty, rubric, constraints, starter_code, visible_tests, reflection_prompts, cohort_id, active, created_by) values (
  'A07_malloc_resize',
  1,
  $$malloc과 동적 배열$$,
  $$입력 N에 대해 malloc으로 N개 정수 배열을 할당, 입력 N개 값을 읽고 뒤집어 출력한 뒤 반드시 free하라. 누수 금지.$$,
  $$["memory-allocation","arrays-indexing","control-flow-loop"]$$::jsonb,
  4,
  $${"correctness":0.45,"style":0.1,"memory_safety":0.3,"reflection":0.15}$$::jsonb,
  $${"timeLimitMs":2000,"memLimitMb":64,"allowedHeaders":["stdio.h","stdlib.h","string.h"]}$$::jsonb,
  $$#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int n;
    scanf("%d", &n);
    // TODO: 동적 메모리를 할당하고 결과를 출력한 뒤 정리해보세요.
    return 0;
}
$$,
  $$[{"input":"3\n1 2 3","expected":"3 2 1\n"},{"input":"5\n10 20 30 40 50","expected":"50 40 30 20 10\n"}]$$::jsonb,
  $$["이 과제에서 가장 어려웠던 부분은 무엇이고, 어떻게 해결했나요?","다른 방법으로도 풀 수 있었나요? 그중 왜 이 방식을 택했는지 한 문장으로 적어봐요.","비슷한 문제를 다시 만나면 무엇을 다르게 하겠나요?"]$$::jsonb,
  '00000000-0000-4000-8000-000000000010',
  true,
  '00000000-0000-4000-8000-000000000001'
) on conflict (code) do update set
  version = excluded.version,
  title = excluded.title,
  template = excluded.template,
  kc_tags = excluded.kc_tags,
  difficulty = excluded.difficulty,
  rubric = excluded.rubric,
  constraints = excluded.constraints,
  starter_code = excluded.starter_code,
  visible_tests = excluded.visible_tests,
  reflection_prompts = excluded.reflection_prompts;

insert into public.assignments (code, version, title, template, kc_tags, difficulty, rubric, constraints, starter_code, visible_tests, reflection_prompts, cohort_id, active, created_by) values (
  'A08_factorial_iter',
  1,
  $$반복문으로 팩토리얼$$,
  $$정수 n (0 ≤ n ≤ 12) 을 입력받아 n!을 반복문으로 계산해 출력하라. 재귀 금지.$$,
  $$["functions-params","control-flow-loop","control-flow-if","variables-types"]$$::jsonb,
  3,
  $${"correctness":0.5,"style":0.15,"memory_safety":0.2,"reflection":0.15}$$::jsonb,
  $${"timeLimitMs":2000,"memLimitMb":64,"allowedHeaders":["stdio.h","stdlib.h","string.h"]}$$::jsonb,
  $$#include <stdio.h>

long factorial_iter(int n) {
    // TODO: 반복문으로 n! 을 계산해보세요.
    return 1;
}

int main(void) {
    int n;
    scanf("%d", &n);
    printf("%ld\n", factorial_iter(n));
    return 0;
}
$$,
  $$[{"input":"5","expected":"120\n"},{"input":"0","expected":"1\n"},{"input":"10","expected":"3628800\n"}]$$::jsonb,
  $$["이 과제에서 가장 어려웠던 부분은 무엇이고, 어떻게 해결했나요?","다른 방법으로도 풀 수 있었나요? 그중 왜 이 방식을 택했는지 한 문장으로 적어봐요.","비슷한 문제를 다시 만나면 무엇을 다르게 하겠나요?"]$$::jsonb,
  '00000000-0000-4000-8000-000000000010',
  true,
  '00000000-0000-4000-8000-000000000001'
) on conflict (code) do update set
  version = excluded.version,
  title = excluded.title,
  template = excluded.template,
  kc_tags = excluded.kc_tags,
  difficulty = excluded.difficulty,
  rubric = excluded.rubric,
  constraints = excluded.constraints,
  starter_code = excluded.starter_code,
  visible_tests = excluded.visible_tests,
  reflection_prompts = excluded.reflection_prompts;

insert into public.assignments (code, version, title, template, kc_tags, difficulty, rubric, constraints, starter_code, visible_tests, reflection_prompts, cohort_id, active, created_by) values (
  'A09_factorial_rec',
  1,
  $$재귀로 팩토리얼$$,
  $$같은 팩토리얼을 이번엔 재귀 함수 `long factorial_rec(int n)`로 작성하라. 기저 조건을 반드시 명시.$$,
  $$["recursion","functions-params"]$$::jsonb,
  4,
  $${"correctness":0.5,"style":0.15,"memory_safety":0.2,"reflection":0.15}$$::jsonb,
  $${"timeLimitMs":2000,"memLimitMb":64,"allowedHeaders":["stdio.h","stdlib.h","string.h"]}$$::jsonb,
  $$#include <stdio.h>

long factorial_rec(int n) {
    // TODO: 재귀 호출로 n! 을 계산해보세요.
    return 1;
}

int main(void) {
    int n;
    scanf("%d", &n);
    printf("%ld\n", factorial_rec(n));
    return 0;
}
$$,
  $$[{"input":"5","expected":"120\n"},{"input":"1","expected":"1\n"},{"input":"7","expected":"5040\n"}]$$::jsonb,
  $$["이 과제에서 가장 어려웠던 부분은 무엇이고, 어떻게 해결했나요?","다른 방법으로도 풀 수 있었나요? 그중 왜 이 방식을 택했는지 한 문장으로 적어봐요.","비슷한 문제를 다시 만나면 무엇을 다르게 하겠나요?"]$$::jsonb,
  '00000000-0000-4000-8000-000000000010',
  true,
  '00000000-0000-4000-8000-000000000001'
) on conflict (code) do update set
  version = excluded.version,
  title = excluded.title,
  template = excluded.template,
  kc_tags = excluded.kc_tags,
  difficulty = excluded.difficulty,
  rubric = excluded.rubric,
  constraints = excluded.constraints,
  starter_code = excluded.starter_code,
  visible_tests = excluded.visible_tests,
  reflection_prompts = excluded.reflection_prompts;

insert into public.assignments (code, version, title, template, kc_tags, difficulty, rubric, constraints, starter_code, visible_tests, reflection_prompts, cohort_id, active, created_by) values (
  'A10_printf_table',
  1,
  $$printf 포맷과 구구단$$,
  $$정수 N(1~9)을 입력 받아 N단 전체를 `%d x %d = %2d` 포맷으로 출력하라. 숫자 폭 정렬 필수.$$,
  $$["io-formatting","control-flow-loop"]$$::jsonb,
  2,
  $${"correctness":0.5,"style":0.15,"memory_safety":0.2,"reflection":0.15}$$::jsonb,
  $${"timeLimitMs":2000,"memLimitMb":64,"allowedHeaders":["stdio.h","stdlib.h","string.h"]}$$::jsonb,
  $$#include <stdio.h>

int main(void) {
    int n;
    scanf("%d", &n);
    // TODO: n 단 구구단을 형식에 맞춰 출력해보세요.
    return 0;
}
$$,
  $$[{"input":"2","expected":"2 x 1 =  2\n2 x 2 =  4\n2 x 3 =  6\n2 x 4 =  8\n2 x 5 = 10\n2 x 6 = 12\n2 x 7 = 14\n2 x 8 = 16\n2 x 9 = 18\n"}]$$::jsonb,
  $$["이 과제에서 가장 어려웠던 부분은 무엇이고, 어떻게 해결했나요?","다른 방법으로도 풀 수 있었나요? 그중 왜 이 방식을 택했는지 한 문장으로 적어봐요.","비슷한 문제를 다시 만나면 무엇을 다르게 하겠나요?"]$$::jsonb,
  '00000000-0000-4000-8000-000000000010',
  true,
  '00000000-0000-4000-8000-000000000001'
) on conflict (code) do update set
  version = excluded.version,
  title = excluded.title,
  template = excluded.template,
  kc_tags = excluded.kc_tags,
  difficulty = excluded.difficulty,
  rubric = excluded.rubric,
  constraints = excluded.constraints,
  starter_code = excluded.starter_code,
  visible_tests = excluded.visible_tests,
  reflection_prompts = excluded.reflection_prompts;

commit;
