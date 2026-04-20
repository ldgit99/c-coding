import { NextResponse } from "next/server";

import { listRecentEvents, listStudentEvents } from "@cvibe/xapi";

/**
 * GET /api/events — Cross-origin 엔드포인트 (교사 앱이 폴링).
 *
 * 쿼리:
 * - learner=<hashedId> 지정 시 해당 학생의 최근 이벤트만.
 * - limit=<n> (기본 50).
 *
 * 로컬 개발에서는 next.config.ts의 CORS 헤더가 teacher 오리진을 허용.
 * 운영에서는 Supabase `events` 테이블을 쿼리하는 엔드포인트로 교체.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const learner = url.searchParams.get("learner");
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);

  const events = learner
    ? listStudentEvents(learner, limit)
    : listRecentEvents(limit);

  return NextResponse.json({ events, count: events.length }, {
    headers: { "Cache-Control": "no-store" },
  });
}
