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
 * 각 항목은 0~1 정규화 후 가중합. 정렬만 바꿀 뿐, 원 reasons 는 유지.
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

export async function GET() {
  const supabase = createServiceRoleClientIfAvailable();
  const { students } = await fetchClassroomData(supabase, DEMO_COHORT_ID);
  const cohortStudents = students as unknown as StudentData[];

  const rawQueue = buildInterventionQueue(cohortStudents, DEMO_COHORT_ID);

  // 학생 발화를 학생 앱 dump에서 수집
  let turnsByStudent = new Map<string, string[]>();
  try {
    const res = await fetch(`${STUDENT_URL}/api/analytics/dump`, { cache: "no-store" });
    if (res.ok) {
      const dump = (await res.json()) as DumpResponse;
      for (const t of dump.turns ?? []) {
        if (t.role !== "student") continue;
        const arr = turnsByStudent.get(t.studentId) ?? [];
        arr.push(t.text);
        turnsByStudent.set(t.studentId, arr);
      }
    }
  } catch {
    // 학생 앱 접근 실패 시 대화 신호 없이 진행
    turnsByStudent = new Map();
  }

  const enriched = rawQueue.map((item) => {
    const utters = turnsByStudent.get(item.studentId) ?? [];
    const frustration = frustrationScore(utters);
    const loop = detectStuckLoop(utters);
    let answerReqHits = 0;
    for (const u of utters) {
      if (classifyUtterance(u) === "answer_request") answerReqHits += 1;
    }
    const answerReqRate = utters.length > 0 ? answerReqHits / utters.length : 0;
    const baseLevelScore = item.level === "strong" ? 1 : item.level === "medium" ? 0.6 : 0.3;
    const loopScore = loop.inLoop ? Math.min(1, loop.repeatCount / 6) : 0;
    const urgency =
      0.45 * baseLevelScore +
      0.25 * frustration +
      0.2 * loopScore +
      0.1 * answerReqRate;
    return {
      ...item,
      signals: {
        frustration: Number(frustration.toFixed(2)),
        stuckLoop: loop.inLoop
          ? { term: loop.repeatedTerm ?? null, repeat: loop.repeatCount }
          : null,
        answerRequestRate: Number(answerReqRate.toFixed(2)),
        recentUtteranceCount: utters.length,
      },
      urgency: Number(urgency.toFixed(3)),
    };
  });
  enriched.sort((a, b) => b.urgency - a.urgency);

  return NextResponse.json({
    cohortId: DEMO_COHORT_ID,
    queue: enriched,
    summary: summarizeClassroom(cohortStudents, DEMO_COHORT_ID),
    misconceptions: aggregateMisconceptions(cohortStudents, DEMO_COHORT_ID).slice(0, 5),
    generatedAt: new Date().toISOString(),
  });
}
