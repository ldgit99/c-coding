import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 교사 앱 (또는 cron) 이 학생 앱 /api/analytics/dump HTTP 프록시 없이 직접
 * Supabase 에서 events·conversations 를 가져오는 헬퍼.
 *
 * cross-deployment fetch 의존성을 제거하고, 학생 앱 cold start 가 교사
 * 대시보드를 막던 문제를 해결한다.
 */

export interface AnalyticsTurn {
  id: string;
  studentId: string;
  assignmentId?: string;
  role: "student" | "ai";
  text: string;
  meta: Record<string, unknown> | null;
  timestamp: string;
}

export interface AnalyticsEvent {
  actor: { account: { name: string } } & Record<string, unknown>;
  verb: { id: string } & Record<string, unknown>;
  object: { id: string } & Record<string, unknown>;
  result?: Record<string, unknown> | null;
  context?: Record<string, unknown> | null;
  studentId?: string;
  assignmentId?: string;
  timestamp: string;
}

export interface AnalyticsBundle {
  source: "supabase" | "empty";
  events: AnalyticsEvent[];
  turns: AnalyticsTurn[];
}

export interface FetchAnalyticsInput {
  client: SupabaseClient | null;
  /** 이 ISO 시각 이후만 포함 — undefined 면 전부. */
  since?: string;
  /** events 최대 N건 (시간 역순). */
  eventLimit?: number;
  /** turns 최대 N건 (시간 역순). */
  turnLimit?: number;
  /** 활성 학생 ID 만 포함 (제적·비활성 제외). */
  studentIds?: string[];
}

export async function fetchAnalyticsFromDb(
  input: FetchAnalyticsInput,
): Promise<AnalyticsBundle> {
  const client = input.client;
  if (!client) {
    return { source: "empty", events: [], turns: [] };
  }
  const eventLimit = input.eventLimit ?? 1000;
  const turnLimit = input.turnLimit ?? 2000;

  const eventsQuery = client
    .from("events")
    .select(
      "actor, verb, object, result, context, student_id, assignment_id, timestamp",
    )
    .order("timestamp", { ascending: false })
    .limit(eventLimit);
  if (input.since) eventsQuery.gte("timestamp", input.since);
  if (input.studentIds && input.studentIds.length > 0) {
    eventsQuery.in("student_id", input.studentIds);
  }

  const turnsQuery = client
    .from("conversations")
    .select(
      "id, student_id, assignment_id, role, text, meta, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(turnLimit);
  if (input.since) turnsQuery.gte("created_at", input.since);
  if (input.studentIds && input.studentIds.length > 0) {
    turnsQuery.in("student_id", input.studentIds);
  }

  const [eventsRes, turnsRes] = await Promise.all([eventsQuery, turnsQuery]);

  const events: AnalyticsEvent[] = (eventsRes.data ?? []).map((row) => ({
    actor: row.actor as AnalyticsEvent["actor"],
    verb: row.verb as AnalyticsEvent["verb"],
    object: row.object as AnalyticsEvent["object"],
    result: (row.result as Record<string, unknown> | null) ?? null,
    context: (row.context as Record<string, unknown> | null) ?? null,
    studentId: (row.student_id as string | null) ?? undefined,
    assignmentId: (row.assignment_id as string | null) ?? undefined,
    timestamp: row.timestamp as string,
  }));

  const turns: AnalyticsTurn[] = (turnsRes.data ?? []).map((row) => ({
    id: row.id as string,
    studentId: row.student_id as string,
    assignmentId: (row.assignment_id as string | null) ?? undefined,
    role: (row.role as string) === "ai" ? "ai" : "student",
    text: row.text as string,
    meta: (row.meta as Record<string, unknown> | null) ?? null,
    timestamp: row.created_at as string,
  }));

  return { source: "supabase", events, turns };
}
