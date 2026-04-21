import { NextResponse } from "next/server";

import { createServiceRoleClientIfAvailable } from "@cvibe/db";
import { getConversation, type ConversationTurn } from "@cvibe/xapi";

/**
 * GET /api/conversations?studentId=...&assignmentId=...&limit=...
 *
 * 학생 본인 · 교사(프록시) 공용 열람 경로. Supabase env 있으면 conversations
 * 테이블에서 SELECT, 없으면 in-memory conversation-store fallback.
 *
 * 학생 측 AIPanel은 재로그인·탭 이동 후에도 이 엔드포인트로 과거 대화를 복원.
 * 교사 측은 /api/student/[id]/conversations 프록시로 사용 (RLS 적용 예정).
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

  let turns: ConversationTurn[] = [];
  let source: "supabase" | "memory" = "memory";

  const supabase = createServiceRoleClientIfAvailable();
  if (supabase) {
    try {
      let query = supabase
        .from("conversations")
        .select("id, student_id, assignment_id, role, text, meta, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: true })
        .limit(limit);
      if (assignmentId) query = query.eq("assignment_id", assignmentId);
      const { data, error } = await query;
      if (!error && data) {
        turns = data.map((row) => ({
          id: row.id as string,
          studentId: row.student_id as string,
          assignmentId: (row.assignment_id as string | null) ?? undefined,
          role: row.role as "student" | "ai",
          text: row.text as string,
          meta: row.meta as ConversationTurn["meta"],
          timestamp: row.created_at as string,
        }));
        source = "supabase";
      }
    } catch {
      // fall through to memory
    }
  }

  if (source === "memory") {
    turns = getConversation({ studentId, assignmentId, limit });
  }

  return NextResponse.json(
    { studentId, assignmentId: assignmentId ?? null, count: turns.length, turns, source },
    { headers: { "Cache-Control": "no-store" } },
  );
}
