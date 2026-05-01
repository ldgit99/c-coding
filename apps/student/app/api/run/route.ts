import { NextResponse } from "next/server";

import { resolveUserFromRequest } from "@cvibe/db";
import { Judge0Backend, type RunCInput, type RunCResult } from "@cvibe/wasm-runtime";
import { buildStatement, recordEvent, Verbs } from "@cvibe/xapi";

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

  // xAPI — 모든 실행 (정상·실패) 을 events 에 풀 본문 기록.
  // "하나도 놓치지 않는다" 운영 원칙 — stdout·stderr·exit 도 분석 데이터.
  const sid = resolveUserFromRequest(request, { preferredRole: "student" }).id;
  // assignmentCode 는 RunCInput 에 없으나, body 에 같이 들어올 수 있어 unknown 캐스트.
  const assignmentCode =
    typeof (input as unknown as { assignmentCode?: string }).assignmentCode === "string"
      ? (input as unknown as { assignmentCode: string }).assignmentCode
      : undefined;
  const runCtx = { studentId: sid, assignmentCode };
  const baseResult = {
    executed: result.executed,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    // 본문은 너무 길면 events 가 비대해지므로 4KB 컷.
    stdout: (result.stdout ?? "").slice(0, 4000),
    stderr: (result.stderr ?? "").slice(0, 4000),
    stdin: (input.stdin ?? "").slice(0, 1000),
    codeLength: input.code.length,
  };
  if (result.errorType === "compile") {
    recordEvent(
      buildStatement({
        actor: { type: "student", id: sid },
        verb: Verbs.compileError,
        object: { type: "code", submissionId: "adhoc" },
        result: { ...baseResult, errorType: "compile" },
      }),
      runCtx,
    );
  } else if (result.errorType === "runtime" || result.errorType === "timeout") {
    recordEvent(
      buildStatement({
        actor: { type: "student", id: sid },
        verb: Verbs.runtimeError,
        object: { type: "code", submissionId: "adhoc" },
        result: { ...baseResult, errorType: result.errorType },
      }),
      runCtx,
    );
  } else {
    // 정상 실행도 기록 — 실행 횟수·stdout 패턴·실행 시간 분석에 필수.
    recordEvent(
      buildStatement({
        actor: { type: "student", id: sid },
        verb: Verbs.runExecuted,
        object: { type: "code", submissionId: "adhoc" },
        result: baseResult,
      }),
      runCtx,
    );
  }

  return NextResponse.json(result);
}
