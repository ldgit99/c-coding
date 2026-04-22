import { NextResponse } from "next/server";

import {
  DEMO_COHORT_ID,
  createServiceRoleClientIfAvailable,
  fetchClassroomData,
} from "@cvibe/db";

/**
 * GET /api/students — cohort 소속 학생 명단 (회원 관리용).
 *
 * Supabase env 있으면 `profiles` 테이블을 읽고, 최근 활동·제출 통계를 덧붙여
 * 반환한다. 없으면 demo cohort로 fallback.
 */
export async function GET() {
  const supabase = createServiceRoleClientIfAvailable();

  if (!supabase) {
    const { students } = await fetchClassroomData(null, DEMO_COHORT_ID);
    return NextResponse.json({
      cohortId: DEMO_COHORT_ID,
      source: "demo",
      students: students.map((s) => ({
        id: s.id,
        displayName: s.displayName,
        email: null,
        cohortId: s.cohortId,
        role: "student" as const,
        status: "active" as const,
        lastActiveAt: null,
        submissionCount: s.recentSubmissions.length,
        passedCount: s.recentSubmissions.filter((r) => r.passed).length,
        createdAt: null,
      })),
    });
  }

  try {
    // 1차: status 컬럼 포함 조회. 컬럼 미적용(마이그레이션 전)이면 42703 에러 → 재시도.
    let profiles: Array<Record<string, unknown>> | null = null;
    let statusColumnMissing = false;
    {
      const full = await supabase
        .from("profiles")
        .select("id, display_name, email, cohort_id, role, status, created_at")
        .eq("cohort_id", DEMO_COHORT_ID)
        .eq("role", "student")
        .order("display_name", { ascending: true });
      if (full.error) {
        const msg = full.error.message ?? "";
        const code = (full.error as unknown as { code?: string }).code;
        if (code === "42703" || /status/.test(msg)) {
          statusColumnMissing = true;
        } else {
          return NextResponse.json(
            {
              cohortId: DEMO_COHORT_ID,
              source: "supabase",
              students: [],
              error: full.error.message,
            },
            { status: 200 },
          );
        }
      } else {
        profiles = full.data;
      }
    }

    if (statusColumnMissing) {
      const fallback = await supabase
        .from("profiles")
        .select("id, display_name, email, cohort_id, role, created_at")
        .eq("cohort_id", DEMO_COHORT_ID)
        .eq("role", "student")
        .order("display_name", { ascending: true });
      if (fallback.error) {
        return NextResponse.json(
          {
            cohortId: DEMO_COHORT_ID,
            source: "supabase",
            students: [],
            error: fallback.error.message,
          },
          { status: 200 },
        );
      }
      profiles = fallback.data;
    }

    const studentIds = (profiles ?? []).map((p) => p.id as string);
    const [subsRes, convRes] = await Promise.all([
      studentIds.length > 0
        ? supabase
            .from("submissions")
            .select("student_id, status, submitted_at")
            .in("student_id", studentIds)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
      studentIds.length > 0
        ? supabase
            .from("conversations")
            .select("student_id, created_at")
            .in("student_id", studentIds)
            .order("created_at", { ascending: false })
            .limit(studentIds.length * 5)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
    ]);

    const lastActive = new Map<string, string>();
    for (const row of (convRes.data as Array<Record<string, unknown>>) ?? []) {
      const sid = row.student_id as string;
      const t = row.created_at as string;
      if (!lastActive.has(sid) && t) lastActive.set(sid, t);
    }

    const counts = new Map<string, { total: number; passed: number; lastSubmit?: string }>();
    for (const row of (subsRes.data as Array<Record<string, unknown>>) ?? []) {
      const sid = row.student_id as string;
      const cur = counts.get(sid) ?? { total: 0, passed: 0 };
      cur.total += 1;
      if (row.status === "passed") cur.passed += 1;
      const t = row.submitted_at as string | null;
      if (t && (!cur.lastSubmit || t > cur.lastSubmit)) cur.lastSubmit = t;
      counts.set(sid, cur);
    }

    const students = (profiles ?? []).map((p) => {
      const id = p.id as string;
      const c = counts.get(id);
      const convLast = lastActive.get(id);
      const subLast = c?.lastSubmit;
      const lastActiveAt =
        convLast && subLast ? (convLast > subLast ? convLast : subLast) : convLast ?? subLast ?? null;
      return {
        id,
        displayName: (p.display_name as string) ?? id,
        email: (p.email as string) ?? null,
        cohortId: (p.cohort_id as string) ?? DEMO_COHORT_ID,
        role: (p.role as string) ?? "student",
        status: ((p.status as string) ?? "active") as "active" | "inactive" | "removed",
        lastActiveAt,
        submissionCount: c?.total ?? 0,
        passedCount: c?.passed ?? 0,
        createdAt: (p.created_at as string) ?? null,
      };
    });

    return NextResponse.json({
      cohortId: DEMO_COHORT_ID,
      source: "supabase",
      students,
    });
  } catch (err) {
    return NextResponse.json(
      { cohortId: DEMO_COHORT_ID, source: "supabase", students: [], error: String(err) },
      { status: 200 },
    );
  }
}

/**
 * PATCH /api/students — 학생 상태 변경 (active/inactive/removed) 또는 display_name
 * 수정. Supabase 없으면 데모 경고만 반환.
 */
export async function PATCH(request: Request) {
  type Body = {
    id: string;
    status?: "active" | "inactive" | "removed";
    displayName?: string;
  };

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "id는 필수" }, { status: 400 });
  }

  const supabase = createServiceRoleClientIfAvailable();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, source: "demo", note: "Supabase 미설정 — 실제 변경 없음" },
      { status: 200 },
    );
  }

  const patch: Record<string, string> = {};
  if (body.status) patch.status = body.status;
  if (body.displayName) patch.display_name = body.displayName;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "변경할 항목 없음" }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", body.id);
  if (error) {
    const code = (error as unknown as { code?: string }).code;
    const missingCol = code === "42703" || /status/.test(error.message ?? "");
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        hint: missingCol
          ? "profiles.status 컬럼이 없습니다. supabase/migrations/20260422000000_profile_status.sql 을 적용하세요."
          : undefined,
      },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, id: body.id, patch });
}
