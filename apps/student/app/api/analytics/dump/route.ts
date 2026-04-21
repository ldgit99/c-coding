import { NextResponse } from "next/server";

import { DEMO_STUDENTS } from "@cvibe/db";
import {
  getConversation,
  hashLearnerId,
  listRecentEvents,
  type ConversationTurn,
  type XApiStatementT,
} from "@cvibe/xapi";

/**
 * GET /api/analytics/dump
 *
 * 연구 전용 export. 교사 앱의 /api/research/* 가 프록시한다. 학생 브라우저는
 * 직접 호출할 수 없게 CORS 화이트리스트로 TEACHER_ORIGIN만 허용.
 *
 * 응답:
 *  - events: 최근 xAPI 이벤트 (limit=500)
 *  - turns: 각 DEMO_STUDENT의 대화 로그
 *  - dependencyFactorHistory: DEMO_STUDENTS 의 이력 (파일럿 전엔 mock, 이후엔
 *    Supabase assessments 조인)
 *
 * Supabase 연결 후에는 events·conversations·assessments를 각각 실 테이블로 교체.
 */
export async function GET() {
  const events: XApiStatementT[] = listRecentEvents(500);

  // DEMO_STUDENTS 기준 대화 덤프 + hash id로도 조회 (xAPI actor name이 hash)
  const turns: ConversationTurn[] = [];
  for (const s of DEMO_STUDENTS) {
    const direct = getConversation({ studentId: s.id, limit: 200 });
    const hashed = getConversation({ studentId: hashLearnerId(s.id), limit: 200 });
    turns.push(...direct, ...hashed);
  }

  const dependencyFactorHistory = DEMO_STUDENTS.flatMap((s) =>
    s.dependencyFactorHistory.map((d, i) => ({
      studentId: s.id,
      studentIdHashed: hashLearnerId(s.id),
      dependencyFactor: d,
      // timestamp 가상: 가장 최근부터 역산 (i + 1) 일 전
      timestamp: new Date(Date.now() - (s.dependencyFactorHistory.length - i) * 86400000).toISOString(),
    })),
  );

  const transferByStudent = DEMO_STUDENTS.map((s) => ({
    studentId: s.id,
    studentIdHashed: hashLearnerId(s.id),
    // DEMO에는 self-explanation transfer 축이 없으므로 mastery 평균으로 대체
    transferAxisMean:
      Object.values(s.mastery).length > 0
        ? Object.values(s.mastery).reduce((a, b) => a + b, 0) /
          Object.values(s.mastery).length
        : 0,
  }));

  return NextResponse.json(
    {
      collectedAt: new Date().toISOString(),
      events,
      turns,
      dependencyFactorHistory,
      transferByStudent,
      students: DEMO_STUDENTS.map((s) => ({
        id: s.id,
        idHashed: hashLearnerId(s.id),
        displayName: s.displayName,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
