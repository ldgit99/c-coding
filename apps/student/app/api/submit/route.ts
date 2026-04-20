import { NextResponse } from "next/server";

import {
  gradeSubmission,
  reviewCode,
  type DependencyLog,
  type HiddenTestResult,
  type ReflectionInput,
} from "@cvibe/agents";
import { lintC } from "@cvibe/wasm-runtime";

/**
 * POST /api/submit — 학생 제출물을 채점 파이프라인으로 처리.
 *
 * 순서: lintC → Code Reviewer findings → gradeSubmission
 *
 * Week 7 MVP 제약:
 * - hiddenTestResults는 클라이언트가 보내거나(교사 도구), 미제공 시 correctness null.
 * - Supabase 저장·Student Modeler 연쇄 호출은 Week 7 후반에 추가.
 */

interface SubmitRequestBody {
  code: string;
  reflection: ReflectionInput;
  assignment?: {
    id: string;
    rubric?: { correctness: number; style: number; memory_safety: number; reflection: number };
    kcTags?: string[];
  };
  hiddenTestResults?: HiddenTestResult[];
  dependencyLog?: DependencyLog;
}

export async function POST(request: Request) {
  let body: SubmitRequestBody;
  try {
    body = (await request.json()) as SubmitRequestBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (typeof body.code !== "string" || body.code.trim().length === 0) {
    return NextResponse.json({ error: "code는 필수다" }, { status: 400 });
  }
  if (!body.reflection || typeof body.reflection !== "object") {
    return NextResponse.json({ error: "reflection은 필수 객체다" }, { status: 400 });
  }

  const lintResult = await lintC(body.code);
  const { review } = await reviewCode({
    code: body.code,
    assignment: body.assignment,
    studentLevel: "novice",
    lintResult,
  });

  const grade = await gradeSubmission({
    submission: {
      code: body.code,
      reflection: body.reflection,
      submittedAt: new Date().toISOString(),
    },
    assignment: {
      id: body.assignment?.id ?? "ungoverned",
      rubric: body.assignment?.rubric,
      kcTags: body.assignment?.kcTags,
    },
    hiddenTestResults: body.hiddenTestResults,
    codeReviewerFindings: review.findings,
    styleWarnings: lintResult.warnings.filter((w) => w.severity === "warning").length,
    dependencyLog: body.dependencyLog,
  });

  // teacherOnlyNotes와 dependencyFactor는 클라이언트 응답에서 제거 (학생 UI 노출 금지)
  const { teacherOnlyNotes: _omit1, dependencyFactor: _omit2, ...studentFacing } = grade.assessment;
  void _omit1;
  void _omit2;

  return NextResponse.json({
    ...grade,
    assessment: studentFacing,
    review,
  });
}
