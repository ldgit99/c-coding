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
