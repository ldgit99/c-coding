import { ClangWasmBackend, type ClangWasmConfig } from "./clang-wasm";
import { Judge0Backend, type Judge0Config } from "./judge0";
import { TwrWasmBackend, type TwrBackendConfig } from "./twr";
import type { Backend, RunCInput, RunCResult } from "./types";

export * from "./types";
export * from "./lint";
export * from "./run-hidden-tests";
export { ClangWasmBackend } from "./clang-wasm";
export { Judge0Backend } from "./judge0";
export { TwrWasmBackend } from "./twr";

/**
 * 백엔드 선택 규칙:
 *
 * 1. `clang-wasm` — 브라우저 환경 + 워커 가용 시 기본. 서버 비용 0, 학생 격리 실행.
 * 2. `judge0` — clang-wasm 번들 로딩 실패 또는 서버 사이드 실행 필요 시 폴백.
 * 3. `twr-wasm` — 사전 컴파일된 샘플 실행 전용 (학생 코드 실행 경로 아님).
 *
 * 현재는 아직 실제 clang.wasm 번들이 준비되지 않아, 기본값을 Judge0으로 둔다.
 * Week 3 후반에 clang.wasm 번들이 배포되면 env로 전환한다.
 */

export interface RunCOptions {
  preferredBackend?: "clang-wasm" | "judge0" | "twr-wasm";
  judge0?: Judge0Config;
  clangWasm?: ClangWasmConfig;
  twrWasm?: TwrBackendConfig;
}

export class RunCRouter {
  private backends: Backend[] = [];

  constructor(options: RunCOptions) {
    if (options.clangWasm) this.backends.push(new ClangWasmBackend(options.clangWasm));
    if (options.judge0) this.backends.push(new Judge0Backend(options.judge0));
    if (options.twrWasm) this.backends.push(new TwrWasmBackend(options.twrWasm));

    if (options.preferredBackend) {
      this.backends.sort((a, b) => {
        if (a.id === options.preferredBackend) return -1;
        if (b.id === options.preferredBackend) return 1;
        return 0;
      });
    }
  }

  async runC(input: RunCInput): Promise<RunCResult> {
    if (this.backends.length === 0) {
      return {
        executed: false,
        exitCode: null,
        stdout: "",
        stderr: "등록된 WASM 런타임 백엔드가 없다 — RunCOptions를 확인하라.",
        durationMs: 0,
        errorType: "environment",
      };
    }

    // 첫 백엔드 시도, 환경 오류면 다음으로 폴백
    for (const backend of this.backends) {
      const result = await backend.runC(input);
      if (result.errorType !== "environment") return result;
    }
    // 전부 환경 오류
    return {
      executed: false,
      exitCode: null,
      stdout: "",
      stderr: "모든 백엔드 실패: 실행 환경 문제. Teacher Copilot에 보고 중.",
      durationMs: 0,
      errorType: "environment",
    };
  }
}
