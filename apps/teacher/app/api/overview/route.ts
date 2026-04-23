import { NextResponse } from "next/server";

import {
  aggregateMisconceptions,
  summarizeClassroom,
  type StudentData,
} from "@cvibe/agents";
import {
  DEMO_COHORT_ID,
  createServiceRoleClientIfAvailable,
  fetchClassroomData,
} from "@cvibe/db";
import { detectStuckLoop, frustrationScore } from "@cvibe/xapi";

/**
 * GET /api/overview — 홈 화면 Health Card + At-Risk Strip.
 *
 * 각 학생에 🟢 / 🟡 / 🔴 건강도를 붙인다:
 *   🔴 critical: stuckLoop OR frustration >= 0.3 OR 최근 3제출 모두 fail
 *   🟡 watch   : avg mastery < 0.4 OR dependency >= 0.5 OR last activity > 15min
 *   🟢 flow    : otherwise
 *
 * At-risk 는 🔴/🟡 학생을 urgency 순으로 정렬한 리스트.
 */

const STUDENT_URL =
  process.env.STUDENT_APP_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_STUDENT_APP_URL ??
  "http://localhost:3000";

interface DumpTurn {
  studentId: string;
  role: "student" | "ai" | "assistant";
  text: string;
  timestamp: string;
}

interface DumpResponse {
  turns?: DumpTurn[];
}

export type HealthStatus = "flow" | "watch" | "critical";

export async function GET() {
  const supabase = createServiceRoleClientIfAvailable();
  const { students, source } = await fetchClassroomData(supabase, DEMO_COHORT_ID);
  const cohortStudents = students as unknown as StudentData[];

  // 학생별 대화 로그 (frustration·loop 계산용)
  const utterancesByStudent = new Map<string, string[]>();
  const lastTimestampByStudent = new Map<string, string>();
  try {
    const res = await fetch(`${STUDENT_URL}/api/analytics/dump`, { cache: "no-store" });
    if (res.ok) {
      const dump = (await res.json()) as DumpResponse;
      for (const t of dump.turns ?? []) {
        const prev = lastTimestampByStudent.get(t.studentId);
        if (!prev || t.timestamp > prev) {
          lastTimestampByStudent.set(t.studentId, t.timestamp);
        }
        if (t.role !== "student") continue;
        const arr = utterancesByStudent.get(t.studentId) ?? [];
        arr.push(t.text);
        utterancesByStudent.set(t.studentId, arr);
      }
    }
  } catch {
    // ignore
  }

  const now = Date.now();
  const cards = students.map((s) => {
    const utters = utterancesByStudent.get(s.id) ?? [];
    const frustration = frustrationScore(utters);
    const loop = detectStuckLoop(utters);

    const masteryValues = Object.values(s.mastery);
    const avgMastery =
      masteryValues.length > 0
        ? masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length
        : 0;

    const deps = s.dependencyFactorHistory ?? [];
    const latestDep = deps.at(-1) ?? 0;

    const recent = [...s.recentSubmissions].sort((a, b) =>
      b.submittedAt.localeCompare(a.submittedAt),
    );
    const last3 = recent.slice(0, 3);
    const last3AllFail = last3.length === 3 && last3.every((r) => !r.passed);
    const lastSubmit = recent[0]?.submittedAt;
    const lastConv = lastTimestampByStudent.get(s.id);
    const lastActivity =
      lastSubmit && lastConv
        ? lastSubmit > lastConv
          ? lastSubmit
          : lastConv
        : lastSubmit ?? lastConv ?? null;
    const minutesSinceActivity = lastActivity
      ? Math.round((now - new Date(lastActivity).getTime()) / 60000)
      : null;

    const reasons: string[] = [];
    let status: HealthStatus = "flow";

    if (loop.inLoop) {
      reasons.push(`막힘 루프 "${loop.repeatedTerm}" ×${loop.repeatCount}`);
      status = "critical";
    }
    if (frustration >= 0.3) {
      reasons.push(`감정 지수 ${(frustration * 100).toFixed(0)}%`);
      status = "critical";
    }
    if (last3AllFail) {
      reasons.push("최근 3제출 연속 미통과");
      status = "critical";
    }
    if (status !== "critical") {
      if (avgMastery < 0.4 && masteryValues.length > 0) {
        reasons.push(`평균 숙련도 ${avgMastery.toFixed(2)}`);
        status = "watch";
      }
      if (latestDep >= 0.5) {
        reasons.push(`의존도 ${latestDep.toFixed(2)}`);
        status = "watch";
      }
      // "N분 무활동" 은 교실 밖 시간에도 쌓여 신호로 유용하지 않음 → 제거.
    }

    const passRate =
      recent.length > 0 ? recent.filter((r) => r.passed).length / recent.length : 0;

    return {
      id: s.id,
      displayName: s.displayName,
      status,
      reasons,
      avgMastery: Number(avgMastery.toFixed(2)),
      latestDependency: Number(latestDep.toFixed(2)),
      frustration: Number(frustration.toFixed(2)),
      stuckLoop: loop.inLoop
        ? { term: loop.repeatedTerm ?? null, repeat: loop.repeatCount }
        : null,
      utteranceCount: utters.length,
      submissionCount: recent.length,
      passRate: Number(passRate.toFixed(2)),
      minutesSinceActivity,
    };
  });

  const urgencyRank = (c: (typeof cards)[number]): number => {
    const base = c.status === "critical" ? 2 : c.status === "watch" ? 1 : 0;
    return base + c.frustration * 0.8 + (c.stuckLoop ? 0.5 : 0);
  };
  const atRisk = cards
    .filter((c) => c.status !== "flow")
    .sort((a, b) => urgencyRank(b) - urgencyRank(a))
    .slice(0, 10);

  const statusCounts = {
    flow: cards.filter((c) => c.status === "flow").length,
    watch: cards.filter((c) => c.status === "watch").length,
    critical: cards.filter((c) => c.status === "critical").length,
  };

  return NextResponse.json({
    cohortId: DEMO_COHORT_ID,
    source,
    cards,
    atRisk,
    statusCounts,
    summary: summarizeClassroom(cohortStudents, DEMO_COHORT_ID),
    misconceptions: aggregateMisconceptions(cohortStudents, DEMO_COHORT_ID),
    generatedAt: new Date().toISOString(),
  });
}
