import { describe, expect, it } from "vitest";

import type { Backend, RunCInput, RunCResult } from "./types";
import { runHiddenTests, type HiddenTest } from "./run-hidden-tests";

/** 테스트 더블 backend — 스텁 응답 주입 */
class StubBackend implements Backend {
  readonly id = "judge0";
  private q: RunCResult[];
  constructor(queue: RunCResult[]) {
    this.q = queue;
  }
  async runC(_input: RunCInput): Promise<RunCResult> {
    const next = this.q.shift();
    if (!next) throw new Error("stub queue exhausted");
    return next;
  }
}

const tests: HiddenTest[] = [
  { id: 1, input: "5\n1 2 3 4 5", expected: "15\n" },
  { id: 2, input: "3\n10 -5 7", expected: "12\n" },
  { id: 3, input: "1\n42", expected: "42\n" },
];

function okResult(stdout: string): RunCResult {
  return { executed: true, exitCode: 0, stdout, stderr: "", durationMs: 50 };
}

describe("runHiddenTests", () => {
  it("모든 테스트 통과 시 passedRatio=1", async () => {
    const backend = new StubBackend([okResult("15\n"), okResult("12\n"), okResult("42\n")]);
    const res = await runHiddenTests({ backend, code: "x", tests });
    expect(res.passed).toBe(3);
    expect(res.total).toBe(3);
    expect(res.passedRatio).toBe(1);
  });

  it("부분 통과 시 정확한 비율", async () => {
    const backend = new StubBackend([okResult("15\n"), okResult("wrong\n"), okResult("42\n")]);
    const res = await runHiddenTests({ backend, code: "x", tests });
    expect(res.passed).toBe(2);
    expect(res.passedRatio).toBeCloseTo(2 / 3, 5);
    const failed = res.results.find((r) => r.id === 2);
    expect(failed?.passed).toBe(false);
    expect(failed?.actual).toBe("wrong\n");
  });

  it("타임아웃 결과는 passed=false + errorType=timeout", async () => {
    const backend = new StubBackend([
      okResult("15\n"),
      { executed: false, exitCode: null, stdout: "", stderr: "", durationMs: 2000, errorType: "timeout" },
      okResult("42\n"),
    ]);
    const res = await runHiddenTests({ backend, code: "x", tests });
    expect(res.passed).toBe(2);
    const t = res.results.find((r) => r.id === 2);
    expect(t?.passed).toBe(false);
    expect(t?.errorType).toBe("timeout");
  });

  it("trailing newline 차이는 기본적으로 정규화", async () => {
    const backend = new StubBackend([okResult("15"), okResult("12\n\n"), okResult("42\n")]);
    const res = await runHiddenTests({ backend, code: "x", tests });
    expect(res.passed).toBe(3);
  });

  it("관대 모드: 공백·개행 차이가 있어도 토큰 순서가 맞으면 통과", async () => {
    const spacyTests: HiddenTest[] = [
      {
        id: 10,
        input: "",
        expected: "초기 상태 배열: [ 7 4 5  ] \n정렬된 배열: [ 4 5 7  ] \n",
      },
    ];
    const backend = new StubBackend([
      // 학생 출력: 공백 squash + Windows 개행 + trailing 불일치
      okResult("초기 상태 배열:   [ 7  4 5 ]\r\n정렬된 배열: [ 4 5 7 ]\r\n\r\n"),
    ]);
    const res = await runHiddenTests({ backend, code: "x", tests: spacyTests });
    expect(res.passed).toBe(1);
  });

  it("관대 모드: 토큰 순서가 다르면 불합격 (로직 오류 감지 유지)", async () => {
    const spacyTests: HiddenTest[] = [
      { id: 11, input: "", expected: "1 2 3\n" },
    ];
    // 학생이 잘못 정렬
    const backend = new StubBackend([okResult("2 1 3\n")]);
    const res = await runHiddenTests({ backend, code: "x", tests: spacyTests });
    expect(res.passed).toBe(0);
  });

  it("backend 예외는 environment 에러로 기록", async () => {
    class FailingBackend implements Backend {
      readonly id = "judge0";
      async runC(): Promise<RunCResult> {
        throw new Error("network down");
      }
    }
    const res = await runHiddenTests({ backend: new FailingBackend(), code: "x", tests: [tests[0]!] });
    expect(res.results[0]!.passed).toBe(false);
    expect(res.results[0]!.errorType).toBe("environment");
  });
});
