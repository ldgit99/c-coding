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
    // assignment_id 컬럼을 uuid 로 통일했으므로 code 가 들어오면 lookup 변환.
    // 옛 schema(text) 환경 호환을 위해 lookup 실패 시 raw 값을 그대로 전달
    // (Supabase 가 type mismatch 면 에러 — 마이그레이션 적용 후 lookup 성공).
    let assignmentId: string | null = null;
    if (input.assignmentId) {
      if (isUuid(input.assignmentId)) {
        assignmentId = input.assignmentId;
      } else {
        const { data: asg } = await client
          .from("assignments")
          .select("id")
          .eq("code", input.assignmentId)
          .maybeSingle();
        assignmentId = (asg?.id as string | undefined) ?? null;
      }
    }
    const { error } = await client.from("conversations").insert({
      student_id: input.studentId,
      assignment_id: assignmentId,
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

/**
 * 카운터를 함께 갱신하는 wrapper. fire-and-forget 호출자가 사용.
 * 호출자는 await 하지 않고 .catch 도 안 걸어도 됨 — 에러는 카운터에 기록된다.
 */
export function trackConversationTurnInsert(
  client: SupabaseClient | null,
  input: InsertConversationTurnInput,
  counters?: {
    onAttempt?: (table: string) => void;
    onFailure?: (table: string, error?: unknown) => void;
  },
): Promise<{ ok: boolean; error?: string }> {
  counters?.onAttempt?.("conversations");
  return insertConversationTurn(client, input).then((result) => {
    if (!result.ok) counters?.onFailure?.("conversations", result.error);
    return result;
  });
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
  /** hidden test 별 결과 (id, passed) — submissions.evidence 에 저장. */
  hiddenTestResults?: Array<{ id: number; passed: boolean }>;
  /** Code Reviewer findings 요약 — evidence 의 보조 정보. */
  reviewSummary?: {
    summary: string;
    findingsCount: number;
    topIssues?: string[];
  };
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

    // evidence — hidden test 결과 + review 요약. 교사 모달에서 "테스트별 결과"
    // 섹션을 만들 수 있게 구조적으로 저장.
    const evidence: Record<string, unknown> = {};
    if (input.hiddenTestResults && input.hiddenTestResults.length > 0) {
      evidence.hiddenTests = input.hiddenTestResults;
      evidence.hiddenPassed = input.hiddenTestResults.filter((r) => r.passed).length;
      evidence.hiddenTotal = input.hiddenTestResults.length;
    }
    if (input.reviewSummary) {
      evidence.codeReview = input.reviewSummary;
    }

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
        evidence: Object.keys(evidence).length > 0 ? evidence : null,
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

// =============================================================================
// xAPI events 영구 저장
// =============================================================================

export interface InsertEventInput {
  /** xAPI statement (actor·verb·object·result·context·timestamp). */
  statement: {
    actor: { account: { name: string } } & Record<string, unknown>;
    verb: { id: string } & Record<string, unknown>;
    object: { id: string } & Record<string, unknown>;
    result?: Record<string, unknown>;
    context?: Record<string, unknown>;
    timestamp: string;
  };
  /** profiles.id (uuid). 미제공 시 actor.account.name 으로 lookup 시도하지 않음 — null 저장. */
  studentId?: string;
  /** assignments.id (uuid). assignment code 가 statement 에 들어 있으면 라우트가 변환해서 넘김. */
  assignmentId?: string;
}

export async function insertEvent(
  client: SupabaseClient | null,
  input: InsertEventInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!client) return { ok: false, error: "no-client" };
  try {
    const { error } = await client.from("events").insert({
      actor: input.statement.actor,
      verb: input.statement.verb,
      object: input.statement.object,
      result: input.statement.result ?? null,
      context: input.statement.context ?? null,
      student_id: input.studentId && isUuid(input.studentId) ? input.studentId : null,
      assignment_id: input.assignmentId && isUuid(input.assignmentId) ? input.assignmentId : null,
      timestamp: input.statement.timestamp,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// =============================================================================
// drafts — 에디터 자동 저장 (제출 전 코드 보존)
// =============================================================================

export interface UpsertDraftInput {
  studentId: string;
  /** assignments.code (예: "A01_array_2d_sum"). 라우트가 id 로 변환. */
  assignmentCode: string;
  code: string;
}

export async function upsertDraft(
  client: SupabaseClient | null,
  input: UpsertDraftInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!client) return { ok: false, error: "no-client" };
  if (!isUuid(input.studentId)) return { ok: false, error: "non-uuid-studentId" };
  try {
    const { data: asg, error: asgErr } = await client
      .from("assignments")
      .select("id")
      .eq("code", input.assignmentCode)
      .maybeSingle();
    if (asgErr) return { ok: false, error: asgErr.message };
    if (!asg) return { ok: false, error: `assignment not found: ${input.assignmentCode}` };

    const { error } = await client.from("drafts").upsert(
      {
        student_id: input.studentId,
        assignment_id: asg.id as string,
        code: input.code,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,assignment_id" },
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export interface FetchDraftInput {
  studentId: string;
  assignmentCode: string;
}

export async function fetchDraft(
  client: SupabaseClient | null,
  input: FetchDraftInput,
): Promise<{ code: string | null; updatedAt: string | null; error?: string }> {
  if (!client) return { code: null, updatedAt: null, error: "no-client" };
  if (!isUuid(input.studentId)) return { code: null, updatedAt: null, error: "non-uuid-studentId" };
  try {
    const { data: asg } = await client
      .from("assignments")
      .select("id")
      .eq("code", input.assignmentCode)
      .maybeSingle();
    if (!asg) return { code: null, updatedAt: null };

    const { data, error } = await client
      .from("drafts")
      .select("code, updated_at")
      .eq("student_id", input.studentId)
      .eq("assignment_id", asg.id as string)
      .maybeSingle();
    if (error) return { code: null, updatedAt: null, error: error.message };
    return {
      code: (data?.code as string | undefined) ?? null,
      updatedAt: (data?.updated_at as string | undefined) ?? null,
    };
  } catch (err) {
    return { code: null, updatedAt: null, error: String(err) };
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}
