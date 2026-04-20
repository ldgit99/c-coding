import { z } from "zod";

import { ASSESSMENT_SYSTEM_PROMPT } from "../prompts";
import { cacheSystemPrompt, createAnthropicClient, MODELS } from "./client";
import type { Finding } from "./code-reviewer";

/**
 * Assessment 런타임 — rubric-grading 스킬 규약.
 *
 * 결정적 계산 (correctness, style, memory_safety, kcDelta, dependencyFactor) +
 * LLM 평가 (reflection 품질) 혼합.
 *
 * research.md §6.1 기본 가중치: 0.5 / 0.15 / 0.2 / 0.15 (총합 1.0).
 * 중요 규약: Dependency Factor는 finalScore에 절대 반영되지 않는다.
 */

export interface Rubric {
  correctness: number;
  style: number;
  memory_safety: number;
  reflection: number;
}

export const DEFAULT_RUBRIC: Rubric = {
  correctness: 0.5,
  style: 0.15,
  memory_safety: 0.2,
  reflection: 0.15,
};

export const ReflectionInput = z.object({
  Q1_difficult: z.string().optional(),
  Q2_hint_decisive: z.string().optional(),
  Q3_alternatives: z.string().optional(),
  Q4_why: z.string().optional(),
  Q5_next_time: z.string().optional(),
});
export type ReflectionInput = z.infer<typeof ReflectionInput>;

export interface HiddenTestResult {
  id: number;
  passed: boolean;
  /** 학생에게 노출 금지 — 교사 로그용만. */
  actual?: string;
  expected?: string;
}

export interface DependencyLog {
  hintRequests_L1_L2: number;
  hintRequests_L3_L4: number;
  acceptedAIBlocks_without_rationale: number;
  acceptedAIBlocks_total: number;
  /** 0~1, 대화당 평균 follow-up 깊이. */
  avg_question_depth: number;
}

export interface AssessmentInput {
  submission: {
    code: string;
    reflection: ReflectionInput;
    submittedAt: string;
  };
  assignment: {
    id: string;
    rubric?: Rubric;
    kcTags?: string[];
  };
  hiddenTestResults?: HiddenTestResult[];
  codeReviewerFindings?: Finding[];
  styleWarnings?: number;
  dependencyLog?: DependencyLog;
  anthropicApiKey?: string;
}

export const RubricScores = z.object({
  correctness: z.number().min(0).max(1).nullable(),
  style: z.number().min(0).max(1).nullable(),
  memory_safety: z.number().min(0).max(1).nullable(),
  reflection: z.number().min(0).max(1).nullable(),
});
export type RubricScores = z.infer<typeof RubricScores>;

export const AssessmentOutput = z.object({
  rubricScores: RubricScores,
  finalScore: z.number().min(0).max(1),
  passed: z.boolean(),
  evidence: z.array(
    z.object({
      criterion: z.enum(["correctness", "style", "memory_safety", "reflection"]),
      lineRanges: z.array(z.tuple([z.number(), z.number()])).default(() => []),
      note: z.string(),
      partial: z.boolean().default(false),
    }),
  ),
  kcDelta: z.record(z.string(), z.number()),
  dependencyFactor: z.number().min(0).max(1).nullable(),
  teacherOnlyNotes: z.string().optional(),
});
export type AssessmentOutput = z.infer<typeof AssessmentOutput>;

export interface GradeSubmissionResult {
  assessment: AssessmentOutput;
  usedModel: string;
  mocked: boolean;
}

export async function gradeSubmission(input: AssessmentInput): Promise<GradeSubmissionResult> {
  const rubric = input.assignment.rubric ?? DEFAULT_RUBRIC;

  // (1) 리플렉션 누락 → 무효 반송
  if (isReflectionEmpty(input.submission.reflection)) {
    const output: AssessmentOutput = {
      rubricScores: { correctness: null, style: null, memory_safety: null, reflection: 0 },
      finalScore: 0,
      passed: false,
      evidence: [
        {
          criterion: "reflection",
          lineRanges: [],
          note: "리플렉션이 비어 있다 — 제출 무효, 보완 후 재제출 필요.",
          partial: true,
        },
      ],
      kcDelta: {},
      dependencyFactor: null,
      teacherOnlyNotes: "리플렉션 미제출로 즉시 반송.",
    };
    return { assessment: output, usedModel: "deterministic", mocked: true };
  }

  // (2) 결정적 축 계산
  const correctness = computeCorrectness(input.hiddenTestResults);
  const memorySafety = computeMemorySafety(input.codeReviewerFindings ?? []);
  const style = computeStyle(input.styleWarnings ?? 0);

  // (3) Reflection 품질 — LLM 또는 heuristic mock
  const reflectionEval = await evaluateReflection(input);

  const rubricScores: RubricScores = {
    correctness: correctness.value,
    style,
    memory_safety: memorySafety.value,
    reflection: reflectionEval.score,
  };

  // (4) finalScore (null 축은 가중치만큼 축소)
  const { finalScore, partial } = computeFinalScore(rubricScores, rubric);

  // (5) kcDelta
  const kcDelta = computeKcDelta(input.assignment.kcTags ?? [], correctness, memorySafety);

  // (6) Dependency Factor (교사 전용)
  const dependencyFactor = computeDependencyFactor(input.dependencyLog, reflectionEval.score);

  // (7) 증거 조립
  const evidence = buildEvidence(correctness, memorySafety, style, reflectionEval, partial);

  const output: AssessmentOutput = {
    rubricScores,
    finalScore,
    passed: finalScore >= 0.6 && correctness.value !== null && correctness.value >= 0.5,
    evidence,
    kcDelta,
    dependencyFactor,
    teacherOnlyNotes: buildTeacherNotes(dependencyFactor, input.dependencyLog),
  };

  return {
    assessment: output,
    usedModel: reflectionEval.mocked ? "deterministic+mock-reflection" : `deterministic+${reflectionEval.model}`,
    mocked: reflectionEval.mocked,
  };
}

// =============================================================================
// 축별 계산
// =============================================================================

function computeCorrectness(tests?: HiddenTestResult[]): { value: number | null; partial: boolean } {
  if (!tests || tests.length === 0) return { value: null, partial: true };
  const passed = tests.filter((t) => t.passed).length;
  return { value: passed / tests.length, partial: false };
}

function computeStyle(warnings: number): number {
  return Math.max(0, 1 - warnings * 0.1);
}

function computeMemorySafety(findings: Finding[]): { value: number | null; findings: Finding[] } {
  const memFindings = findings.filter((f) => f.category === "memory-safety");
  const deductions =
    memFindings.filter((f) => f.severity === "blocker").length * 0.5 +
    memFindings.filter((f) => f.severity === "major").length * 0.25 +
    memFindings.filter((f) => f.severity === "minor").length * 0.1;
  return { value: Math.max(0, 1 - deductions), findings: memFindings };
}

interface ReflectionEval {
  score: number;
  quality: { specificity: number; metacognition: number; alternatives: number; selfAssessment: number };
  notes: string;
  mocked: boolean;
  model: string;
}

async function evaluateReflection(input: AssessmentInput): Promise<ReflectionEval> {
  if (!(input.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY)) {
    return mockReflectionEval(input.submission.reflection);
  }
  const client = createAnthropicClient(input.anthropicApiKey);
  const model = MODELS.sonnet;
  const prompt = [
    `<reflection>`,
    JSON.stringify(input.submission.reflection, null, 2),
    `</reflection>`,
    "",
    "research.md §3.4 5개 질문에 대한 학생 응답을 다음 4개 요소로 평가하라. 각 0~1 점수 + 간단 근거.",
    `{
  "specificity": 0.0,
  "metacognition": 0.0,
  "alternatives": 0.0,
  "selfAssessment": 0.0,
  "notes": "..."
}`,
  ].join("\n");
  const response = await client.messages.create({
    model,
    max_tokens: 400,
    system: cacheSystemPrompt(ASSESSMENT_SYSTEM_PROMPT),
    messages: [{ role: "user", content: prompt }],
  });
  const text = response.content.map((b) => ("text" in b ? b.text : "")).join("\n");
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as {
        specificity: number;
        metacognition: number;
        alternatives: number;
        selfAssessment: number;
        notes?: string;
      };
      const score =
        parsed.specificity * 0.3 +
        parsed.metacognition * 0.3 +
        parsed.alternatives * 0.2 +
        parsed.selfAssessment * 0.2;
      return {
        score: clamp01(score),
        quality: parsed,
        notes: parsed.notes ?? "",
        mocked: false,
        model,
      };
    } catch {
      // fall through
    }
  }
  return mockReflectionEval(input.submission.reflection);
}

function mockReflectionEval(reflection: ReflectionInput): ReflectionEval {
  // 응답 길이·키워드 기반 heuristic
  const q = (s?: string) => (s ?? "").trim();
  const specificity = Math.min(1, q(reflection.Q1_difficult).length / 60);
  const metacognition = Math.min(1, q(reflection.Q4_why).length / 50);
  const alternatives = q(reflection.Q3_alternatives).length > 10 ? 0.8 : 0;
  const selfAssessment = q(reflection.Q5_next_time).length > 15 ? 0.6 : 0.2;
  const score =
    specificity * 0.3 + metacognition * 0.3 + alternatives * 0.2 + selfAssessment * 0.2;
  return {
    score: clamp01(score),
    quality: { specificity, metacognition, alternatives, selfAssessment },
    notes: "[mock] 길이·키워드 기반 휴리스틱",
    mocked: true,
    model: "mock",
  };
}

function computeFinalScore(
  scores: RubricScores,
  rubric: Rubric,
): { finalScore: number; partial: boolean } {
  let total = 0;
  let weightUsed = 0;
  let partial = false;
  for (const key of Object.keys(rubric) as Array<keyof Rubric>) {
    const s = scores[key];
    if (s !== null && s !== undefined) {
      total += s * rubric[key];
      weightUsed += rubric[key];
    } else {
      partial = true;
    }
  }
  const finalScore = weightUsed > 0 ? total / weightUsed : 0;
  return { finalScore: clamp01(finalScore), partial };
}

function computeKcDelta(
  kcTags: string[],
  correctness: { value: number | null },
  memorySafety: { value: number | null; findings: Finding[] },
): Record<string, number> {
  const delta: Record<string, number> = {};
  if (kcTags.length === 0) return delta;

  if (correctness.value !== null) {
    const share = correctness.value / (2 * kcTags.length); // 성공 기여
    const failShare = (1 - correctness.value) * -0.1; // 실패 기여
    for (const kc of kcTags) {
      delta[kc] = clampDelta((delta[kc] ?? 0) + share + failShare);
    }
  }

  // memory-safety blocker/major를 해당 KC에 추가 감점
  for (const f of memorySafety.findings) {
    const tag = f.kc || "memory-safety";
    const penalty = f.severity === "blocker" ? -0.08 : f.severity === "major" ? -0.04 : -0.02;
    delta[tag] = clampDelta((delta[tag] ?? 0) + penalty);
  }

  return delta;
}

function computeDependencyFactor(
  log: DependencyLog | undefined,
  reflectionQuality: number,
): number | null {
  if (!log) return null;
  const totalHints = log.hintRequests_L1_L2 + log.hintRequests_L3_L4;
  const hintPortion = totalHints > 0 ? log.hintRequests_L3_L4 / totalHints : 0;
  const acceptPortion =
    log.acceptedAIBlocks_total > 0
      ? log.acceptedAIBlocks_without_rationale / log.acceptedAIBlocks_total
      : 0;
  const depth = 1 - clamp01(log.avg_question_depth);
  const reflect = 1 - reflectionQuality;
  return clamp01(0.3 * hintPortion + 0.3 * acceptPortion + 0.2 * depth + 0.2 * reflect);
}

function buildEvidence(
  correctness: { value: number | null; partial: boolean },
  memorySafety: { value: number | null; findings: Finding[] },
  style: number,
  reflection: ReflectionEval,
  partial: boolean,
): AssessmentOutput["evidence"] {
  const evidence: AssessmentOutput["evidence"] = [];
  if (correctness.value !== null) {
    evidence.push({
      criterion: "correctness",
      lineRanges: [],
      note: `hidden tests pass ratio = ${correctness.value.toFixed(2)}`,
      partial: false,
    });
  } else {
    evidence.push({
      criterion: "correctness",
      lineRanges: [],
      note: "hidden tests 미실행 — 채점 보류",
      partial: true,
    });
  }
  evidence.push({
    criterion: "memory_safety",
    lineRanges: memorySafety.findings.map((f) => [f.line, f.line] as [number, number]),
    note: `${memorySafety.findings.length}건 memory-safety findings — deduction ${(1 - (memorySafety.value ?? 1)).toFixed(2)}`,
    partial: false,
  });
  evidence.push({
    criterion: "style",
    lineRanges: [],
    note: `style warnings 기반 → ${style.toFixed(2)}`,
    partial: false,
  });
  evidence.push({
    criterion: "reflection",
    lineRanges: [],
    note: `specificity=${reflection.quality.specificity.toFixed(2)} · metacognition=${reflection.quality.metacognition.toFixed(2)} · alternatives=${reflection.quality.alternatives.toFixed(2)} · selfAssessment=${reflection.quality.selfAssessment.toFixed(2)}`,
    partial: false,
  });
  if (partial) {
    evidence.push({
      criterion: "correctness",
      lineRanges: [],
      note: "일부 축이 null — finalScore 가중치 비례 축소됨",
      partial: true,
    });
  }
  return evidence;
}

function buildTeacherNotes(df: number | null, log: DependencyLog | undefined): string {
  if (df === null) return "dependency log 미제공";
  const level = df >= 0.6 ? "높음" : df >= 0.35 ? "중간" : "낮음";
  const parts = [`의존도 ${level} (${df.toFixed(2)})`];
  if (log) {
    parts.push(
      `힌트 L3/L4 ${log.hintRequests_L3_L4}회, AI 블록 수락 ${log.acceptedAIBlocks_total}건 (rationale 미작성 ${log.acceptedAIBlocks_without_rationale}건)`,
    );
  }
  return parts.join(" · ");
}

function isReflectionEmpty(r: ReflectionInput): boolean {
  const total = Object.values(r)
    .map((v) => (v ?? "").trim())
    .join("");
  return total.length === 0;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function clampDelta(x: number): number {
  return Math.max(-0.15, Math.min(0.15, x));
}
