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
