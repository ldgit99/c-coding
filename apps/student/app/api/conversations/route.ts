import { NextResponse } from "next/server";

import { getConversation } from "@cvibe/xapi";

/**
 * GET /api/conversations?studentId=...&assignmentId=...&limit=...
 *
 * 교사 전용 열람 경로 — 교사 앱이 교차 오리진으로 프록시 호출한다.
 * 학생 본인이 URL을 직접 치면 자기 로그가 보이지만, 낙인 방지 원칙상 UI에는
 * 연결하지 않는다 (research.md §6.3). Supabase 연결 후에는 `conversations`
 * 테이블을 RLS(`role = teacher`)로 조회.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get("studentId");
  if (!studentId) {
    return NextResponse.json({ error: "studentId는 필수 쿼리다" }, { status: 400 });
  }
  const assignmentId = url.searchParams.get("assignmentId") ?? undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Math.min(parseInt(limitRaw, 10) || 0, 200) : 100;

  const turns = getConversation({ studentId, assignmentId, limit });
  return NextResponse.json(
    { studentId, assignmentId: assignmentId ?? null, count: turns.length, turns },
    { headers: { "Cache-Control": "no-store" } },
  );
}
