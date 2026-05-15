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

import { loadHiddenTests, loadReferenceSolution } from "@/lib/seed-private";
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

  try {
    return await handleSubmit(request, body);
  } catch (err) {
    // 외곽 안전망 — reviewCode·evaluateReflection 은 자체 fallback 이 있고
    // insertSubmission 은 result-pattern 이라 사실상 여기까지 오는 건 매우 드물다.
    // 하지만 학생에게 빈 "제출 실패: " 가 절대 보이지 않도록 마지막 가드.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[submit] uncaught exception · ${message}`, err);
    return NextResponse.json(
      {
        error: "submission_failed",
        userMessage:
          "제출 처리 중 일시적인 문제가 발생했어요. 잠시 후 다시 시도해주세요. 계속되면 교사에게 알려주세요.",
        detail: message,
      },
      { status: 500 },
    );
  }
}

async function handleSubmit(request: Request, body: SubmitRequestBody) {
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
  const referenceSolution = body.assignment?.id
    ? (await loadReferenceSolution(body.assignment.id)) ?? undefined
    : undefined;
  const hiddenTestPassRatio =
    hiddenTestResults && hiddenTestResults.length > 0
      ? hiddenTestResults.filter((r) => r.passed).length / hiddenTestResults.length
      : undefined;
  const { review, usedModel: reviewModel, mocked: reviewMocked } = await reviewCode({
    code: body.code,
    assignment: {
      id: effectiveAssignment.id,
      kcTags: effectiveAssignment.kcTags,
      rubric: effectiveAssignment.rubric,
      template: catalog?.template,
      visibleTests: catalog?.visibleTests,
    },
    referenceSolution,
    hiddenTestPassRatio,
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
  const persistCtx = { studentId: sid, assignmentCode: effectiveAssignment.id };

  // xAPI — Code Reviewer 결과 (제출 시점) 영구 기록.
  recordEvent(
    buildStatement({
      actor: { type: "student", id: sid },
      verb: Verbs.codeReviewed,
      object: { type: "assignment", id: effectiveAssignment.id },
      result: {
        summary: review.summary.slice(0, 500),
        analysisMode: review.analysisMode,
        findingsCount: review.findings.length,
        findings: review.findings.slice(0, 10).map((f) => ({
          id: f.id,
          severity: f.severity,
          category: f.category,
          kc: f.kc,
          line: f.line,
          message: f.message.slice(0, 400),
        })),
        topIssues: review.topIssues,
        usedModel: reviewModel,
        mocked: reviewMocked,
        triggeredBy: "submit",
      },
    }),
    persistCtx,
  );
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
    persistCtx,
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
    persistCtx,
  );

  // Supabase env 있으면 submission insert (service_role, RLS 우회).
  // 결과를 await 하고 응답에 포함 → silent-fail 재발 시 즉시 확인 가능.
  const supabaseWriter = createServiceRoleClientIfAvailable();
  const dbWrite = await insertSubmission(supabaseWriter, {
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
    hiddenTestResults,
    reviewSummary: {
      summary: review.summary.slice(0, 400),
      findingsCount: review.findings.length,
      topIssues: review.topIssues,
    },
  });
  if (!dbWrite.ok && supabaseWriter) {
    // 서버 로그 — Vercel Logs 에서 검색 가능. 학생 화면에는 노출하지 않음.
    console.warn(
      `[submit] insertSubmission failed · studentId=${sid} · assignmentCode=${effectiveAssignment.id} · error=${dbWrite.error}`,
    );
  }

  // teacherOnlyNotes와 dependencyFactor는 클라이언트 응답에서 제거 (학생 UI 노출 금지)
  const { teacherOnlyNotes: _omit1, dependencyFactor: _omit2, ...studentFacing } = grade.assessment;
  void _omit1;
  void _omit2;

  return NextResponse.json({
    ...grade,
    assessment: studentFacing,
    review,
    hiddenTestsSource,
    // 교사·개발자용 — 학생 UI 는 무시. supabaseWriter 가 null(데모 모드)이면 dbWrite 생략.
    dbWrite: supabaseWriter
      ? { ok: dbWrite.ok, error: dbWrite.error }
      : undefined,
  });
}
