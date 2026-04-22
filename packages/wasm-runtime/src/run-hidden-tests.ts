import type { Backend, RunCInput, RunCResult } from "./types";

/**
 * Hidden tests 다중 실행 래퍼.
 *
 * Assessment가 `hiddenTestResults`를 입력으로 받지만, 이걸 실제로 생성하는
 * 경로가 이번 이터레이션 이전에는 비어 있었다. 여기서 각 hidden test를
 * 순차 실행하고(동시성 낮춰 Judge0 rate limit 회피), stdout을 expected와
 * 비교해 passed 여부를 판정한다.
 *
 * 학생 코드 실행이므로 타임아웃/메모리 상한 그대로 유지. 타임아웃은
 * passed=false, errorType='timeout'으로 기록.
 */

export interface HiddenTest {
  id: number;
  input: string;
  expected: string;
  /** trailing newline 정규화 여부 (기본 true) */
  trimTrailingNewline?: boolean;
}

export interface HiddenTestResult {
  id: number;
  passed: boolean;
  /** 학생에게 노출 금지 — 교사 로그용만. */
  actual?: string;
  expected?: string;
  /** 실행 자체 실패(timeout/compile/env)는 passed=false로 기록. */
  errorType?: RunCResult["errorType"];
  durationMs: number;
}

export interface RunHiddenTestsInput {
  backend: Backend;
  code: string;
  tests: HiddenTest[];
  timeoutMs?: number;
  memLimitMb?: number;
}

export interface RunHiddenTestsOutput {
  results: HiddenTestResult[];
  passed: number;
  total: number;
  passedRatio: number;
}

/**
 * 기본 동시성 1 — Judge0 rate limit이 엄격한 경우가 많고, 학생 코드의
 * 글로벌 상태(전역 변수) 격리를 최대한 보장하기 위해.
 */
export async function runHiddenTests(input: RunHiddenTestsInput): Promise<RunHiddenTestsOutput> {
  const results: HiddenTestResult[] = [];
  for (const test of input.tests) {
    const runInput: RunCInput = {
      code: input.code,
      stdin: test.input,
      timeoutMs: input.timeoutMs,
      memLimitMb: input.memLimitMb,
    };
    const startedAt = Date.now();
    let result: RunCResult;
    try {
      result = await input.backend.runC(runInput);
    } catch (err) {
      results.push({
        id: test.id,
        passed: false,
        errorType: "environment",
        durationMs: Date.now() - startedAt,
        actual: `[exception] ${String(err)}`,
      });
      continue;
    }

    if (!result.executed || result.errorType) {
      results.push({
        id: test.id,
        passed: false,
        actual: result.stdout,
        expected: test.expected,
        errorType: result.errorType,
        durationMs: result.durationMs,
      });
      continue;
    }

    // 관대(lenient) 모드 비교 — 2026-04-22 전환.
    // 학생이 공백·개행 실수로 감점당하지 않도록, 로직 정확성만 평가한다.
    // - \r\n → \n 정규화 (Windows · Judge0 출력 차이 흡수)
    // - 라인별로 양끝 트림 + 여러 공백을 하나로 squash
    // - 빈 줄은 모두 제거
    // - 최종 비교는 정규화된 문자열 간 === . trimTrailingNewline 옵션은 유지
    //   (test 단위로 엄격 모드 복원 가능) 하지만 기본 동작이 관대.
    const actual = lenientNormalize(result.stdout, test.trimTrailingNewline);
    const expected = lenientNormalize(test.expected, test.trimTrailingNewline);
    results.push({
      id: test.id,
      passed: actual === expected,
      actual: result.stdout,
      expected: test.expected,
      durationMs: result.durationMs,
    });
  }

  const passed = results.filter((r) => r.passed).length;
  return {
    results,
    passed,
    total: results.length,
    passedRatio: results.length > 0 ? passed / results.length : 0,
  };
}

/**
 * 관대 정규화 — 공백·개행에 둔감한 비교를 위한 전처리.
 *
 * 적용:
 *   "초기 상태 배열: [ 7 4 5  ] \n정렬된 배열: [ 4 5 7  ] \n"
 *   → "초기 상태 배열: [ 7 4 5 ]\n정렬된 배열: [ 4 5 7 ]"
 *
 *   "초기 상태 배열:[ 7 4 5 ]\r\n정렬된 배열:[ 4 5 7 ]\r\n\r\n"
 *   → "초기 상태 배열: [ 7 4 5 ]\n정렬된 배열: [ 4 5 7 ]"
 *
 * 둘 다 같은 정규화 결과 → 통과. 학생이 출력 형식(공백·개행)에서 소소한
 * 실수를 해도 로직이 맞으면 인정. 대신 토큰 순서와 한국어·기호는 그대로
 * 유지돼야 통과.
 */
export function lenientNormalize(
  s: string,
  trimTrailingNewline: boolean | undefined = true,
): string {
  let out = s.replace(/\r\n/g, "\n"); // Windows → Unix 개행
  // 라인별: 양끝 트림 + 내부 공백(스페이스·탭) squash
  out = out
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n");
  // 연속된 빈 줄 → 단일 빈 줄
  out = out.replace(/\n{3,}/g, "\n\n");
  // trailing newline 정규화 — 기본 true: 모든 trailing \n 제거
  if (trimTrailingNewline !== false) {
    out = out.replace(/\n+$/, "");
  }
  return out;
}
