import { NextResponse } from "next/server";

import { createServiceRoleClientIfAvailable } from "@cvibe/db";

/**
 * GET /api/submission?studentId=X&assignmentCode=Y
 *
 * 특정 학생 × 과제의 전체 제출 이력 (코드 본문 포함, 시간 역순).
 *
 * 교사 전용 — service_role 로 RLS 우회. 학생 앱에서는 호출 불가
 * (교사 미들웨어로 보호됨).
 */

interface SubmissionDetail {
  id: string;
  code: string;
  finalScore: number | null;
  status: string;
  rubricScores: Record<string, unknown> | null;
  submittedAt: string | null;
  evaluatedAt: string | null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get("studentId");
  const assignmentCode = url.searchParams.get("assignmentCode");

  if (!studentId || !assignmentCode) {
    return NextResponse.json(
      { error: "studentId 와 assignmentCode 쿼리 파라미터가 필요하다" },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClientIfAvailable();
  if (!supabase) {
    return NextResponse.json({
      source: "demo",
      submissions: [] as SubmissionDetail[],
      note: "Supabase 미설정 — 데모 모드에서는 코드 본문이 저장되지 않는다.",
    });
  }

  try {
    // assignments.code → assignments.id
    const { data: asg, error: asgErr } = await supabase
      .from("assignments")
      .select("id")
      .eq("code", assignmentCode)
      .maybeSingle();
    if (asgErr) {
      return NextResponse.json(
        { source: "supabase", submissions: [], error: asgErr.message },
        { status: 200 },
      );
    }
    if (!asg) {
      return NextResponse.json(
        { source: "supabase", submissions: [], error: `assignment not found: ${assignmentCode}` },
        { status: 200 },
      );
    }

    const { data: rows, error: rowsErr } = await supabase
      .from("submissions")
      .select("id, code, final_score, status, rubric_scores, submitted_at, evaluated_at")
      .eq("student_id", studentId)
      .eq("assignment_id", asg.id as string)
      .order("submitted_at", { ascending: false });

    if (rowsErr) {
      return NextResponse.json(
        { source: "supabase", submissions: [], error: rowsErr.message },
        { status: 200 },
      );
    }

    const submissions: SubmissionDetail[] = (rows ?? []).map((r) => ({
      id: r.id as string,
      code: (r.code as string) ?? "",
      finalScore: r.final_score != null ? Number(r.final_score) : null,
      status: (r.status as string) ?? "unknown",
      rubricScores: (r.rubric_scores as Record<string, unknown> | null) ?? null,
      submittedAt: (r.submitted_at as string | null) ?? null,
      evaluatedAt: (r.evaluated_at as string | null) ?? null,
    }));

    return NextResponse.json({
      source: "supabase",
      submissions,
    });
  } catch (err) {
    return NextResponse.json(
      { source: "supabase", submissions: [], error: String(err) },
      { status: 200 },
    );
  }
}
