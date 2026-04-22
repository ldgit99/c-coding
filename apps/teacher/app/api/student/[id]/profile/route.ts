import { NextResponse } from "next/server";

import {
  DEMO_COHORT_ID,
  DEMO_STUDENTS,
  createServiceRoleClientIfAvailable,
  fetchClassroomData,
} from "@cvibe/db";
import {
  classifyUtterance,
  computeLinguisticProfile,
  detectCopyPasteRedFlag,
  detectStuckLoop,
  frustrationScore,
  type QuestionType,
} from "@cvibe/xapi";

/**
 * GET /api/student/[id]/profile — 학생 상세 페이지 보강 데이터.
 *
 * 기본 `/api/student/[id]` 는 mastery·misconceptions·submissions 만 반환.
 * 이 엔드포인트는 conversations 를 끌어와 대화 파생 신호를 계산해 붙인다.
 *
 * 반환:
 *   - questionDistribution: 질문 유형 분포
 *   - frustration / offloading / metacognitiveRate
 *   - stuckLoop / copyPasteFlag (latest)
 *   - supportLadder: hintLevel × acceptance (AI 턴 meta 에서 집계)
 */

const STUDENT_URL =
  process.env.STUDENT_APP_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_STUDENT_APP_URL ??
  "http://localhost:3000";

interface Turn {
  id: string;
  studentId: string;
  role: "student" | "ai" | "assistant";
  text: string;
  timestamp: string;
  assignmentId?: string;
  meta?: {
    hintLevel?: 1 | 2 | 3 | 4;
    hintType?: string;
    mode?: string;
    usedModel?: string;
    blockedBySafety?: boolean;
  };
}

interface Submission {
  assignmentId: string;
  finalScore: number | null;
  passed: boolean;
  submittedAt: string;
  errorTypes: string[];
  stagnationSec: number;
  hintRequestsL3L4: number;
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = createServiceRoleClientIfAvailable();
  const { students, source } = await fetchClassroomData(supabase, DEMO_COHORT_ID);
  let student = students.find((s) => s.id === id);
  if (!student && source === "demo") {
    student = DEMO_STUDENTS.find((s) => s.id === id);
  }
  if (!student) {
    return NextResponse.json({ error: "student not found", source }, { status: 404 });
  }

  // 대화 로그 프록시 호출
  let turns: Turn[] = [];
  try {
    const res = await fetch(
      `${STUDENT_URL}/api/conversations?studentId=${encodeURIComponent(id)}&limit=200`,
      { cache: "no-store" },
    );
    if (res.ok) {
      const data = (await res.json()) as { turns?: Turn[] };
      turns = data.turns ?? [];
    }
  } catch {
    // ignore
  }

  const studentTexts = turns.filter((t) => t.role === "student").map((t) => t.text);
  const aiTurns = turns.filter((t) => t.role === "ai" || t.role === "assistant");

  // 질문 유형 분포
  const questionDistribution: Record<QuestionType, number> = {
    concept: 0,
    debug: 0,
    answer_request: 0,
    metacognitive: 0,
    other: 0,
  };
  for (const t of studentTexts) questionDistribution[classifyUtterance(t)] += 1;

  const frustration = Number(frustrationScore(studentTexts).toFixed(2));
  const loop = detectStuckLoop(studentTexts);
  const linguistic = computeLinguisticProfile(studentTexts);

  // Support Ladder — AI 턴 중 hintLevel 집계
  const supportLadder = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<1 | 2 | 3 | 4, number>;
  for (const t of aiTurns) {
    const l = t.meta?.hintLevel;
    if (l && l >= 1 && l <= 4) supportLadder[l] += 1;
  }

  // Copy-paste flag — 각 submission 의 제출 시각 vs 직전 AI 턴 시각
  const submissions = (student.recentSubmissions as Submission[]) ?? [];
  const copyPasteFlags = submissions.map((s) => {
    const aiBefore = [...aiTurns]
      .filter((t) => new Date(t.timestamp).getTime() <= new Date(s.submittedAt).getTime())
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .at(-1);
    const res = detectCopyPasteRedFlag({
      lastAssistantTurnAt: aiBefore?.timestamp ?? null,
      lastSubmissionAt: s.submittedAt,
      reflectionLength: 50, // 실제 reflection length 는 /api/submit 쪽에 있음. 여기선 30자 flag 비활성화.
    });
    return {
      assignmentId: s.assignmentId,
      submittedAt: s.submittedAt,
      gapSec: res.gapSec,
      suspected: res.suspectedCopy,
    };
  });

  const latestSuspected = copyPasteFlags.find((f) => f.suspected) ?? null;

  // Conversation Arc — assignment 단위로 묶고 role 이 번갈아 나타나는 흐름
  const arcsByAssignment = new Map<string, Turn[]>();
  for (const t of turns) {
    const a = t.assignmentId ?? "unscoped";
    const arr = arcsByAssignment.get(a) ?? [];
    arr.push(t);
    arcsByAssignment.set(a, arr);
  }
  const conversationArcs = Array.from(arcsByAssignment.entries())
    .map(([assignmentId, list]) => {
      const sorted = [...list].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const first = sorted[0]?.timestamp ?? null;
      const last = sorted.at(-1)?.timestamp ?? null;
      return {
        assignmentId,
        turnCount: sorted.length,
        startedAt: first,
        lastAt: last,
        hintRequests: sorted.filter((t) => t.meta?.hintLevel).length,
      };
    })
    .sort((a, b) => (a.lastAt ?? "").localeCompare(b.lastAt ?? "") * -1);

  return NextResponse.json({
    student,
    source,
    conversation: {
      turnCount: turns.length,
      studentUtteranceCount: studentTexts.length,
      questionDistribution,
      frustration,
      offloadingScore: Number(linguistic.offloadingScore.toFixed(2)),
      metacognitiveRate: Number(linguistic.metacognitiveRate.toFixed(2)),
      avgUtteranceLength: linguistic.avgLength,
      stuckLoop: loop.inLoop
        ? { term: loop.repeatedTerm ?? null, repeat: loop.repeatCount }
        : null,
    },
    supportLadder,
    copyPasteFlags,
    latestSuspectedCopyPaste: latestSuspected,
    conversationArcs,
    generatedAt: new Date().toISOString(),
  });
}
