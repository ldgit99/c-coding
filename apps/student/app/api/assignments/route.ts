import { NextResponse } from "next/server";

import { ASSIGNMENTS } from "@cvibe/db";

/**
 * GET /api/assignments — 현재 학생에게 노출 가능한 과제 목록.
 *
 * Week 8 MVP: 정적 카탈로그(ASSIGNMENTS)를 그대로 반환. hidden test는 절대 포함 안 함.
 * Week 10에 Supabase 쿼리 + cohort 필터 + Row-Level Security로 교체.
 */
export async function GET() {
  const publicView = ASSIGNMENTS.map((a) => ({
    code: a.code,
    title: a.title,
    template: a.template,
    kcTags: a.kcTags,
    difficulty: a.difficulty,
    rubric: a.rubric,
    constraints: a.constraints,
    starterCode: a.starterCode,
    visibleTests: a.visibleTests,
    reflectionPrompts: a.reflectionPrompts,
  }));
  return NextResponse.json({ assignments: publicView });
}
