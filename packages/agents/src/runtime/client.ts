import Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic 클라이언트 팩토리 — research.md §7.2 모델 전략 구현.
 *
 * 모델 계층화:
 * - Haiku 4.5: 분류·필터·가벼운 요약 (Supervisor, Safety Guard, Runtime Debugger)
 * - Sonnet 4.6: 일상적 튜터링·리뷰·채점 (기본 엔진)
 * - Opus 4.7: 과제 생성, 교사 Copilot 고품질 보고서
 *
 * Prompt caching을 기본 활성화 — 시스템 프롬프트가 ephemeral 캐시로 마킹되어
 * 5분 TTL 내 재사용 시 최대 90% 비용 절감 (Anthropic 공식 수치).
 */

export const MODELS = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-7",
} as const;

export type ModelTier = keyof typeof MODELS;

export function createAnthropicClient(apiKey?: string): Anthropic {
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY가 설정되지 않았다. apps/student/.env.local을 확인하라.",
    );
  }
  return new Anthropic({ apiKey: key });
}

/**
 * 시스템 프롬프트를 ephemeral 캐시 제어가 붙은 system block 배열로 래핑.
 * messages.create()에 `system: cacheSystemPrompt(prompt)` 형태로 주입.
 */
export function cacheSystemPrompt(
  text: string,
): Anthropic.Messages.TextBlockParam[] {
  return [
    {
      type: "text",
      text,
      cache_control: { type: "ephemeral" },
    },
  ];
}

/**
 * 여러 시스템 파트(예: 역할 정의 + 현재 과제 스펙)를 조립하면서
 * 마지막 파트에만 캐시 마커를 단다 — 모두 동일 접두사가 되어 캐시 히트율 극대화.
 */
export function composeSystem(
  staticParts: string[],
  dynamicPart?: string,
): Anthropic.Messages.TextBlockParam[] {
  const blocks: Anthropic.Messages.TextBlockParam[] = staticParts.map((text, idx) => {
    const isLastStatic = idx === staticParts.length - 1;
    return isLastStatic
      ? { type: "text", text, cache_control: { type: "ephemeral" } }
      : { type: "text", text };
  });
  if (dynamicPart) blocks.push({ type: "text", text: dynamicPart });
  return blocks;
}
