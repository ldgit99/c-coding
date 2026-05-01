import { NextResponse } from "next/server";

import { ASSIGNMENTS, createServiceRoleClientIfAvailable } from "@cvibe/db";

import { requireTeacher } from "@/lib/guard";

/**
 * GET /api/debug/db-status — 교사 진단용. DB 의 assignments.code 가 정적
 * 카탈로그(ASSIGNMENTS)와 일치하는지·submissions/conversations row 수를 확인.
 *
 * 학생 제출이 그리드에 안 잡히는 silent-fail 디버깅 전용. 운영 안정화 후
 * 제거할 수 있다.
 */
export async function GET(request: Request) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;
  const supabase = createServiceRoleClientIfAvailable();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "no-service-role-client" });
  }

  const catalogCodes = ASSIGNMENTS.map((a) => a.code).sort();

  const [asgRes, subsCount, convCount, profileCount] = await Promise.all([
    supabase.from("assignments").select("code, version, title").order("code"),
    supabase.from("submissions").select("id", { count: "exact", head: true }),
    supabase.from("conversations").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
  ]);

  const dbCodes = (asgRes.data ?? []).map((r) => r.code as string).sort();
  const missingInDb = catalogCodes.filter((c) => !dbCodes.includes(c));
  const extraInDb = dbCodes.filter((c) => !catalogCodes.includes(c));

  return NextResponse.json({
    catalogCount: catalogCodes.length,
    dbAssignmentCount: dbCodes.length,
    catalogCodes,
    dbCodes,
    missingInDb,
    extraInDb,
    submissionsCount: subsCount.count ?? null,
    submissionsError: subsCount.error?.message ?? null,
    conversationsCount: convCount.count ?? null,
    studentProfilesCount: profileCount.count ?? null,
    assignmentsQueryError: asgRes.error?.message ?? null,
  });
}
