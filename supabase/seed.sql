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
  4,
  $$단어 정렬 프로그램$$,
  $$공백으로 구분된 **세 개의 영어 단어** 를 입력받아 **사전순(알파벳순)** 으로 정렬해 출력하라.

## 입출력 예시

```
세 개의 단어 입력: kiwi banana apple
사전순 출력: apple banana kiwi
```$$,
  $$["strings-basic","control-flow-if","arrays-indexing"]$$::jsonb,
  3,
  $${"correctness":0.5,"style":0.15,"memory_safety":0.2,"reflection":0.15}$$::jsonb,
  $${"timeLimitMs":2000,"memLimitMb":64,"allowedHeaders":["stdio.h","stdlib.h","string.h"]}$$::jsonb,
  $$#include <stdio.h>
#include <string.h>

int main(void)
{
    char str1[100], str2[100], str3[100];
    char temp[100];

    printf("세 개의 단어 입력: ");
    scanf("%s %s %s", str1, str2, str3);

    // TODO 1: str1 과 str2 비교 — str1 이 str2 보다 사전순으로 뒤면 둘을 교환


    // TODO 2: str1 과 str3 비교 — str1 이 str3 보다 사전순으로 뒤면 둘을 교환


    // TODO 3: str2 와 str3 비교 — str2 가 str3 보다 사전순으로 뒤면 둘을 교환


    printf("사전순 출력: %s %s %s\n", str1, str2, str3);

    return 0;
}
$$,
  $$[{"input":"kiwi banana apple","expected":"세 개의 단어 입력: 사전순 출력: apple banana kiwi\n","note":"예시 입력 — 정반대 순서. 세 번의 비교 모두 교환이 일어남."},{"input":"apple banana kiwi","expected":"세 개의 단어 입력: 사전순 출력: apple banana kiwi\n","note":"이미 정렬된 입력 — 한 번도 교환이 일어나면 안 됨."}]$$::jsonb,
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
  3,
  $$함수 포인터 배열로 사칙연산$$,
  $$네 개의 사칙연산 함수(add / sub / mul / div) 를 작성하고, 이들을 **함수 포인터 배열** 로 묶어 인덱스로 호출하는 프로그램을 완성하라.

## 입출력 예시

```
두 정수 입력: 20 5
덧셈 결과: 25
뺄셈 결과: 15
곱셈 결과: 100
나눗셈 결과: 4
```$$,
  $$["function-pointers","functions-params","pointer-basics"]$$::jsonb,
  3,
  $${"correctness":0.5,"style":0.15,"memory_safety":0.2,"reflection":0.15}$$::jsonb,
  $${"timeLimitMs":2000,"memLimitMb":64,"allowedHeaders":["stdio.h","stdlib.h","string.h"]}$$::jsonb,
  $$#include <stdio.h>

// TODO 1: 두 정수의 합을 반환하는 add 함수를 작성하세요.


// TODO 2: 두 정수의 차를 반환하는 sub 함수를 작성하세요.


// TODO 3: 두 정수의 곱을 반환하는 mul 함수를 작성하세요.


// TODO 4: 두 정수를 나눈 몫을 반환하는 div 함수를 작성하세요.


int main(void)
{
    int num1, num2;

    // TODO 5: add, sub, mul, div 를 담는 함수 포인터 배열 fp 를 선언·초기화하세요.


    printf("두 정수 입력: ");
    scanf("%d %d", &num1, &num2);

    printf("덧셈 결과: %d\n", fp[0](num1, num2));
    printf("뺄셈 결과: %d\n", fp[1](num1, num2));
    printf("곱셈 결과: %d\n", fp[2](num1, num2));
    printf("나눗셈 결과: %d\n", fp[3](num1, num2));

    return 0;
}
$$,
  $$[{"input":"20 5","expected":"두 정수 입력: 덧셈 결과: 25\n뺄셈 결과: 15\n곱셈 결과: 100\n나눗셈 결과: 4\n","note":"예시 입력 — 20 / 5"},{"input":"10 2","expected":"두 정수 입력: 덧셈 결과: 12\n뺄셈 결과: 8\n곱셈 결과: 20\n나눗셈 결과: 5\n","note":"기본 정수 케이스"}]$$::jsonb,
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
  3,
  $$malloc과 realloc으로 동적 배열 확장$$,
  $$동적 메모리로 정수 3개 공간을 만들어 출력한 뒤, 크기를 5개로 확장해 두 칸을 더 채우고 다시 출력하라. starter 코드의 TODO 1~4 를 채우면 된다. 입력은 없다.

## 예상 출력

```
기존 배열:
10 20 30 

확장된 배열:
10 20 30 40 50 
```$$,
  $$["memory-allocation","memory-realloc","control-flow-loop"]$$::jsonb,
  3,
  $${"correctness":0.45,"style":0.1,"memory_safety":0.3,"reflection":0.15}$$::jsonb,
  $${"timeLimitMs":2000,"memLimitMb":64,"allowedHeaders":["stdio.h","stdlib.h","string.h"]}$$::jsonb,
  $$#include <stdio.h>
#include <stdlib.h>

int main()
{
    int* arr;
    int i;

    // TODO 1 : malloc( )을 활용하여 3개의 정수 공간 할당


    if (arr == NULL) {
        printf("메모리 할당 실패\n");
        return 1;
    }

    // 값 저장
    for (i = 0; i < 3; i++) {
        arr[i] = (i + 1) * 10;
    }

    printf("기존 배열:\n");
    for (i = 0; i < 3; i++) {
        printf("%d ", arr[i]);
    }

    // TODO 2 : realloc( )를 활용하여 배열 크기를 5개로 확장


    // TODO 3 : 메모리 재할당 실패 여부 확인


    // TODO 4 : 늘어난 새 공간에 40과 50 저장


    printf("\n\n확장된 배열:\n");
    for (i = 0; i < 5; i++) {
        printf("%d ", arr[i]);
    }

    // 메모리 해제
    free(arr);

    return 0;
}
$$,
  $$[{"input":"","expected":"기존 배열:\n10 20 30 \n\n확장된 배열:\n10 20 30 40 50 ","note":"입력 없음 — 고정된 값(10,20,30 → 40,50 추가) 출력"}]$$::jsonb,
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
  2,
  $$구조체 중첩으로 학생 성적 관리$$,
  $$구조체(`struct`)로 한 학생의 성적 정보를 관리하는 프로그램을 완성하라.

- **Score** — 국어·영어·수학 점수(정수)를 담는 구조체
- **Student** — 이름과 성적(`Score`)을 **중첩(nested)** 으로 담는 구조체

`main` 에는 한 학생의 데이터가 이미 저장돼 있다. starter 의 TODO 1~4(구조체 두 개 정의 → 총점·평균 계산 → 출력)를 채워라. 평균은 실수로 출력한다. 입력은 없다.

## 예상 출력

```
Name: Kim Min Jun
Korean: 90
English: 85
Math: 95
Total: 270
Average: 90.00
```$$,
  $$["structs-basic","structs-nested","io-formatting"]$$::jsonb,
  3,
  $${"correctness":0.5,"style":0.15,"memory_safety":0.2,"reflection":0.15}$$::jsonb,
  $${"timeLimitMs":2000,"memLimitMb":64,"allowedHeaders":["stdio.h","stdlib.h","string.h"]}$$::jsonb,
  $$#include <stdio.h>
#include <string.h>

// TODO 1. 성적 정보를 나타내는 구조체 Score 를 정의하세요.
//         (korean, english, math — 모두 정수형 멤버)


// TODO 2. 학생 정보를 나타내는 구조체 Student 를 정의하세요.
//         (이름을 담는 char name[50] + 성적 구조체(Score)를 멤버로 중첩)


int main(void)
{
    struct Student student;
    int total;
    double average;

    // 데이터 저장
    strcpy(student.name, "Kim Min Jun");
    student.exam.korean = 90;
    student.exam.english = 85;
    student.exam.math = 95;

    // TODO 3. 총점(total)과 평균(average)을 계산하세요.
    //         평균은 3.0 으로 나눠 실수로 떨어지게 하세요.


    // TODO 4. 아래 형식대로 출력하세요. (각 줄 끝에 줄바꿈)
    //   Name: 이름
    //   Korean: 점수 / English: 점수 / Math: 점수
    //   Total: 총점 / Average: 평균(소수점 2자리)


    return 0;
}
$$,
  $$[{"input":"","expected":"Name: Kim Min Jun\nKorean: 90\nEnglish: 85\nMath: 95\nTotal: 270\nAverage: 90.00\n","note":"입력 없음 — 고정된 학생 데이터(90,85,95 → 총점 270, 평균 90.00) 출력"}]$$::jsonb,
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
  2,
  $$구조체 포인터로 학생 성적 처리$$,
  $$구조체 포인터를 함수에 넘겨 여러 학생의 성적을 처리하는 프로그램을 완성하라.

- **Student** — 이름(`name[50]`)과 점수(`score`)를 담는 구조체
- **printStudents** — 학생 배열(구조체 포인터)과 학생 수를 받아 모든 학생의 이름·점수를 출력
- **getAverage** — 학생 배열과 학생 수를 받아 평균 점수를 `double` 로 반환

`main` 에는 학생 3명(Kim·Lee·Park)이 이미 저장돼 있다. starter 의 TODO 1~3(구조체 정의 → 출력 함수 → 평균 함수)을 채워라. 두 함수의 원형(prototype)은 starter 에 제시돼 있다. 입력은 없다.

## 예상 출력

```
학생 정보 출력
이름: Kim, 점수: 90
이름: Lee, 점수: 80
이름: Park, 점수: 70

평균 점수: 80.00
```$$,
  $$["structs-pointer","functions-params","structs-basic","variables-types"]$$::jsonb,
  3,
  $${"correctness":0.5,"style":0.15,"memory_safety":0.2,"reflection":0.15}$$::jsonb,
  $${"timeLimitMs":2000,"memLimitMb":64,"allowedHeaders":["stdio.h","stdlib.h","string.h"]}$$::jsonb,
  $$#include <stdio.h>

// TODO 1. 학생의 이름(name[50])과 점수(score)를 담는 구조체 Student 를 정의하세요.


// TODO 2. printStudents 함수를 완성하세요.
//   - 모든 학생의 이름과 점수를 한 줄씩 출력합니다.
//   - 구조체 포인터(students)로 멤버에 접근하고, for 문으로 size 만큼 반복하세요.
//   - 첫 줄에 "학생 정보 출력" 을 먼저 출력합니다. (예상 출력 참고)
void printStudents(struct Student *students, int size)
{
    // 여기를 채우세요.
}

// TODO 3. getAverage 함수를 완성하세요.
//   - 모든 학생의 점수를 더한 뒤 평균을 double 로 반환합니다.
double getAverage(struct Student *students, int size)
{
    // 여기를 채우세요.
    return 0.0;
}

int main(void)
{
    struct Student students[3] = {
        {"Kim", 90},
        {"Lee", 80},
        {"Park", 70}
    };

    double average;

    printStudents(students, 3);

    average = getAverage(students, 3);
    printf("\n평균 점수: %.2f\n", average);

    return 0;
}
$$,
  $$[{"input":"","expected":"학생 정보 출력\n이름: Kim, 점수: 90\n이름: Lee, 점수: 80\n이름: Park, 점수: 70\n\n평균 점수: 80.00\n","note":"입력 없음 — 고정된 학생 3명(90,80,70 → 평균 80.00) 출력"}]$$::jsonb,
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
  2,
  $$파일 입출력$$,
  $$파일에 문자열을 저장한 뒤 다시 읽어 화면에 출력하는 프로그램을 완성하라.

- `hello.txt` 파일에 주어진 문자열(`message`)을 쓴다.
- 같은 파일을 다시 열어 내용을 읽어 화면에 출력한다.
- 파일 열기에 실패하면 `"파일을 열 수 없습니다."` 를 출력하고 종료한다.

`main` 에는 저장할 문자열과 읽어 올 버퍼가 이미 준비돼 있다. starter 의 TODO 1~7(쓰기 모드 열기 → 실패 검사 → 쓰기 → 읽기 모드 열기 → 실패 검사 → 읽기 → 출력)을 채워라. 입력은 없다.

## 예상 출력

```
파일에서 읽은 문자열: Let's wrap it up here.
```$$,
  $$["file-io","io-formatting"]$$::jsonb,
  3,
  $${"correctness":0.5,"style":0.15,"memory_safety":0.2,"reflection":0.15}$$::jsonb,
  $${"timeLimitMs":2000,"memLimitMb":64,"allowedHeaders":["stdio.h","stdlib.h","string.h"]}$$::jsonb,
  $$#include <stdio.h>

int main(void)
{
    FILE *fp;

    char message[] = "Let's wrap it up here.";
    char readMessage[100];

    // TODO 1. hello.txt 파일을 쓰기 모드("w")로 연다.


    // TODO 2. 파일 열기에 실패하면(fp == NULL) "파일을 열 수 없습니다." 를
    //         출력하고 return 1; 로 종료한다.


    // TODO 3. message 문자열을 파일에 저장한다.


    fclose(fp);

    // TODO 4. hello.txt 파일을 읽기 모드("r")로 연다.


    // TODO 5. 파일 열기에 실패하면 "파일을 열 수 없습니다." 를 출력하고 종료한다.


    // TODO 6. fgets 함수로 파일에서 문자열을 readMessage 에 읽어 온다.


    // TODO 7. 읽은 문자열을 화면에 출력한다.


    fclose(fp);

    return 0;
}
$$,
  $$[{"input":"","expected":"파일에서 읽은 문자열: Let's wrap it up here.","note":"입력 없음 — 파일에 쓴 문자열을 다시 읽어 그대로 출력"}]$$::jsonb,
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
