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
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("cohort_id", DEMO_COHORT_ID)
      .eq("role", "student")
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

    const studentIds = (profiles ?? []).map((p) => p.id as string);
    let submissions: Array<Record<string, unknown>> = [];
    if (studentIds.length > 0) {
      const { data: subs, error: subsError } = await supabase
        .from("submissions")
        .select(
          "student_id, assignment_id, final_score, status, submitted_at, assignments!inner(code)",
        )
        .in("student_id", studentIds)
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
      submissions = subs ?? [];
    }

    const byStudent = new Map<string, Map<string, CellState>>();
    for (const row of submissions) {
      const sid = row.student_id as string;
      const assignment = row.assignments as unknown as { code?: string } | null;
      const code = assignment?.code;
      if (!code) continue;
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

    const rows = (profiles ?? []).map((p) => {
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
    });

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
