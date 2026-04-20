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

    const actual = test.trimTrailingNewline === false ? result.stdout : result.stdout.replace(/\n*$/, "\n");
    const expected = test.trimTrailingNewline === false ? test.expected : test.expected.replace(/\n*$/, "\n");
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
