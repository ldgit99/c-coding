import { NextResponse } from "next/server";

import {
  ASSIGNMENTS,
  DEMO_COHORT_ID,
  createServiceRoleClientIfAvailable,
  fetchClassroomData,
} from "@cvibe/db";

/**
 * GET /api/submissions/grid — 학생 × 과제 제출 상태 매트릭스.
 *
 * 각 cell:
 *   status: "passed" | "failed" | "in_progress" | "none"
 *   attempts: 제출 횟수 (0 이상)
 *   lastScore: finalScore | null
 *   lastAt:    submittedAt ISO | null
 *
 * 같은 학생/과제 조합에서 가장 최근 제출의 status를 기준으로 하되,
 * attempts 는 전체 카운트.
 */
export async function GET() {
  const assignments = ASSIGNMENTS.map((a) => ({
    code: a.code,
    title: a.title,
    difficulty: a.difficulty,
    kcTags: a.kcTags,
  }));

  const supabase = createServiceRoleClientIfAvailable();

  if (!supabase) {
    const { students } = await fetchClassroomData(null, DEMO_COHORT_ID);
    const rows = students.map((s) => {
      const cells: Record<string, CellState> = {};
      for (const a of assignments) {
        const subs = s.recentSubmissions.filter((r) => r.assignmentId === a.code);
        cells[a.code] = summarize(subs);
      }
      return {
        studentId: s.id,
        displayName: s.displayName,
        cells,
      };
    });
    return NextResponse.json({
      cohortId: DEMO_COHORT_ID,
      source: "demo",
      assignments,
      students: rows,
    });
  }

  try {
    // 학생 프로필 조회.
    //
    // cohort_id 가 DEMO_COHORT_ID 와 일치하지 않거나 NULL 인 학생도 포함한다.
    // 이유: handle_new_user 트리거(SUPABASE.md Step 5)가 cohort_id 를 "최초
    // 생성 cohort"로 채우기 때문에, 다른 cohort 가 먼저 생성됐거나 트리거 적용
    // 전 가입한 학생의 cohort_id 가 NULL/불일치할 수 있다. 파일럿은 단일
    // cohort 이므로 role=student 만 보장되면 그리드에 노출하는 것이 안전하다.
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name, cohort_id")
      .eq("role", "student")
      .or(`cohort_id.eq.${DEMO_COHORT_ID},cohort_id.is.null`)
      .order("display_name", { ascending: true });

    if (profileError) {
      return NextResponse.json(
        {
          cohortId: DEMO_COHORT_ID,
          source: "supabase",
          assignments,
          students: [],
          error: profileError.message,
        },
        { status: 200 },
      );
    }

    // assignments 코드↔ID 맵을 별도 조회. PostgREST embed (`assignments!inner`)
    // 가 캐시·관계 추론 실패 시 조용히 빈 배열을 돌려주는 위험을 회피.
    const { data: assignmentRows, error: asgError } = await supabase
      .from("assignments")
      .select("id, code");
    if (asgError) {
      return NextResponse.json(
        {
          cohortId: DEMO_COHORT_ID,
          source: "supabase",
          assignments,
          students: [],
          error: asgError.message,
        },
        { status: 200 },
      );
    }
    const codeById = new Map<string, string>();
    for (const row of assignmentRows ?? []) {
      const id = row.id as string | undefined;
      const code = row.code as string | undefined;
      if (id && code) codeById.set(id, code);
    }

    // 제출물은 학생 ID 필터 없이 전부 가져와 student_id 가 누락 프로필인
    // 케이스(예: cohort_id 가 둘 다 아닌 학생)도 union 으로 합친다.
    const studentIdSet = new Set((profiles ?? []).map((p) => p.id as string));
    const { data: subs, error: subsError } = await supabase
      .from("submissions")
      .select(
        "student_id, assignment_id, final_score, status, submitted_at",
      )
      .order("submitted_at", { ascending: false });
    if (subsError) {
      return NextResponse.json(
        {
          cohortId: DEMO_COHORT_ID,
          source: "supabase",
          assignments,
          students: [],
          error: subsError.message,
        },
        { status: 200 },
      );
    }
    const submissions: Array<Record<string, unknown>> = subs ?? [];

    const byStudent = new Map<string, Map<string, CellState>>();
    const orphanStudentIds = new Set<string>();
    for (const row of submissions) {
      const sid = row.student_id as string;
      const aid = row.assignment_id as string | undefined;
      const code = aid ? codeById.get(aid) : undefined;
      if (!code) continue;
      if (!studentIdSet.has(sid)) orphanStudentIds.add(sid);
      const outer = byStudent.get(sid) ?? new Map<string, CellState>();
      const cur = outer.get(code) ?? {
        status: "none",
        attempts: 0,
        lastScore: null,
        lastAt: null,
      };
      cur.attempts += 1;
      const at = (row.submitted_at as string | null) ?? null;
      if (!cur.lastAt || (at && at > cur.lastAt)) {
        cur.lastAt = at;
        cur.lastScore = row.final_score != null ? Number(row.final_score) : null;
        cur.status = mapStatus(row.status as string | null);
      } else if (cur.status !== "passed" && row.status === "passed") {
        cur.status = "passed";
      }
      outer.set(code, cur);
      byStudent.set(sid, outer);
    }

    // cohort 필터에 걸리지 않았지만 제출 기록이 있는 학생의 표시명을 찾아온다.
    const orphanProfiles: Array<Record<string, unknown>> = [];
    if (orphanStudentIds.size > 0) {
      const { data: orphans } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", Array.from(orphanStudentIds));
      if (orphans) orphanProfiles.push(...orphans);
    }

    const allProfiles = [...(profiles ?? []), ...orphanProfiles];
    const seen = new Set<string>();
    const rows = allProfiles
      .filter((p) => {
        const id = p.id as string;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map((p) => {
        const id = p.id as string;
        const cellMap = byStudent.get(id) ?? new Map<string, CellState>();
        const cells: Record<string, CellState> = {};
        for (const a of assignments) {
          cells[a.code] = cellMap.get(a.code) ?? {
            status: "none",
            attempts: 0,
            lastScore: null,
            lastAt: null,
          };
        }
        return {
          studentId: id,
          displayName: (p.display_name as string) ?? id,
          cells,
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "ko"));

    return NextResponse.json({
      cohortId: DEMO_COHORT_ID,
      source: "supabase",
      assignments,
      students: rows,
    });
  } catch (err) {
    return NextResponse.json(
      {
        cohortId: DEMO_COHORT_ID,
        source: "supabase",
        assignments,
        students: [],
        error: String(err),
      },
      { status: 200 },
    );
  }
}

type CellStatus = "passed" | "failed" | "in_progress" | "none";
interface CellState {
  status: CellStatus;
  attempts: number;
  lastScore: number | null;
  lastAt: string | null;
}

function summarize(
  subs: Array<{ finalScore: number | null; passed: boolean; submittedAt: string }>,
): CellState {
  if (subs.length === 0) {
    return { status: "none", attempts: 0, lastScore: null, lastAt: null };
  }
  const sorted = [...subs].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  const latest = sorted[0]!;
  const hasPassed = subs.some((s) => s.passed);
  return {
    status: hasPassed ? "passed" : "failed",
    attempts: subs.length,
    lastScore: latest.finalScore,
    lastAt: latest.submittedAt,
  };
}

function mapStatus(raw: string | null): CellStatus {
  if (raw === "passed") return "passed";
  if (raw === "failed") return "failed";
  if (raw === "in_progress" || raw === "submitted") return "in_progress";
  return "failed";
}
