import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { debugRun } from "./runtime-debugger";

describe("debugRun — mock 경로", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  beforeAll(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterAll(() => {
    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("컴파일 에러 → variables-types KC 가설", async () => {
    const result = await debugRun({
      code: "int main() { return x; }",
      runResult: {
        executed: false,
        exitCode: null,
        stdout: "",
        stderr: "error: 'x' undeclared",
        durationMs: 100,
        errorType: "compile",
      },
    });
    expect(result.mocked).toBe(true);
    expect(result.debug.errorType).toBe("compile");
    expect(result.debug.hypotheses[0]!.kc).toBe("variables-types");
  });

  it("타임아웃 → control-flow-loop KC + 무한 루프/환경 가설 둘 다 고려", async () => {
    const result = await debugRun({
      code: "while(1);",
      runResult: {
        executed: false,
        exitCode: null,
        stdout: "",
        stderr: "",
        durationMs: 2000,
        errorType: "timeout",
      },
    });
    expect(result.debug.errorType).toBe("timeout");
    expect(result.debug.hypotheses[0]!.kc).toBe("control-flow-loop");
    expect(result.debug.hypotheses[0]!.cause).toMatch(/무한|환경|지연/);
  });

  it("정상 실행은 hypotheses 없이 격려 메시지", async () => {
    const result = await debugRun({
      code: "int main(){return 0;}",
      runResult: { executed: true, exitCode: 0, stdout: "", stderr: "", durationMs: 10 },
    });
    expect(result.debug.errorType).toBe("none");
    expect(result.debug.hypotheses).toHaveLength(0);
  });
});
