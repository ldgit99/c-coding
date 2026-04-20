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
  };
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

  const assignmentBlock = input.assignment
    ? `<assignment>\nid: ${input.assignment.id}\nkc_tags: ${JSON.stringify(input.assignment.kcTags ?? [])}\n</assignment>`
    : "<assignment>미배정 (generic review)</assignment>";

  return [
    `<student_code>\n${input.code}\n</student_code>`,
    "",
    assignmentBlock,
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
      "message": "문제 설명 (학생 언어)",
      "suggestion": "확인해볼 질문 형태",
      "proposedCode": "severity=blocker일 때만, ≤5라인 diff"
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
