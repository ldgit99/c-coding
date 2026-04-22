import { NextResponse } from "next/server";

import {
  DEMO_COHORT_ID,
  createServiceRoleClientIfAvailable,
  fetchClassroomData,
} from "@cvibe/db";
import {
  classifyUtterance,
  clusterCommonQuestions,
  computeLinguisticProfile,
  detectStuckLoop,
  frustrationScore,
  type QuestionType,
} from "@cvibe/xapi";

/**
 * GET /api/conversations — 교사 대화 분석 탭 데이터.
 *
 * 수집: 학생 앱 /api/analytics/dump → turns
 * 집계:
 *  - 학생별 요약(distribution, frustration, loop)
 *  - 전체 질문 유형 분포
 *  - 상위 공통 질문 클러스터
 *  - 레드플래그 목록(답 요청 다발, 막힘 루프, frustration 높음)
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
  source?: "supabase" | "memory";
}

export async function GET() {
  const supabase = createServiceRoleClientIfAvailable();
  const { students } = await fetchClassroomData(supabase, DEMO_COHORT_ID);
  const nameById = new Map(students.map((s) => [s.id, s.displayName] as const));

  let turns: DumpTurn[] = [];
  let source: "supabase" | "memory" = "memory";
  try {
    const res = await fetch(`${STUDENT_URL}/api/analytics/dump`, { cache: "no-store" });
    if (res.ok) {
      const dump = (await res.json()) as DumpResponse;
      turns = dump.turns ?? [];
      source = dump.source ?? "memory";
    }
  } catch {
    // ignore — empty turns
  }

  // 학생별 발화 그룹핑
  const byStudent = new Map<string, string[]>();
  for (const t of turns) {
    if (t.role !== "student") continue;
    const arr = byStudent.get(t.studentId) ?? [];
    arr.push(t.text);
    byStudent.set(t.studentId, arr);
  }

  const perStudent = Array.from(byStudent.entries()).map(([studentId, utters]) => {
    const distribution: Record<QuestionType, number> = {
      concept: 0,
      debug: 0,
      answer_request: 0,
      metacognitive: 0,
      other: 0,
    };
    for (const u of utters) distribution[classifyUtterance(u)] += 1;
    const frustration = Number(frustrationScore(utters).toFixed(2));
    const loop = detectStuckLoop(utters);
    const linguistic = computeLinguisticProfile(utters);
    return {
      studentId,
      displayName: nameById.get(studentId) ?? studentId,
      utteranceCount: utters.length,
      distribution,
      frustration,
      stuckLoop: loop.inLoop ? { term: loop.repeatedTerm ?? null, repeat: loop.repeatCount } : null,
      offloadingScore: Number(linguistic.offloadingScore.toFixed(2)),
      metacognitiveRate: Number(linguistic.metacognitiveRate.toFixed(2)),
    };
  });

  // 전체 분포
  const totalDistribution: Record<QuestionType, number> = {
    concept: 0,
    debug: 0,
    answer_request: 0,
    metacognitive: 0,
    other: 0,
  };
  for (const s of perStudent) {
    for (const k of Object.keys(s.distribution) as QuestionType[]) {
      totalDistribution[k] += s.distribution[k];
    }
  }

  // 공통 질문 클러스터
  const allStudentUtterances: string[] = [];
  for (const arr of byStudent.values()) allStudentUtterances.push(...arr);
  const clusters = clusterCommonQuestions(allStudentUtterances, {
    minClusterSize: 2,
    topK: 6,
  });

  // 레드플래그
  const redFlags: Array<{
    studentId: string;
    displayName: string;
    kind: "frustration" | "stuck_loop" | "answer_request";
    detail: string;
  }> = [];
  for (const s of perStudent) {
    if (s.frustration >= 0.3) {
      redFlags.push({
        studentId: s.studentId,
        displayName: s.displayName,
        kind: "frustration",
        detail: `감정 지수 ${(s.frustration * 100).toFixed(0)}%`,
      });
    }
    if (s.stuckLoop) {
      redFlags.push({
        studentId: s.studentId,
        displayName: s.displayName,
        kind: "stuck_loop",
        detail: `"${s.stuckLoop.term}" ${s.stuckLoop.repeat}회 반복`,
      });
    }
    const answerReq = s.distribution.answer_request;
    if (s.utteranceCount >= 3 && answerReq / s.utteranceCount >= 0.33) {
      redFlags.push({
        studentId: s.studentId,
        displayName: s.displayName,
        kind: "answer_request",
        detail: `답 요청 ${answerReq}/${s.utteranceCount}턴`,
      });
    }
  }

  return NextResponse.json({
    cohortId: DEMO_COHORT_ID,
    source,
    collectedTurns: turns.length,
    studentCount: perStudent.length,
    totalDistribution,
    perStudent: perStudent.sort((a, b) => b.utteranceCount - a.utteranceCount),
    clusters,
    redFlags,
    generatedAt: new Date().toISOString(),
  });
}
