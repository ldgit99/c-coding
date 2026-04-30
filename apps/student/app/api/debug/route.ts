import { NextResponse } from "next/server";

import { debugRun, type RunResultShape } from "@cvibe/agents";
import { resolveUserFromRequest } from "@cvibe/db";
import { buildStatement, recordEvent, Verbs } from "@cvibe/xapi";

/**
 * POST /api/debug — 이미 실행된 결과를 Runtime Debugger로 해석.
 * 학생 UI가 "실행" 후 에러가 있으면 이 엔드포인트를 호출해 가설을 받아간다.
 */

interface DebugRequestBody {
  code: string;
  runResult: RunResultShape;
  hiddenTestSummary?: {
    total: number;
    passed: number;
    failedIds?: number[];
    timedOutIds?: number[];
  };
  /** 옵션 — 어떤 과제 컨텍스트인지 events.assignment_id 매핑용. */
  assignmentCode?: string;
}

export async function POST(request: Request) {
  let body: DebugRequestBody;
  try {
    body = (await request.json()) as DebugRequestBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (typeof body.code !== "string" || !body.runResult) {
    return NextResponse.json({ error: "code와 runResult는 필수" }, { status: 400 });
  }

  const result = await debugRun({
    code: body.code,
    runResult: body.runResult,
    hiddenTestSummary: body.hiddenTestSummary,
  });

  // xAPI — Runtime Debugger 결과 영구 기록 (가설 + 컨텍스트).
  const sid = resolveUserFromRequest(request, { preferredRole: "student" }).id;
  recordEvent(
    buildStatement({
      actor: { type: "student", id: sid },
      verb: Verbs.runtimeDebugged,
      object: { type: "assignment", id: body.assignmentCode ?? "ungoverned" },
      result: {
        errorType: result.debug.errorType,
        studentFacingMessage: result.debug.studentFacingMessage.slice(0, 500),
        hypothesesCount: result.debug.hypotheses.length,
        hypotheses: result.debug.hypotheses.slice(0, 5).map((h) => ({
          cause: h.cause.slice(0, 300),
          evidence: h.evidence.slice(0, 200),
          kc: h.kc,
          investigationQuestion: h.investigationQuestion.slice(0, 200),
        })),
        runErrorType: body.runResult.errorType ?? null,
        runExitCode: body.runResult.exitCode ?? null,
        runDurationMs: body.runResult.durationMs ?? null,
        usedModel: result.usedModel,
        mocked: result.mocked,
      },
    }),
  );

  return NextResponse.json(result);
}
