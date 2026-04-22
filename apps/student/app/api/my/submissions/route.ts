import { NextResponse } from "next/server";

import { createServiceRoleClientIfAvailable } from "@cvibe/db";

import { getRouteHandlerUser } from "@/lib/session";

/**
 * GET /api/my/submissions — 현재 로그인 학생 본인의 제출 이력.
 *
 * 진행 상황 표시, 내 학습 탭에서 사용. Supabase env 있으면 assignments JOIN 해서
 * code 를 반환. 없으면 빈 배열 (데모 모드엔 쌓을 데이터 없음).
 *
 * dependencyFactor · teacherOnlyNotes 는 여기서 반환하지 않는다 —
 * research.md §6.3 낙인 방지.
 */
export async function GET(request: Request) {
  const user = await getRouteHandlerUser(request, { preferredRole: "student" });
  const supabase = createServiceRoleClientIfAvailable();

  if (!supabase) {
    return NextResponse.json(
      { studentId: user.id, submissions: [], source: "memory" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { data, error } = await supabase
      .from("submissions")
      .select(
        "id, assignment_id, code, final_score, status, rubric_scores, submitted_at, evaluated_at, assignments!inner(code, title, kc_tags, difficulty)",
      )
      .eq("student_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        { studentId: user.id, submissions: [], source: "supabase", error: error.message },
        { status: 200 },
      );
    }

    const submissions = (data ?? []).map((row) => {
      const assignment = row.assignments as unknown as {
        code: string;
        title: string;
        kc_tags: string[] | null;
        difficulty: number;
      };
      return {
        id: row.id as string,
        assignmentCode: assignment?.code ?? null,
        assignmentTitle: assignment?.title ?? null,
        kcTags: assignment?.kc_tags ?? [],
        difficulty: assignment?.difficulty ?? null,
        finalScore: row.final_score != null ? Number(row.final_score) : null,
        passed: row.status === "passed",
        rubricScores: row.rubric_scores as Record<string, number | null> | null,
        submittedAt: (row.submitted_at as string) ?? (row.evaluated_at as string),
      };
    });

    return NextResponse.json(
      { studentId: user.id, submissions, source: "supabase" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { studentId: user.id, submissions: [], source: "supabase", error: String(err) },
      { status: 200 },
    );
  }
}
