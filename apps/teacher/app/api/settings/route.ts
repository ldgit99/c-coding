import { NextResponse } from "next/server";

import {
  DEMO_COHORT_ID,
  createServiceRoleClientIfAvailable,
  fetchClassroomData,
} from "@cvibe/db";

/**
 * GET /api/settings — 교사 대시보드 운영 진단.
 * 민감값(키 전체)은 절대 노출하지 않고, "설정됨/미설정" 플래그만 반환.
 */
export async function GET() {
  const env = process.env;
  const supabase = createServiceRoleClientIfAvailable();

  // Cohort 스냅샷 (학생 수만)
  const { students, source } = await fetchClassroomData(supabase, DEMO_COHORT_ID);

  // Student 앱 연결 여부 (health check)
  const studentUrl =
    env.STUDENT_APP_INTERNAL_URL ??
    env.NEXT_PUBLIC_STUDENT_APP_URL ??
    "http://localhost:3000";

  let studentAppReachable = false;
  try {
    const res = await fetch(`${studentUrl}/api/analytics/dump`, { cache: "no-store" });
    studentAppReachable = res.ok;
  } catch {
    studentAppReachable = false;
  }

  return NextResponse.json({
    cohort: {
      id: DEMO_COHORT_ID,
      studentCount: students.length,
      source,
    },
    integrations: {
      supabase: Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      supabaseServiceRole: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      anthropic: Boolean(env.ANTHROPIC_API_KEY),
      judge0: Boolean(env.JUDGE0_API_URL),
      langfuse: Boolean(env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY),
      studentApp: {
        url: studentUrl,
        reachable: studentAppReachable,
      },
    },
    runtime: {
      node: process.version,
      platform: process.platform,
      uptimeSec: Math.round(process.uptime()),
    },
    generatedAt: new Date().toISOString(),
  });
}
