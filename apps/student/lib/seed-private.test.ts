import { describe, expect, it } from "vitest";

import { loadHiddenTests, loadReferenceSolution } from "./seed-private";

describe("seed-private loader (in-memory ASSIGNMENTS 기반)", () => {
  it("loadHiddenTests(A03_arrays_basic)은 5개 테스트 반환", async () => {
    const tests = await loadHiddenTests("A03_arrays_basic");
    expect(tests).not.toBeNull();
    expect(tests!.length).toBe(5);
    expect(tests![0]!).toEqual({ id: 1, input: "5\n1 2 3 4 5", expected: "15\n" });
  });

  it("loadHiddenTests(존재하지 않는 code)는 null", async () => {
    const tests = await loadHiddenTests("XYZ_nonexistent");
    expect(tests).toBeNull();
  });

  it("loadReferenceSolution(A01_array_2d_sum)은 행·열 합산 C 소스", async () => {
    const ref = await loadReferenceSolution("A01_array_2d_sum");
    expect(ref).not.toBeNull();
    expect(ref).toContain("printf");
    expect(ref).toContain("sumrow");
    expect(ref).toContain("sumcol");
    expect(ref).toMatch(/int\s+main/);
  });

  it("loadReferenceSolution(A02_pointer_swap_fn)은 swap 함수 포함", async () => {
    const ref = await loadReferenceSolution("A02_pointer_swap_fn");
    expect(ref).not.toBeNull();
    expect(ref).toContain("void swap");
    expect(ref).toContain("*a = *b");
  });

  it("존재하지 않는 code 는 null", async () => {
    expect(await loadReferenceSolution("XYZ_nonexistent")).toBeNull();
  });
});
