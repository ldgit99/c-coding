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
    // status='removed' 학생은 모든 집계에서 제외 (제적). status 컬럼이 없는
    // 마이그레이션 미적용 환경 대비 fallback 포함.
    //
    // cohort 필터는 grid 라우트와 동일하게 관대하게 둔다 — handle_new_user
    // 트리거가 cohort_id 를 NULL/다른 값으로 채울 수 있어 엄격 매칭이면
    // 실제 활동 중인 학생이 dashboard 집계에서 누락된다. 파일럿은 단일
    // cohort 라 role=student 만 보장되면 이 cohort 의 학생으로 본다.
    let profiles: Array<Record<string, unknown>> | null = null;
    {
      const withStatus = await client
        .from("profiles")
        .select("id, display_name, cohort_id, status")
        .eq("role", "student")
        .or(`cohort_id.eq.${cohortId},cohort_id.is.null`);
      if (withStatus.error) {
        const code = (withStatus.error as { code?: string }).code;
        if (code === "42703" || /status/.test(withStatus.error.message)) {
          const fallback = await client
            .from("profiles")
            .select("id, display_name, cohort_id")
            .eq("role", "student")
            .or(`cohort_id.eq.${cohortId},cohort_id.is.null`);
          if (fallback.error) throw fallback.error;
          profiles = fallback.data;
        } else {
          throw withStatus.error;
        }
      } else {
        profiles = withStatus.data;
      }
    }
    profiles = (profiles ?? []).filter((p) => p.status !== "removed");

    // 추가로 — profiles 에 안 잡히지만 submissions 가 있는 orphan 학생도
    // 합친다. grid 라우트와 동일 정책. assignments 쿼리는 student 집합과
    // 무관하게 항상 필요해서 미리 시작.
    const orphanProfilesPromise = (async () => {
      const { data: subRows } = await client
        .from("submissions")
        .select("student_id");
      const seen = new Set((profiles ?? []).map((p) => p.id as string));
      const extras = new Set<string>();
      for (const r of subRows ?? []) {
        const sid = r.student_id as string | undefined;
        if (sid && !seen.has(sid)) extras.add(sid);
      }
      if (extras.size === 0) return [] as Array<Record<string, unknown>>;
      const { data: orphanRows } = await client
        .from("profiles")
        .select("id, display_name, cohort_id, status")
        .in("id", Array.from(extras));
      return (orphanRows ?? []).filter((p) => p.status !== "removed");
    })();

    const orphans = await orphanProfilesPromise;
    profiles = [...(profiles ?? []), ...orphans];
    if (profiles.length === 0) {
      return { students: [], source: "supabase" };
    }

    const studentIds = profiles.map((p) => p.id as string);
    const [masteryRes, miscRes, submissionsRes, assignmentsRes] = await Promise.all([
      client.from("mastery").select("student_id, kc, value").in("student_id", studentIds),
      client
        .from("misconceptions")
        .select("student_id, kc, pattern, occurrences")
        .in("student_id", studentIds),
      // 학생당 시도가 많으면 limit=studentIds*5 는 부족 — 11과제 × 학생 가정
      // 만으로도 cap 가 차서 오래된 제출이 잘린다. 충분히 큰 상한으로 변경.
      client
        .from("submissions")
        .select(
          "student_id, assignment_id, final_score, status, submitted_at, dependency_factor",
        )
        .in("student_id", studentIds)
        .order("submitted_at", { ascending: false })
        .limit(2000),
      // assignments.id (uuid) → assignments.code 매핑. recentSubmissions[].assignmentId
      // 의 contract 가 code 문자열이라 (overview·grid·demo data 모두 code 비교)
      // 여기서 UUID → code 로 정규화한다.
      client.from("assignments").select("id, code"),
    ]);
    const assignmentCodeById = new Map<string, string>();
    for (const a of assignmentsRes.data ?? []) {
      assignmentCodeById.set(a.id as string, a.code as string);
    }

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
        // contract: code 문자열 (e.g. "A01_array_2d_sum"). 매핑 실패 시
        // 원 UUID 를 그대로 두면 모든 consumer 의 code 비교가 빗나가므로
        // 차라리 빈 문자열로 떨어뜨려 즉시 발견 가능하게 한다.
        assignmentId:
          assignmentCodeById.get(s.assignment_id as string) ?? "",
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
