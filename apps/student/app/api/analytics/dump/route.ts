import { NextResponse } from "next/server";

import {
  DEMO_STUDENTS,
  createServiceRoleClientIfAvailable,
} from "@cvibe/db";
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
 * 데이터 소스:
 * - Supabase env 있으면 events + conversations 테이블 SELECT
 * - 없으면 in-memory store (xapi store + conversation-store)
 *
 * 응답: events, turns, dependencyFactorHistory, transferByStudent, students, source
 */
export async function GET() {
  const supabase = createServiceRoleClientIfAvailable();
  let events: XApiStatementT[] = [];
  let turns: ConversationTurn[] = [];
  let source: "supabase" | "memory" = "memory";

  if (supabase) {
    try {
      const [eventsRes, convRes] = await Promise.all([
        supabase
          .from("events")
          .select("actor, verb, object, result, context, timestamp")
          .order("timestamp", { ascending: false })
          .limit(500),
        supabase
          .from("conversations")
          .select("id, student_id, assignment_id, role, text, meta, created_at")
          .order("created_at", { ascending: false })
          .limit(2000),
      ]);
      if (!eventsRes.error && eventsRes.data) {
        events = eventsRes.data.map((row) => ({
          actor: row.actor as XApiStatementT["actor"],
          verb: row.verb as XApiStatementT["verb"],
          object: row.object as XApiStatementT["object"],
          result: row.result as XApiStatementT["result"],
          context: row.context as XApiStatementT["context"],
          timestamp: row.timestamp as string,
        }));
      }
      if (!convRes.error && convRes.data) {
        turns = convRes.data.map((row) => ({
          id: row.id as string,
          studentId: row.student_id as string,
          assignmentId: (row.assignment_id as string | null) ?? undefined,
          role: row.role as "student" | "ai",
          text: row.text as string,
          meta: row.meta as ConversationTurn["meta"],
          timestamp: row.created_at as string,
        }));
      }
      source = "supabase";
    } catch {
      // fall through to memory fallback below
    }
  }

  if (source === "memory") {
    events = listRecentEvents(500);
    for (const s of DEMO_STUDENTS) {
      const direct = getConversation({ studentId: s.id, limit: 200 });
      const hashed = getConversation({ studentId: hashLearnerId(s.id), limit: 200 });
      turns.push(...direct, ...hashed);
    }
  }

  const dependencyFactorHistory = DEMO_STUDENTS.flatMap((s) =>
    s.dependencyFactorHistory.map((d, i) => ({
      studentId: s.id,
      studentIdHashed: hashLearnerId(s.id),
      dependencyFactor: d,
      timestamp: new Date(
        Date.now() - (s.dependencyFactorHistory.length - i) * 86400000,
      ).toISOString(),
    })),
  );

  const transferByStudent = DEMO_STUDENTS.map((s) => ({
    studentId: s.id,
    studentIdHashed: hashLearnerId(s.id),
    transferAxisMean:
      Object.values(s.mastery).length > 0
        ? Object.values(s.mastery).reduce((a, b) => a + b, 0) /
          Object.values(s.mastery).length
        : 0,
  }));

  return NextResponse.json(
    {
      collectedAt: new Date().toISOString(),
      source,
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
