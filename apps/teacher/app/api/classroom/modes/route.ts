import { NextResponse } from "next/server";

import { computeModeDistribution, type ConversationTurn } from "@cvibe/xapi";

/**
 * GET /api/classroom/modes — 실시간 AI 모드 분포.
 *
 * 최근 대화 턴의 meta.mode 를 집계한다. 완전 실시간이라기보다 "최근 N 턴
 * 기준 분포" — Orchestration Cockpit 에서 '지금 전체 학생이 어떤 모드에서
 * 활동 중인가' 를 한눈에 보는 용도.
 */
const STUDENT_URL =
  process.env.STUDENT_APP_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_STUDENT_APP_URL ??
  "http://localhost:3000";

interface DumpTurns {
  turns: ConversationTurn[];
}

export async function GET() {
  try {
    const res = await fetch(`${STUDENT_URL}/api/analytics/dump`, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { distribution: { solo: 0, pair: 0, coach: 0, total: 0 }, error: `dump ${res.status}` },
        { status: 200 },
      );
    }
    const data = (await res.json()) as DumpTurns;
    // 최근 100턴만 분석 (실시간성 보장)
    const recent = (data.turns ?? []).slice(-100);
    const distribution = computeModeDistribution(recent);
    return NextResponse.json(
      { distribution, sampled: recent.length, generatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { distribution: { solo: 0, pair: 0, coach: 0, total: 0 }, error: String(err) },
      { status: 200 },
    );
  }
}
