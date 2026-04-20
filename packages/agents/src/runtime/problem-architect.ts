import { z } from "zod";

import { PROBLEM_ARCHITECT_SYSTEM_PROMPT } from "../prompts";
import { cacheSystemPrompt, createAnthropicClient, MODELS } from "./client";

/**
 * Problem Architect 런타임 — problem-templating 스킬 규약.
 *
 * research.md §6.1 YAML 구조를 그대로 따른다. reference_solution은 함수가 직접
 * 반환하지 않는다 — 호출부가 `_workspace/private/solutions/`에 저장하고
 * Safety Guard에 등록해야 한다.
 *
 * 학생 경로에서 호출 금지 — actor 검증은 호출부(API route 또는 Supervisor)가 담당.
 */

export const VariantSchema = z.object({
  variantCode: z.string(),
  params: z.record(z.string(), z.unknown()),
  hiddenTests: z.array(z.object({ input: z.string(), expected: z.string() })),
  /** Safety Guard에 등록되어야 할 참고 솔루션 내용. 응답에만 존재, 저장은 호출부 책임. */
  referenceSolution: z.string(),
});
export type Variant = z.infer<typeof VariantSchema>;

export const GenProblemSchema = z.object({
  assignmentId: z.string(),
  kcTags: z.array(z.string()),
  difficulty: z.number().int().min(1).max(5),
  template: z.string(),
  rubric: z.object({
    correctness: z.number(),
    style: z.number(),
    memory_safety: z.number(),
    reflection: z.number(),
  }),
  variants: z.array(VariantSchema),
});
export type GenProblemOutput = z.infer<typeof GenProblemSchema>;

export interface GenProblemInput {
  kc: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  variantCount: number;
  seed?: number;
  anthropicApiKey?: string;
}

export interface GenProblemResult {
  problem: GenProblemOutput;
  usedModel: string;
  mocked: boolean;
}

/**
 * 간단한 deterministic PRNG — seed 기반 variant 파생의 재현성 보장.
 * xorshift32 기반, 32-bit → [0, 1) 실수로 투영.
 */
export function seededRandom(seed: number): () => number {
  let state = (seed | 0) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    // 부호 처리 후 [0, 1)로 투영
    return ((state >>> 0) / 0xffffffff) % 1;
  };
}

export async function genProblem(input: GenProblemInput): Promise<GenProblemResult> {
  if (!(input.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY)) {
    return { problem: mockGenProblem(input), usedModel: "mock", mocked: true };
  }

  const client = createAnthropicClient(input.anthropicApiKey);
  const model = MODELS.opus; // 창의적 생성 — research.md §7.2

  const prompt = formatProblemGenMessage(input);
  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    system: cacheSystemPrompt(PROBLEM_ARCHITECT_SYSTEM_PROMPT),
    messages: [{ role: "user", content: prompt }],
  });
  const text = response.content.map((b) => ("text" in b ? b.text : "")).join("\n");
  return { problem: parseGenProblemResponse(text, input), usedModel: model, mocked: false };
}

function formatProblemGenMessage(input: GenProblemInput): string {
  return [
    `Generate a CS1 C programming assignment targeting KC: ${input.kc}`,
    `Difficulty: ${input.difficulty} (1=trivial, 5=hardest for CS1)`,
    `Variant count: ${input.variantCount}`,
    `Seed: ${input.seed ?? "random"}`,
    "",
    "Return a JSON object matching this schema (no prose):",
    `{
  "assignmentId": "Axx_slug",
  "kcTags": ["${input.kc}", "..."],
  "difficulty": ${input.difficulty},
  "template": "학생에게 보여줄 문제 한국어 설명",
  "rubric": { "correctness": 0.5, "style": 0.15, "memory_safety": 0.2, "reflection": 0.15 },
  "variants": [
    {
      "variantCode": "v1",
      "params": { "N": 5 },
      "hiddenTests": [ { "input": "...", "expected": "..." } ],
      "referenceSolution": "완전한 C 소스 (학생 경로에 유출되지 않도록 호출부가 격리)"
    }
  ]
}`,
  ].join("\n");
}

function parseGenProblemResponse(text: string, input: GenProblemInput): GenProblemOutput {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return GenProblemSchema.parse(JSON.parse(match[0]));
    } catch {
      // fall through
    }
  }
  return mockGenProblem(input);
}

function mockGenProblem(input: GenProblemInput): GenProblemOutput {
  const rand = seededRandom(input.seed ?? 42);
  const variants: Variant[] = Array.from({ length: input.variantCount }, (_, i) => {
    const n = Math.floor(rand() * 7) + 3; // 3..9
    const values = Array.from({ length: n }, () => Math.floor(rand() * 20));
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      variantCode: `v${i + 1}`,
      params: { N: n, values },
      hiddenTests: [{ input: `${n}\n${values.join(" ")}`, expected: `${sum}\n` }],
      referenceSolution: `// [mock] reference solution for ${input.kc}\n#include <stdio.h>\nint main(){ int n; scanf("%d",&n); long s=0; for(int i=0;i<n;i++){int x; scanf("%d",&x); s+=x;} printf("%ld\\n", s); return 0; }\n`,
    };
  });

  return {
    assignmentId: `MOCK_${input.kc.toUpperCase().replace(/-/g, "_")}`,
    kcTags: [input.kc],
    difficulty: input.difficulty,
    template: `[mock] ${input.kc} 대상 CS1 과제 — 길이 N인 배열에서 요구 연산을 수행하라.`,
    rubric: { correctness: 0.5, style: 0.15, memory_safety: 0.2, reflection: 0.15 },
    variants,
  };
}
