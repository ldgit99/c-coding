import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { PEDAGOGY_COACH_CHAT_PROMPT, PEDAGOGY_COACH_SYSTEM_PROMPT } from "../prompts";
import type { SessionState } from "../state";
import { cacheSystemPrompt, composeSystem, createAnthropicClient, MODELS } from "./client";
import { applyFading, computeAllowedLevel, type GatingContext, type HintLevel } from "./gating";

/**
 * Pedagogy Coach 런타임 — research.md §5.5 시스템 프롬프트 +
 * socratic-hinting 스킬의 게이팅 규칙 + Anthropic API 호출.
 *
 * 개선 포인트 (2026-04):
 *  - 대화 이력을 multi-turn messages 배열로 전달 (맥락 보존)
 *  - intent='general_chat' 시 탐색 대화용 system prompt 사용
 *  - assignment visibleTests + difficulty, lintFindings, recentError 주입
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

export type PedagogyMode = "hint" | "chat";

export interface PriorTurn {
  role: "student" | "ai";
  text: string;
}

export interface VisibleTest {
  input: string;
  expected: string;
  note?: string;
}

export interface LintFinding {
  line?: number;
  severity: "error" | "warning" | "info";
  message: string;
}

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
  assignmentDifficulty?: number;
  assignmentTitle?: string;
  visibleTests?: VisibleTest[];
  /** 최근 lintC 결과 (에러/경고만). */
  lintFindings?: LintFinding[];
  /** 최근 /api/run 실행 결과 — 컴파일 실패 또는 런타임 오류 메시지. */
  recentError?: string;
  /** 최근 대화 턴 (8턴 이내 권장) — messages 배열로 직렬화. */
  priorTurns?: PriorTurn[];
  /** 'chat' 이면 탐색 대화 프롬프트, 'hint' 이면 단계적 힌트 프롬프트. */
  pedagogyMode?: PedagogyMode;
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
  const pedagogyMode: PedagogyMode = input.pedagogyMode ?? "hint";

  const gatingCtx: GatingContext = {
    state: input.sessionState,
    requestedLevel,
    restatedProblem: input.restatedProblem,
    namedStuckPoint: input.namedStuckPoint,
  };
  const gatingResult = computeAllowedLevel(gatingCtx);
  const relatedKC = [...(input.sessionState.currentKC ?? []), ...(input.assignmentKC ?? [])];
  const uniqueKC = Array.from(new Set(relatedKC));
  const fadedLevel = applyFading(gatingResult.grantedLevel, input.sessionState, uniqueKC);
  const fadedFrom = fadedLevel !== gatingResult.grantedLevel ? gatingResult.grantedLevel : undefined;

  // API key 미설정 시 mock 응답 — 개발·데모 환경용.
  if (!(input.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY)) {
    return {
      hint: mockHint(fadedLevel, uniqueKC, gatingResult.failedConditions),
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

  const userContext = buildUserContext(input, fadedLevel, gatingResult.failedConditions, uniqueKC);
  const messages = buildMessages(input.priorTurns ?? [], userContext);

  const basePrompt =
    pedagogyMode === "chat" ? PEDAGOGY_COACH_CHAT_PROMPT : PEDAGOGY_COACH_SYSTEM_PROMPT;
  const systemBlocks =
    gatingResult.failedConditions.length > 0 && pedagogyMode === "hint"
      ? composeSystem([basePrompt], gatingContextNote(gatingResult.failedConditions, fadedLevel))
      : cacheSystemPrompt(basePrompt);

  const response = await client.messages.create({
    model,
    max_tokens: 700,
    system: systemBlocks,
    messages,
  });

  const text = response.content
    .map((b) => ("text" in b ? b.text : ""))
    .join("\n");

  const hint = parseHintResponse(text, fadedLevel, uniqueKC);

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

/** priorTurns → Anthropic messages 배열로 직렬화하고, 마지막에 현재 맥락+발화 붙임. */
function buildMessages(
  priorTurns: PriorTurn[],
  userContextBlock: string,
): Anthropic.Messages.MessageParam[] {
  const messages: Anthropic.Messages.MessageParam[] = [];

  // priorTurns 를 user/assistant 로 매핑. 최근 8턴 이내만 (과도한 토큰 방지).
  const recent = priorTurns.slice(-8);
  for (const t of recent) {
    messages.push({
      role: t.role === "student" ? "user" : "assistant",
      content: t.text,
    });
  }

  // 현재 학생 메시지는 userContextBlock 에 포함. 마지막 메시지가 user 로 끝나도록 보장.
  if (messages.length > 0 && messages.at(-1)!.role === "user") {
    // 마지막이 user 로 끝나면 (학생 발화 직후) — 그 직전 user 메시지를 덮어쓰지 않고
    // assistant placeholder 를 넣어 마지막을 user 로 새로 만든다.
    messages.push({
      role: "assistant",
      content: "(학생의 새 메시지를 기다리는 중…)",
    });
  }
  messages.push({ role: "user", content: userContextBlock });
  return messages;
}

function buildUserContext(
  input: RequestHintInput,
  grantedLevel: HintLevel,
  failed: string[],
  uniqueKC: string[],
): string {
  const signals = input.sessionState.learningSignals;
  const lines: string[] = [];

  // Assignment 블록
  if (input.assignmentTemplate || input.assignmentTitle) {
    lines.push(`<assignment>`);
    if (input.assignmentTitle) lines.push(`제목: ${input.assignmentTitle}`);
    if (typeof input.assignmentDifficulty === "number") {
      lines.push(`난이도: ${input.assignmentDifficulty}/5`);
    }
    if (uniqueKC.length > 0) lines.push(`KC: ${uniqueKC.join(", ")}`);
    if (input.assignmentTemplate) {
      lines.push("", "설명:", input.assignmentTemplate);
    }
    if (input.visibleTests && input.visibleTests.length > 0) {
      lines.push("", "공개 테스트 케이스:");
      for (const t of input.visibleTests.slice(0, 3)) {
        const inputLine = t.input && t.input.trim().length > 0 ? t.input : "(입력 없음)";
        lines.push(`  입력: ${inputLine}`);
        lines.push(`  기대 출력: ${t.expected.trimEnd()}`);
        if (t.note) lines.push(`  노트: ${t.note}`);
      }
    }
    lines.push(`</assignment>`, "");
  }

  // 학생 코드
  if (input.editorCode && input.editorCode.trim().length > 0) {
    lines.push(`<student_code>`);
    lines.push(input.editorCode);
    lines.push(`</student_code>`, "");
  }

  // Lint findings
  if (input.lintFindings && input.lintFindings.length > 0) {
    lines.push(`<lint_findings>`);
    for (const f of input.lintFindings.slice(0, 5)) {
      lines.push(`[${f.severity}] ${f.line ? `L${f.line} ` : ""}${f.message}`);
    }
    lines.push(`</lint_findings>`, "");
  }

  // 최근 실행 에러
  if (input.recentError && input.recentError.trim().length > 0) {
    lines.push(`<recent_error>`);
    lines.push(input.recentError.slice(0, 800));
    lines.push(`</recent_error>`, "");
  }

  // 학생 발화
  lines.push(`<student_utterance>${input.utterance}</student_utterance>`, "");

  // 세션 상태
  lines.push(
    `<session>`,
    `mode: ${input.sessionState.mode}`,
    `support_level: ${input.sessionState.supportLevel}`,
    `attemptCount: ${signals?.attemptCount ?? 0}`,
    `stagnationSec: ${signals?.stagnationSec ?? 0}`,
    `repeatedErrorCount: ${signals?.repeatedErrorCount ?? 0}`,
    `hintRequests: ${signals?.hintRequests ?? 0}`,
    `</session>`,
    "",
    `<constraint>`,
    `Granted level: ${grantedLevel} (${HINT_LEVEL_TYPE[grantedLevel]})`,
    failed.length > 0 ? `Gating failures: ${failed.join("; ")}` : "All gating conditions satisfied.",
    `구체성 강제: 학생 코드가 있으면 변수명·라인 번호·조건을 반드시 언급하라. 일반론 금지.`,
    `</constraint>`,
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
