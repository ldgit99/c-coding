import type { Backend, RunCInput, RunCResult } from "./types";

/**
 * Judge0 API 백엔드 — research.md §7.1의 서버 폴백 경로.
 *
 * 핵심 제약:
 * - 서버 경로에서만 호출 (API key를 학생 브라우저에 노출 금지).
 * - Next.js API Route 또는 Edge Function이 이 모듈을 import해서 학생 요청을 프록시.
 *
 * Judge0의 C 언어 ID:
 * - 50: C (GCC 9.2.0)
 * - 75: C (Clang 7.0.1)
 * 기본값은 50 (GCC). clang 특화 진단이 필요하면 75로 오버라이드.
 */

const JUDGE0_C_LANG_ID = 50;

export interface Judge0Config {
  baseUrl: string;
  apiKey?: string;
  apiHost?: string; // RapidAPI 게이트웨이 사용 시
  languageId?: number;
}

interface Judge0SubmissionRequest {
  source_code: string;
  language_id: number;
  stdin?: string;
  cpu_time_limit?: number;
  wall_time_limit?: number;
  memory_limit?: number;
}

interface Judge0SubmissionResponse {
  token: string;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: { id: number; description: string };
  time: string | null;
  memory: number | null;
}

export class Judge0Backend implements Backend {
  readonly id = "judge0";
  constructor(private config: Judge0Config) {}

  async runC(input: RunCInput): Promise<RunCResult> {
    const startedAt = Date.now();
    const timeoutSec = (input.timeoutMs ?? 2000) / 1000;

    // Judge0는 UTF-8 밖의 문자(한국어 주석 등)를 거부 → base64 인코딩 필수.
    // source_code·stdin은 base64로 보내고, 응답의 stdout/stderr/compile_output은
    // base64 디코딩해서 반환.
    const body: Judge0SubmissionRequest = {
      source_code: toB64(input.code),
      language_id: this.config.languageId ?? JUDGE0_C_LANG_ID,
      stdin: input.stdin ? toB64(input.stdin) : undefined,
      cpu_time_limit: timeoutSec,
      wall_time_limit: timeoutSec * 2,
      memory_limit: (input.memLimitMb ?? 64) * 1024,
    };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.config.apiKey) {
      headers["X-RapidAPI-Key"] = this.config.apiKey;
    }
    // RapidAPI Gateway는 Host 헤더가 명시돼야 올바른 API로 라우팅한다.
    // config.apiHost가 명시 안 됐으면 baseUrl에서 hostname을 파싱해 자동 주입.
    // (예: https://judge0-ce.p.rapidapi.com → judge0-ce.p.rapidapi.com)
    const inferredHost =
      this.config.apiHost ??
      (() => {
        try {
          return new URL(this.config.baseUrl).hostname;
        } catch {
          return undefined;
        }
      })();
    if (inferredHost && inferredHost.endsWith(".rapidapi.com")) {
      headers["X-RapidAPI-Host"] = inferredHost;
    }

    // wait=true: 작업 완료까지 동기 응답 (짧은 실행 전용)
    // base64_encoded=true: 입출력 모두 base64로 교환
    const response = await fetch(`${this.config.baseUrl}/submissions?base64_encoded=true&wait=true`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return {
        executed: false,
        exitCode: null,
        stdout: "",
        stderr: `Judge0 HTTP ${response.status}: ${await response.text()}`,
        durationMs: Date.now() - startedAt,
        errorType: "environment",
      };
    }

    const data = (await response.json()) as Judge0SubmissionResponse;
    const durationMs = Date.now() - startedAt;

    // Judge0 status 매핑: https://ce.judge0.com/statuses
    // 1=In Queue, 2=Processing, 3=Accepted, 4=WA, 5=TLE, 6=CE, 7..=Runtime Error, 13=Internal
    const errorType = mapJudge0Status(data.status.id);
    const stdout = data.stdout ? fromB64(data.stdout) : "";
    const stderr = data.stderr ? fromB64(data.stderr) : "";
    const compileOutput = data.compile_output ? fromB64(data.compile_output) : "";

    return {
      executed: data.status.id !== 13,
      exitCode: data.status.id === 3 ? 0 : data.status.id === 7 ? 139 : null,
      stdout,
      stderr: stderr + (compileOutput ? `\n${compileOutput}` : ""),
      durationMs,
      errorType,
    };
  }
}

function toB64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

function fromB64(b64: string): string {
  return Buffer.from(b64, "base64").toString("utf8");
}

function mapJudge0Status(id: number): RunCResult["errorType"] | undefined {
  if (id === 3) return undefined; // Accepted
  if (id === 5) return "timeout";
  if (id === 6) return "compile";
  if (id >= 7 && id <= 12) return "runtime";
  if (id === 13) return "environment";
  return undefined;
}
