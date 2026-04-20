import type { Backend, RunCInput, RunCResult } from "./types";

/**
 * clang.wasm 백엔드 — research.md §7.3의 주 경로.
 *
 * Emscripten으로 clang·lld를 WASM으로 빌드 → Web Worker에서 격리 실행.
 * 번들 크기가 크므로 (50~100MB) 학생 앱은 첫 실행 시에만 fetch + 캐시.
 *
 * 실제 빌드 파이프라인은 packages/wasm-runtime/emscripten/ (Dockerfile).
 * 현재는 Worker 프로토콜과 인터페이스만 확정. 실제 WASM 번들은 Week 3 후반에 교체.
 */

export interface ClangWasmConfig {
  /** Web Worker 스크립트 경로 (보통 /workers/clang.worker.js). */
  workerUrl: string;
  /** clang.wasm 번들 URL. */
  wasmUrl: string;
}

interface WorkerRequest {
  id: string;
  kind: "compile-and-run";
  code: string;
  stdin: string;
  timeoutMs: number;
  memLimitMb: number;
}

interface WorkerResponse {
  id: string;
  result: RunCResult;
}

export class ClangWasmBackend implements Backend {
  readonly id = "clang-wasm";
  private worker?: Worker;
  private pending = new Map<string, (result: RunCResult) => void>();

  constructor(private config: ClangWasmConfig) {}

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    if (typeof Worker === "undefined") {
      throw new Error("clang-wasm 백엔드는 브라우저 Worker 환경이 필요하다.");
    }
    const worker = new Worker(this.config.workerUrl, { type: "module" });
    worker.addEventListener("message", (ev: MessageEvent<WorkerResponse>) => {
      const pending = this.pending.get(ev.data.id);
      if (pending) {
        pending(ev.data.result);
        this.pending.delete(ev.data.id);
      }
    });
    this.worker = worker;
    return worker;
  }

  async runC(input: RunCInput): Promise<RunCResult> {
    const worker = this.ensureWorker();
    const id = crypto.randomUUID();
    const req: WorkerRequest = {
      id,
      kind: "compile-and-run",
      code: input.code,
      stdin: input.stdin ?? "",
      timeoutMs: input.timeoutMs ?? 2000,
      memLimitMb: input.memLimitMb ?? 64,
    };

    return new Promise<RunCResult>((resolve, reject) => {
      this.pending.set(id, resolve);
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Worker가 응답하지 않는다 — 재시작 필요"));
      }, (input.timeoutMs ?? 2000) * 3);
      worker.postMessage(req);
      void timer; // keepalive
    });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.pending.clear();
  }
}
