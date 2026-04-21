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
  ('cohort-2026-spring-cs1', $$2026 Spring CS1$$, $$2026-Spring$$, '00000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

insert into public.assignments (code, version, title, template, kc_tags, difficulty, rubric, constraints, starter_code, visible_tests, reflection_prompts, cohort_id, active, created_by) values (
  'A01_hello_variables',
  1,
  $$변수와 출력$$,
  $$정수 변수 2개를 선언하고 그 합을 출력하는 프로그램을 작성하라. 출력 형식: `sum = <값>`$$,
  $$["variables-types","io-formatting"]$$::jsonb,
  1,
  $${"correctness":0.5,"style":0.15,"memory_safety":0.2,"reflection":0.15}$$::jsonb,
  $${"timeLimitMs":2000,"memLimitMb":64,"allowedHeaders":["stdio.h","stdlib.h","string.h"]}$$::jsonb,
  $$#include <stdio.h>

int main(void) {
    // TODO: 두 정수 변수를 선언하고 그 합을 출력한다.
    return 0;
}
$$,
  $$[{"input":"","expected":"sum = 7\n","note":"a=3, b=4"}]$$::jsonb,
  $$["이 코드에서 가장 어려웠던 부분은?","AI의 어떤 힌트가 결정적이었나?","가능했던 두 가지 해결안은 무엇이었고, 왜 이 방식을 선택했는가?","왜 그렇게 생각했는가?","다음에 비슷한 문제를 만나면 어떻게 접근하겠나?"]$$::jsonb,
  'cohort-2026-spring-cs1',
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
  'A02_grade_if',
  1,
  $$점수 등급 분류$$,
  $$표준 입력으로 받은 점수(0~100)에 대해 등급을 출력하라. 90+ A, 80+ B, 70+ C, 60+ D, 그 외 F.$$,
  $$["control-flow-if","variables-types","io-formatting"]$$::jsonb,
  2,
  $${"correctness":0.5,"style":0.15,"memory_safety":0.2,"reflection":0.15}$$::jsonb,
  $${"timeLimitMs":2000,"memLimitMb":64,"allowedHeaders":["stdio.h","stdlib.h","string.h"]}$$::jsonb,
  $$#include <stdio.h>

int main(void) {
    int score;
    scanf("%d", &score);
    // TODO: 등급 분기
    return 0;
}
$$,
  $$[{"input":"92","expected":"A\n"},{"input":"78","expected":"C\n"},{"input":"45","expected":"F\n"}]$$::jsonb,
  $$["이 코드에서 가장 어려웠던 부분은?","AI의 어떤 힌트가 결정적이었나?","가능했던 두 가지 해결안은 무엇이었고, 왜 이 방식을 선택했는가?","왜 그렇게 생각했는가?","다음에 비슷한 문제를 만나면 어떻게 접근하겠나?"]$$::jsonb,
  'cohort-2026-spring-cs1',
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
  1,
  $$배열 합산$$,
  $$길이 N인 정수 배열을 입력 받아 모든 원소의 합을 한 줄로 출력하라. 입력 첫 줄은 N, 둘째 줄은 공백으로 구분된 N개 정수.$$,
  $$["arrays-indexing","control-flow-loop"]$$::jsonb,
  2,
  $${"correctness":0.5,"style":0.15,"memory_safety":0.2,"reflection":0.15}$$::jsonb,
  $${"timeLimitMs":2000,"memLimitMb":64,"allowedHeaders":["stdio.h","stdlib.h","string.h"]}$$::jsonb,
  $$#include <stdio.h>

int main(void) {
    int n;
    scanf("%d", &n);
    int arr[100];
    // TODO: n개 정수 읽기 + 합산
    return 0;
}
$$,
  $$[{"input":"5\n1 2 3 4 5","expected":"15\n"},{"input":"3\n10 -5 7","expected":"12\n"}]$$::jsonb,
  $$["이 코드에서 가장 어려웠던 부분은?","AI의 어떤 힌트가 결정적이었나?","가능했던 두 가지 해결안은 무엇이었고, 왜 이 방식을 선택했는가?","왜 그렇게 생각했는가?","다음에 비슷한 문제를 만나면 어떻게 접근하겠나?"]$$::jsonb,
  'cohort-2026-spring-cs1',
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
    // TODO: 최댓값과 인덱스 찾기
    return 0;
}
$$,
  $$[{"input":"5\n3 1 4 1 5","expected":"max=5 idx=4\n"},{"input":"4\n2 2 2 2","expected":"max=2 idx=0\n"}]$$::jsonb,
  $$["이 코드에서 가장 어려웠던 부분은?","AI의 어떤 힌트가 결정적이었나?","가능했던 두 가지 해결안은 무엇이었고, 왜 이 방식을 선택했는가?","왜 그렇게 생각했는가?","다음에 비슷한 문제를 만나면 어떻게 접근하겠나?"]$$::jsonb,
  'cohort-2026-spring-cs1',
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
  $$["이 코드에서 가장 어려웠던 부분은?","AI의 어떤 힌트가 결정적이었나?","가능했던 두 가지 해결안은 무엇이었고, 왜 이 방식을 선택했는가?","왜 그렇게 생각했는가?","다음에 비슷한 문제를 만나면 어떻게 접근하겠나?"]$$::jsonb,
  'cohort-2026-spring-cs1',
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
    // TODO: 포인터 산술로 역순 출력
    return 0;
}
$$,
  $$[{"input":"4\n1 2 3 4","expected":"4 3 2 1\n"},{"input":"1\n42","expected":"42\n"}]$$::jsonb,
  $$["이 코드에서 가장 어려웠던 부분은?","AI의 어떤 힌트가 결정적이었나?","가능했던 두 가지 해결안은 무엇이었고, 왜 이 방식을 선택했는가?","왜 그렇게 생각했는가?","다음에 비슷한 문제를 만나면 어떻게 접근하겠나?"]$$::jsonb,
  'cohort-2026-spring-cs1',
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
    // TODO: malloc + 입력 + 역순 출력 + free
    return 0;
}
$$,
  $$[{"input":"3\n1 2 3","expected":"3 2 1\n"},{"input":"5\n10 20 30 40 50","expected":"50 40 30 20 10\n"}]$$::jsonb,
  $$["이 코드에서 가장 어려웠던 부분은?","AI의 어떤 힌트가 결정적이었나?","가능했던 두 가지 해결안은 무엇이었고, 왜 이 방식을 선택했는가?","왜 그렇게 생각했는가?","다음에 비슷한 문제를 만나면 어떻게 접근하겠나?"]$$::jsonb,
  'cohort-2026-spring-cs1',
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
  $$["functions-params","control-flow-loop","variables-types"]$$::jsonb,
  3,
  $${"correctness":0.5,"style":0.15,"memory_safety":0.2,"reflection":0.15}$$::jsonb,
  $${"timeLimitMs":2000,"memLimitMb":64,"allowedHeaders":["stdio.h","stdlib.h","string.h"]}$$::jsonb,
  $$#include <stdio.h>

long factorial_iter(int n) {
    // TODO: 반복문으로 구현 (재귀 금지)
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
  $$["이 코드에서 가장 어려웠던 부분은?","AI의 어떤 힌트가 결정적이었나?","가능했던 두 가지 해결안은 무엇이었고, 왜 이 방식을 선택했는가?","왜 그렇게 생각했는가?","다음에 비슷한 문제를 만나면 어떻게 접근하겠나?"]$$::jsonb,
  'cohort-2026-spring-cs1',
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
    // TODO: 재귀로 구현 — 기저 조건 필수
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
  $$["이 코드에서 가장 어려웠던 부분은?","AI의 어떤 힌트가 결정적이었나?","가능했던 두 가지 해결안은 무엇이었고, 왜 이 방식을 선택했는가?","왜 그렇게 생각했는가?","다음에 비슷한 문제를 만나면 어떻게 접근하겠나?"]$$::jsonb,
  'cohort-2026-spring-cs1',
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
    // TODO: "n x i = <값>" 포맷으로 i=1..9 출력
    return 0;
}
$$,
  $$[{"input":"2","expected":"2 x 1 =  2\n2 x 2 =  4\n2 x 3 =  6\n2 x 4 =  8\n2 x 5 = 10\n2 x 6 = 12\n2 x 7 = 14\n2 x 8 = 16\n2 x 9 = 18\n"}]$$::jsonb,
  $$["이 코드에서 가장 어려웠던 부분은?","AI의 어떤 힌트가 결정적이었나?","가능했던 두 가지 해결안은 무엇이었고, 왜 이 방식을 선택했는가?","왜 그렇게 생각했는가?","다음에 비슷한 문제를 만나면 어떻게 접근하겠나?"]$$::jsonb,
  'cohort-2026-spring-cs1',
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
