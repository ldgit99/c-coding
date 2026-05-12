import { describe, expect, it } from "vitest";

import { loadHiddenTests, loadReferenceSolution } from "./seed-private";

describe("seed-private loader (in-memory ASSIGNMENTS 기반)", () => {
  it("loadHiddenTests(A03_arrays_basic)은 5개 테스트 반환", async () => {
    const tests = await loadHiddenTests("A03_arrays_basic");
    expect(tests).not.toBeNull();
    expect(tests!.length).toBe(5);
    expect(tests![0]!).toEqual({
      id: 1,
      input: "HELLO\n",
      expected: "문자열 입력: 소문자로 변환된 문자열: hello\n",
    });
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

  it("loadReferenceSolution(A02_pointer_swap_fn)은 포인터 순회 + max/min 갱신", async () => {
    const ref = await loadReferenceSolution("A02_pointer_swap_fn");
    expect(ref).not.toBeNull();
    // 포인터 산술 표기 + 최댓값/최솟값 갱신 로직 확인
    expect(ref).toMatch(/\*\(p\s*\+\s*i\)/);
    expect(ref).toContain("max =");
    expect(ref).toContain("min =");
    expect(ref).toMatch(/printf\("%d "/);
  });

  it("존재하지 않는 code 는 null", async () => {
    expect(await loadReferenceSolution("XYZ_nonexistent")).toBeNull();
  });
});
