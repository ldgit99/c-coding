import { describe, expect, it } from "vitest";

import { reviewCode } from "./code-reviewer";

describe("reviewCode — mock 경로 (API key 미설정)", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeAll(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterAll(() => {
    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("off-by-one 패턴을 감지해 blocker finding을 생성", async () => {
    const code = `
int sum(int *a, int n) {
  int s = 0;
  for (int i = 0; i <= n; i++) s += a[i];
  return s;
}`;
    const { review, mocked } = await reviewCode({ code, studentLevel: "novice" });
    expect(mocked).toBe(true);
    expect(review.findings).toHaveLength(1);
    expect(review.findings[0]!.severity).toBe("blocker");
    expect(review.findings[0]!.category).toBe("memory-safety");
    expect(review.topIssues).toEqual(["f001"]);
    expect(review.findings[0]!.proposedCode).toMatch(/< n/);
  });

  it("문제 없는 코드에는 findings 없음", async () => {
    const code = `
int add(int a, int b) { return a + b; }`;
    const { review } = await reviewCode({ code });
    expect(review.findings).toHaveLength(0);
    expect(review.topIssues).toEqual([]);
  });
});

// vitest global beforeAll/afterAll import
import { afterAll, beforeAll } from "vitest";

describe("downgradeHallucinatedBlockers — 통과 신호 기반 BLOCKER 강등", () => {
  // 새 mockReview 는 referenceSolution 등 새 필드를 보지 않으므로 mock 경로에서는
  // 후처리만 단독으로 검증 가능하다.

  it("hidden test 100% 통과면 mock 의 BLOCKER finding 도 minor 로 강등", async () => {
    const code = `
int sum(int *a, int n) {
  int s = 0;
  for (int i = 0; i <= n; i++) s += a[i];
  return s;
}`;
    const { review } = await reviewCode({
      code,
      studentLevel: "novice",
      hiddenTestPassRatio: 1.0,
    });
    // mockReview 는 off-by-one 을 BLOCKER 로 만든다 → 후처리가 minor 로 내림
    expect(review.findings.length).toBeGreaterThan(0);
    const off = review.findings[0]!;
    expect(off.severity).toBe("minor");
    expect(off.message).toContain("[자동 강등");
  });

  it("last_run_status === ok 이면 BLOCKER → major 강등 (correctness 한정)", async () => {
    const code = `
int sum(int *a, int n) {
  int s = 0;
  for (int i = 0; i <= n; i++) s += a[i];
  return s;
}`;
    const { review } = await reviewCode({
      code,
      studentLevel: "novice",
      lastRunResult: { status: "ok" },
    });
    // mock 의 BLOCKER 는 category=memory-safety 라 강등 대상 아님
    // → 변경 없음 검증
    expect(review.findings[0]!.severity).toBe("blocker");
    expect(review.findings[0]!.category).toBe("memory-safety");
  });

  it("통과 신호가 없으면 mock BLOCKER 그대로 유지", async () => {
    const code = `
int sum(int *a, int n) {
  int s = 0;
  for (int i = 0; i <= n; i++) s += a[i];
  return s;
}`;
    const { review } = await reviewCode({ code, studentLevel: "novice" });
    expect(review.findings[0]!.severity).toBe("blocker");
  });
});
