import { NextResponse } from "next/server";

import {
  aggregateMisconceptions,
  buildInterventionQueue,
  summarizeClassroom,
  type StudentData,
} from "@cvibe/agents";
import {
  DEMO_COHORT_ID,
  createServiceRoleClientIfAvailable,
  fetchAnalyticsFromDb,
  fetchClassroomData,
} from "@cvibe/db";
import {
  classifyUtterance,
  detectStuckLoop,
  frustrationScore,
} from "@cvibe/xapi";

/**
 * GET /api/queue — 개입 큐(긴급도 재정렬) + 대화 파생 신호 결합.
 *
 * 점수: urgency = baseLevel + frustration + stuckLoop + answerRequestRate
 * 각 항목은 0~1 정규화 후 가중합.
 *
 * buildInterventionQueue 의 트리거(반복 오류·L3/L4 힌트·의존도 상승·misconception)
 * 만으로는 turn 기반 신호(frustration·stuckLoop·연속실패) 학생을 못 잡아 큐가
 * 비기 쉽다. overview 의 health 분류와 동일한 신호 셋으로 보강한다.
 */

interface QueueItem {
  studentId: string;
  displayName: string;
  level: "weak" | "medium" | "strong";
  reasons: string[];
  suggestedActions: Array<{ label: string; params?: Record<string, unknown> }>;
  signals: {
    frustration: number;
    stuckLoop: { term: string | null; repeat: number } | null;
    answerRequestRate: number;
    recentUtteranceCount: number;
  };
  urgency: number;
}

export async function GET() {
  const supabase = createServiceRoleClientIfAvailable();
  const { students } = await fetchClassroomData(supabase, DEMO_COHORT_ID);
  const cohortStudents = students as unknown as StudentData[];

  const rawQueue = buildInterventionQueue(cohortStudents, DEMO_COHORT_ID);
  const rawById = new Map(rawQueue.map((q) => [q.studentId, q] as const));

  // 학생 발화를 Supabase 직접 조회 — overview 와 동일 경로(권위) + 7일 이내.
  const turnsByStudent = new Map<string, string[]>();
  if (supabase && students.length > 0) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const bundle = await fetchAnalyticsFromDb({
      client: supabase,
      studentIds: students.map((s) => s.id),
      since,
      turnLimit: 4000,
      eventLimit: 1,
    });
    for (const t of bundle.turns) {
      if (t.role !== "student") continue;
      const arr = turnsByStudent.get(t.studentId) ?? [];
      arr.push(t.text);
      turnsByStudent.set(t.studentId, arr);
    }
  }

  const enriched: QueueItem[] = [];
  for (const s of students) {
    const utters = turnsByStudent.get(s.id) ?? [];
    const frustration = frustrationScore(utters);
    const loop = detectStuckLoop(utters);
    let answerReqHits = 0;
    for (const u of utters) {
      if (classifyUtterance(u) === "answer_request") answerReqHits += 1;
    }
    const answerReqRate = utters.length > 0 ? answerReqHits / utters.length : 0;

    const recent = [...s.recentSubmissions].sort((a, b) =>
      b.submittedAt.localeCompare(a.submittedAt),
    );
    const last3 = recent.slice(0, 3);
    const last3AllFail = last3.length === 3 && last3.every((r) => !r.passed);

    const masteryValues = Object.values(s.mastery);
    const avgMastery =
      masteryValues.length > 0
        ? masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length
        : 0;
    const latestDep = s.dependencyFactorHistory.at(-1) ?? 0;

    // buildInterventionQueue 가 잡은 reasons 베이스 + turn/제출 신호로 확장
    const base = rawById.get(s.id);
    const reasons: string[] = base ? [...base.reasons] : [];

    if (loop.inLoop) {
      reasons.push(`막힘 루프 "${loop.repeatedTerm}" ×${loop.repeatCount}`);
    }
    if (frustration >= 0.3) {
      reasons.push(`감정 지수 ${(frustration * 100).toFixed(0)}%`);
    }
    if (last3AllFail) {
      reasons.push("최근 3제출 연속 미통과");
    }
    if (answerReqRate >= 0.3 && utters.length >= 5) {
      reasons.push(`답 요청 비율 ${(answerReqRate * 100).toFixed(0)}%`);
    }
    if (avgMastery > 0 && avgMastery < 0.4) {
      reasons.push(`평균 숙련도 ${avgMastery.toFixed(2)}`);
    }
    if (latestDep >= 0.5) {
      reasons.push(`의존도 ${latestDep.toFixed(2)}`);
    }

    if (reasons.length === 0) continue;

    // level: 강한 신호(루프·감정·연속실패) 가 있거나 reasons ≥ 3 → strong
    //        2 개 → medium, 1 개 → weak. base 가 strong 이면 그대로 유지.
    const hardSignals =
      (loop.inLoop ? 1 : 0) + (frustration >= 0.3 ? 1 : 0) + (last3AllFail ? 1 : 0);
    const level: "weak" | "medium" | "strong" =
      base?.level === "strong" || hardSignals >= 2 || reasons.length >= 3
        ? "strong"
        : reasons.length === 2 || hardSignals === 1
          ? "medium"
          : "weak";

    const baseLevelScore = level === "strong" ? 1 : level === "medium" ? 0.6 : 0.3;
    const loopScore = loop.inLoop ? Math.min(1, loop.repeatCount / 6) : 0;
    const failScore = last3AllFail ? 0.8 : 0;
    const urgency =
      0.4 * baseLevelScore +
      0.2 * frustration +
      0.15 * loopScore +
      0.15 * failScore +
      0.1 * answerReqRate;

    enriched.push({
      studentId: s.id,
      displayName: s.displayName,
      level,
      reasons,
      suggestedActions:
        base?.suggestedActions ??
        defaultSuggestedActions(level, loop.inLoop, frustration >= 0.3),
      signals: {
        frustration: Number(frustration.toFixed(2)),
        stuckLoop: loop.inLoop
          ? { term: loop.repeatedTerm ?? null, repeat: loop.repeatCount }
          : null,
        answerRequestRate: Number(answerReqRate.toFixed(2)),
        recentUtteranceCount: utters.length,
      },
      urgency: Number(urgency.toFixed(3)),
    });
  }
  enriched.sort((a, b) => b.urgency - a.urgency);

  return NextResponse.json({
    cohortId: DEMO_COHORT_ID,
    queue: enriched,
    summary: summarizeClassroom(cohortStudents, DEMO_COHORT_ID),
    misconceptions: aggregateMisconceptions(cohortStudents, DEMO_COHORT_ID).slice(0, 5),
    generatedAt: new Date().toISOString(),
  });
}

function defaultSuggestedActions(
  level: "weak" | "medium" | "strong",
  inLoop: boolean,
  highFrustration: boolean,
): Array<{ label: string; params?: Record<string, unknown> }> {
  const actions: Array<{ label: string; params?: Record<string, unknown> }> = [];
  if (level === "strong") {
    actions.push({ label: "AI 모드를 coach 로 올려 직접 개입", params: { mode: "coach" } });
    actions.push({ label: "쪽지로 직접 힌트 주입" });
  } else if (level === "medium") {
    actions.push({ label: "AI 모드를 pair 로 고정", params: { mode: "pair" } });
  } else {
    actions.push({ label: "관찰 (solo 권장)", params: { mode: "solo" } });
  }
  if (inLoop) actions.push({ label: "막힘 루프 — 같은 KC 다른 variant 제시" });
  if (highFrustration) actions.push({ label: "짧은 격려 메시지 + 쉬는 시간 권유" });
  return actions;
}
