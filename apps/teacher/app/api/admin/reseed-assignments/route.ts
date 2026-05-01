import { NextResponse } from "next/server";

import {
  ASSIGNMENTS,
  DEMO_COHORT_ID,
  createServiceRoleClientIfAvailable,
} from "@cvibe/db";

import { requireTeacher } from "@/lib/guard";

/**
 * POST /api/admin/reseed-assignments — 정적 카탈로그(ASSIGNMENTS)를 DB
 * assignments 테이블로 강제 upsert.
 *
 * 배경: 카탈로그가 변경되면(예: A01 교체, A00 추가) DB 의 assignments.code 가
 * 정적 코드와 mismatch 되어 `insertSubmission` 의 코드→ID 매핑이 실패,
 * 학생 제출이 silent skip 된다. 이 endpoint 가 한 번 실행되면 모든 catalog
 * code 가 DB 에 보장되어 이후 제출이 정상 INSERT 된다.
 *
 * service_role key 가 환경에 있어야 동작 (Vercel 환경 보호 + RLS 우회).
 * SEED_TEACHER_ID 프로필이 이미 있다는 가정 (seed.sql 최초 적용으로 존재).
 */

const SEED_TEACHER_ID = "00000000-0000-4000-8000-000000000001";

export async function POST(request: Request) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;
  const supabase = createServiceRoleClientIfAvailable();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "no-service-role-client" },
      { status: 500 },
    );
  }

  // SEED_TEACHER_ID 프로필이 없으면 먼저 만들어야 FK 충족.
  // (init_schema 마이그레이션에서 profiles → auth.users FK 가 드롭된 상태.)
  const { data: teacherRow } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", SEED_TEACHER_ID)
    .maybeSingle();
  if (!teacherRow) {
    const { error: profErr } = await supabase.from("profiles").upsert(
      {
        id: SEED_TEACHER_ID,
        email: "seed-teacher@cvibe.dev",
        role: "teacher",
        display_name: "Seed Teacher",
      },
      { onConflict: "id" },
    );
    if (profErr) {
      return NextResponse.json(
        {
          ok: false,
          error: `seed-teacher upsert failed: ${profErr.message}`,
        },
        { status: 500 },
      );
    }
  }

  const results: Array<{
    code: string;
    ok: boolean;
    error?: string;
  }> = [];

  for (const a of ASSIGNMENTS) {
    const row = {
      code: a.code,
      version: a.version,
      title: a.title,
      template: a.template,
      kc_tags: a.kcTags,
      difficulty: a.difficulty,
      rubric: a.rubric,
      constraints: a.constraints,
      starter_code: a.starterCode,
      visible_tests: a.visibleTests,
      reflection_prompts: a.reflectionPrompts,
      cohort_id: DEMO_COHORT_ID,
      active: true,
      created_by: SEED_TEACHER_ID,
    };
    const { error } = await supabase
      .from("assignments")
      .upsert(row, { onConflict: "code" });
    if (error) {
      results.push({ code: a.code, ok: false, error: error.message });
    } else {
      results.push({ code: a.code, ok: true });
    }
  }

  // 후처리: stale code (catalog 에 없는 DB row) 정리는 데이터 보존을 위해 skip.
  // 기존 submissions 가 그 assignment_id 를 참조 중일 수 있으므로 active=false 로
  // 만 표시.
  const catalogCodes = new Set(ASSIGNMENTS.map((a) => a.code));
  const { data: dbAll } = await supabase.from("assignments").select("code");
  const stale = (dbAll ?? [])
    .map((r) => r.code as string)
    .filter((c) => !catalogCodes.has(c));
  if (stale.length > 0) {
    await supabase.from("assignments").update({ active: false }).in("code", stale);
  }

  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: okCount === results.length,
    upserted: okCount,
    total: results.length,
    deactivated: stale,
    results,
  });
}
