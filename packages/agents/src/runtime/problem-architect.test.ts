import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { genProblem, seededRandom } from "./problem-architect";

describe("seededRandom — 결정론성", () => {
  it("같은 seed는 같은 수열을 생성", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("다른 seed는 다른 수열", () => {
    const a = seededRandom(1);
    const b = seededRandom(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });
});

describe("genProblem — mock 경로", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  beforeAll(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterAll(() => {
    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("seed 기반 variants는 재현 가능", async () => {
    const r1 = await genProblem({ kc: "arrays-indexing", difficulty: 2, variantCount: 3, seed: 1234 });
    const r2 = await genProblem({ kc: "arrays-indexing", difficulty: 2, variantCount: 3, seed: 1234 });
    expect(r1.mocked).toBe(true);
    expect(r1.problem.variants).toEqual(r2.problem.variants);
  });

  it("다른 seed는 다른 variants", async () => {
    const r1 = await genProblem({ kc: "arrays-indexing", difficulty: 2, variantCount: 3, seed: 1 });
    const r2 = await genProblem({ kc: "arrays-indexing", difficulty: 2, variantCount: 3, seed: 999 });
    expect(r1.problem.variants).not.toEqual(r2.problem.variants);
  });

  it("variantCount만큼 반환, kcTags에 요청 KC 포함", async () => {
    const { problem } = await genProblem({
      kc: "pointer-arithmetic",
      difficulty: 3,
      variantCount: 4,
      seed: 7,
    });
    expect(problem.variants).toHaveLength(4);
    expect(problem.kcTags).toContain("pointer-arithmetic");
    expect(problem.rubric.correctness + problem.rubric.style + problem.rubric.memory_safety + problem.rubric.reflection).toBeCloseTo(1, 5);
  });

  it("referenceSolution 필드는 응답에 포함되지만 별도 격리가 필요함을 스키마가 암시", async () => {
    const { problem } = await genProblem({
      kc: "arrays-indexing",
      difficulty: 2,
      variantCount: 1,
      seed: 42,
    });
    expect(problem.variants[0]!.referenceSolution).toMatch(/include/);
  });
});
