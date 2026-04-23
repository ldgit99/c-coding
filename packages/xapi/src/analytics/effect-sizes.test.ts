import { describe as test, expect, it } from "vitest";

import {
  bootstrapCI,
  cliffsDelta,
  cohensD,
  cohensKappa,
  cramerV,
  describe,
  ecdf,
  pearsonR,
  shannonEntropy,
  transitionMatrix,
} from "./effect-sizes";

test("describe", () => {
  it("기본 기술통계", () => {
    const d = describe([1, 2, 3, 4, 5]);
    expect(d.n).toBe(5);
    expect(d.mean).toBe(3);
    expect(d.median).toBe(3);
    expect(d.min).toBe(1);
    expect(d.max).toBe(5);
  });
  it("빈 배열 안전", () => {
    const d = describe([]);
    expect(d.n).toBe(0);
  });
});

test("cohensD", () => {
  it("같은 분포면 0", () => {
    expect(cohensD([1, 2, 3], [1, 2, 3])).toBe(0);
  });
  it("큰 분리면 큰 d", () => {
    const d = cohensD([5, 6, 7], [1, 2, 3]);
    expect(d).toBeGreaterThan(2);
  });
});

test("cliffsDelta", () => {
  it("완전 우세면 1", () => {
    expect(cliffsDelta([5, 6, 7], [1, 2, 3])).toBe(1);
  });
  it("완전 열세면 -1", () => {
    expect(cliffsDelta([1, 2, 3], [5, 6, 7])).toBe(-1);
  });
});

test("pearsonR", () => {
  it("완벽 양의 상관 = 1", () => {
    expect(pearsonR([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 3);
  });
  it("완벽 음의 상관 = -1", () => {
    expect(pearsonR([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 3);
  });
});

test("cramerV", () => {
  it("독립이면 V ≈ 0", () => {
    const { v } = cramerV([
      [10, 10],
      [10, 10],
    ]);
    expect(v).toBeCloseTo(0, 3);
  });
  it("강한 연관이면 V > 0.5", () => {
    const { v } = cramerV([
      [20, 0],
      [0, 20],
    ]);
    expect(v).toBeGreaterThan(0.9);
  });
});

test("cohensKappa", () => {
  it("완벽 합치 = 1", () => {
    const { kappa } = cohensKappa(["a", "b", "c"], ["a", "b", "c"]);
    expect(kappa).toBeCloseTo(1, 2);
  });
});

test("bootstrapCI", () => {
  it("deterministic with seed", () => {
    const s = [1, 2, 3, 4, 5];
    const a = bootstrapCI(s, (xs) => xs.reduce((a, b) => a + b, 0) / xs.length, { seed: 42 });
    const b = bootstrapCI(s, (xs) => xs.reduce((a, b) => a + b, 0) / xs.length, { seed: 42 });
    expect(a.lo).toBeCloseTo(b.lo, 6);
    expect(a.hi).toBeCloseTo(b.hi, 6);
    expect(a.estimate).toBeCloseTo(3, 3);
  });
});

test("transitionMatrix", () => {
  it("연속 상태 전이 카운트", () => {
    const { counts } = transitionMatrix(["a", "b", "a", "b", "b"] as const, [
      "a",
      "b",
    ] as const);
    expect(counts[0]![1]).toBe(2); // a→b 2회
    expect(counts[1]![0]).toBe(1); // b→a 1회
    expect(counts[1]![1]).toBe(1); // b→b 1회
  });
});

test("shannonEntropy", () => {
  it("균등 분포면 최대", () => {
    expect(shannonEntropy([1, 1, 1, 1])).toBeCloseTo(2, 3); // log2(4)
  });
  it("집중되면 0에 가까움", () => {
    expect(shannonEntropy([100, 0, 0, 0])).toBeCloseTo(0, 3);
  });
});

test("ecdf", () => {
  it("정렬된 누적확률", () => {
    const e = ecdf([3, 1, 2]);
    expect(e[0]).toEqual({ x: 1, p: 1 / 3 });
    expect(e[2]).toEqual({ x: 3, p: 1 });
  });
});
