import type { SessionState } from "../state";
import { cacheSystemPrompt, createAnthropicClient, MODELS } from "./client";

/**
 * Supervisor — 학생/교사 발화를 분류해 적합한 전문가로 라우팅.
 *
 * 기본: Haiku 4.5 를 호출해 intent 분류. ANTHROPIC_API_KEY 없거나 LLM 실패 시
 * regex 휴리스틱으로 폴백. 반환 인터페이스는 동일.
 *
 * 추가 intent: 'general_chat' — 개념 탐색·감정·상황 공유. Pedagogy Coach
 * 탐색 대화(PEDAGOGY_COACH_CHAT_PROMPT) 로 라우팅.
 */

export type RouteTarget =
  | "pedagogy-coach"
  | "code-reviewer"
  | "runtime-debugger"
  | "assessment"
  | "problem-architect"
  | "teacher-copilot"
  | "safety-guard";

export type Intent =
  | "hint_request"
  | "code_submit"
  | "run_request"
  | "code_review_request"
  | "grade_submit"
  | "problem_generate"
  | "dashboard_summary"
  | "general_chat";

export interface ClassifyInput {
  actor: "student" | "teacher";
  utterance: string;
  sessionState: SessionState;
  /** 현재 에디터 코드. code-first gate 판정에 사용. */
  editorHasCode: boolean;
}

export interface ClassifyResult {
  intent: Intent;
  route: RouteTarget;
  reason: string;
  blockedByCodeFirstGate?: boolean;
}

const HINT_PATTERNS = [/힌트/, /알려\s*줘/, /모르겠/, /어떻게\s*해/, /도와\s*줘/, /hint/i, /help/i];
const RUN_PATTERNS = [/실행/, /돌려/, /run/i, /컴파일/];
const REVIEW_PATTERNS = [/리뷰/, /검토/, /확인/, /맞아/, /틀렸/];
const SUBMIT_PATTERNS = [/제출/, /채점/, /submit/i];
const PROBLEM_GEN_PATTERNS = [/과제\s*(생성|만들|추가)/, /variant/, /새\s*문제/];
const DASHBOARD_PATTERNS = [/대시보드/, /요약/, /intervention/i, /현황/];

export function classify(input: ClassifyInput): ClassifyResult {
  const text = input.utterance;

  if (input.actor === "teacher") {
    if (PROBLEM_GEN_PATTERNS.some((p) => p.test(text))) {
      return { intent: "problem_generate", route: "problem-architect", reason: "교사 + 과제 생성 키워드" };
    }
    if (DASHBOARD_PATTERNS.some((p) => p.test(text))) {
      return { intent: "dashboard_summary", route: "teacher-copilot", reason: "교사 + 대시보드 키워드" };
    }
    return { intent: "general_chat", route: "teacher-copilot", reason: "교사 기본 라우팅" };
  }

  // 학생 경로 — 안전 우선 키워드 먼저 (submit/run 은 항상 regex)
  if (SUBMIT_PATTERNS.some((p) => p.test(text))) {
    return { intent: "grade_submit", route: "assessment", reason: "학생 + 제출 키워드" };
  }
  if (RUN_PATTERNS.some((p) => p.test(text))) {
    return { intent: "run_request", route: "runtime-debugger", reason: "학생 + 실행 키워드" };
  }
  if (REVIEW_PATTERNS.some((p) => p.test(text))) {
    if (!input.editorHasCode) {
      return {
        intent: "hint_request",
        route: "pedagogy-coach",
        reason: "코드 미작성 → code-first gate — 리뷰 요청을 힌트로 재라우팅",
        blockedByCodeFirstGate: true,
      };
    }
    return { intent: "code_review_request", route: "code-reviewer", reason: "학생 + 리뷰 키워드" };
  }
  if (HINT_PATTERNS.some((p) => p.test(text))) {
    return { intent: "hint_request", route: "pedagogy-coach", reason: "학생 + 힌트 키워드" };
  }

  // 분류 모호 → Pedagogy Coach 탐색 대화 (자연 대화 모드)
  return {
    intent: "general_chat",
    route: "pedagogy-coach",
    reason: "분류 모호 — 탐색 대화 라우팅",
  };
}

/**
 * LLM 기반 분류 — Haiku 4.5 사용, prompt caching 으로 비용 ~1/10.
 * env 없거나 네트워크 실패 시 regex classify() 로 자동 폴백.
 */
const CLASSIFY_SYSTEM_PROMPT = `
당신은 CS1 프로그래밍 튜터 플랫폼의 발화 분류기입니다.
학생 입력을 아래 6 intent 중 정확히 하나로 분류하세요.

intents:
  hint_request        — 학생이 힌트·도움·단계적 안내를 명시적으로 요청
  code_review_request — "내 코드 봐줘/검토/리뷰" 류 (코드가 이미 있을 때만 유효)
  run_request         — "실행/돌려줘/컴파일" 류
  grade_submit        — "제출/채점"
  general_chat        — 개념 탐색, "이게 뭐야/왜 이래", 감정·상황 공유, 일반 대화
  hint_request_implicit — 학생이 문제를 헤매는 정황("모르겠어", "왜 안 되지")

명확히 힌트를 요청한 경우만 hint_request. 막연한 혼란은 general_chat.

응답 형식 (JSON 한 덩어리만):
{"intent": "<name>", "confidence": 0.0-1.0}
`.trim();

export async function classifyLLM(
  input: ClassifyInput,
  opts: { anthropicApiKey?: string; timeoutMs?: number } = {},
): Promise<ClassifyResult> {
  if (!(opts.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY)) {
    return classify(input);
  }

  try {
    const client = createAnthropicClient(opts.anthropicApiKey);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 2500);
    const res = await client.messages.create(
      {
        model: MODELS.haiku,
        max_tokens: 80,
        system: cacheSystemPrompt(CLASSIFY_SYSTEM_PROMPT),
        messages: [
          {
            role: "user",
            content: [
              `<actor>${input.actor}</actor>`,
              `<editor_has_code>${input.editorHasCode}</editor_has_code>`,
              `<utterance>${input.utterance}</utterance>`,
            ].join("\n"),
          },
        ],
      },
      { signal: controller.signal },
    );
    clearTimeout(timer);
    const text = res.content.map((b) => ("text" in b ? b.text : "")).join("\n");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return classify(input);
    const parsed = JSON.parse(m[0]) as { intent?: string; confidence?: number };
    return mapLLMIntent(parsed.intent ?? "", input);
  } catch {
    return classify(input);
  }
}

function mapLLMIntent(intent: string, input: ClassifyInput): ClassifyResult {
  switch (intent) {
    case "grade_submit":
      return { intent: "grade_submit", route: "assessment", reason: "LLM 분류 · 제출" };
    case "run_request":
      return { intent: "run_request", route: "runtime-debugger", reason: "LLM 분류 · 실행" };
    case "code_review_request":
      if (!input.editorHasCode) {
        return {
          intent: "hint_request",
          route: "pedagogy-coach",
          reason: "LLM 분류 · 리뷰 요청이나 코드 미작성 → 힌트로 재라우팅",
          blockedByCodeFirstGate: true,
        };
      }
      return {
        intent: "code_review_request",
        route: "code-reviewer",
        reason: "LLM 분류 · 코드 리뷰",
      };
    case "hint_request":
    case "hint_request_implicit":
      return { intent: "hint_request", route: "pedagogy-coach", reason: "LLM 분류 · 힌트" };
    case "general_chat":
      return {
        intent: "general_chat",
        route: "pedagogy-coach",
        reason: "LLM 분류 · 탐색 대화",
      };
    default:
      return classify(input);
  }
}
