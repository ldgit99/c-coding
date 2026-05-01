import { NextResponse } from "next/server";

import { createServiceRoleClientIfAvailable } from "@cvibe/db";
import { hashLearnerId, Verbs } from "@cvibe/xapi";

/**
 * GET /api/submission?studentId=X&assignmentCode=Y
 *
 * 특정 학생 × 과제의 전체 제출 이력 (코드 본문 포함, 시간 역순) +
 * 같은 학생 × 과제의 AI 분석 events (codeReviewed · runtimeDebugged).
 *
 * 교사 전용 — service_role 로 RLS 우회. 학생 앱에서는 호출 불가
 * (교사 미들웨어로 보호됨).
 */

interface SubmissionDetail {
  id: string;
  code: string;
  finalScore: number | null;
  status: string;
  rubricScores: Record<string, unknown> | null;
  evidence: Record<string, unknown> | null;
  submittedAt: string | null;
  evaluatedAt: string | null;
}

interface AiAnalysis {
  id: number;
  kind: "code-review" | "runtime-debug";
  timestamp: string;
  result: Record<string, unknown> | null;
}

interface ConversationTurn {
  id: string;
  role: "student" | "ai";
  text: string;
  createdAt: string;
  meta: Record<string, unknown> | null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get("studentId");
  const assignmentCode = url.searchParams.get("assignmentCode");

  if (!studentId || !assignmentCode) {
    return NextResponse.json(
      { error: "studentId 와 assignmentCode 쿼리 파라미터가 필요하다" },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClientIfAvailable();
  if (!supabase) {
    return NextResponse.json({
      source: "demo",
      submissions: [] as SubmissionDetail[],
      aiAnalyses: [] as AiAnalysis[],
      conversation: [] as ConversationTurn[],
      note: "Supabase 미설정 — 데모 모드에서는 코드 본문이 저장되지 않는다.",
    });
  }

  try {
    // assignments.code → assignments.id
    const { data: asg, error: asgErr } = await supabase
      .from("assignments")
      .select("id")
      .eq("code", assignmentCode)
      .maybeSingle();
    if (asgErr) {
      return NextResponse.json(
        { source: "supabase", submissions: [], aiAnalyses: [], error: asgErr.message },
        { status: 200 },
      );
    }
    if (!asg) {
      return NextResponse.json(
        { source: "supabase", submissions: [], aiAnalyses: [], error: `assignment not found: ${assignmentCode}` },
        { status: 200 },
      );
    }

    const { data: rows, error: rowsErr } = await supabase
      .from("submissions")
      .select(
        "id, code, final_score, status, rubric_scores, evidence, submitted_at, evaluated_at",
      )
      .eq("student_id", studentId)
      .eq("assignment_id", asg.id as string)
      .order("submitted_at", { ascending: false });

    if (rowsErr) {
      return NextResponse.json(
        { source: "supabase", submissions: [], aiAnalyses: [], error: rowsErr.message },
        { status: 200 },
      );
    }

    const submissions: SubmissionDetail[] = (rows ?? []).map((r) => ({
      id: r.id as string,
      code: (r.code as string) ?? "",
      finalScore: r.final_score != null ? Number(r.final_score) : null,
      status: (r.status as string) ?? "unknown",
      rubricScores: (r.rubric_scores as Record<string, unknown> | null) ?? null,
      evidence: (r.evidence as Record<string, unknown> | null) ?? null,
      submittedAt: (r.submitted_at as string | null) ?? null,
      evaluatedAt: (r.evaluated_at as string | null) ?? null,
    }));

    // AI 분석 events 조회 — 학생 actor (해시) + 과제 object id 매칭.
    // event-persistence.ts 가 student_id 를 null 로 저장하므로 actor.account.name
    // (hashLearnerId 결과) 기준으로 필터.
    const learnerName = hashLearnerId(studentId);
    const objectMatchSuffix = `/assignment/${assignmentCode}`;
    const { data: eventRows } = await supabase
      .from("events")
      .select("id, verb, object, result, timestamp")
      .filter("actor->account->>name", "eq", learnerName)
      .in("verb->>id", [Verbs.codeReviewed, Verbs.runtimeDebugged])
      .order("timestamp", { ascending: false })
      .limit(40);

    const aiAnalyses: AiAnalysis[] = (eventRows ?? [])
      .filter((r) => {
        const obj = r.object as { id?: string } | null;
        return typeof obj?.id === "string" && obj.id.endsWith(objectMatchSuffix);
      })
      .map((r) => {
        const verbId = ((r.verb as { id?: string } | null)?.id) ?? "";
        const kind: AiAnalysis["kind"] =
          verbId === Verbs.runtimeDebugged ? "runtime-debug" : "code-review";
        return {
          id: Number(r.id),
          kind,
          timestamp: (r.timestamp as string) ?? "",
          result: (r.result as Record<string, unknown> | null) ?? null,
        };
      });

    // 대화 턴 — assignment_id 가 uuid 로 통일된 후 asg.id 로 매칭.
    // 시간 오름차순으로 모달에서 자연 흐름대로. 최근 200턴.
    const { data: convRows } = await supabase
      .from("conversations")
      .select("id, role, text, meta, created_at")
      .eq("student_id", studentId)
      .eq("assignment_id", asg.id as string)
      .order("created_at", { ascending: true })
      .limit(200);

    const conversation: ConversationTurn[] = (convRows ?? []).map((r) => ({
      id: r.id as string,
      role: ((r.role as string) === "ai" ? "ai" : "student") as "student" | "ai",
      text: (r.text as string) ?? "",
      createdAt: (r.created_at as string) ?? "",
      meta: (r.meta as Record<string, unknown> | null) ?? null,
    }));

    return NextResponse.json({
      source: "supabase",
      submissions,
      aiAnalyses,
      conversation,
    });
  } catch (err) {
    return NextResponse.json(
      {
        source: "supabase",
        submissions: [],
        aiAnalyses: [],
        conversation: [],
        error: String(err),
      },
      { status: 200 },
    );
  }
}
