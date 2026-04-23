import { NextResponse } from "next/server";

import {
  classifyUtterance,
  cramerV,
  hashLearnerId,
  isRealUtterance,
  shannonEntropy,
  transitionMatrix,
  type QuestionType,
} from "@cvibe/xapi";

/**
 * GET /api/research/question-dynamics
 *
 * Paper 3 — Question Type Dynamics in ZPD-Calibrated Tutoring
 *
 * 산출물:
 *  - 5x5 Markov transition matrix (concept/debug/answer_request/metacognitive/other)
 *  - 학생별 질문유형 엔트로피
 *  - 질문유형 × 성과(pass/fail) contingency + Cramér's V
 *  - 시계열: 세션 시작부터 첫 통과까지의 유형 비율 (10-min bins)
 */

const STUDENT_URL =
  process.env.STUDENT_APP_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_STUDENT_APP_URL ??
  "http://localhost:3000";

const TYPES: QuestionType[] = [
  "concept",
  "debug",
  "answer_request",
  "metacognitive",
  "other",
];

interface Turn {
  studentId: string;
  assignmentId?: string;
  role: "student" | "ai" | "assistant";
  text: string;
  timestamp: string;
}

interface Event {
  actor?: { id?: string };
  verb?: string;
  object?: Record<string, unknown>;
  result?: Record<string, unknown>;
  timestamp?: string;
}

export async function GET() {
  let turns: Turn[] = [];
  let events: Event[] = [];
  let source = "memory";
  try {
    const res = await fetch(`${STUDENT_URL}/api/analytics/dump`, { cache: "no-store" });
    if (res.ok) {
      const dump = (await res.json()) as {
        turns?: Turn[];
        events?: Event[];
        source?: string;
      };
      turns = dump.turns ?? [];
      events = dump.events ?? [];
      source = dump.source ?? "memory";
    }
  } catch {
    // ignore
  }

  // 학생별 실제 발화 시퀀스 (type, timestamp)
  const byStudent = new Map<
    string,
    Array<{ type: QuestionType; at: string; assignmentId?: string }>
  >();
  for (const t of turns) {
    if (t.role !== "student") continue;
    if (!isRealUtterance(t.text)) continue;
    const type = classifyUtterance(t.text);
    const arr = byStudent.get(t.studentId) ?? [];
    arr.push({ type, at: t.timestamp, assignmentId: t.assignmentId });
    byStudent.set(t.studentId, arr);
  }

  // 전체 타입 시퀀스 (학생 경계 제외) → Markov transition
  const allSequence: QuestionType[] = [];
  for (const [, seq] of byStudent) {
    for (const s of seq) allSequence.push(s.type);
  }
  const { matrix, counts } = transitionMatrix(allSequence, TYPES);

  // 학생별 entropy (전체 발화 분포)
  const entropyPerStudent: Array<{
    studentIdHashed: string;
    n: number;
    entropyBits: number;
    dominantType: QuestionType | null;
  }> = [];
  for (const [sid, seq] of byStudent) {
    const counts: Record<QuestionType, number> = {
      concept: 0,
      debug: 0,
      answer_request: 0,
      metacognitive: 0,
      other: 0,
    };
    for (const s of seq) counts[s.type] += 1;
    const vec = TYPES.map((t) => counts[t]);
    const h = shannonEntropy(vec);
    let dominant: QuestionType | null = null;
    let best = 0;
    for (const t of TYPES) {
      if (counts[t] > best) {
        best = counts[t];
        dominant = t;
      }
    }
    entropyPerStudent.push({
      studentIdHashed: hashLearnerId(sid),
      n: seq.length,
      entropyBits: Number(h.toFixed(3)),
      dominantType: dominant,
    });
  }
  entropyPerStudent.sort((a, b) => b.n - a.n);

  // 학생별 submission outcome (passed / failed) → type × outcome contingency
  // 한 학생의 dominantType 에 그 학생의 pass 여부를 곱해 2D contingency.
  // 간단화: pass 이벤트 하나라도 있으면 passed 로 집계.
  const passedByStudent = new Map<string, boolean>();
  for (const e of events) {
    const verb = String(e.verb ?? "");
    const actorId =
      e.actor && typeof e.actor === "object" && "id" in e.actor
        ? String((e.actor as { id?: string }).id ?? "")
        : "";
    if (!actorId) continue;
    if (verb.endsWith("submission-passed") || verb === "submissionPassed") {
      passedByStudent.set(actorId, true);
    } else if (
      !passedByStudent.get(actorId) &&
      (verb.endsWith("submission-failed") || verb === "submissionFailed")
    ) {
      passedByStudent.set(actorId, false);
    }
  }
  // Contingency: rows = 5 question types (dominant), cols = [passed, failed]
  const contingency: number[][] = TYPES.map(() => [0, 0]);
  for (const sid of byStudent.keys()) {
    const dom = entropyPerStudent.find((e) => e.studentIdHashed === hashLearnerId(sid));
    if (!dom || !dom.dominantType) continue;
    const rowIdx = TYPES.indexOf(dom.dominantType);
    const passed = passedByStudent.get(sid);
    if (passed === true) contingency[rowIdx]![0]! += 1;
    else if (passed === false) contingency[rowIdx]![1]! += 1;
  }
  const cv = cramerV(contingency);

  // 시간 binning (10-min bins, 0~60min). 세션 시작 = 학생 첫 turn timestamp.
  const binCount = 6;
  const binMs = 10 * 60 * 1000;
  const typeBinTotals: Record<QuestionType, number[]> = {
    concept: new Array(binCount).fill(0),
    debug: new Array(binCount).fill(0),
    answer_request: new Array(binCount).fill(0),
    metacognitive: new Array(binCount).fill(0),
    other: new Array(binCount).fill(0),
  };
  const totalPerBin = new Array(binCount).fill(0);
  for (const [, seq] of byStudent) {
    if (seq.length === 0) continue;
    const start = new Date(seq[0]!.at).getTime();
    for (const turn of seq) {
      const elapsed = new Date(turn.at).getTime() - start;
      const bin = Math.min(binCount - 1, Math.max(0, Math.floor(elapsed / binMs)));
      typeBinTotals[turn.type]![bin]! += 1;
      totalPerBin[bin]! += 1;
    }
  }
  const typeRateSeries = TYPES.map((t) => ({
    type: t,
    rates: typeBinTotals[t].map((v, i) => ((totalPerBin[i] ?? 0) > 0 ? v / (totalPerBin[i] ?? 1) : 0)),
  }));

  return NextResponse.json({
    source,
    sample: {
      students: byStudent.size,
      utterances: allSequence.length,
      eventsSeen: events.length,
      passedMarked: Array.from(passedByStudent.values()).filter(Boolean).length,
    },
    types: TYPES,
    transitionMatrix: matrix,
    transitionCounts: counts,
    entropyPerStudent,
    contingency,
    cramerV: cv,
    timeBins: {
      binMs,
      binCount,
      totalPerBin,
      typeRateSeries,
    },
    generatedAt: new Date().toISOString(),
  });
}
