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

  return {
    signals: computeLearningSignals(src),
    priorTurns,
    recentError: lastError,
  };
}

async function fetchPriorTurns(input: ComputeInput) {
  // Supabase 경로 우선 — 해당 assignment 의 최근 대화 16턴 (8 학생 + 8 AI).
  if (input.supabase && input.assignmentCode) {
    try {
      const { data } = await input.supabase
        .from("conversations")
        .select("role, text, created_at")
        .eq("student_id", input.studentId)
        .eq("assignment_id", input.assignmentCode)
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
