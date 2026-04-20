import { describe, expect, it } from "vitest";

import {
  aggregateMisconceptions,
  buildInterventionQueue,
  summarizeClassroom,
  type StudentData,
} from "./teacher-copilot";

const cohort = "c-1";

const students: StudentData[] = [
  {
    id: "s1",
    displayName: "A",
    cohortId: cohort,
    mastery: { "arrays-indexing": 0.9, "pointer-basics": 0.2 },
    dependencyFactorHistory: [0.1, 0.1, 0.1],
    misconceptions: [],
    recentSubmissions: [
      { assignmentId: "A01", finalScore: 0.9, passed: true, submittedAt: "2026-04-20", errorTypes: [], stagnationSec: 60, hintRequestsL3L4: 0 },
    ],
  },
  {
    id: "s2",
    displayName: "B",
    cohortId: cohort,
    mastery: { "arrays-indexing": 0.3, "pointer-basics": 0.4 },
    dependencyFactorHistory: [0.2, 0.3, 0.3, 0.5, 0.55, 0.6], // 상승 추세
    misconceptions: [
      { kc: "pointer-basics", pattern: "NULL 체크 누락 반복", occurrences: 4 },
    ],
    recentSubmissions: [
      { assignmentId: "A05", finalScore: 0.3, passed: false, submittedAt: "2026-04-20", errorTypes: ["segfault", "segfault"], stagnationSec: 700, hintRequestsL3L4: 3 },
    ],
  },
];

describe("summarizeClassroom", () => {
  it("평균 mastery 계산", () => {
    const s = summarizeClassroom(students, cohort);
    expect(s.studentCount).toBe(2);
    expect(s.avgMasteryByKC["arrays-indexing"]).toBeCloseTo(0.6, 5);
    expect(s.weakKCs).toContain("pointer-basics"); // 0.3 평균
  });
});

describe("buildInterventionQueue", () => {
  it("트리거 충족 학생만 포함, strong이 weak보다 먼저", () => {
    const q = buildInterventionQueue(students, cohort);
    expect(q).toHaveLength(1);
    expect(q[0]!.studentId).toBe("s2");
    expect(q[0]!.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it("아무 트리거 없는 학생은 큐에 포함 안 됨", () => {
    const quiet: StudentData[] = [{ ...students[0]! }];
    const q = buildInterventionQueue(quiet, cohort);
    expect(q).toHaveLength(0);
  });
});

describe("aggregateMisconceptions", () => {
  it("occurrences ≥ 3만 집계, 영향 학생 수 함께 반환", () => {
    const m = aggregateMisconceptions(students, cohort);
    expect(m).toHaveLength(1);
    expect(m[0]!.kc).toBe("pointer-basics");
    expect(m[0]!.affectedStudentCount).toBe(1);
    expect(m[0]!.totalOccurrences).toBe(4);
  });
});
