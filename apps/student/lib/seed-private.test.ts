import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadHiddenTests, loadReferenceSolution } from "./seed-private";

describe("seed-private loader", () => {
  const originalDir = process.env.CVIBE_SEED_PRIVATE_DIR;

  beforeEach(() => {
    // 실제 repo의 seed-private 경로를 사용 — vitest cwd는 apps/student
    delete process.env.CVIBE_SEED_PRIVATE_DIR;
  });
  afterEach(() => {
    if (originalDir) process.env.CVIBE_SEED_PRIVATE_DIR = originalDir;
  });

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

  it("loadReferenceSolution(A01_hello_variables)은 sum printf 포함 C 소스", async () => {
    const ref = await loadReferenceSolution("A01_hello_variables");
    expect(ref).not.toBeNull();
    expect(ref).toContain("printf");
    expect(ref).toMatch(/int\s+main/);
  });

  it("CVIBE_SEED_PRIVATE_DIR env override 존중", async () => {
    process.env.CVIBE_SEED_PRIVATE_DIR = "/nonexistent/path";
    expect(await loadHiddenTests("A01_hello_variables")).toBeNull();
    expect(await loadReferenceSolution("A01_hello_variables")).toBeNull();
  });
});
