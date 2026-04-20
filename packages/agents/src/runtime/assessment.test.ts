import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Finding } from "./code-reviewer";
import { gradeSubmission } from "./assessment";

describe("gradeSubmission — 결정적 경로", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  beforeAll(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterAll(() => {
    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("리플렉션 미제출은 즉시 passed=false", async () => {
    const result = await gradeSubmission({
      submission: {
        code: "int main(){return 0;}",
        reflection: {},
        submittedAt: new Date().toISOString(),
      },
      assignment: { id: "A01" },
    });
    expect(result.assessment.passed).toBe(false);
    expect(result.assessment.finalScore).toBe(0);
    expect(result.assessment.evidence[0]!.criterion).toBe("reflection");
  });

  it("hidden test 3/4 통과 + blocker memory-safety 1건", async () => {
    const findings: Finding[] = [
      {
        id: "f001",
        severity: "blocker",
        line: 5,
        category: "memory-safety",
        kc: "arrays-indexing",
        message: "OOB",
        suggestion: "?",
      },
    ];
    const makeInput = (f: Finding[]) => ({
      submission: {
        code: "int main(){return 0;}",
        reflection: {
          Q1_difficult: "포인터로 배열을 받는 부분이 너무 헷갈렸어요.",
          Q4_why: "for 루프로 모든 요소를 돌면 된다고 생각했어요.",
          Q5_next_time: "테스트 케이스를 더 많이 확인하겠어요.",
        },
        submittedAt: new Date().toISOString(),
      },
      assignment: { id: "A03", kcTags: ["arrays-indexing", "control-flow-loop"] },
      hiddenTestResults: [
        { id: 1, passed: true },
        { id: 2, passed: false },
        { id: 3, passed: true },
        { id: 4, passed: true },
      ],
      codeReviewerFindings: f,
      styleWarnings: 0,
    });
    const withBlocker = await gradeSubmission(makeInput(findings));
    const withoutBlocker = await gradeSubmission(makeInput([]));

    expect(withBlocker.assessment.rubricScores.correctness).toBe(0.75);
    expect(withBlocker.assessment.rubricScores.memory_safety).toBe(0.5);
    expect(withoutBlocker.assessment.rubricScores.memory_safety).toBe(1);
    expect(withBlocker.assessment.rubricScores.style).toBe(1);
    // blocker 감점이 실제로 arrays-indexing KC delta에 반영되는지 상대 비교
    expect(withBlocker.assessment.kcDelta["arrays-indexing"]).toBeLessThan(
      withoutBlocker.assessment.kcDelta["arrays-indexing"] ?? 0,
    );
  });

  it("Dependency Factor는 별도 산출, finalScore에 반영되지 않음", async () => {
    const grade1 = await gradeSubmission({
      submission: {
        code: "x",
        reflection: { Q1_difficult: "abc def ghi jkl mno pqr stu vwx yz1 234" },
        submittedAt: new Date().toISOString(),
      },
      assignment: { id: "A" },
      dependencyLog: {
        hintRequests_L1_L2: 1,
        hintRequests_L3_L4: 5,
        acceptedAIBlocks_without_rationale: 3,
        acceptedAIBlocks_total: 4,
        avg_question_depth: 0.2,
      },
    });
    const grade2 = await gradeSubmission({
      submission: {
        code: "x",
        reflection: { Q1_difficult: "abc def ghi jkl mno pqr stu vwx yz1 234" },
        submittedAt: new Date().toISOString(),
      },
      assignment: { id: "A" },
      // dependencyLog 없이
    });
    // 두 제출의 reflection·code가 동일하므로 finalScore도 동일해야 한다
    expect(grade1.assessment.finalScore).toBeCloseTo(grade2.assessment.finalScore, 5);
    expect(grade1.assessment).toBeTruthy(); // dependencyFactor는 서버 응답에만 포함
  });

  it("hidden test 미제공 시 correctness null + evidence.partial", async () => {
    const result = await gradeSubmission({
      submission: {
        code: "x",
        reflection: { Q1_difficult: "hello world my reflection" },
        submittedAt: new Date().toISOString(),
      },
      assignment: { id: "A" },
    });
    expect(result.assessment.rubricScores.correctness).toBeNull();
    const correctnessEvidence = result.assessment.evidence.find((e) => e.criterion === "correctness");
    expect(correctnessEvidence?.partial).toBe(true);
  });
});
