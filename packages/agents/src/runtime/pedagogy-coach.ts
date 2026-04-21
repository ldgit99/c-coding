import { z } from "zod";

import { PEDAGOGY_COACH_SYSTEM_PROMPT } from "../prompts";
import type { SessionState } from "../state";
import { cacheSystemPrompt, composeSystem, createAnthropicClient, MODELS } from "./client";
import { applyFading, computeAllowedLevel, type GatingContext, type HintLevel } from "./gating";

/**
 * Pedagogy Coach 런타임 — research.md §5.5 시스템 프롬프트 +
 * socratic-hinting 스킬의 게이팅 규칙 + Anthropic API 호출.
 */

export const HintSchema = z.object({
  hintLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  hintType: z.enum(["question", "concept", "pseudocode", "example"]),
  message: z.string().min(1),
  relatedKC: z.array(z.string()).default(() => []),
  requiresSelfExplanation: z.boolean().default(false),
  stateDelta: z
    .object({
      supportLevel: z.number().int().min(0).max(3),
      hintRequests: z.number().int().min(0),
      aiDependencyScore: z.number().min(0).max(1).optional(),
    })
    .optional(),
});
export type Hint = z.infer<typeof HintSchema>;

export interface RequestHintInput {
  utterance: string;
  sessionState: SessionState;
  /** 학생이 명시적으로 요청한 레벨 (UI의 계단식 버튼). 미지정이면 현재 +1. */
  requestedLevel?: HintLevel;
  /** 휴리스틱 — 학생 문장에 문제 재진술이 포함되는가. */
  restatedProblem?: boolean;
  namedStuckPoint?: boolean;
  /** 학생 현재 에디터 코드 — prompt의 <student_code> 블록으로 주입. */
  editorCode?: string;
  /** 현재 과제 정보 — 문제 설명을 prompt에 포함해 컨텍스트 일관성 확보. */
  assignmentTemplate?: string;
  assignmentKC?: string[];
  anthropicApiKey?: string;
}

export interface RequestHintOutput {
  hint: Hint;
  gating: { grantedLevel: HintLevel; failedConditions: string[]; fadedFrom?: HintLevel };
  usedModel: string;
  mocked: boolean;
}

const HINT_LEVEL_TYPE: Record<HintLevel, Hint["hintType"]> = {
  1: "question",
  2: "concept",
  3: "pseudocode",
  4: "example",
};

export async function requestHint(input: RequestHintInput): Promise<RequestHintOutput> {
  const currentSupport = input.sessionState.supportLevel ?? 0;
  const defaultRequest = Math.min(currentSupport + 1, 4) as HintLevel;
  const requestedLevel = input.requestedLevel ?? defaultRequest;

  const gatingCtx: GatingContext = {
    state: input.sessionState,
    requestedLevel,
    restatedProblem: input.restatedProblem,
    namedStuckPoint: input.namedStuckPoint,
  };
  const gatingResult = computeAllowedLevel(gatingCtx);
  const relatedKC = input.sessionState.currentKC ?? [];
  const fadedLevel = applyFading(gatingResult.grantedLevel, input.sessionState, relatedKC);
  const fadedFrom = fadedLevel !== gatingResult.grantedLevel ? gatingResult.grantedLevel : undefined;

  // API key 미설정 시 mock 응답 — 개발·데모 환경용.
  if (!(input.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY)) {
    return {
      hint: mockHint(fadedLevel, relatedKC, gatingResult.failedConditions),
      gating: {
        grantedLevel: fadedLevel,
        failedConditions: gatingResult.failedConditions,
        fadedFrom,
      },
      usedModel: "mock",
      mocked: true,
    };
  }

  const client = createAnthropicClient(input.anthropicApiKey);
  const model = MODELS.sonnet;

  const userMessage = formatUserMessage(input, fadedLevel, gatingResult.failedConditions);
  const systemBlocks =
    gatingResult.failedConditions.length > 0
      ? composeSystem([PEDAGOGY_COACH_SYSTEM_PROMPT], gatingContextNote(gatingResult.failedConditions, fadedLevel))
      : cacheSystemPrompt(PEDAGOGY_COACH_SYSTEM_PROMPT);

  const response = await client.messages.create({
    model,
    max_tokens: 600,
    system: systemBlocks,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content
    .map((b) => ("text" in b ? b.text : ""))
    .join("\n");

  const hint = parseHintResponse(text, fadedLevel, relatedKC);

  return {
    hint,
    gating: {
      grantedLevel: fadedLevel,
      failedConditions: gatingResult.failedConditions,
      fadedFrom,
    },
    usedModel: model,
    mocked: false,
  };
}

function formatUserMessage(
  input: RequestHintInput,
  grantedLevel: HintLevel,
  failed: string[],
): string {
  const signals = input.sessionState.learningSignals;
  const lines: string[] = [];

  if (input.assignmentTemplate) {
    lines.push(`<assignment>`);
    lines.push(input.assignmentTemplate);
    if (input.assignmentKC && input.assignmentKC.length > 0) {
      lines.push(`KC tags: ${input.assignmentKC.join(", ")}`);
    }
    lines.push(`</assignment>`, "");
  }

  // 학생의 현재 에디터 코드를 주석·문자열 주입 방지를 위해 <student_code>로 감싼다.
  if (input.editorCode && input.editorCode.trim().length > 0) {
    lines.push(`<student_code>`);
    lines.push(input.editorCode);
    lines.push(`</student_code>`, "");
  }

  lines.push(
    `<student_utterance>${input.utterance}</student_utterance>`,
    "",
    `<session_state>`,
    `mode: ${input.sessionState.mode}`,
    `support_level: ${input.sessionState.supportLevel}`,
    `attemptCount: ${signals?.attemptCount ?? 0}`,
    `stagnationSec: ${signals?.stagnationSec ?? 0}`,
    `repeatedErrorCount: ${signals?.repeatedErrorCount ?? 0}`,
    `hintRequests: ${signals?.hintRequests ?? 0}`,
    `current_KC: ${JSON.stringify(input.sessionState.currentKC ?? [])}`,
    `</session_state>`,
    "",
    `<constraint>`,
    `Granted level: ${grantedLevel} (${HINT_LEVEL_TYPE[grantedLevel]})`,
    failed.length > 0 ? `Gating failures: ${failed.join("; ")}` : "All gating conditions satisfied.",
    `학생 코드가 주어졌으면 질문·개념·의사코드·예시 모두 실제 코드 지점(변수·라인 번호·조건)을 언급해 구체적으로. 일반 답변 금지.`,
    `</constraint>`,
    "",
    "다음 JSON 스키마로만 응답하라 (다른 텍스트 금지):",
    `{
  "hintLevel": ${grantedLevel},
  "hintType": "${HINT_LEVEL_TYPE[grantedLevel]}",
  "message": "학생에게 보여줄 한국어 메시지",
  "relatedKC": ["kc-slug-1"],
  "requiresSelfExplanation": false
}`,
  );
  return lines.join("\n");
}

function gatingContextNote(failed: string[], level: HintLevel): string {
  return [
    "추가 제약: 학생이 더 높은 레벨을 요청했지만 게이팅 규칙이 충족되지 않았다.",
    `실패한 조건: ${failed.join("; ")}`,
    `허용된 레벨: ${level}. 이 레벨에 맞춰 응답하고, 왜 상위 레벨이 지금 열리지 않는지 부드럽게 반사 질문으로 전달하라.`,
  ].join("\n");
}

function parseHintResponse(text: string, level: HintLevel, relatedKC: string[]): Hint {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = HintSchema.parse(JSON.parse(jsonMatch[0]));
      return parsed;
    } catch {
      // fall through
    }
  }
  // 파싱 실패 — 안전 폴백
  return {
    hintLevel: level,
    hintType: HINT_LEVEL_TYPE[level],
    message: text.trim().slice(0, 500) || "죄송, 힌트를 생성하지 못했어. 다시 시도해볼래?",
    relatedKC,
    requiresSelfExplanation: false,
  };
}

function mockHint(level: HintLevel, relatedKC: string[], failed: string[]): Hint {
  const fallbackMessages: Record<HintLevel, string> = {
    1: "[mock] 지금 해결하려는 문제가 정확히 뭐라고 생각해? 입력이 뭐고 출력이 뭐인지 네 말로 설명해줄래?",
    2: "[mock] 관련 개념을 잠깐 짚어보자. 배열을 순회할 때 유효한 인덱스 범위가 어디까지인지 다시 확인해보면 어떨까?",
    3: "[mock] 의사코드로 접근해볼까? 1) 합계 변수 초기화 → 2) 각 요소 누적 → 3) 종료 조건 검토. 이 흐름에서 어느 단계가 네 코드와 다른지 비교해볼 수 있어?",
    4: "[mock] 예시 코드 한 줄 힌트: `for (int i = 0; i < n; i++)` — 경계 조건에 주의. 왜 `<=`가 아니라 `<`인지 설명해줄 수 있을까?",
  };
  const suffix = failed.length > 0 ? `\n(게이팅: ${failed[0]})` : "";
  return {
    hintLevel: level,
    hintType: HINT_LEVEL_TYPE[level],
    message: fallbackMessages[level] + suffix,
    relatedKC,
    requiresSelfExplanation: level === 4,
  };
}
