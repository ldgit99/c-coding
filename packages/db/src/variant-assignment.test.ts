import { describe, expect, it } from "vitest";

import {
  fnv1a32,
  pickVariantIndex,
  variantDistribution,
} from "./variant-assignment";

describe("fnv1a32", () => {
  it("결정적 — 같은 입력 → 같은 해시", () => {
    expect(fnv1a32("hello")).toBe(fnv1a32("hello"));
  });

  it("다른 입력 → 다른 해시 (general property, 충돌은 예외적)", () => {
    expect(fnv1a32("a")).not.toBe(fnv1a32("b"));
  });

  it("32-bit unsigned 범위 유지", () => {
    const h = fnv1a32("some-long-input-string-for-testing");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });
});

describe("pickVariantIndex", () => {
  it("variantCount=1이면 항상 0", () => {
    expect(pickVariantIndex({ studentId: "stu-x", assignmentCode: "A01", variantCount: 1 })).toBe(0);
  });

  it("같은 (studentId, assignmentCode)는 항상 같은 index", () => {
    const a = pickVariantIndex({ studentId: "stu-1", assignmentCode: "A03", variantCount: 6 });
    const b = pickVariantIndex({ studentId: "stu-1", assignmentCode: "A03", variantCount: 6 });
    expect(a).toBe(b);
  });

  it("다른 studentId는 다른 index일 수도 있음 (분포 확인)", () => {
    const indices = new Set<number>();
    for (let i = 0; i < 100; i++) {
      indices.add(
        pickVariantIndex({ studentId: `stu-${i}`, assignmentCode: "A03", variantCount: 6 }),
      );
    }
    // 100명 중 6개 variant 중 다수 사용됨을 기대
    expect(indices.size).toBeGreaterThanOrEqual(4);
  });

  it("cohortSeed 바꾸면 같은 학생도 다른 index가 될 수 있음", () => {
    const base = pickVariantIndex({
      studentId: "stu-1",
      assignmentCode: "A03",
      variantCount: 6,
    });
    const shifted = pickVariantIndex({
      studentId: "stu-1",
      assignmentCode: "A03",
      variantCount: 6,
      cohortSeed: "2026-fall",
    });
    // 반드시 다르다고 보장할 수 없지만 (3/36 확률로 같음) 대부분 다르다.
    // 대신 seed 여럿으로 적어도 하나가 다름을 검증.
    const seeds = ["2026-spring", "2026-fall", "2027-spring"];
    const variations = new Set(
      seeds.map((s) =>
        pickVariantIndex({ studentId: "stu-1", assignmentCode: "A03", variantCount: 6, cohortSeed: s }),
      ),
    );
    expect(variations.size + (variations.has(base) ? 0 : 1)).toBeGreaterThanOrEqual(2);
  });
});

describe("variantDistribution", () => {
  it("총합이 학생 수와 같음", () => {
    const students = Array.from({ length: 30 }, (_, i) => `stu-${i}`);
    const counts = variantDistribution(students, "A03", 6);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(30);
    expect(counts).toHaveLength(6);
  });

  it("각 variant에 최소 1명 이상 (충분히 큰 학생 수에서)", () => {
    const students = Array.from({ length: 300 }, (_, i) => `stu-${i}`);
    const counts = variantDistribution(students, "A03", 6);
    for (const c of counts) {
      expect(c).toBeGreaterThan(0);
    }
  });
});
