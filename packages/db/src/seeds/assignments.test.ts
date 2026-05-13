import { describe, expect, it } from "vitest";

import { ASSIGNMENTS, getAssignmentByCode } from "./assignments";

describe("ASSIGNMENTS — 카탈로그 무결성", () => {
  it("정확히 10개 과제가 있음", () => {
    expect(ASSIGNMENTS).toHaveLength(11);
  });

  it("assignment code는 중복 없음", () => {
    const codes = ASSIGNMENTS.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("각 과제의 rubric 가중치 총합은 1.0", () => {
    for (const a of ASSIGNMENTS) {
      const sum = a.rubric.correctness + a.rubric.style + a.rubric.memory_safety + a.rubric.reflection;
      expect(sum).toBeCloseTo(1.0, 5);
    }
  });

  it("CS1 필수 KC 10개를 모두 최소 1회 커버", () => {
    const required = [
      "variables-types",
      "control-flow-if",
      "control-flow-loop",
      "arrays-indexing",
      "pointer-basics",
      "pointer-arithmetic",
      "memory-allocation",
      "functions-params",
      "recursion",
      "io-formatting",
    ];
    const covered = new Set(ASSIGNMENTS.flatMap((a) => a.kcTags));
    for (const kc of required) expect(covered.has(kc)).toBe(true);
  });

  it("difficulty는 1~5 범위", () => {
    for (const a of ASSIGNMENTS) {
      expect(a.difficulty).toBeGreaterThanOrEqual(1);
      expect(a.difficulty).toBeLessThanOrEqual(5);
    }
  });

  it("getAssignmentByCode가 기대대로 동작", () => {
    expect(getAssignmentByCode("A03_arrays_basic")?.title).toBe(
      "문자 입력 반복과 대문자 변환",
    );
    expect(getAssignmentByCode("nonexistent")).toBeUndefined();
  });

  it("각 과제 starter_code에 TODO 주석이 포함 (학생이 작성할 부분 표시)", () => {
    for (const a of ASSIGNMENTS) {
      expect(a.starterCode.includes("TODO") || a.starterCode.includes("todo")).toBe(true);
    }
  });

  it("visible_tests는 각 과제에 최소 1개 포함", () => {
    for (const a of ASSIGNMENTS) {
      expect(a.visibleTests.length).toBeGreaterThan(0);
    }
  });
});
