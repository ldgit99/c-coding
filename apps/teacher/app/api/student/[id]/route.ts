import { NextResponse } from "next/server";

import { DEMO_STUDENTS } from "@cvibe/db";
import {
  DEMO_COHORT_ID,
  createServiceRoleClientIfAvailable,
  fetchClassroomData,
} from "@cvibe/db";

/**
 * GET /api/student/[id] — 개별 학생 상세.
 *
 * Supabase env가 있으면 fetchClassroomData로 profile을 찾고, 없으면 DEMO_STUDENTS.
 * fetchClassroomData는 이미 mastery·misconceptions·recentSubmissions를 조인해서
 * 반환하므로 여기서는 id 필터만 수행.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = createServiceRoleClientIfAvailable();
  const { students, source } = await fetchClassroomData(supabase, DEMO_COHORT_ID);

  let student = students.find((s) => s.id === id);
  if (!student && source === "demo") {
    // demo fallback 시 다른 cohort도 검색
    student = DEMO_STUDENTS.find((s) => s.id === id);
  }
  if (!student) {
    return NextResponse.json({ error: "student not found", source }, { status: 404 });
  }
  return NextResponse.json({ student, source });
}
