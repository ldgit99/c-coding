import { z } from "zod";

import { CODE_REVIEWER_SYSTEM_PROMPT } from "../prompts";
import { cacheSystemPrompt, createAnthropicClient, MODELS } from "./client";
import { flushTrace, recordGeneration, startTrace } from "./observability";

/**
 * Code Reviewer 런타임 — c-code-review 스킬 규약 구현.
 *
 * 3축 분석 순서: correctness → memory-safety → style (상위 실패 시 하위 보류).
 * Novice 학생에게는 topIssues 1~2개만 초기 노출, proposedCode는 blocker에만.
 */

export const FindingSchema = z.object({
  id: z.string(),
  severity: z.enum(["blocker", "major", "minor", "style"]),
  line: z.number().int().min(0),
  column: z.number().int().min(0).optional(),
  category: z.enum(["correctness", "memory-safety", "style"]),
  kc: z.string(),
  message: z.string().min(1),
  suggestion: z.string().min(1),
  proposedCode: z.string().optional(),
  evidence: z
    .object({
      lintToolRule: z.string().optional(),
      stdErrExcerpt: z.string().optional(),
    })
    .optional(),
});
export type Finding = z.infer<typeof FindingSchema>;

export const ReviewSchema = z.object({
  findings: z.array(FindingSchema),
  topIssues: z.array(z.string()),
  analysisMode: z.enum(["lint+llm", "llm-only"]),
  summary: z.string(),
});
export type ReviewOutput = z.infer<typeof ReviewSchema>;

export interface LintWarning {
  rule: string;
  line: number;
  column: number;
  message: string;
  severity: "warning" | "error";
}

export interface ReviewInput {
  code: string;
  assignment?: {
    id: string;
    kcTags?: string[];
    rubric?: Record<string, number>;
    /** 문제 명세 본문 — LLM이 학생 의도를 추측하지 않도록 정확한 스펙을 제공. */
    template?: string;
    /** 학생에게 공개된 입출력 예시 — 정답 출력 형식 검증용. */
    visibleTests?: Array<{ input: string; expected: string; note?: string }>;
  };
  /**
   * 참고 정답 — LLM 의 행위적 동등성 비교 근거로만 사용. 학생 응답에
   * 절대 인용·노출 금지 (시스템 프롬프트의 HARD RULE 로도 명시됨).
   */
  referenceSolution?: string;
  /** 학생이 직전에 ▶실행으로 받은 결과 — 통과 신호로 환각 BLOCKER 차단. */
  lastRunResult?: {
    status: "ok" | "compile_error" | "runtime_error" | "timeout" | "signal";
    stdout?: string;
    stderr?: string;
    exitCode?: number | null;
  };
  /** 0~1. /api/submit 에서 hidden tests 가 실행됐다면 그 통과율. */
  hiddenTestPassRatio?: number;
  studentLevel?: "novice" | "intermediate";
  lintResult?: { executed: boolean; warnings: LintWarning[] };
  anthropicApiKey?: string;
}

export interface RequestReviewOutput {
  review: ReviewOutput;
  usedModel: string;
  mocked: boolean;
}

export async function reviewCode(input: ReviewInput): Promise<RequestReviewOutput> {
  // API key 없으면 mock — 개발·데모용
  if (!(input.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY)) {
    return {
      review: mockReview(input),
      usedModel: "mock",
      mocked: true,
    };
  }

  const client = createAnthropicClient(input.anthropicApiKey);
  const model = MODELS.sonnet;
  const analysisMode: ReviewOutput["analysisMode"] = input.lintResult?.executed ? "lint+llm" : "llm-only";

  const userMessage = formatReviewUserMessage(input, analysisMode);

  const trace = startTrace({
    name: "code-reviewer",
    metadata: { assignmentId: input.assignment?.id, analysisMode },
    tags: ["code-reviewer", analysisMode],
  });
  const startedAt = new Date();

  const response = await client.messages.create({
    model,
    max_tokens: 1200,
    system: cacheSystemPrompt(CODE_REVIEWER_SYSTEM_PROMPT),
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content.map((b) => ("text" in b ? b.text : "")).join("\n");
  const review = parseReviewResponse(text, analysisMode);
  // 방어선 — LLM 이 system prompt 를 어기고 proposedCode 를 냈더라도 제거.
  for (const f of review.findings) {
    if (f.proposedCode) delete (f as { proposedCode?: string }).proposedCode;
  }
  // 결정적 후처리 — 통과 신호가 있으면 correctness BLOCKER 환각 차단.
  // 학생 코드가 이미 동작 검증된 정답일 때 LLM 이 환각 BLOCKER 를 내면
  // 학생 학습을 가로막는다. 외부 신호(hidden test 통과 / 컴파일 성공) 로
  // severity 를 결정적으로 강등.
  downgradeHallucinatedBlockers(review, input);

  recordGeneration(trace, {
    name: "code-reviewer.messages.create",
    model,
    input: userMessage,
    output: text,
    startTime: startedAt,
    endTime: new Date(),
    usage: {
      promptTokens: response.usage?.input_tokens,
      completionTokens: response.usage?.output_tokens,
    },
    metadata: { findingsCount: review.findings.length, topIssues: review.topIssues },
  });
  await flushTrace(trace);

  return { review, usedModel: model, mocked: false };
}

function formatReviewUserMessage(input: ReviewInput, mode: ReviewOutput["analysisMode"]): string {
  const lintBlock = input.lintResult?.executed
    ? `<lint_result>\n${JSON.stringify(input.lintResult, null, 2)}\n</lint_result>`
    : "<lint_result>clang-tidy 미실행 — LLM 단독 분석</lint_result>";

  const assignment = input.assignment;
  const assignmentLines: string[] = [];
  if (assignment) {
    assignmentLines.push(`id: ${assignment.id}`);
    assignmentLines.push(`kc_tags: ${JSON.stringify(assignment.kcTags ?? [])}`);
    if (assignment.template) {
      assignmentLines.push("---");
      assignmentLines.push(assignment.template);
    }
  }
  const assignmentBlock =
    assignmentLines.length > 0
      ? `<assignment>\n${assignmentLines.join("\n")}\n</assignment>`
      : "<assignment>미배정 (generic review)</assignment>";

  const visibleTestsBlock =
    assignment?.visibleTests && assignment.visibleTests.length > 0
      ? `<visible_tests>\n${JSON.stringify(assignment.visibleTests, null, 2)}\n</visible_tests>`
      : "";

  // 참고 정답은 판정 *근거* 로만 노출 — system prompt 가 학생 응답 인용을 금지.
  // 길이가 너무 길어 cache 효율을 떨어뜨리지 않도록 첫 4KB 만 전달.
  const refBlock = input.referenceSolution
    ? `<reference_solution note="DO NOT quote in findings — judgement basis only">\n${input.referenceSolution.slice(0, 4000)}\n</reference_solution>`
    : "";

  // 통과 신호 — LLM 이 환각 BLOCKER 를 내지 않도록 명시적으로 통과 사실 알림.
  const signalLines: string[] = [];
  if (input.lastRunResult) {
    signalLines.push(`last_run_status: ${input.lastRunResult.status}`);
    if (input.lastRunResult.stderr) {
      signalLines.push(
        `last_run_stderr_excerpt: ${input.lastRunResult.stderr.slice(0, 500)}`,
      );
    }
  }
  if (typeof input.hiddenTestPassRatio === "number") {
    signalLines.push(
      `hidden_test_pass_ratio: ${input.hiddenTestPassRatio.toFixed(2)} (1.0 = all passed)`,
    );
  }
  const runtimeSignalsBlock =
    signalLines.length > 0
      ? `<runtime_signals>\n${signalLines.join("\n")}\n</runtime_signals>`
      : "";

  return [
    `<student_code>\n${input.code}\n</student_code>`,
    "",
    assignmentBlock,
    visibleTestsBlock,
    refBlock,
    runtimeSignalsBlock,
    "",
    lintBlock,
    "",
    `<student_level>${input.studentLevel ?? "novice"}</student_level>`,
    "",
    "스킬 규약(c-code-review)을 지켜 다음 JSON 스키마로만 응답하라. JSON 외 텍스트 금지:",
    `{
  "findings": [
    {
      "id": "f001",
      "severity": "blocker" | "major" | "minor" | "style",
      "line": 0,
      "column": 0,
      "category": "correctness" | "memory-safety" | "style",
      "kc": "kc-slug",
      "message": "문제 설명 (수정 방법 언급 금지)",
      "suggestion": "학생이 스스로 수정법을 떠올리도록 유도하는 한국어 질문"
    }
  ],
  "topIssues": ["f001"],
  "analysisMode": "${mode}",
  "summary": "1~2문장 요약"
}`,
  ].join("\n");
}

function parseReviewResponse(text: string, mode: ReviewOutput["analysisMode"]): ReviewOutput {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return ReviewSchema.parse(JSON.parse(match[0]));
    } catch {
      // fall through
    }
  }
  return {
    findings: [],
    topIssues: [],
    analysisMode: mode,
    summary: text.trim().slice(0, 300) || "리뷰 생성 실패 — 재시도 필요.",
  };
}

/**
 * 통과 신호 기반 BLOCKER 강등.
 *
 * - hidden test 100% 통과: correctness 카테고리의 BLOCKER · MAJOR 모두 minor 로
 *   강등 (코드는 사실상 정답이므로 학생을 막을 이유 없음).
 * - lastRunResult.status === "ok" : correctness BLOCKER → MAJOR 강등 (실행은
 *   됐으니 logic bug 가능성은 있으나 BLOCKER 는 아님).
 * - lastRunResult.status === "compile_error" : 강등 안 함 (LLM 이 컴파일러보다
 *   원인을 잘 짚을 수 있음).
 * - topIssues 도 비어버린 finding ID 는 정리.
 */
function downgradeHallucinatedBlockers(review: ReviewOutput, input: ReviewInput): void {
  const allHiddenPassed =
    typeof input.hiddenTestPassRatio === "number" && input.hiddenTestPassRatio >= 0.999;
  const runOk = input.lastRunResult?.status === "ok";

  if (!allHiddenPassed && !runOk) return;

  for (const f of review.findings) {
    if (f.category !== "correctness") continue;
    if (allHiddenPassed) {
      // BLOCKER · MAJOR → minor (학생에게 메시지는 보여주되 차단하지 않음)
      if (f.severity === "blocker" || f.severity === "major") {
        f.severity = "minor";
        f.message = `[자동 강등 — hidden test 전부 통과] ${f.message}`;
      }
    } else if (runOk && f.severity === "blocker") {
      f.severity = "major";
      f.message = `[자동 강등 — 컴파일·실행 성공] ${f.message}`;
    }
  }
}

function mockReview(input: ReviewInput): ReviewOutput {
  // off-by-one 패턴 감지(휴리스틱) — 데모·테스트 용
  const hasOffByOne = /for\s*\([^)]*<=\s*\w+\s*;[^)]*\)/.test(input.code);
  if (hasOffByOne) {
    const match = input.code.match(/for\s*\([^)]*<=\s*\w+/);
    const line =
      (match ? input.code.slice(0, match.index ?? 0).split("\n").length : 1) || 1;
    const findings: Finding[] = [
      {
        id: "f001",
        severity: "blocker",
        line,
        category: "memory-safety",
        kc: "arrays-indexing",
        message: "[mock] 반복 조건이 `i <= n`이라 i=n일 때 arr[n]을 읽는데, 크기가 n인 배열의 유효 인덱스는 0..n-1까지다.",
        suggestion: "확인해볼 질문: 크기가 n인 배열에서 접근할 수 있는 가장 큰 인덱스는? 현재 조건을 그 경계에 맞추려면 어떤 연산자를 써야 할까?",
        proposedCode: "-    for (int i = 0; i <= n; i++)\n+    for (int i = 0; i < n; i++)",
      },
    ];
    return {
      findings,
      topIssues: ["f001"],
      analysisMode: input.lintResult?.executed ? "lint+llm" : "llm-only",
      summary: "[mock] 배열 경계를 1 넘어 읽는 off-by-one OOB가 blocker.",
    };
  }
  return {
    findings: [],
    topIssues: [],
    analysisMode: input.lintResult?.executed ? "lint+llm" : "llm-only",
    summary: "[mock] 눈에 띄는 문제는 없지만 정답성 검증 전이다. 실행 테스트로 확인해보자.",
  };
}
