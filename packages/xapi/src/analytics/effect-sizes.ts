/**
 * Effect size & statistical helpers for SSCI-grade research figures.
 *
 * 모든 함수는 순수 — 외부 의존성 없음. Deterministic (bootstrap 은 seeded RNG).
 * `p-value` 대신 effect size 를 전면에 배치하도록 설계.
 */

// ============================================================================
// Descriptives
// ============================================================================

export interface Descriptives {
  n: number;
  mean: number;
  sd: number;
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
}

export function describe(values: number[]): Descriptives {
  const n = values.length;
  if (n === 0) {
    return { n: 0, mean: 0, sd: 0, median: 0, q1: 0, q3: 0, min: 0, max: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const variance = sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1);
  const sd = Math.sqrt(variance);
  const q = (p: number) => {
    const idx = (n - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return lo === hi ? sorted[lo]! : sorted[lo]! + (idx - lo) * (sorted[hi]! - sorted[lo]!);
  };
  return {
    n,
    mean,
    sd,
    median: q(0.5),
    q1: q(0.25),
    q3: q(0.75),
    min: sorted[0]!,
    max: sorted[n - 1]!,
  };
}

// ============================================================================
// Effect sizes
// ============================================================================

/** Cohen's d — 표준화된 평균 차이. (Hedges 보정 없음) */
export function cohensD(a: number[], b: number[]): number {
  if (a.length < 2 || b.length < 2) return 0;
  const da = describe(a);
  const db = describe(b);
  const pooled = Math.sqrt(
    ((da.n - 1) * da.sd ** 2 + (db.n - 1) * db.sd ** 2) / Math.max(1, da.n + db.n - 2),
  );
  return pooled === 0 ? 0 : (da.mean - db.mean) / pooled;
}

/** Cliff's delta — 비모수 효과 크기. 범위 [-1, 1]. |0.147|=small |0.33|=medium |0.474|=large. */
export function cliffsDelta(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  let greater = 0;
  let less = 0;
  for (const x of a) {
    for (const y of b) {
      if (x > y) greater += 1;
      else if (x < y) less += 1;
    }
  }
  return (greater - less) / (a.length * b.length);
}

/** Pearson r — 선형 상관. */
export function pearsonR(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const mx = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0,
    dx = 0,
    dy = 0;
  for (let i = 0; i < n; i++) {
    const xi = x[i]! - mx;
    const yi = y[i]! - my;
    num += xi * yi;
    dx += xi * xi;
    dy += yi * yi;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

/** Cramér's V — categorical × categorical 연관강도. 범위 [0, 1]. */
export function cramerV(contingency: number[][]): { v: number; chiSquare: number; df: number } {
  const rows = contingency.length;
  if (rows === 0) return { v: 0, chiSquare: 0, df: 0 };
  const cols = contingency[0]!.length;
  const rowSums = contingency.map((r) => r.reduce((a, b) => a + b, 0));
  const colSums = Array.from({ length: cols }, (_, j) =>
    contingency.reduce((acc, r) => acc + (r[j] ?? 0), 0),
  );
  const total = rowSums.reduce((a, b) => a + b, 0);
  if (total === 0) return { v: 0, chiSquare: 0, df: 0 };
  let chi = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const expected = (rowSums[i]! * colSums[j]!) / total;
      if (expected === 0) continue;
      const observed = contingency[i]![j] ?? 0;
      chi += (observed - expected) ** 2 / expected;
    }
  }
  const df = (rows - 1) * (cols - 1);
  const minDim = Math.min(rows, cols) - 1;
  const v = minDim <= 0 ? 0 : Math.sqrt(chi / (total * minDim));
  return { v, chiSquare: chi, df };
}

/** Cohen's κ — 두 rater 간 합치도. 범위 [-1, 1]. */
export function cohensKappa<T extends string | number>(
  rater1: T[],
  rater2: T[],
): { kappa: number; agreement: number } {
  const n = Math.min(rater1.length, rater2.length);
  if (n === 0) return { kappa: 0, agreement: 0 };
  const categories = Array.from(new Set([...rater1, ...rater2]));
  const freq1 = new Map<T, number>();
  const freq2 = new Map<T, number>();
  let agree = 0;
  for (let i = 0; i < n; i++) {
    const a = rater1[i]!;
    const b = rater2[i]!;
    freq1.set(a, (freq1.get(a) ?? 0) + 1);
    freq2.set(b, (freq2.get(b) ?? 0) + 1);
    if (a === b) agree += 1;
  }
  const po = agree / n;
  let pe = 0;
  for (const cat of categories) {
    pe += ((freq1.get(cat) ?? 0) / n) * ((freq2.get(cat) ?? 0) / n);
  }
  const kappa = pe === 1 ? 0 : (po - pe) / (1 - pe);
  return { kappa, agreement: po };
}

// ============================================================================
// Bootstrap CI (deterministic with seed)
// ============================================================================

/** xorshift32 — deterministic RNG for reproducible bootstrap. */
function xorshift32(seed: number): () => number {
  let state = seed | 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
}

/**
 * Non-parametric bootstrap CI (percentile method).
 * @param sample 원 표본
 * @param stat 통계량 함수 (예: 평균, 중앙값)
 * @param opts.iterations B (기본 1000), opts.ci (기본 0.95), opts.seed (기본 42)
 */
export function bootstrapCI(
  sample: number[],
  stat: (xs: number[]) => number,
  opts: { iterations?: number; ci?: number; seed?: number } = {},
): { estimate: number; lo: number; hi: number; n: number } {
  const n = sample.length;
  const iters = opts.iterations ?? 1000;
  const ci = opts.ci ?? 0.95;
  const rng = xorshift32(opts.seed ?? 42);
  if (n < 2) {
    const est = n === 1 ? sample[0]! : 0;
    return { estimate: est, lo: est, hi: est, n };
  }
  const replicates: number[] = [];
  for (let b = 0; b < iters; b++) {
    const draw: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      draw[i] = sample[Math.floor(rng() * n)]!;
    }
    replicates.push(stat(draw));
  }
  replicates.sort((a, b) => a - b);
  const tail = (1 - ci) / 2;
  const lo = replicates[Math.floor(iters * tail)]!;
  const hi = replicates[Math.min(iters - 1, Math.ceil(iters * (1 - tail)))]!;
  return { estimate: stat(sample), lo, hi, n };
}

// ============================================================================
// Markov transition matrix + Shannon entropy
// ============================================================================

/** 이산 상태열을 받아 NxN 전이확률 행렬로. 각 행합=1. */
export function transitionMatrix<T extends string>(
  sequence: T[],
  states: T[],
): { matrix: number[][]; counts: number[][] } {
  const n = states.length;
  const index = new Map(states.map((s, i) => [s, i] as const));
  const counts: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < sequence.length - 1; i++) {
    const a = index.get(sequence[i]!);
    const b = index.get(sequence[i + 1]!);
    if (a == null || b == null) continue;
    counts[a]![b]! += 1;
  }
  const matrix = counts.map((row) => {
    const total = row.reduce((a, b) => a + b, 0);
    return total === 0 ? row.map(() => 0) : row.map((v) => v / total);
  });
  return { matrix, counts };
}

/** Shannon entropy (bits). 입력이 확률분포(합=1) 이면 바로, 아니면 카운트로 정규화. */
export function shannonEntropy(values: number[]): number {
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let h = 0;
  for (const v of values) {
    if (v <= 0) continue;
    const p = v / total;
    h -= p * Math.log2(p);
  }
  return h;
}

// ============================================================================
// eCDF — empirical cumulative distribution function
// ============================================================================

export function ecdf(sample: number[]): Array<{ x: number; p: number }> {
  const sorted = [...sample].sort((a, b) => a - b);
  const n = sorted.length;
  return sorted.map((x, i) => ({ x, p: (i + 1) / n }));
}
