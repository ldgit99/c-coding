import { z } from "zod";

import { RUNTIME_DEBUGGER_SYSTEM_PROMPT } from "../prompts";
import { cacheSystemPrompt, createAnthropicClient, MODELS } from "./client";

/**
 * Runtime Debugger 런타임 — 이미 실행된 결과를 CS1 학생의 언어로 해석.
 *
 * 원칙: 단일 원인 단정 금지, 2~3개 가설 병렬 제시, hidden test stdout 비노출,
 *        수정 코드 미제공 — 탐구 질문만.
 */

export const HypothesisSchema = z.object({
  cause: z.string().min(1),
  evidence: z.string().min(1),
  kc: z.string(),
  investigationQuestion: z.string().min(1),
});
export type Hypothesis = z.infer<typeof HypothesisSchema>;

export const DebugSchema = z.object({
  errorType: z.enum(["compile", "runtime", "logic", "timeout", "environment", "none"]),
  hypotheses: z.array(HypothesisSchema),
  studentFacingMessage: z.string(),
  stateDelta: z.object({
    errorTypes: z.array(z.string()),
    repeatedErrorCount: z.number().int().min(0),
  }),
});
export type DebugOutput = z.infer<typeof DebugSchema>;

export interface RunResultShape {
  executed: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  errorType?: "compile" | "runtime" | "timeout" | "memory" | "environment";
}

export interface HiddenTestSummary {
  total: number;
  passed: number;
  failedIds?: number[];
  timedOutIds?: number[];
}

export interface DebugInput {
  code: string;
  runResult: RunResultShape;
  /** 숨은 테스트 요약 — stdout은 절대 포함하지 말 것. */
  hiddenTestSummary?: HiddenTestSummary;
  anthropicApiKey?: string;
}

export interface RequestDebugOutput {
  debug: DebugOutput;
  usedModel: string;
  mocked: boolean;
}

export async function debugRun(input: DebugInput): Promise<RequestDebugOutput> {
  if (!(input.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY)) {
    return { debug: mockDebug(input), usedModel: "mock", mocked: true };
  }

  const client = createAnthropicClient(input.anthropicApiKey);
  const model = MODELS.haiku; // research.md §5.2: Runtime Debugger는 Haiku 계층

  const response = await client.messages.create({
    model,
    max_tokens: 800,
    system: cacheSystemPrompt(RUNTIME_DEBUGGER_SYSTEM_PROMPT),
    messages: [{ role: "user", content: formatDebugUserMessage(input) }],
  });
  const text = response.content.map((b) => ("text" in b ? b.text : "")).join("\n");
  return { debug: parseDebugResponse(text, input), usedModel: model, mocked: false };
}

function formatDebugUserMessage(input: DebugInput): string {
  const r = input.runResult;
  const testsBlock = input.hiddenTestSummary
    ? `<hidden_tests>
total: ${input.hiddenTestSummary.total}
passed: ${input.hiddenTestSummary.passed}
failed_ids: ${JSON.stringify(input.hiddenTestSummary.failedIds ?? [])}
timed_out_ids: ${JSON.stringify(input.hiddenTestSummary.timedOutIds ?? [])}
(stdout은 학생에게 노출 금지라 생략)
</hidden_tests>`
    : "";

  return [
    `<student_code>\n${input.code}\n</student_code>`,
    "",
    `<run_result>`,
    `executed: ${r.executed}`,
    `exitCode: ${r.exitCode ?? "null"}`,
    `durationMs: ${r.durationMs}`,
    `errorType: ${r.errorType ?? "none"}`,
    `stderr: ${r.stderr.slice(0, 500)}`,
    `stdout: ${r.stdout.slice(0, 300)}`,
    `</run_result>`,
    "",
    testsBlock,
    "",
    "스킬 규약을 지켜 다음 JSON 스키마로만 응답하라. 가설은 2~3개, 단정형 금지 (\"~일 수도 있다\"):",
    `{
  "errorType": "compile" | "runtime" | "logic" | "timeout" | "environment" | "none",
  "hypotheses": [
    { "cause": "원인 가설 (hedged)", "evidence": "근거 인용", "kc": "kc-slug", "investigationQuestion": "학생이 해볼 진단 질문" }
  ],
  "studentFacingMessage": "학생에게 보여줄 한국어 메시지 (hidden stdout 금지)",
  "stateDelta": { "errorTypes": ["..."], "repeatedErrorCount": 0 }
}`,
  ].join("\n");
}

function parseDebugResponse(text: string, input: DebugInput): DebugOutput {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return DebugSchema.parse(JSON.parse(match[0]));
    } catch {
      // fall through
    }
  }
  return {
    errorType: mapErrorType(input.runResult.errorType),
    hypotheses: [],
    studentFacingMessage: text.trim().slice(0, 300) || "디버거 응답 파싱 실패 — 재시도 필요.",
    stateDelta: { errorTypes: [input.runResult.errorType ?? "unknown"], repeatedErrorCount: 0 },
  };
}

function mapErrorType(e?: string): DebugOutput["errorType"] {
  if (e === "compile" || e === "runtime" || e === "timeout" || e === "environment") return e;
  return "none";
}

function mockDebug(input: DebugInput): DebugOutput {
  const r = input.runResult;
  const errorType = mapErrorType(r.errorType);
  if (errorType === "none" && r.executed && r.exitCode === 0) {
    return {
      errorType: "none",
      hypotheses: [],
      studentFacingMessage: "[mock] 실행 성공. 출력이 기대와 일치하는지 스스로 확인해볼까?",
      stateDelta: { errorTypes: [], repeatedErrorCount: 0 },
    };
  }
  const hypotheses: Hypothesis[] = [];
  if (errorType === "compile") {
    hypotheses.push({
      cause: "[mock] 변수나 함수가 선언되기 전에 사용되었을 가능성.",
      evidence: r.stderr.split("\n").slice(0, 2).join(" "),
      kc: "variables-types",
      investigationQuestion: "stderr의 라인 번호를 찾아 그 위쪽에 선언이 있는지 확인해볼래?",
    });
  } else if (errorType === "timeout") {
    hypotheses.push({
      cause: "[mock] 루프 종료 조건이 실제 충족되지 않아 무한 루프일 수도, 환경 지연일 수도 있다.",
      evidence: `duration=${r.durationMs}ms`,
      kc: "control-flow-loop",
      investigationQuestion: "루프 변수가 반드시 증가하거나 감소하는지 한 번 더 확인해볼 수 있을까?",
    });
  } else if (errorType === "runtime") {
    hypotheses.push({
      cause: "[mock] 배열/포인터가 유효하지 않은 위치를 읽거나 썼을 가능성.",
      evidence: r.stderr.slice(0, 200),
      kc: "pointer-nullcheck",
      investigationQuestion: "어느 포인터가 NULL로 남아있을 가능성이 있는지 코드를 역추적해볼까?",
    });
  } else {
    hypotheses.push({
      cause: "[mock] 실행 환경 문제 (WASM runtime 또는 Judge0 장애).",
      evidence: r.stderr.slice(0, 200),
      kc: "runtime-environment-flake",
      investigationQuestion: "한 번 더 실행했을 때도 같은 오류가 재현되는지 확인해볼까?",
    });
  }
  return {
    errorType,
    hypotheses,
    studentFacingMessage: "[mock] 실행에서 이슈가 감지됐어. 위 가설 중 어느 게 가장 그럴듯한지 먼저 판단해볼까?",
    stateDelta: { errorTypes: [errorType], repeatedErrorCount: 0 },
  };
}
