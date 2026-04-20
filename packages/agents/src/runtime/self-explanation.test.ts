import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { evaluateSelfExplanation } from "./self-explanation";

describe("evaluateSelfExplanation — mock 경로", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  beforeAll(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterAll(() => {
    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("짧고 모호한 설명은 낮은 점수 + improvements 제시", async () => {
    const res = await evaluateSelfExplanation({ text: "그냥 그렇게 해야 됨" });
    expect(res.mocked).toBe(true);
    expect(res.evaluation.quality).toBeLessThan(0.5);
    expect(res.evaluation.improvements.length).toBeGreaterThan(0);
  });

  it("구체·인과 포함 설명은 높은 점수", async () => {
    const res = await evaluateSelfExplanation({
      text: "line 6의 배열 인덱스 i가 n까지 가서 OOB가 났기 때문에, 조건을 i < n 으로 바꿔야 한다. 다음에 비슷한 루프 문제에서도 경계를 먼저 확인하겠다.",
    });
    expect(res.evaluation.quality).toBeGreaterThan(0.5);
    expect(res.evaluation.strengths.length).toBeGreaterThan(0);
  });

  it("모든 axis가 0~1 범위", async () => {
    const res = await evaluateSelfExplanation({ text: "aa" });
    expect(res.evaluation.axes.specificity).toBeGreaterThanOrEqual(0);
    expect(res.evaluation.axes.specificity).toBeLessThanOrEqual(1);
    expect(res.evaluation.axes.causality).toBeGreaterThanOrEqual(0);
    expect(res.evaluation.axes.causality).toBeLessThanOrEqual(1);
    expect(res.evaluation.axes.transfer).toBeGreaterThanOrEqual(0);
    expect(res.evaluation.axes.transfer).toBeLessThanOrEqual(1);
  });

  it("품질 공식 0.4*causality + 0.35*specificity + 0.25*transfer 준수 (mock 경로)", async () => {
    const res = await evaluateSelfExplanation({ text: "line 10의 변수 sum이 왜냐하면 누적 연산을 해야 해서" });
    const a = res.evaluation.axes;
    const expected = 0.4 * a.causality + 0.35 * a.specificity + 0.25 * a.transfer;
    expect(res.evaluation.quality).toBeCloseTo(Math.max(0, Math.min(1, expected)), 5);
  });
});
