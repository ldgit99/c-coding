import { NextResponse } from "next/server";

import {
  classifyArc,
  classifyUtterance,
  hashLearnerId,
  isRealUtterance,
  pca2D,
  type ArcType,
  type QuestionType,
} from "@cvibe/xapi";

/**
 * GET /api/research/conversation-arcs
 *
 * Paper 6 — Conversation Arc Taxonomy
 *
 * Per-session (student-level aggregate):
 *  - Question-type 시퀀스 → 5 arc type 분류 (규칙 기반)
 *  - 5D 질문유형 빈도 벡터 → PCA 2D projection
 *  - Arc × outcome 집계
 */

const STUDENT_URL =
  process.env.STUDENT_APP_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_STUDENT_APP_URL ??
  "http://localhost:3000";

interface Turn {
  studentId: string;
  role: "student" | "ai" | "assistant";
  text: string;
  timestamp: string;
}

interface Event {
  actor?: { id?: string };
  verb?: string;
  timestamp?: string;
}

const TYPES: QuestionType[] = [
  "concept",
  "debug",
  "answer_request",
  "metacognitive",
  "other",
];

export async function GET() {
  let turns: Turn[] = [];
  let events: Event[] = [];
  try {
    const res = await fetch(`${STUDENT_URL}/api/analytics/dump`, { cache: "no-store" });
    if (res.ok) {
      const dump = (await res.json()) as {
        turns?: Turn[];
        events?: Event[];
      };
      turns = dump.turns ?? [];
      events = dump.events ?? [];
    }
  } catch {
    // ignore
  }

  // 학생별 시퀀스 (type 열) + 지속시간
  const byStudent = new Map<
    string,
    { types: QuestionType[]; firstAt: string; lastAt: string }
  >();
  for (const t of turns) {
    if (t.role !== "student") continue;
    if (!isRealUtterance(t.text)) continue;
    const type = classifyUtterance(t.text);
    const cur = byStudent.get(t.studentId);
    if (!cur) {
      byStudent.set(t.studentId, {
        types: [type],
        firstAt: t.timestamp,
        lastAt: t.timestamp,
      });
    } else {
      cur.types.push(type);
      cur.lastAt = t.timestamp;
    }
  }

  // Passed 여부
  const passedByStudent = new Map<string, boolean>();
  const submittedByStudent = new Map<string, number>();
  for (const e of events) {
    const actorId =
      e.actor && typeof e.actor === "object" && "id" in e.actor
        ? String((e.actor as { id?: string }).id ?? "")
        : "";
    if (!actorId) continue;
    const verb = String(e.verb ?? "");
    if (verb.endsWith("submission-passed")) {
      passedByStudent.set(actorId, true);
      submittedByStudent.set(actorId, (submittedByStudent.get(actorId) ?? 0) + 1);
    } else if (verb.endsWith("submission-failed")) {
      if (!passedByStudent.get(actorId)) passedByStudent.set(actorId, false);
      submittedByStudent.set(actorId, (submittedByStudent.get(actorId) ?? 0) + 1);
    }
  }

  // 분류 + 벡터화
  const rows = Array.from(byStudent.entries()).map(([sid, data]) => {
    const durationMs =
      new Date(data.lastAt).getTime() - new Date(data.firstAt).getTime();
    const durationMin = Math.max(0, durationMs / 60000);
    const classification = classifyArc({
      studentId: hashLearnerId(sid),
      types: data.types,
      passed: passedByStudent.get(sid) ?? false,
      submittedCount: submittedByStudent.get(sid) ?? 0,
      durationMin,
    });
    // 5D 벡터 (각 타입 비율) — PCA input
    const n = data.types.length;
    const counts: Record<QuestionType, number> = {
      concept: 0,
      debug: 0,
      answer_request: 0,
      metacognitive: 0,
      other: 0,
    };
    for (const t of data.types) counts[t] += 1;
    const vec = TYPES.map((t) => (n === 0 ? 0 : counts[t] / n));
    return { row: classification, vec };
  });

  const projection = pca2D(rows.map((r) => r.vec));

  // Arc × outcome 집계
  const arcSummary: Record<
    ArcType,
    { n: number; passed: number; failed: number; meanDurationMin: number; meanTurns: number }
  > = {
    productive: { n: 0, passed: 0, failed: 0, meanDurationMin: 0, meanTurns: 0 },
    stuck_loop: { n: 0, passed: 0, failed: 0, meanDurationMin: 0, meanTurns: 0 },
    answer_seek: { n: 0, passed: 0, failed: 0, meanDurationMin: 0, meanTurns: 0 },
    wandering: { n: 0, passed: 0, failed: 0, meanDurationMin: 0, meanTurns: 0 },
    solo_confident: { n: 0, passed: 0, failed: 0, meanDurationMin: 0, meanTurns: 0 },
  };
  for (const r of rows) {
    const s = arcSummary[r.row.arc];
    s.n += 1;
    if (r.row.passed) s.passed += 1;
    else s.failed += 1;
    s.meanDurationMin += r.row.durationMin;
    s.meanTurns += r.row.n;
  }
  for (const key of Object.keys(arcSummary) as ArcType[]) {
    const s = arcSummary[key];
    if (s.n > 0) {
      s.meanDurationMin = Number((s.meanDurationMin / s.n).toFixed(1));
      s.meanTurns = Number((s.meanTurns / s.n).toFixed(1));
    }
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    sample: {
      students: rows.length,
      utterances: rows.reduce((a, r) => a + r.row.n, 0),
      passedMarked: Array.from(passedByStudent.values()).filter(Boolean).length,
    },
    rows: rows.map((r, i) => ({
      ...r.row,
      pcX: projection[i]?.x ?? 0,
      pcY: projection[i]?.y ?? 0,
    })),
    arcSummary,
  });
}
