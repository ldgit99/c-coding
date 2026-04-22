import { describe, expect, it } from "vitest";

import type { SessionState } from "../state";
import { applyFading, computeAllowedLevel } from "./gating";

const baseState = (overrides: Partial<SessionState> = {}): SessionState => ({
  studentId: "11111111-1111-1111-1111-111111111111",
  currentKC: [],
  mastery: {},
  conversation: [],
  interventionFlags: [],
  supportLevel: 0,
  selfExplanationRequired: false,
  mode: "pair",
  ...overrides,
});

describe("computeAllowedLevel — socratic-hinting 게이팅", () => {
  it("신규 세션에서 L1 요청은 허용", () => {
    const result = computeAllowedLevel({ state: baseState(), requestedLevel: 1 });
    expect(result.grantedLevel).toBe(1);
    expect(result.failedConditions).toEqual([]);
  });

  it("attemptCount=0에서 L2 요청은 L1로 다운그레이드", () => {
    const result = computeAllowedLevel({
      state: baseState({
        learningSignals: {
          attemptCount: 0,
          errorTypes: [],
          repeatedErrorCount: 0,
          stagnationSec: 0,
          hintRequests: 0,
          aiDependencyScore: 0,
        },
      }),
      requestedLevel: 2,
    });
    expect(result.grantedLevel).toBe(1);
    expect(result.failedConditions[0]).toMatch(/L1→L2/);
  });

  it("pair 모드에서 L4 요청은 L3 ceiling 에 막힘", () => {
    const result = computeAllowedLevel({
      state: baseState({
        mode: "pair",
        learningSignals: {
          attemptCount: 3,
          errorTypes: ["compile_error"],
          repeatedErrorCount: 2,
          stagnationSec: 240,
          hintRequests: 3,
          aiDependencyScore: 0.3,
        },
      }),
      requestedLevel: 4,
      restatedProblem: true,
      namedStuckPoint: true,
    });
    expect(result.grantedLevel).toBe(3);
    expect(result.failedConditions.some((c) => /pair/.test(c))).toBe(true);
  });

  it("coach 모드 + 모든 조건 충족 시 L4 허용", () => {
    const result = computeAllowedLevel({
      state: baseState({
        mode: "coach",
        currentKC: ["arrays-indexing"],
        learningSignals: {
          attemptCount: 3,
          errorTypes: ["oob"],
          repeatedErrorCount: 2,
          stagnationSec: 300,
          hintRequests: 3,
          aiDependencyScore: 0.2,
        },
      }),
      requestedLevel: 4,
      restatedProblem: true,
      namedStuckPoint: true,
    });
    expect(result.grantedLevel).toBe(4);
    expect(result.failedConditions).toEqual([]);
  });

  it("solo 모드는 L2 이상 요청 시 L1 ceiling 고정", () => {
    const result = computeAllowedLevel({
      state: baseState({
        mode: "solo",
        learningSignals: {
          attemptCount: 5,
          errorTypes: [],
          repeatedErrorCount: 0,
          stagnationSec: 500,
          hintRequests: 2,
          aiDependencyScore: 0,
        },
      }),
      requestedLevel: 3,
    });
    expect(result.grantedLevel).toBe(1);
    expect(result.failedConditions.some((c) => /solo/.test(c))).toBe(true);
  });
});

describe("applyFading — 숙련도 기반 레벨 하향", () => {
  it("mastery 평균 ≥ 0.75면 L3 → L2로 하향", () => {
    const state = baseState({ mastery: { "arrays-indexing": 0.8, "control-flow-loop": 0.76 } });
    expect(applyFading(3, state, ["arrays-indexing", "control-flow-loop"])).toBe(2);
  });

  it("mastery가 낮으면 레벨 유지", () => {
    const state = baseState({ mastery: { "arrays-indexing": 0.3 } });
    expect(applyFading(3, state, ["arrays-indexing"])).toBe(3);
  });

  it("L1은 더 낮출 수 없음", () => {
    const state = baseState({ mastery: { foo: 0.9 } });
    expect(applyFading(1, state, ["foo"])).toBe(1);
  });
});
