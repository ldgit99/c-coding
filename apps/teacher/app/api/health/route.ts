import { NextResponse } from "next/server";

import { ASSIGNMENTS, createServiceRoleClientIfAvailable } from "@cvibe/db";

import { requireTeacher } from "@/lib/guard";

/**
 * GET /api/health — 시스템 헬스 종합. 교사 settings 에서 호출.
 *
 *  1) 학생 앱의 /api/health/db-writes 폴링 (write counters).
 *  2) DB 카탈로그 ↔ ASSIGNMENTS 정적 카탈로그 drift 검출.
 *  3) 최근 1시간 events·conversations·submissions 카운트.
 */
const STUDENT_URL =
  process.env.STUDENT_APP_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_STUDENT_APP_URL ??
  "http://localhost:3000";

interface WriteSnapshot {
  processStartedAt: string;
  tables: Array<{
    table: string;
    attempts: number;
    failures: number;
    failureRate: number;
    lastFailureAt: string | null;
    lastError: string | null;
  }>;
}

export async function GET(request: Request) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  const supabase = createServiceRoleClientIfAvailable();

  // 학생 앱 write counters
  let writes: WriteSnapshot | null = null;
  try {
    const res = await fetch(`${STUDENT_URL}/api/health/db-writes`, {
      cache: "no-store",
    });
    if (res.ok) writes = (await res.json()) as WriteSnapshot;
  } catch {
    // ignore — student app cold start 또는 미배포
  }

  // catalog drift
  const catalogCodes = ASSIGNMENTS.map((a) => a.code).sort();
  let dbCodes: string[] = [];
  let recentCounts = { events: 0, conversations: 0, submissions: 0 };
  if (supabase) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [{ data: asgRows }, eventsRes, convRes, subsRes] = await Promise.all([
      supabase.from("assignments").select("code"),
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .gte("timestamp", since),
      supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
      supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .gte("submitted_at", since),
    ]);
    dbCodes = (asgRows ?? []).map((r) => r.code as string).sort();
    recentCounts = {
      events: eventsRes.count ?? 0,
      conversations: convRes.count ?? 0,
      submissions: subsRes.count ?? 0,
    };
  }
  const drift = {
    missingInDb: catalogCodes.filter((c) => !dbCodes.includes(c)),
    extraInDb: dbCodes.filter((c) => !catalogCodes.includes(c)),
    inSync:
      catalogCodes.length === dbCodes.length &&
      catalogCodes.every((c) => dbCodes.includes(c)),
  };

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      writes,
      drift,
      recentCounts,
      env: {
        hasSupabase: !!supabase,
        hasStudentApp: !!STUDENT_URL,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
