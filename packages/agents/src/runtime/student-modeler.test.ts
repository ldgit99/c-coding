import { describe, expect, it } from "vitest";

import { activeMisconceptions, updateMastery, type MasteryEntry } from "./student-modeler";

describe("updateMastery — BKT 스타일 갱신", () => {
  it("|delta| ≤ 0.15 상한", () => {
    const { masteryUpdated } = updateMastery({
      currentMastery: { "pointer-arithmetic": { value: 0.5, confidence: 0, observations: 0 } },
      currentMisconceptions: [],
      kcDelta: { "pointer-arithmetic": 0.8 }, // 0.15로 캡 기대
    });
    // 첫 관찰: confidence 0 → (1-0)=1 가중 → value = 0.5 + 0.15 = 0.65
    expect(masteryUpdated["pointer-arithmetic"]!.value).toBeCloseTo(0.65, 5);
    expect(masteryUpdated["pointer-arithmetic"]!.observations).toBe(1);
  });

  it("confidence 높을수록 관찰이 움직이는 폭 줄어듦", () => {
    const base: MasteryEntry = { value: 0.5, confidence: 0.8, observations: 20 };
    const { masteryUpdated } = updateMastery({
      currentMastery: { "arrays-indexing": base },
      currentMisconceptions: [],
      kcDelta: { "arrays-indexing": 0.15 },
    });
    // 0.5 + 0.15 * (1 - 0.8) = 0.53
    expect(masteryUpdated["arrays-indexing"]!.value).toBeCloseTo(0.53, 5);
  });

  it("mastery ≥ 0.75 + confidence ≥ 0.7이면 reduce-support signal", () => {
    const { fadingSignals } = updateMastery({
      currentMastery: { "arrays-indexing": { value: 0.82, confidence: 0.75, observations: 10 } },
      currentMisconceptions: [],
    });
    expect(fadingSignals).toContainEqual({ kc: "arrays-indexing", action: "reduce-support" });
  });

  it("mastery < 0.3 + observations ≥ 5이면 reinforce signal", () => {
    const { fadingSignals } = updateMastery({
      currentMastery: { "recursion": { value: 0.2, confidence: 0.4, observations: 6 } },
      currentMisconceptions: [],
    });
    expect(fadingSignals).toContainEqual({ kc: "recursion", action: "reinforce" });
  });

  it("의존도 최근 3회 평균이 이전 3회보다 ≥0.15 오르면 flag", () => {
    const { interventionFlags } = updateMastery({
      currentMastery: {},
      currentMisconceptions: [],
      dependencyFactorHistory: [0.2, 0.25, 0.3, 0.5, 0.55, 0.6],
    });
    expect(interventionFlags).toContain("ai_dependency_trend");
  });

  it("이벤트 기반 누적 갱신 — compile-error 3회 반복은 misconception 후보", () => {
    const { misconceptions } = updateMastery({
      currentMastery: {},
      currentMisconceptions: [],
      events: [
        {
          verb: "https://cvibe.app/verbs/compile-error",
          kc: "pointer-basics",
          errorType: "undeclared-variable",
          timestamp: "2026-04-20T10:00:00Z",
        },
        {
          verb: "https://cvibe.app/verbs/compile-error",
          kc: "pointer-basics",
          errorType: "undeclared-variable",
          timestamp: "2026-04-20T10:05:00Z",
        },
        {
          verb: "https://cvibe.app/verbs/compile-error",
          kc: "pointer-basics",
          errorType: "undeclared-variable",
          timestamp: "2026-04-20T10:10:00Z",
        },
      ],
    });
    const active = activeMisconceptions(misconceptions);
    expect(active).toHaveLength(1);
    expect(active[0]!.kc).toBe("pointer-basics");
    expect(active[0]!.occurrences).toBe(3);
  });

  it("lastProcessedEventAt 이전 이벤트는 무시", () => {
    const { masteryUpdated } = updateMastery({
      currentMastery: { "arrays-indexing": { value: 0.5, confidence: 0, observations: 0 } },
      currentMisconceptions: [],
      lastProcessedEventAt: "2026-04-20T12:00:00Z",
      events: [
        {
          verb: "https://cvibe.app/verbs/submission-passed",
          kc: "arrays-indexing",
          timestamp: "2026-04-20T11:00:00Z",
        },
      ],
    });
    expect(masteryUpdated["arrays-indexing"]!.observations).toBe(0);
  });
});
