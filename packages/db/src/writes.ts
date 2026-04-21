/**
 * Supabase 쓰기 경로 — service_role key를 사용하는 서버 전용 함수.
 *
 * 각 함수는 클라이언트가 null이면 조용히 no-op → 학생 앱이 Supabase env 없이도
 * 배포 가능. env 설정 시 자동 활성화.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface InsertConversationTurnInput {
  studentId: string;
  assignmentId?: string;
  role: "student" | "ai";
  text: string;
  meta?: Record<string, unknown>;
}

export async function insertConversationTurn(
  client: SupabaseClient | null,
  input: InsertConversationTurnInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!client) return { ok: false, error: "no-client" };
  // studentId 가 uuid가 아니면 demo 세션 — 쓰지 않는다
  if (!isUuid(input.studentId)) return { ok: false, error: "non-uuid-studentId" };
  try {
    const { error } = await client.from("conversations").insert({
      student_id: input.studentId,
      assignment_id: input.assignmentId ?? null,
      role: input.role,
      text: input.text.slice(0, 4000),
      meta: input.meta ?? {},
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export interface InsertSubmissionInput {
  studentId: string;
  /** 카탈로그 code (예: "A01_hello_variables") → assignments 테이블 id로 변환 */
  assignmentCode: string;
  code: string;
  reflection: Record<string, string>;
  status: "passed" | "failed";
  rubricScores: Record<string, unknown>;
  finalScore: number;
  kcDelta: Record<string, number>;
  dependencyFactor?: number;
  teacherOnlyNotes?: string;
}

export async function insertSubmission(
  client: SupabaseClient | null,
  input: InsertSubmissionInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!client) return { ok: false, error: "no-client" };
  if (!isUuid(input.studentId)) return { ok: false, error: "non-uuid-studentId" };
  try {
    // assignments 테이블에서 code → id 조회
    const { data: asg, error: asgErr } = await client
      .from("assignments")
      .select("id")
      .eq("code", input.assignmentCode)
      .maybeSingle();
    if (asgErr) return { ok: false, error: asgErr.message };
    if (!asg) return { ok: false, error: `assignment not found: ${input.assignmentCode}` };

    const { data, error } = await client
      .from("submissions")
      .insert({
        student_id: input.studentId,
        assignment_id: asg.id as string,
        code: input.code,
        reflection: input.reflection,
        status: input.status,
        rubric_scores: input.rubricScores,
        final_score: input.finalScore,
        kc_delta: input.kcDelta,
        dependency_factor: input.dependencyFactor ?? null,
        teacher_only_notes: input.teacherOnlyNotes ?? null,
        submitted_at: new Date().toISOString(),
        evaluated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id as string | undefined };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}
