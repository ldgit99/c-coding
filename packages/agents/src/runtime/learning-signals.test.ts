import { describe, expect, it } from "vitest";

import { computeLearningSignals, extractErrorKeywords } from "./learning-signals";

describe("computeLearningSignals", () => {
  it("제출 없음·코드 30자 이상이면 attempt=1 로 보정", () => {
    const s = computeLearningSignals({
      submissionCount: 0,
      recentFailureStreak: 0,
      secondsSinceLastRun: null,
      hintRequestsThisAssignment: 0,
      recentErrorKeywords: [],
      editorCodeLength: 100,
    });
    expect(s.attemptCount).toBe(1);
  });

  it("제출 3회면 attempt=3", () => {
    const s = computeLearningSignals({
      submissionCount: 3,
      recentFailureStreak: 2,
      secondsSinceLastRun: 60,
      hintRequestsThisAssignment: 1,
      recentErrorKeywords: [],
      editorCodeLength: 200,
    });
    expect(s.attemptCount).toBe(3);
    expect(s.stagnationSec).toBe(60);
    expect(s.hintRequests).toBe(1);
  });

  it("같은 에러 키워드 2회 이상이면 repeatedErrorCount ≥ 1", () => {
    const s = computeLearningSignals({
      submissionCount: 1,
      recentFailureStreak: 1,
      secondsSinceLastRun: null,
      hintRequestsThisAssignment: 0,
      recentErrorKeywords: ["세그폴트", "세그폴트", "null"],
      editorCodeLength: 50,
    });
    expect(s.repeatedErrorCount).toBe(1);
    expect(s.errorTypes).toContain("세그폴트");
  });

  it("hint 많이 받으면 aiDependencyScore 상승", () => {
    const s = computeLearningSignals({
      submissionCount: 1,
      recentFailureStreak: 0,
      secondsSinceLastRun: null,
      hintRequestsThisAssignment: 9,
      recentErrorKeywords: [],
      editorCodeLength: 40,
    });
    expect(s.aiDependencyScore).toBeGreaterThan(0.8);
  });
});

describe("extractErrorKeywords", () => {
  it("세그폴트·컴파일 에러·null 등 탐지", () => {
    const k = extractErrorKeywords("세그폴트가 떴어 null 참조 같아");
    expect(k).toContain("세그폴트");
    expect(k).toContain("null");
  });

  it("없으면 빈 배열", () => {
    expect(extractErrorKeywords("그냥 질문이에요")).toEqual([]);
  });
});
