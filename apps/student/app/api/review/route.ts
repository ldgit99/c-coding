import { NextResponse } from "next/server";

import { reviewCode } from "@cvibe/agents";
import { lintC } from "@cvibe/wasm-runtime";

/**
 * POST /api/review — 학생 코드를 Code Reviewer로 분석.
 * MVP: 현재 lintC는 스텁(빈 결과) — LLM 단독 분석으로 폴백된다.
 */

interface ReviewRequestBody {
  code: string;
  assignment?: {
    id: string;
    kcTags?: string[];
    rubric?: Record<string, number>;
  };
  studentLevel?: "novice" | "intermediate";
}

export async function POST(request: Request) {
  let body: ReviewRequestBody;
  try {
    body = (await request.json()) as ReviewRequestBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (typeof body.code !== "string" || body.code.trim().length === 0) {
    return NextResponse.json({ error: "code는 필수다" }, { status: 400 });
  }

  const lintResult = await lintC(body.code);

  const result = await reviewCode({
    code: body.code,
    assignment: body.assignment,
    studentLevel: body.studentLevel ?? "novice",
    lintResult,
  });

  return NextResponse.json(result);
}
