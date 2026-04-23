/**
 * Conversation Arc Taxonomy — Paper 6.
 *
 * Per-student 세션 시퀀스를 5 canonical arc 로 분류.
 * 규칙 기반 (no LLM) — 재현가능, 순수 함수.
 *
 * Arc types:
 *  - productive   : concept → debug → metacognitive → pass
 *  - stuck_loop   : same-type (예: debug) 3회 이상 반복 → fail 또는 unresolved
 *  - answer_seek  : answer_request ≥ 40% + <2 metacognitive → pass 여부 무관
 *  - wandering   : entropy 높음(≥1.8) + 제출 없음
 *  - solo_confident: 턴 <3 이고 제출 통과 (조용히 풀어낸 경우)
 */

import type { QuestionType } from "./conversation";
import { shannonEntropy } from "./effect-sizes";

export type ArcType =
  | "productive"
  | "stuck_loop"
  | "answer_seek"
  | "wandering"
  | "solo_confident";

export interface ArcClassificationInput {
  studentId: string;
  types: QuestionType[]; // 시간순 질문 유형
  passed: boolean;
  submittedCount: number;
  durationMin: number; // 첫 turn 부터 마지막 이벤트까지
}

export interface ArcRow {
  studentId: string;
  arc: ArcType;
  n: number;
  passed: boolean;
  durationMin: number;
  entropyBits: number;
  dominantType: QuestionType | null;
  answerReqRate: number;
  metacogRate: number;
}

const TYPES: QuestionType[] = [
  "concept",
  "debug",
  "answer_request",
  "metacognitive",
  "other",
];

export function classifyArc(input: ArcClassificationInput): ArcRow {
  const counts: Record<QuestionType, number> = {
    concept: 0,
    debug: 0,
    answer_request: 0,
    metacognitive: 0,
    other: 0,
  };
  for (const t of input.types) counts[t] += 1;
  const n = input.types.length;
  const entropy = shannonEntropy(TYPES.map((t) => counts[t]));
  let dominant: QuestionType | null = null;
  let best = 0;
  for (const t of TYPES) {
    if (counts[t] > best) {
      best = counts[t];
      dominant = t;
    }
  }
  const answerReqRate = n === 0 ? 0 : counts.answer_request / n;
  const metacogRate = n === 0 ? 0 : counts.metacognitive / n;

  // 검출 순서: solo_confident → stuck_loop → answer_seek → productive → wandering
  let arc: ArcType;
  if (input.passed && n <= 2) {
    arc = "solo_confident";
  } else if (detectStuckLoop(input.types)) {
    arc = "stuck_loop";
  } else if (answerReqRate >= 0.4 && counts.metacognitive < 2) {
    arc = "answer_seek";
  } else if (
    input.passed &&
    counts.concept >= 1 &&
    (counts.debug >= 1 || counts.metacognitive >= 1)
  ) {
    arc = "productive";
  } else {
    arc = "wandering";
  }

  return {
    studentId: input.studentId,
    arc,
    n,
    passed: input.passed,
    durationMin: Number(input.durationMin.toFixed(1)),
    entropyBits: Number(entropy.toFixed(3)),
    dominantType: dominant,
    answerReqRate: Number(answerReqRate.toFixed(3)),
    metacogRate: Number(metacogRate.toFixed(3)),
  };
}

/** 같은 유형이 3회 이상 연속 반복되는지 — stuck 신호. */
function detectStuckLoop(types: QuestionType[]): boolean {
  let run = 1;
  for (let i = 1; i < types.length; i++) {
    if (types[i] === types[i - 1]) {
      run += 1;
      if (run >= 3) return true;
    } else {
      run = 1;
    }
  }
  return false;
}

/**
 * 간단 PCA — 2D projection (Jacobi 없이 power iteration 2회로 근사).
 * 입력: N × D 수치 행렬. 반환: N × 2 좌표.
 * 크기 작은 연구 표본(<100 학생) 에서 충분.
 */
export function pca2D(data: number[][]): Array<{ x: number; y: number }> {
  const n = data.length;
  if (n === 0) return [];
  const d = data[0]!.length;
  if (d === 0) return data.map(() => ({ x: 0, y: 0 }));

  // center
  const mean = new Array(d).fill(0);
  for (const row of data) for (let j = 0; j < d; j++) mean[j]! += row[j]! / n;
  const centered = data.map((row) => row.map((v, j) => v - mean[j]!));

  // Covariance matrix D × D
  const cov: number[][] = Array.from({ length: d }, () => new Array(d).fill(0));
  for (const row of centered) {
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) {
        cov[i]![j]! += (row[i]! * row[j]!) / Math.max(1, n - 1);
      }
    }
  }

  // Power iteration for top eigenvector
  const pc1 = powerIteration(cov, 30);
  // Deflate: cov - lambda1 * pc1 pc1^T
  const lambda1 = rayleigh(cov, pc1);
  const deflated = cov.map((row, i) => row.map((v, j) => v - lambda1 * pc1[i]! * pc1[j]!));
  const pc2 = powerIteration(deflated, 30);

  return centered.map((row) => ({
    x: dot(row, pc1),
    y: dot(row, pc2),
  }));
}

function powerIteration(matrix: number[][], iterations: number): number[] {
  const n = matrix.length;
  let v = new Array(n).fill(0).map(() => Math.random());
  v = normalize(v);
  for (let iter = 0; iter < iterations; iter++) {
    const next = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        next[i]! += matrix[i]![j]! * v[j]!;
      }
    }
    v = normalize(next);
  }
  return v;
}

function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0));
  if (norm === 0) return v.map(() => 0);
  return v.map((x) => x / norm);
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
  return sum;
}

function rayleigh(matrix: number[][], v: number[]): number {
  const Av = new Array(v.length).fill(0);
  for (let i = 0; i < v.length; i++) {
    for (let j = 0; j < v.length; j++) {
      Av[i]! += matrix[i]![j]! * v[j]!;
    }
  }
  const num = dot(v, Av);
  const denom = dot(v, v);
  return denom === 0 ? 0 : num / denom;
}
