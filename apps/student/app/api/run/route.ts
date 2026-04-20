import { NextResponse } from "next/server";

import { Judge0Backend, type RunCInput, type RunCResult } from "@cvibe/wasm-runtime";

/**
 * POST /api/run — 학생 C 코드를 실행한다.
 *
 * 서버 경로에서만 Judge0 API key를 사용. 브라우저에는 키가 노출되지 않는다.
 * Week 3 후반에 Safety Guard 통합 (코드 주입·정답 유출 사전 검사).
 */
export async function POST(request: Request) {
  let input: RunCInput;
  try {
    input = (await request.json()) as RunCInput;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (typeof input.code !== "string" || input.code.length === 0) {
    return NextResponse.json({ error: "code는 필수 문자열이다" }, { status: 400 });
  }

  const judge0Url = process.env.JUDGE0_API_URL;
  if (!judge0Url) {
    const result: RunCResult = {
      executed: false,
      exitCode: null,
      stdout: "",
      stderr:
        "JUDGE0_API_URL이 설정되지 않았다 — .env.local을 확인하거나 Week 3 후반의 clang.wasm 번들을 기다려라.",
      durationMs: 0,
      errorType: "environment",
    };
    return NextResponse.json(result);
  }

  const backend = new Judge0Backend({
    baseUrl: judge0Url,
    apiKey: process.env.JUDGE0_API_KEY,
  });
  const result = await backend.runC(input);
  return NextResponse.json(result);
}
