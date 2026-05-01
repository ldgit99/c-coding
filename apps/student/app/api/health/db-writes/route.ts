import { NextResponse } from "next/server";

import { snapshotWriteCounters } from "@cvibe/xapi";

/**
 * GET /api/health/db-writes — 학생 앱 프로세스에서 누적된 DB write 시도/실패
 * 횟수 스냅샷.
 *
 * Vercel serverless 는 인스턴스가 분리되므로 *프로세스 단위* 카운터다. 즉
 * 여러 인스턴스의 합산이 아니라 "지금 응답한 인스턴스 한 개의 누적치". 추세
 * 추적은 교사 앱이 주기적으로 폴링해 합산한다.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const snap = snapshotWriteCounters();
  return NextResponse.json(
    {
      processStartedAt: snap.startedAt,
      generatedAt: new Date().toISOString(),
      tables: snap.tables,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
