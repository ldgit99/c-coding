import { z } from "zod";

import { cacheSystemPrompt, createAnthropicClient, MODELS } from "./client";
import { flushTrace, recordGeneration, startTrace } from "./observability";

/**
 * Self-explanation 품질 평가 — research.md §3.1 Accept Gate의 최종 단계.
 *
 * 학생이 AI 제안을 수락하기 전 제출한 1~2문장 설명을:
 *  - 구체성 (코드 지점·변수·라인 번호 언급)
 *  - 인과 연결 (왜 그 수정이 필요한가)
 *  - 학습 전이 (다음 유사 문제에서 재활용 가능한 서술)
 * 세 축으로 평가. 0~1 quality + strengths/improvements 배열.
 *
 * 비용 관리: research.md §7.2에 따라 Haiku 계층 — 가벼운 분류·평가.
 * env 미설정 시 heuristic mock 반환 (현재 /api/self-explanation의 기존 점수와 호환).
 */

export const SelfExplanationEvalSchema = z.object({
  quality: z.number().min(0).max(1),
  axes: z.object({
    specificity: z.number().min(0).max(1),
    causality: z.number().min(0).max(1),
    transfer: z.number().min(0).max(1),
  }),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
});
export type SelfExplanationEval = z.infer<typeof SelfExplanationEvalSchema>;

export interface SelfExplanationInput {
  text: string;
  context?: {
    hintLevel?: 1 | 2 | 3 | 4;
    kc?: string[];
    codeExcerpt?: string;
  };
  studentId?: string;
  anthropicApiKey?: string;
}

export interface SelfExplanationResult {
  evaluation: SelfExplanationEval;
  usedModel: string;
  mocked: boolean;
}

const SELF_EXPLANATION_SYSTEM = `
You evaluate a CS1 student's *self-explanation* submitted right before they
accept an AI suggestion. Rate three axes 0~1, then output strengths and
improvements as short Korean bullet fragments.

Axes:
- specificity: mentions specific line/variable/concept from the code
- causality: explains *why* the change is needed, not just what it is
- transfer: phrased generally enough to apply to similar future problems

Return a JSON object only, no prose. Use this shape exactly:
{
  "quality": <weighted avg 0..1>,
  "axes": { "specificity": x, "causality": x, "transfer": x },
  "strengths": ["..."],
  "improvements": ["..."]
}

The overall quality is 0.4*causality + 0.35*specificity + 0.25*transfer,
clamped to [0,1]. Be concise — max 2 strengths, max 2 improvements.
`.trim();

export async function evaluateSelfExplanation(
  input: SelfExplanationInput,
): Promise<SelfExplanationResult> {
  if (!(input.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY)) {
    return { evaluation: mockEvaluation(input), usedModel: "mock", mocked: true };
  }

  const client = createAnthropicClient(input.anthropicApiKey);
  const model = MODELS.haiku;

  const userMessage = [
    `<self_explanation>`,
    input.text,
    `</self_explanation>`,
    "",
    input.context?.hintLevel ? `<hint_level>${input.context.hintLevel}</hint_level>` : "",
    input.context?.kc ? `<related_kc>${JSON.stringify(input.context.kc)}</related_kc>` : "",
    input.context?.codeExcerpt
      ? `<code_excerpt>\n${input.context.codeExcerpt.slice(0, 500)}\n</code_excerpt>`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const trace = startTrace({
    name: "self-explanation",
    userId: input.studentId,
    metadata: { hintLevel: input.context?.hintLevel, kc: input.context?.kc },
    tags: ["self-explanation", input.context?.hintLevel ? `L${input.context.hintLevel}` : "unknown"],
  });
  const startedAt = new Date();

  const response = await client.messages.create({
    model,
    max_tokens: 400,
    system: cacheSystemPrompt(SELF_EXPLANATION_SYSTEM),
    messages: [{ role: "user", content: userMessage }],
  });
  const text = response.content.map((b) => ("text" in b ? b.text : "")).join("\n");
  const evaluation = parseEvaluation(text) ?? mockEvaluation(input);

  recordGeneration(trace, {
    name: "self-explanation.messages.create",
    model,
    input: userMessage,
    output: text,
    startTime: startedAt,
    endTime: new Date(),
    usage: {
      promptTokens: response.usage?.input_tokens,
      completionTokens: response.usage?.output_tokens,
    },
    metadata: { quality: evaluation.quality },
  });
  await flushTrace(trace);

  return { evaluation, usedModel: model, mocked: false };
}

function parseEvaluation(text: string): SelfExplanationEval | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return SelfExplanationEvalSchema.parse(JSON.parse(match[0]));
  } catch {
    return null;
  }
}

/**
 * /api/self-explanation의 원래 휴리스틱과 호환 — 길이·접속사·구체 키워드 기반.
 * LLM이 없어도 의미 있는 구분력을 제공하도록 axis별 점수 다양화.
 */
function mockEvaluation(input: SelfExplanationInput): SelfExplanationEval {
  const text = input.text.trim();
  const length = Math.min(text.length / 150, 1);
  const hasConnector = /왜냐하면|그래서|따라서|때문에|만약|즉/.test(text);
  const hasConcrete = /변수|함수|루프|배열|조건|포인터|인덱스|NULL|주소|라인|\d+\s*번/.test(text);
  const hasTransfer = /다음|비슷한|일반적|항상|언제나|패턴/.test(text);

  const specificity = clamp01(length * 0.5 + (hasConcrete ? 0.5 : 0));
  const causality = clamp01(length * 0.4 + (hasConnector ? 0.5 : 0) + (hasConcrete ? 0.1 : 0));
  const transfer = clamp01((hasTransfer ? 0.6 : 0.2) + length * 0.3);

  const quality = clamp01(0.4 * causality + 0.35 * specificity + 0.25 * transfer);

  const strengths: string[] = [];
  const improvements: string[] = [];
  if (hasConcrete) strengths.push("[mock] 구체적 코드 요소 언급");
  if (hasConnector) strengths.push("[mock] 인과 접속어 사용");
  if (!hasConcrete) improvements.push("[mock] 코드의 어느 지점인지 더 구체적으로");
  if (!hasConnector) improvements.push("[mock] 왜 필요한지 이유를 한 문장 더");

  return { quality, axes: { specificity, causality, transfer }, strengths, improvements };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
