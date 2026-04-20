import type { SupabaseClient } from "@supabase/supabase-js";

import { DEMO_STUDENTS, type DemoStudent } from "./seeds/demo-cohort";

/**
 * @cvibe/agents의 StudentData와 동일 shape — 순환 의존을 피하려고 여기 재선언.
 * 두 쪽 모두 구조적 타입이므로 as 캐스트로 안전하게 호환된다.
 */
export interface ClassroomStudentRow {
  id: string;
  displayName: string;
  cohortId: string;
  mastery: Record<string, number>;
  dependencyFactorHistory: number[];
  misconceptions: Array<{ kc: string; pattern: string; occurrences: number }>;
  recentSubmissions: Array<{
    assignmentId: string;
    finalScore: number | null;
    passed: boolean;
    submittedAt: string;
    errorTypes: string[];
    stagnationSec: number;
    hintRequestsL3L4: number;
  }>;
}

/**
 * Cohort 학생 데이터를 얻는다.
 * - Supabase 연결 있으면 profiles·mastery·misconceptions·submissions 조인 쿼리.
 * - 없으면 DEMO_STUDENTS fallback.
 *
 * 현재 Supabase 구현은 초안 — RLS policy 조정과 쿼리 튜닝은 실제 인스턴스에
 * 연결한 뒤 이터레이션 7+에서. 지금은 연결 시점에 바로 실데이터로 전환할 수
 * 있도록 인터페이스와 fallback만 확정.
 */
export async function fetchClassroomData(
  client: SupabaseClient | null,
  cohortId: string,
): Promise<{ students: ClassroomStudentRow[]; source: "supabase" | "demo" }> {
  if (!client) {
    return {
      students: toClassroomRows(DEMO_STUDENTS.filter((s) => s.cohortId === cohortId)),
      source: "demo",
    };
  }

  try {
    const { data: profiles, error } = await client
      .from("profiles")
      .select("id, display_name, cohort_id")
      .eq("cohort_id", cohortId)
      .eq("role", "student");
    if (error) throw error;
    if (!profiles || profiles.length === 0) {
      return { students: [], source: "supabase" };
    }

    const studentIds = profiles.map((p) => p.id as string);
    const [masteryRes, miscRes, submissionsRes] = await Promise.all([
      client.from("mastery").select("student_id, kc, value").in("student_id", studentIds),
      client
        .from("misconceptions")
        .select("student_id, kc, pattern, occurrences")
        .in("student_id", studentIds),
      client
        .from("submissions")
        .select(
          "student_id, assignment_id, final_score, status, submitted_at, dependency_factor",
        )
        .in("student_id", studentIds)
        .order("submitted_at", { ascending: false })
        .limit(studentIds.length * 5),
    ]);

    const students: ClassroomStudentRow[] = profiles.map((p) => {
      const id = p.id as string;
      const masteryRows = (masteryRes.data ?? []).filter((m) => m.student_id === id);
      const mastery: Record<string, number> = {};
      for (const m of masteryRows) mastery[m.kc as string] = Number(m.value);

      const misconceptions = (miscRes.data ?? [])
        .filter((m) => m.student_id === id)
        .map((m) => ({
          kc: m.kc as string,
          pattern: m.pattern as string,
          occurrences: Number(m.occurrences),
        }));

      const studentSubs = (submissionsRes.data ?? []).filter((s) => s.student_id === id);
      const recentSubmissions = studentSubs.map((s) => ({
        assignmentId: s.assignment_id as string,
        finalScore: s.final_score != null ? Number(s.final_score) : null,
        passed: s.status === "passed",
        submittedAt: (s.submitted_at as string) ?? new Date().toISOString(),
        // schema 확장 전까지 placeholder — 학생 세션 로그에서 파생 필요
        errorTypes: [],
        stagnationSec: 0,
        hintRequestsL3L4: 0,
      }));
      const dependencyFactorHistory = studentSubs
        .map((s) => Number(s.dependency_factor ?? 0))
        .filter((v) => Number.isFinite(v));

      return {
        id,
        displayName: (p.display_name as string) ?? id,
        cohortId,
        mastery,
        dependencyFactorHistory,
        misconceptions,
        recentSubmissions,
      };
    });

    return { students, source: "supabase" };
  } catch {
    return {
      students: toClassroomRows(DEMO_STUDENTS.filter((s) => s.cohortId === cohortId)),
      source: "demo",
    };
  }
}

function toClassroomRows(rows: DemoStudent[]): ClassroomStudentRow[] {
  // DemoStudent shape이 ClassroomStudentRow와 이미 호환 — 타입만 명시.
  return rows.map((r) => ({ ...r }));
}

/**
 * env가 있고 클라이언트가 구성 가능하면 반환. 없으면 null.
 * 서버 경로 전용 — Service Role 키를 사용해 RLS 우회(교사 대시보드 집계용).
 */
export function createServiceRoleClientIfAvailable(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
    return mod.createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch {
    return null;
  }
}
