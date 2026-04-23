import { NextResponse } from "next/server";

import {
  aggregateMisconceptions,
  summarizeClassroom,
  type StudentData,
} from "@cvibe/agents";
import {
  ASSIGNMENTS,
  DEMO_COHORT_ID,
  createServiceRoleClientIfAvailable,
  fetchClassroomData,
} from "@cvibe/db";
import {
  classifyUtterance,
  clusterCommonQuestions,
  detectStuckLoop,
  frustrationScore,
  isRealUtterance,
} from "@cvibe/xapi";

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
  assignmentId?: string;
  role: "student" | "ai" | "assistant";
  text: string;
  timestamp: string;
}

interface DumpEvent {
  actor?: { id?: string };
  verb?: string;
  object?: Record<string, unknown>;
  result?: Record<string, unknown>;
  timestamp?: string;
}

interface DumpResponse {
  turns?: DumpTurn[];
  events?: DumpEvent[];
}

export type HealthStatus = "flow" | "watch" | "critical";

export async function GET() {
  const supabase = createServiceRoleClientIfAvailable();
  const { students, source } = await fetchClassroomData(supabase, DEMO_COHORT_ID);
  const cohortStudents = students as unknown as StudentData[];

  // 학생별 대화 로그 (frustration·loop 계산용) + 이벤트 (trend·today)
  const utterancesByStudent = new Map<string, string[]>();
  const lastTimestampByStudent = new Map<string, string>();
  const allTurns: DumpTurn[] = [];
  const allEvents: DumpEvent[] = [];
  try {
    const res = await fetch(`${STUDENT_URL}/api/analytics/dump`, { cache: "no-store" });
    if (res.ok) {
      const dump = (await res.json()) as DumpResponse;
      for (const t of dump.turns ?? []) {
        allTurns.push(t);
        const prev = lastTimestampByStudent.get(t.studentId);
        if (!prev || t.timestamp > prev) {
          lastTimestampByStudent.set(t.studentId, t.timestamp);
        }
        if (t.role !== "student") continue;
        const arr = utterancesByStudent.get(t.studentId) ?? [];
        arr.push(t.text);
        utterancesByStudent.set(t.studentId, arr);
      }
      for (const e of dump.events ?? []) allEvents.push(e);
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

  // ==========================================================================
  // Today at a glance — 오늘/어제 비교
  // ==========================================================================
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const submittedAtsByDay = { today: 0, yesterday: 0 };
  const activeStudentsToday = new Set<string>();
  const recentNotable: Array<{ at: string; kind: string; text: string; studentId?: string }> = [];

  for (const e of allEvents) {
    const ts = e.timestamp ? new Date(e.timestamp).getTime() : NaN;
    if (!Number.isFinite(ts)) continue;
    const verb = String(e.verb ?? "");
    const actorId =
      e.actor && typeof e.actor === "object" && "id" in e.actor
        ? String((e.actor as { id?: string }).id ?? "")
        : "";
    if (verb.endsWith("submission-passed") || verb.endsWith("submission-failed")) {
      if (ts >= startOfToday.getTime() && ts < startOfTomorrow.getTime()) {
        submittedAtsByDay.today += 1;
      } else if (ts >= startOfYesterday.getTime() && ts < startOfToday.getTime()) {
        submittedAtsByDay.yesterday += 1;
      }
      if (verb.endsWith("submission-passed")) {
        const recent =
          now - ts < 10 * 60 * 1000
            ? { at: e.timestamp!, kind: "passed", text: "제출 통과", studentId: actorId }
            : null;
        if (recent) recentNotable.push(recent);
      }
    }
  }
  for (const t of allTurns) {
    const ts = new Date(t.timestamp).getTime();
    if (Number.isFinite(ts) && ts >= startOfToday.getTime()) {
      activeStudentsToday.add(t.studentId);
    }
  }
  const submissionsDelta = submittedAtsByDay.today - submittedAtsByDay.yesterday;

  // nameById 맵 (recent notable 에 이름 붙이기)
  const nameById = new Map(students.map((s) => [s.id, s.displayName] as const));
  const recentNotableNamed = recentNotable
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 5)
    .map((r) => ({
      ...r,
      displayName: r.studentId ? nameById.get(r.studentId) ?? "" : "",
    }));

  // ==========================================================================
  // Action Cards — 자동 생성 인사이트 3개
  // ==========================================================================
  const actionCards: Array<{
    icon: string;
    title: string;
    observation: string;
    cta: { label: string; href: string };
    priority: number;
  }> = [];

  // A. 긴급 개입 (critical 학생 수)
  if (statusCounts.critical > 0) {
    actionCards.push({
      icon: "🚨",
      title: "개입 권장",
      observation: `${statusCounts.critical}명이 막힘/감정/연속실패 신호를 보여요`,
      cta: { label: "개입 큐 열기", href: "/queue" },
      priority: 10 + statusCounts.critical,
    });
  }

  // B. 공통 질문 클러스터
  const realStudentUtterances: string[] = [];
  for (const arr of utterancesByStudent.values()) {
    for (const u of arr) {
      if (isRealUtterance(u)) realStudentUtterances.push(u);
    }
  }
  const clusters = clusterCommonQuestions(realStudentUtterances, {
    minClusterSize: 3,
    topK: 1,
  });
  if (clusters.length > 0) {
    const top = clusters[0]!;
    actionCards.push({
      icon: "💬",
      title: "수업 주제 후보",
      observation: `“${top.representative.slice(0, 30)}${
        top.representative.length > 30 ? "…" : ""
      }” ${top.count}명 반복`,
      cta: { label: "대화 분석 보기", href: "/conversations" },
      priority: 5 + top.count,
    });
  }

  // C. 과제 진행률 관찰
  const totalStudents = students.length;
  const perAssignmentProgress = ASSIGNMENTS.map((a) => {
    const studentsPassed = students.filter((s) =>
      s.recentSubmissions.some((r) => r.assignmentId === a.code && r.passed),
    ).length;
    const studentsStarted = students.filter((s) =>
      s.recentSubmissions.some((r) => r.assignmentId === a.code),
    ).length;
    const totalAttempts = students.reduce(
      (acc, s) =>
        acc + s.recentSubmissions.filter((r) => r.assignmentId === a.code).length,
      0,
    );
    const avgAttempts = studentsStarted > 0 ? totalAttempts / studentsStarted : 0;
    return {
      code: a.code,
      title: a.title,
      difficulty: a.difficulty,
      studentsPassed,
      studentsStarted,
      totalStudents,
      passRate: totalStudents > 0 ? studentsPassed / totalStudents : 0,
      avgAttempts: Number(avgAttempts.toFixed(1)),
    };
  });
  // 가장 최근 "clump" — 통과율 40~80% 인 과제 (현재 진행 중)
  const inProgress = perAssignmentProgress.find(
    (p) => p.passRate >= 0.4 && p.passRate < 0.9,
  );
  if (inProgress) {
    actionCards.push({
      icon: "📝",
      title: "제출 몰림",
      observation: `${inProgress.title} ${Math.round(inProgress.passRate * 100)}% 통과 · 평균 ${inProgress.avgAttempts}회 시도`,
      cta: { label: "제출 현황 열기", href: "/submissions" },
      priority: 4,
    });
  } else {
    // fallback — 다음 시작될 과제
    const next = perAssignmentProgress.find((p) => p.studentsStarted === 0);
    if (next) {
      actionCards.push({
        icon: "📝",
        title: "다음 과제 준비",
        observation: `${next.title} 아직 아무도 시작 안 함`,
        cta: { label: "제출 현황 열기", href: "/submissions" },
        priority: 3,
      });
    }
  }

  // 최대 3개, priority 순
  const topActionCards = [...actionCards]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);

  // ==========================================================================
  // Trend Sparks — 지난 7일 일자별 집계
  // ==========================================================================
  const days = 7;
  const passRateByDay: number[] = new Array(days).fill(0);
  const dependencyByDay: number[] = new Array(days).fill(0);
  const frustrationCountByDay: number[] = new Array(days).fill(0);
  const submissionsByDay = new Array(days).fill(0);

  // For each day, aggregate events
  const dayStart = (offset: number): number => {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() - (days - 1 - offset));
    return d.getTime();
  };
  for (let i = 0; i < days; i++) {
    const begin = dayStart(i);
    const end = i === days - 1 ? startOfTomorrow.getTime() : dayStart(i + 1);
    let pass = 0;
    let fail = 0;
    for (const e of allEvents) {
      const ts = e.timestamp ? new Date(e.timestamp).getTime() : NaN;
      if (!Number.isFinite(ts)) continue;
      if (ts < begin || ts >= end) continue;
      const verb = String(e.verb ?? "");
      if (verb.endsWith("submission-passed")) pass += 1;
      else if (verb.endsWith("submission-failed")) fail += 1;
    }
    const total = pass + fail;
    passRateByDay[i] = total > 0 ? pass / total : 0;
    submissionsByDay[i] = total;
  }
  // Dependency: per-day mean dependency_factor_history tail — 데이터 단위로
  // simplify: 현재 cards 의 latestDependency 평균을 마지막 bin 에 두고 나머지는 0.
  const meanDep =
    cards.length > 0
      ? cards.reduce((a, c) => a + c.latestDependency, 0) / cards.length
      : 0;
  dependencyByDay[days - 1] = Number(meanDep.toFixed(2));
  // Frustration count today
  const critNow = cards.filter((c) => c.frustration >= 0.3).length;
  frustrationCountByDay[days - 1] = critNow;

  const trendSparks = {
    passRateByDay: passRateByDay.map((v) => Number(v.toFixed(2))),
    dependencyByDay,
    frustrationCountByDay,
    submissionsByDay,
    today: {
      passRate: passRateByDay[days - 1]!,
      meanDependency: meanDep,
      frustrationCount: critNow,
      submissions: submittedAtsByDay.today,
    },
    yesterday: {
      passRate: passRateByDay[days - 2]!,
      submissions: submittedAtsByDay.yesterday,
    },
  };

  // ==========================================================================
  // KC Insight — 자동 요약 텍스트
  // ==========================================================================
  const summaryData = summarizeClassroom(cohortStudents, DEMO_COHORT_ID);
  const kcInsights: string[] = [];
  const kcEntries = Object.entries(summaryData.avgMasteryByKC).sort(
    (a, b) => a[1] - b[1],
  );
  if (kcEntries.length > 0) {
    const [weakestKC, weakestVal] = kcEntries[0]!;
    const belowThreshold = cards.filter(
      (c) => (cohortStudents.find((s) => s.id === c.id)?.mastery[weakestKC] ?? 0) < 0.5,
    ).length;
    kcInsights.push(
      `${weakestKC} 가 가장 낮음 (평균 ${weakestVal.toFixed(2)}, ${belowThreshold}/${cards.length}명 미달)`,
    );
  }
  if (kcEntries.length >= 2) {
    const [strongestKC, strongestVal] = kcEntries[kcEntries.length - 1]!;
    if (strongestVal >= 0.7) {
      kcInsights.push(
        `${strongestKC} 는 평균 ${strongestVal.toFixed(2)} 로 대부분 숙련 → 다음 KC 로 확장 가능`,
      );
    }
  }
  if (summaryData.weakKCs.length > 0) {
    kcInsights.push(`주의 KC: ${summaryData.weakKCs.slice(0, 3).join(", ")}`);
  }

  // ==========================================================================
  // Live Events 해석화 — 최근 5분간 주목할 만한 이벤트
  // ==========================================================================
  const FIVE_MIN = 5 * 60 * 1000;
  const interpretedEvents: Array<{
    at: string;
    icon: string;
    text: string;
    severity: "ok" | "warn" | "critical" | "info";
    studentId?: string;
  }> = [];
  for (const e of allEvents) {
    const ts = e.timestamp ? new Date(e.timestamp).getTime() : NaN;
    if (!Number.isFinite(ts) || now - ts > FIVE_MIN) continue;
    const verb = String(e.verb ?? "");
    const actorId =
      e.actor && typeof e.actor === "object" && "id" in e.actor
        ? String((e.actor as { id?: string }).id ?? "")
        : "";
    const name = nameById.get(actorId) ?? "";
    if (verb.endsWith("submission-passed")) {
      interpretedEvents.push({
        at: e.timestamp!,
        icon: "🟢",
        text: `${name} 제출 통과`,
        severity: "ok",
        studentId: actorId,
      });
    } else if (verb.endsWith("mode-decreased")) {
      interpretedEvents.push({
        at: e.timestamp!,
        icon: "✨",
        text: `${name} AI 모드 자발 하향 (SRL 신호)`,
        severity: "ok",
        studentId: actorId,
      });
    } else if (verb.endsWith("mode-changed")) {
      interpretedEvents.push({
        at: e.timestamp!,
        icon: "🔄",
        text: `${name} 모드 전환`,
        severity: "info",
        studentId: actorId,
      });
    }
  }
  // stuck loop / frustration high 도 추가
  for (const c of cards) {
    if (c.stuckLoop) {
      interpretedEvents.push({
        at: new Date().toISOString(),
        icon: "🟡",
        text: `${c.displayName} "${c.stuckLoop.term}" ${c.stuckLoop.repeat}회 반복`,
        severity: "warn",
        studentId: c.id,
      });
    }
    if (c.frustration >= 0.3) {
      interpretedEvents.push({
        at: new Date().toISOString(),
        icon: "🔴",
        text: `${c.displayName} 감정 지수 ${(c.frustration * 100).toFixed(0)}%`,
        severity: "critical",
        studentId: c.id,
      });
    }
  }
  const topInterpreted = interpretedEvents
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 8);

  return NextResponse.json({
    cohortId: DEMO_COHORT_ID,
    source,
    cards,
    atRisk,
    statusCounts,
    summary: summaryData,
    misconceptions: aggregateMisconceptions(cohortStudents, DEMO_COHORT_ID),
    today: {
      submissions: submittedAtsByDay.today,
      submissionsDelta,
      activeStudents: activeStudentsToday.size,
      totalStudents: students.length,
      recentNotable: recentNotableNamed,
    },
    actionCards: topActionCards,
    assignmentProgress: perAssignmentProgress,
    trendSparks,
    kcInsights,
    interpretedEvents: topInterpreted,
    generatedAt: new Date().toISOString(),
  });
}
