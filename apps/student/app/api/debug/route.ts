import { NextResponse } from "next/server";

import { debugRun, type RunResultShape } from "@cvibe/agents";

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

  return NextResponse.json(result);
}
