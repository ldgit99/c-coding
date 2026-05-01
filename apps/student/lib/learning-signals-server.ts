/**
 * 서버 전용 — Supabase + xAPI 에서 실 Learning Signals 계산.
 *
 * 클라이언트가 보낸 값 대신 여기서 계산한 값을 SessionState 에 덮어씌운다.
 */

import {
  computeLearningSignals,
  extractErrorKeywords,
  type SessionState,
  type SignalSources,
} from "@cvibe/agents";

type LearningSignals = NonNullable<SessionState["learningSignals"]>;
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ConversationTurn } from "@cvibe/xapi";
import { getConversation, listRecentEvents } from "@cvibe/xapi";

interface ComputeInput {
  supabase: SupabaseClient | null;
  studentId: string;
  assignmentCode?: string;
  editorCodeLength: number;
}

export async function computeServerSideSignals(input: ComputeInput): Promise<{
  signals: LearningSignals;
  priorTurns: Array<{ role: "student" | "ai"; text: string }>;
  recentError: string | undefined;
  learnerProfile: {
    misconceptions: Array<{ kc: string; pattern: string }>;
    strongKCs: string[];
    recurringErrorTypes: string[];
  };
  hintTurnsSinceLastExplanation: number;
}> {
  // Prior turns (최근 8 턴)
  const priorTurns = await fetchPriorTurns(input);
  const studentTexts = priorTurns.filter((t) => t.role === "student").map((t) => t.text);

  // Submission count
  let submissionCount = 0;
  let recentFailureStreak = 0;
  if (input.supabase && input.assignmentCode) {
    try {
      const { data } = await input.supabase
        .from("submissions")
        .select("status, submitted_at, assignments!inner(code)")
        .eq("student_id", input.studentId)
        .eq("assignments.code", input.assignmentCode)
        .order("submitted_at", { ascending: false })
        .limit(10);
      submissionCount = data?.length ?? 0;
      for (const row of data ?? []) {
        if (row.status === "passed") break;
        recentFailureStreak += 1;
      }
    } catch {
      // ignore
    }
  }

  // xAPI event 기반 hint count + stagnation
  const events = listRecentEvents(200);
  let hintCount = 0;
  let lastRunTs: number | null = null;
  let lastError: string | undefined;
  for (const e of events) {
    const actorRaw = e.actor as unknown;
    const actorId =
      actorRaw && typeof actorRaw === "object" && "id" in actorRaw
        ? String((actorRaw as { id?: unknown }).id ?? "")
        : "";
    if (actorId && actorId !== input.studentId) continue;
    const verb = String(e.verb ?? "");
    if (verb === "requestedHint") hintCount += 1;
    if (verb === "runExecuted" || verb === "codeExecuted") {
      const ts = e.timestamp ? new Date(e.timestamp).getTime() : NaN;
      if (Number.isFinite(ts)) lastRunTs = ts;
      const result = (e.result ?? {}) as Record<string, unknown>;
      const stderr = typeof result.stderr === "string" ? result.stderr : undefined;
      const compileError =
        typeof result.compileError === "string" ? result.compileError : undefined;
      if (stderr && stderr.trim().length > 0) lastError = stderr.slice(0, 600);
      else if (compileError) lastError = compileError.slice(0, 600);
    }
  }

  const secondsSinceLastRun =
    lastRunTs != null ? Math.max(0, Math.round((Date.now() - lastRunTs) / 1000)) : null;

  const recentErrorKeywords: string[] = [];
  for (const text of studentTexts.slice(-6)) {
    recentErrorKeywords.push(...extractErrorKeywords(text));
  }

  const src: SignalSources = {
    submissionCount,
    recentFailureStreak,
    secondsSinceLastRun,
    hintRequestsThisAssignment: hintCount,
    recentErrorKeywords,
    editorCodeLength: input.editorCodeLength,
  };

  // Student Modeler — 교사 전용 오개념/강한 KC 조회 (Supabase 연결 시만).
  const learnerProfile = await fetchLearnerProfile(input);

  // 누적 힌트 중 마지막 자기설명 이후 몇 턴인지 계산 (중간 자기설명 트리거용).
  const hintTurnsSinceLastExplanation = countHintTurnsSinceExplanation(priorTurns);

  return {
    signals: computeLearningSignals(src),
    priorTurns,
    recentError: lastError,
    learnerProfile,
    hintTurnsSinceLastExplanation,
  };
}

async function fetchLearnerProfile(input: ComputeInput): Promise<{
  misconceptions: Array<{ kc: string; pattern: string }>;
  strongKCs: string[];
  recurringErrorTypes: string[];
}> {
  if (!input.supabase) {
    return { misconceptions: [], strongKCs: [], recurringErrorTypes: [] };
  }
  try {
    const [miscRes, masteryRes] = await Promise.all([
      input.supabase
        .from("misconceptions")
        .select("kc, pattern, occurrences")
        .eq("student_id", input.studentId)
        .order("occurrences", { ascending: false })
        .limit(5),
      input.supabase
        .from("mastery")
        .select("kc, value")
        .eq("student_id", input.studentId)
        .gte("value", 0.75),
    ]);
    const misconceptions = (miscRes.data ?? []).map((r) => ({
      kc: r.kc as string,
      pattern: r.pattern as string,
    }));
    const strongKCs = (masteryRes.data ?? []).map((r) => r.kc as string);
    return { misconceptions, strongKCs, recurringErrorTypes: [] };
  } catch {
    return { misconceptions: [], strongKCs: [], recurringErrorTypes: [] };
  }
}

/**
 * priorTurns 에서 마지막 "자기설명" 신호 이후로 등장한 AI 힌트 턴 수.
 * 자기설명 신호: student 턴의 text 에 "이해" / "정리" / "내 생각" 류 포함.
 */
function countHintTurnsSinceExplanation(
  turns: Array<{ role: "student" | "ai"; text: string }>,
): number {
  let count = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i]!;
    if (t.role === "student" && /(이해|정리|내\s*생각|요약|납득)/.test(t.text)) break;
    if (t.role === "ai") count += 1;
  }
  return count;
}

async function fetchPriorTurns(input: ComputeInput) {
  // Supabase 경로 우선 — 해당 assignment 의 최근 대화 16턴 (8 학생 + 8 AI).
  if (input.supabase && input.assignmentCode) {
    try {
      // assignment_id 컬럼을 uuid 로 통일 — code 를 id 로 변환해 매칭.
      const { data: asg } = await input.supabase
        .from("assignments")
        .select("id")
        .eq("code", input.assignmentCode)
        .maybeSingle();
      const assignmentUuid = (asg?.id as string | undefined) ?? input.assignmentCode;
      const { data } = await input.supabase
        .from("conversations")
        .select("role, text, created_at")
        .eq("student_id", input.studentId)
        .eq("assignment_id", assignmentUuid)
        .order("created_at", { ascending: false })
        .limit(16);
      if (data && data.length > 0) {
        return data
          .reverse()
          .map((row) => ({
            role: ((row.role as string) === "student" ? "student" : "ai") as "student" | "ai",
            text: row.text as string,
          }));
      }
    } catch {
      // fall through to in-memory
    }
  }

  // in-memory fallback
  const memoryTurns: ConversationTurn[] = getConversation({
    studentId: input.studentId,
    assignmentId: input.assignmentCode,
    limit: 16,
  });
  return memoryTurns.map((t) => ({
    role: (t.role === "student" ? "student" : "ai") as "student" | "ai",
    text: t.text,
  }));
}
