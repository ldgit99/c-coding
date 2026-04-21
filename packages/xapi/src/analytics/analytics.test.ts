import { describe, expect, it } from "vitest";

import { buildStatement, Verbs } from "../index";
import {
  classifyOffloading,
  clusterStudents,
  computeCascadeTransitions,
  computeLinguisticProfile,
  extractUtteranceFeatures,
  summarizeCascadePerStudent,
} from "./index";

describe("linguistic features", () => {
  it("WH-question + 메타인지 발화를 감지한다", () => {
    const f = extractUtteranceFeatures("왜 이 코드가 segfault가 나는지 이해가 안 돼요");
    expect(f.hasWhQuestion).toBe(true);
    expect(f.hasMetacognitive).toBe(true);
  });

  it("imperative + code-first 발화를 분리해서 감지한다", () => {
    const f = extractUtteranceFeatures("이 코드 돌려줘 그리고 답 알려줘");
    expect(f.hasImperative).toBe(true);
    expect(f.hasCodeFirstDemand).toBe(true);
    expect(f.hasWhQuestion).toBe(false);
  });

  it("empty input은 zero profile을 반환한다", () => {
    const p = computeLinguisticProfile([]);
    expect(p.totalUtterances).toBe(0);
    expect(p.offloadingScore).toBe(0);
  });

  it("WH-question 위주면 offloadingScore가 낮다", () => {
    const p = computeLinguisticProfile([
      "왜 이 부분이 틀렸지?",
      "어떻게 하면 더 빠르게 만들 수 있을까?",
      "무엇이 문제인지 설명해주실래요?",
    ]);
    expect(p.whQuestionRate).toBeGreaterThanOrEqual(0.66);
    expect(p.offloadingScore).toBeLessThan(0.3);
  });

  it("imperative + code-first 위주면 offloadingScore가 높다", () => {
    const p = computeLinguisticProfile([
      "이 코드 돌려줘",
      "정답 코드 써줘",
      "완성시켜줘",
    ]);
    expect(p.codeFirstRate).toBeGreaterThanOrEqual(0.66);
    expect(p.offloadingScore).toBeGreaterThan(0.5);
  });
});

describe("cascade summary + clustering", () => {
  function hintEvent(sid: string, level: 1 | 2 | 3 | 4, ts: string) {
    return buildStatement({
      actor: { type: "student", id: sid },
      verb: Verbs.requestedHint,
      object: { type: "assignment", id: "A01" },
      result: { hintLevel: level, mode: "pair" },
      timestamp: new Date(ts),
    });
  }

  it("독립형 학생 클러스터를 감지한다", () => {
    const events = [
      hintEvent("s_indep", 1, "2026-04-21T10:00:00Z"),
      hintEvent("s_indep", 1, "2026-04-21T10:05:00Z"),
      hintEvent("s_indep", 2, "2026-04-21T10:10:00Z"),
      hintEvent("s_indep", 2, "2026-04-21T10:15:00Z"),
    ];
    const summary = summarizeCascadePerStudent(events);
    const clusters = clusterStudents(summary);
    expect(clusters[0]!.cluster).toBe("independent");
  });

  it("직접형(L4 편중) 학생을 감지한다", () => {
    const events = [
      hintEvent("s_direct", 4, "2026-04-21T10:00:00Z"),
      hintEvent("s_direct", 4, "2026-04-21T10:05:00Z"),
      hintEvent("s_direct", 1, "2026-04-21T10:10:00Z"),
    ];
    const summary = summarizeCascadePerStudent(events);
    const clusters = clusterStudents(summary);
    expect(clusters[0]!.cluster).toBe("direct");
  });

  it("L1→L2→L4 전환을 기록한다", () => {
    const events = [
      hintEvent("s1", 1, "2026-04-21T10:00:00Z"),
      hintEvent("s1", 2, "2026-04-21T10:05:00Z"),
      hintEvent("s1", 4, "2026-04-21T10:10:00Z"),
    ];
    const trans = computeCascadeTransitions(events);
    const l1l2 = trans.find((t) => t.from === "L1" && t.to === "L2");
    const l2l4 = trans.find((t) => t.from === "L2" && t.to === "L4");
    expect(l1l2?.count).toBe(1);
    expect(l2l4?.count).toBe(1);
  });
});

describe("offloading quadrants", () => {
  it("high L4 × low transfer = gaming_danger", () => {
    const out = classifyOffloading([
      {
        studentId: "s_game",
        l4Requests: 5,
        assignmentsAttempted: 5,
        transferAxisMean: 0.2,
      },
    ]);
    expect(out[0]!.quadrant).toBe("gaming_danger");
  });

  it("low L4 × high transfer = healthy_srl", () => {
    const out = classifyOffloading([
      {
        studentId: "s_health",
        l4Requests: 1,
        assignmentsAttempted: 5,
        transferAxisMean: 0.8,
      },
    ]);
    expect(out[0]!.quadrant).toBe("healthy_srl");
  });
});
