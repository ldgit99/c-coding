import type { Backend, RunCInput, RunCResult } from "./types";

/**
 * Hidden tests 다중 실행 래퍼.
 *
 * Assessment가 `hiddenTestResults`를 입력으로 받지만, 이걸 실제로 생성하는
 * 경로가 이번 이터레이션 이전에는 비어 있었다. 여기서 각 hidden test를
 * **bounded concurrency** 로 실행하고, stdout을 expected와 비교해 passed 여부를
 * 판정한다.
 *
 * 2026-05-15: Vercel 함수 30s 타임아웃 회피를 위해 순차 → 동시성 3 으로 전환.
 * Judge0 rate limit 우려 시 input.concurrency=1 로 호출하면 옛 동작 복원.
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
  /**
   * 동시 실행 테스트 수. 기본 3 — Vercel 함수 30s 타임아웃 회피용. 학생 코드
   * 간 전역 상태 격리는 backend 가 책임(요청별 새 컨테이너). Judge0 rate limit
   * 이 빡빡한 환경이면 1 로 낮추면 옛 순차 동작.
   */
  concurrency?: number;
}

export interface RunHiddenTestsOutput {
  results: HiddenTestResult[];
  passed: number;
  total: number;
  passedRatio: number;
}

export async function runHiddenTests(input: RunHiddenTestsInput): Promise<RunHiddenTestsOutput> {
  const concurrency = Math.max(1, input.concurrency ?? 3);

  // 단일 테스트 실행 함수 — 기존 순차 로직을 그대로 함수화. 예외는
  // results 항목으로 변환되어 반환되므로 throw 가 외부로 새지 않는다.
  const runOne = async (test: HiddenTest): Promise<HiddenTestResult> => {
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
      return {
        id: test.id,
        passed: false,
        errorType: "environment",
        durationMs: Date.now() - startedAt,
        actual: `[exception] ${String(err)}`,
      };
    }

    if (!result.executed || result.errorType) {
      return {
        id: test.id,
        passed: false,
        actual: result.stdout,
        expected: test.expected,
        errorType: result.errorType,
        durationMs: result.durationMs,
      };
    }

    // 관대(lenient) 모드 비교 — 2026-04-22 전환.
    // 학생이 공백·개행 실수로 감점당하지 않도록, 로직 정확성만 평가한다.
    const actual = lenientNormalize(result.stdout, test.trimTrailingNewline);
    const expected = lenientNormalize(test.expected, test.trimTrailingNewline);
    return {
      id: test.id,
      passed: actual === expected,
      actual: result.stdout,
      expected: test.expected,
      durationMs: result.durationMs,
    };
  };

  // Bounded concurrency — 한 번에 최대 N 개 동시 실행. 한 배치가 끝나면
  // 다음 배치 시작. 5개 × 3초 직렬 = 15초 → 동시성 3 으로 ≈ 6초.
  const results: HiddenTestResult[] = new Array(input.tests.length);
  for (let i = 0; i < input.tests.length; i += concurrency) {
    const batch = input.tests.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(runOne));
    for (let j = 0; j < batchResults.length; j++) {
      results[i + j] = batchResults[j]!;
    }
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
