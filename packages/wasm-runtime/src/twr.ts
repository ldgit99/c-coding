import type { Backend, RunCInput, RunCResult } from "./types";

/**
 * twr-wasm 백엔드 — 브라우저에서 **사전 컴파일된** C/C++ WASM 모듈을 실행하는 경량 런타임.
 *
 * 제약:
 * - 학생이 작성한 C 코드를 실시간 컴파일하지 못한다 (그건 clang.wasm 몫).
 * - 과제별 "사전 컴파일 채점 하네스"를 미리 빌드해두고 학생 코드는 입력으로 주입하는 패턴에 적합.
 * - 또는 시연·튜토리얼용 샘플 프로그램을 브라우저에서 안전하게 실행할 때.
 *
 * 실제 학생 코드 실행 경로는 Judge0(서버) 또는 clang.wasm(브라우저) 백엔드를 사용.
 */

export interface TwrBackendConfig {
  /** 사전 빌드된 WASM 모듈 URL (public/ 하위 경로 또는 CDN). */
  wasmUrl: string;
}

export class TwrWasmBackend implements Backend {
  readonly id = "twr-wasm";

  constructor(private config: TwrBackendConfig) {}

  async runC(input: RunCInput): Promise<RunCResult> {
    if (typeof window === "undefined") {
      return {
        executed: false,
        exitCode: null,
        stdout: "",
        stderr: "twr-wasm 백엔드는 브라우저 전용이다 — 서버에서는 Judge0 백엔드를 사용하라.",
        durationMs: 0,
        errorType: "environment",
      };
    }

    const startedAt = Date.now();

    // Week 3 후반에 실제 twr-wasm 통합:
    //   import { twrWasmModule } from "twr-wasm";
    //   const mod = new twrWasmModule();
    //   await mod.loadWasm(this.config.wasmUrl);
    //   const stdout = await mod.callC(["main", input.stdin ?? ""]);
    // 현재는 인터페이스만 확정.

    return {
      executed: false,
      exitCode: null,
      stdout: "",
      stderr: `twr-wasm 통합 미완성 (Week 3 후반 예정). wasmUrl=${this.config.wasmUrl}`,
      durationMs: Date.now() - startedAt,
      errorType: "environment",
    };
  }
}
