import { NextResponse } from "next/server";

import {
  gradeSubmission,
  reviewCode,
  type DependencyLog,
  type HiddenTestResult,
  type ReflectionInput,
} from "@cvibe/agents";
import { getAssignmentByCode } from "@cvibe/db";
import { lintC } from "@cvibe/wasm-runtime";
import { buildStatement, recordEvent, Verbs } from "@cvibe/xapi";

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

  // 과제 카탈로그에서 kcTags·rubric 조회 (클라이언트 body에 id만 와도 됨)
  const catalog = body.assignment?.id ? getAssignmentByCode(body.assignment.id) : undefined;
  const effectiveAssignment = {
    id: body.assignment?.id ?? "ungoverned",
    rubric: body.assignment?.rubric ?? catalog?.rubric,
    kcTags: body.assignment?.kcTags ?? catalog?.kcTags,
  };

  const lintResult = await lintC(body.code);
  const { review } = await reviewCode({
    code: body.code,
    assignment: {
      id: effectiveAssignment.id,
      kcTags: effectiveAssignment.kcTags,
      rubric: effectiveAssignment.rubric,
    },
    studentLevel: "novice",
    lintResult,
  });

  const grade = await gradeSubmission({
    submission: {
      code: body.code,
      reflection: body.reflection,
      submittedAt: new Date().toISOString(),
    },
    assignment: effectiveAssignment,
    hiddenTestResults: body.hiddenTestResults,
    codeReviewerFindings: review.findings,
    styleWarnings: lintResult.warnings.filter((w) => w.severity === "warning").length,
    dependencyLog: body.dependencyLog,
  });

  // xAPI: submission 결과 + reflection 제출 이벤트
  const sid = "demo-student-001";
  recordEvent(
    buildStatement({
      actor: { type: "student", id: sid },
      verb: grade.assessment.passed ? Verbs.submissionPassed : Verbs.submissionFailed,
      object: { type: "assignment", id: effectiveAssignment.id },
      result: {
        finalScore: grade.assessment.finalScore,
        rubricScores: grade.assessment.rubricScores,
      },
    }),
  );
  recordEvent(
    buildStatement({
      actor: { type: "student", id: sid },
      verb: Verbs.reflectionSubmitted,
      object: { type: "assignment", id: effectiveAssignment.id },
      result: {
        completedPrompts: Object.values(body.reflection).filter((v) => (v ?? "").trim().length > 0)
          .length,
      },
    }),
  );

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
