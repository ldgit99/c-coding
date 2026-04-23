import { NextResponse } from "next/server";

import {
  bootstrapCI,
  cohensD,
  describe as summarize,
  hashLearnerId,
  pearsonR,
} from "@cvibe/xapi";

/**
 * GET /api/research/self-explanation
 *
 * Paper 4 — Self-Explanation Quality & Transfer Gain.
 *
 * 데이터 소스:
 *  - xAPI events verb="self-explanation-submitted" · result.axes {specificity, causality, transfer}, overall
 *  - submissions: finalScore, passed (axes 제출 전/후로 매칭)
 *
 * 산출물:
 *  - 3축 descriptives (M, SD, median) + Pearson r (각축 vs finalScore)
 *  - Cohen's d (self-explanation 제출 vs 미제출 그룹의 finalScore)
 *  - Scatter: overall × finalScore
 *  - Histogram: 각 축 값 분포
 */

const STUDENT_URL =
  process.env.STUDENT_APP_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_STUDENT_APP_URL ??
  "http://localhost:3000";

interface Event {
  actor?: { id?: string };
  verb?: string;
  result?: Record<string, unknown>;
  timestamp?: string;
}

export async function GET() {
  let events: Event[] = [];
  try {
    const res = await fetch(`${STUDENT_URL}/api/analytics/dump`, { cache: "no-store" });
    if (res.ok) {
      const dump = (await res.json()) as { events?: Event[] };
      events = dump.events ?? [];
    }
  } catch {
    // ignore
  }

  interface SERow {
    studentIdHashed: string;
    specificity: number;
    causality: number;
    transfer: number;
    overall: number;
    at: string;
  }
  const selfExplanations: SERow[] = [];
  const submissionsByStudent = new Map<
    string,
    Array<{ finalScore: number; passed: boolean; at: string }>
  >();

  for (const e of events) {
    const actorId =
      e.actor && typeof e.actor === "object" && "id" in e.actor
        ? String((e.actor as { id?: string }).id ?? "")
        : "";
    if (!actorId) continue;
    const verb = String(e.verb ?? "");
    const r = (e.result ?? {}) as Record<string, unknown>;
    if (verb.endsWith("self-explanation-submitted")) {
      const axes = (r.axes ?? {}) as {
        specificity?: number;
        causality?: number;
        transfer?: number;
      };
      const overall = typeof r.overall === "number" ? r.overall : 0;
      selfExplanations.push({
        studentIdHashed: hashLearnerId(actorId),
        specificity: clamp(axes.specificity ?? 0),
        causality: clamp(axes.causality ?? 0),
        transfer: clamp(axes.transfer ?? 0),
        overall: clamp(overall),
        at: String(e.timestamp ?? ""),
      });
    } else if (
      verb.endsWith("submission-passed") ||
      verb.endsWith("submission-failed")
    ) {
      const score = typeof r.finalScore === "number" ? r.finalScore : 0;
      const passed = verb.endsWith("submission-passed");
      const arr = submissionsByStudent.get(actorId) ?? [];
      arr.push({ finalScore: score, passed, at: String(e.timestamp ?? "") });
      submissionsByStudent.set(actorId, arr);
    }
  }

  // 각 축 descriptives
  const desc = {
    specificity: summarize(selfExplanations.map((s) => s.specificity)),
    causality: summarize(selfExplanations.map((s) => s.causality)),
    transfer: summarize(selfExplanations.map((s) => s.transfer)),
    overall: summarize(selfExplanations.map((s) => s.overall)),
  };

  // Pearson r (학생 단위 평균 축 × 학생 단위 평균 finalScore)
  const perStudentAxes = new Map<
    string,
    { specificity: number[]; causality: number[]; transfer: number[]; overall: number[] }
  >();
  for (const se of selfExplanations) {
    const cur = perStudentAxes.get(se.studentIdHashed) ?? {
      specificity: [],
      causality: [],
      transfer: [],
      overall: [],
    };
    cur.specificity.push(se.specificity);
    cur.causality.push(se.causality);
    cur.transfer.push(se.transfer);
    cur.overall.push(se.overall);
    perStudentAxes.set(se.studentIdHashed, cur);
  }
  const perStudentScore = new Map<string, number>();
  for (const [sid, subs] of submissionsByStudent) {
    const h = hashLearnerId(sid);
    const avg = subs.length === 0 ? 0 : subs.reduce((a, b) => a + b.finalScore, 0) / subs.length;
    perStudentScore.set(h, avg);
  }

  const pairs: Array<{ h: string; axes: number; spec: number; caus: number; tran: number; ovr: number; score: number }> = [];
  for (const [h, ax] of perStudentAxes) {
    const score = perStudentScore.get(h) ?? null;
    if (score == null) continue;
    const avg = (arr: number[]) =>
      arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
    pairs.push({
      h,
      axes: ax.specificity.length,
      spec: avg(ax.specificity),
      caus: avg(ax.causality),
      tran: avg(ax.transfer),
      ovr: avg(ax.overall),
      score,
    });
  }

  const correlations = {
    specificity_vs_score: Number(
      pearsonR(pairs.map((p) => p.spec), pairs.map((p) => p.score)).toFixed(3),
    ),
    causality_vs_score: Number(
      pearsonR(pairs.map((p) => p.caus), pairs.map((p) => p.score)).toFixed(3),
    ),
    transfer_vs_score: Number(
      pearsonR(pairs.map((p) => p.tran), pairs.map((p) => p.score)).toFixed(3),
    ),
    overall_vs_score: Number(
      pearsonR(pairs.map((p) => p.ovr), pairs.map((p) => p.score)).toFixed(3),
    ),
  };

  // Cohen's d — 자기설명 제출한 학생 vs 아닌 학생의 평균 finalScore
  const submittedStudents = new Set(selfExplanations.map((s) => s.studentIdHashed));
  const submittedScores: number[] = [];
  const notSubmittedScores: number[] = [];
  for (const [sid, subs] of submissionsByStudent) {
    const h = hashLearnerId(sid);
    if (subs.length === 0) continue;
    const avg = subs.reduce((a, b) => a + b.finalScore, 0) / subs.length;
    if (submittedStudents.has(h)) submittedScores.push(avg);
    else notSubmittedScores.push(avg);
  }
  const dEffect = Number(cohensD(submittedScores, notSubmittedScores).toFixed(3));
  const submittedCI = bootstrapCI(
    submittedScores,
    (xs) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length),
    { iterations: 500, seed: 42 },
  );
  const notSubmittedCI = bootstrapCI(
    notSubmittedScores,
    (xs) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length),
    { iterations: 500, seed: 43 },
  );

  // Histogram binning (10 bins in [0, 1])
  const histogram = (vals: number[]): number[] => {
    const bins = new Array(10).fill(0);
    for (const v of vals) {
      const idx = Math.min(9, Math.max(0, Math.floor(v * 10)));
      bins[idx] += 1;
    }
    return bins;
  };
  const hist = {
    specificity: histogram(selfExplanations.map((s) => s.specificity)),
    causality: histogram(selfExplanations.map((s) => s.causality)),
    transfer: histogram(selfExplanations.map((s) => s.transfer)),
    overall: histogram(selfExplanations.map((s) => s.overall)),
  };

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    sample: {
      selfExplanations: selfExplanations.length,
      studentsWithSE: submittedStudents.size,
      studentsWithSubmissions: submissionsByStudent.size,
    },
    descriptives: desc,
    correlations,
    cohensD: dEffect,
    groupMeansCI: {
      submitted: submittedCI,
      notSubmitted: notSubmittedCI,
    },
    scatter: pairs.map((p) => ({
      studentIdHashed: p.h,
      axisMean: Number(p.ovr.toFixed(3)),
      finalScoreMean: Number(p.score.toFixed(3)),
      n: p.axes,
    })),
    histogram: hist,
  });
}

function clamp(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}
