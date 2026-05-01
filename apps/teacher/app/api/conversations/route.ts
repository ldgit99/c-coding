import { NextResponse } from "next/server";

import {
  ASSIGNMENTS,
  DEMO_COHORT_ID,
  createServiceRoleClientIfAvailable,
  fetchAnalyticsFromDb,
  fetchClassroomData,
} from "@cvibe/db";
import {
  classifyUtterance,
  clusterCommonQuestions,
  computeLinguisticProfile,
  detectStuckLoop,
  frustrationScore,
  isRealUtterance,
  type QuestionType,
} from "@cvibe/xapi";

/**
 * GET /api/conversations — 교사 대화 분석 탭 데이터.
 *
 * 수집: Supabase conversations 테이블 직접 SELECT (학생 앱 프록시 제거).
 * 집계:
 *  - 학생별 요약(distribution, frustration, loop)
 *  - 전체 질문 유형 분포
 *  - 상위 공통 질문 클러스터
 *  - 레드플래그 목록(답 요청 다발, 막힘 루프, frustration 높음)
 */

interface DumpTurn {
  studentId: string;
  assignmentId?: string;
  role: "student" | "ai" | "assistant";
  text: string;
  timestamp: string;
}

export async function GET(request: Request) {
  const supabase = createServiceRoleClientIfAvailable();
  const { students } = await fetchClassroomData(supabase, DEMO_COHORT_ID);
  const nameById = new Map(students.map((s) => [s.id, s.displayName] as const));
  const activeIds = students.map((s) => s.id);

  // `?assignmentId=A03_arrays_basic` 또는 'all' (기본).
  const url = new URL(request.url);
  const requestedAssignment = url.searchParams.get("assignmentId") ?? "all";

  let turns: DumpTurn[] = [];
  let source: "supabase" | "memory" = "memory";
  if (supabase && activeIds.length > 0) {
    const bundle = await fetchAnalyticsFromDb({
      client: supabase,
      studentIds: activeIds,
      turnLimit: 4000,
    });
    turns = bundle.turns.map((t) => ({
      studentId: t.studentId,
      assignmentId: t.assignmentId,
      role: t.role,
      text: t.text,
      timestamp: t.timestamp,
    }));
    source = "supabase";
  }

  // 과제별 집계 준비 — assignmentId 별 턴 수 (옵션 드롭다운 count 배지용).
  const turnCountByAssignment = new Map<string, number>();
  for (const t of turns) {
    if (t.role !== "student") continue;
    const key = t.assignmentId ?? "unscoped";
    turnCountByAssignment.set(key, (turnCountByAssignment.get(key) ?? 0) + 1);
  }

  // 필터링 — 특정 과제만 분석하려는 경우
  const filteredTurns =
    requestedAssignment === "all"
      ? turns
      : turns.filter((t) => (t.assignmentId ?? "unscoped") === requestedAssignment);

  // 학생별 발화 그룹핑 — 시스템 프리셋(단축 버튼·자동 메시지) 제외해야 통계 정확
  const byStudent = new Map<string, string[]>();
  const byStudentAll = new Map<string, string[]>(); // 프리셋 포함 (총 턴 수 계산용)
  for (const t of filteredTurns) {
    if (t.role !== "student") continue;
    const allArr = byStudentAll.get(t.studentId) ?? [];
    allArr.push(t.text);
    byStudentAll.set(t.studentId, allArr);
    if (!isRealUtterance(t.text)) continue;
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

  // 과제 × 질문유형 히트맵 — 전체 데이터 기준 (필터와 무관, 커리큘럼 관점)
  type HeatmapCell = Record<QuestionType, number>;
  const heatmap: Array<{ assignmentCode: string; title: string; counts: HeatmapCell; total: number }> = [];
  for (const a of ASSIGNMENTS) {
    const cell: HeatmapCell = {
      concept: 0,
      debug: 0,
      answer_request: 0,
      metacognitive: 0,
      other: 0,
    };
    let total = 0;
    for (const t of turns) {
      if (t.role !== "student") continue;
      if ((t.assignmentId ?? "") !== a.code) continue;
      if (!isRealUtterance(t.text)) continue;
      cell[classifyUtterance(t.text)] += 1;
      total += 1;
    }
    heatmap.push({
      assignmentCode: a.code,
      title: a.title,
      counts: cell,
      total,
    });
  }

  // 반 평균 (perStudent 기준)
  const cohortAverages = (() => {
    const n = perStudent.length;
    if (n === 0) {
      return { frustration: 0, offloadingScore: 0, metacognitiveRate: 0 };
    }
    const sum = perStudent.reduce(
      (acc, s) => ({
        frustration: acc.frustration + s.frustration,
        offloadingScore: acc.offloadingScore + s.offloadingScore,
        metacognitiveRate: acc.metacognitiveRate + s.metacognitiveRate,
      }),
      { frustration: 0, offloadingScore: 0, metacognitiveRate: 0 },
    );
    return {
      frustration: Number((sum.frustration / n).toFixed(2)),
      offloadingScore: Number((sum.offloadingScore / n).toFixed(2)),
      metacognitiveRate: Number((sum.metacognitiveRate / n).toFixed(2)),
    };
  })();

  // 요약 스트립 — 임계치 기반 학생 카운트
  const summaryStrip = {
    offloadingHigh: perStudent.filter((s) => s.offloadingScore >= 0.35).length,
    offloadingMid: perStudent.filter(
      (s) => s.offloadingScore >= 0.2 && s.offloadingScore < 0.35,
    ).length,
    offloadingLow: perStudent.filter((s) => s.offloadingScore < 0.2).length,
    frustrationAlert: perStudent.filter((s) => s.frustration >= 0.3).length,
    metacognitiveActive: perStudent.filter((s) => s.metacognitiveRate >= 0.15).length,
    stuckLoop: perStudent.filter((s) => s.stuckLoop).length,
    totalStudents: perStudent.length,
  };

  // 드롭다운 옵션 — 과제 카탈로그 + "전체" + 과제당 턴 수.
  const assignmentOptions = [
    {
      value: "all",
      label: "전체 과제",
      turnCount: Array.from(turnCountByAssignment.values()).reduce((a, b) => a + b, 0),
    },
    ...ASSIGNMENTS.map((a) => ({
      value: a.code,
      label: `${a.code.split("_")[0] ?? a.code} · ${a.title}`,
      turnCount: turnCountByAssignment.get(a.code) ?? 0,
    })),
  ];

  return NextResponse.json({
    cohortId: DEMO_COHORT_ID,
    source,
    assignmentFilter: requestedAssignment,
    assignmentOptions,
    collectedTurns: filteredTurns.length,
    studentCount: perStudent.length,
    totalDistribution,
    perStudent: perStudent.sort((a, b) => b.utteranceCount - a.utteranceCount),
    clusters,
    redFlags,
    heatmap,
    cohortAverages,
    summaryStrip,
    generatedAt: new Date().toISOString(),
  });
}
