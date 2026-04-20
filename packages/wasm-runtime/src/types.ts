/**
 * 공통 입출력 타입 — Judge0, clang.wasm, twr-wasm 등 모든 백엔드가 공유.
 */

export interface RunCInput {
  code: string;
  stdin?: string;
  timeoutMs?: number; // 기본 2000
  memLimitMb?: number; // 기본 64
}

export type ErrorType = "compile" | "runtime" | "timeout" | "memory" | "environment";

export interface RunCResult {
  executed: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  errorType?: ErrorType;
}

export interface Backend {
  id: "judge0" | "clang-wasm" | "twr-wasm";
  runC(input: RunCInput): Promise<RunCResult>;
}
