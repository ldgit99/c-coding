import { NextResponse } from "next/server";

import {
  gradeSubmission,
  reviewCode,
  type DependencyLog,
  type HiddenTestResult,
  type ReflectionInput,
} from "@cvibe/agents";
import {
  createServiceRoleClientIfAvailable,
  getAssignmentByCode,
  insertSubmission,
} from "@cvibe/db";
import { Judge0Backend, lintC, runHiddenTests } from "@cvibe/wasm-runtime";
import { buildStatement, recordEvent, Verbs } from "@cvibe/xapi";

import { loadHiddenTests } from "@/lib/seed-private";
import { getRouteHandlerUser } from "@/lib/session";

/**
 * POST /api/submit — 학생 제출물을 채점 파이프라인으로 처리.
 *
 * 순서: hidden tests 실행 → Code Reviewer → gradeSubmission
 *
 * hidden tests 실행 전략:
 * - body.hiddenTestResults가 있으면 그대로 사용 (교사 도구·E2E 테스트용).
 * - 없으면 Judge0 env + seed-private의 `{code}_hidden.json` 있을 때 서버가
 *   runHiddenTests로 실제 실행.
 * - 둘 다 없으면 hiddenTestResults=undefined → Assessment의 correctness=null.
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

  // 1) Hidden tests 실행
  let hiddenTestResults = body.hiddenTestResults;
  let hiddenTestsSource: "client" | "judge0" | "none" = hiddenTestResults ? "client" : "none";
  if (!hiddenTestResults && body.assignment?.id && process.env.JUDGE0_API_URL) {
    const tests = await loadHiddenTests(body.assignment.id);
    if (tests && tests.length > 0) {
      const backend = new Judge0Backend({
        baseUrl: process.env.JUDGE0_API_URL,
        apiKey: process.env.JUDGE0_API_KEY,
      });
      const run = await runHiddenTests({ backend, code: body.code, tests });
      hiddenTestResults = run.results.map((r): HiddenTestResult => ({
        id: r.id,
        passed: r.passed,
      }));
      hiddenTestsSource = "judge0";
    }
  }

  // 2) 정적 분석 + LLM 리뷰
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

  // 3) 루브릭 채점
  const grade = await gradeSubmission({
    submission: {
      code: body.code,
      reflection: body.reflection,
      submittedAt: new Date().toISOString(),
    },
    assignment: effectiveAssignment,
    hiddenTestResults,
    codeReviewerFindings: review.findings,
    styleWarnings: lintResult.warnings.filter((w) => w.severity === "warning").length,
    dependencyLog: body.dependencyLog,
  });

  // xAPI: submission 결과 + reflection 제출 이벤트
  const sid = (await getRouteHandlerUser(request, { preferredRole: "student" })).id;
  recordEvent(
    buildStatement({
      actor: { type: "student", id: sid },
      verb: grade.assessment.passed ? Verbs.submissionPassed : Verbs.submissionFailed,
      object: { type: "assignment", id: effectiveAssignment.id },
      result: {
        finalScore: grade.assessment.finalScore,
        rubricScores: grade.assessment.rubricScores,
        hiddenTestsSource,
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

  // Supabase env 있으면 submission insert (service_role, RLS 우회). 실패 시 silent.
  const supabaseWriter = createServiceRoleClientIfAvailable();
  void insertSubmission(supabaseWriter, {
    studentId: sid,
    assignmentCode: effectiveAssignment.id,
    code: body.code,
    reflection: body.reflection as Record<string, string>,
    status: grade.assessment.passed ? "passed" : "failed",
    rubricScores: grade.assessment.rubricScores as unknown as Record<string, unknown>,
    finalScore: grade.assessment.finalScore,
    kcDelta: grade.assessment.kcDelta,
    dependencyFactor: grade.assessment.dependencyFactor ?? undefined,
    teacherOnlyNotes: grade.assessment.teacherOnlyNotes,
  });

  // teacherOnlyNotes와 dependencyFactor는 클라이언트 응답에서 제거 (학생 UI 노출 금지)
  const { teacherOnlyNotes: _omit1, dependencyFactor: _omit2, ...studentFacing } = grade.assessment;
  void _omit1;
  void _omit2;

  return NextResponse.json({
    ...grade,
    assessment: studentFacing,
    review,
    hiddenTestsSource,
  });
}
