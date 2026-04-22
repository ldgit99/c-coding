import { z } from "zod";

/**
 * AI 개입 강도 3단계 (2026-04-22 재설계).
 *
 * - solo  : 혼자 푸는 시간. 힌트 L1 상한. 선제 발화 없음. Safety 엄격.
 * - pair  : 기본 짝 프로그래밍. L3 상한 (의사코드·원리까지). 예시 코드 금지.
 * - coach : 적극 도움. L4 상한 (예시 코드 허용). Accept Gate 필수.
 *
 * 레거시 silent/observer → solo, tutor → coach 로 정규화.
 */
export type NormalizedMode = "solo" | "pair" | "coach";

export function normalizeMode(m: string | undefined | null): NormalizedMode {
  if (!m) return "pair";
  if (m === "silent" || m === "observer" || m === "solo") return "solo";
  if (m === "tutor" || m === "coach") return "coach";
  return "pair";
}

export const HINT_CEILING: Record<NormalizedMode, 1 | 2 | 3 | 4> = {
  solo: 1,
  pair: 3,
  coach: 4,
};

/**
 * SessionState — research.md §5.4
 *
 * 에이전트 간 공유 상태의 공식 스키마. Supervisor가 delta 머지를 담당하며,
 * 매 턴 종료 시 conversations.session_state 컬럼에 직렬화 저장된다.
 */

const LearningSignalsSchema = z.object({
  attemptCount: z.number().int().min(0).default(0),
  errorTypes: z.array(z.string()).default(() => []),
  repeatedErrorCount: z.number().int().min(0).default(0),
  stagnationSec: z.number().min(0).default(0),
  hintRequests: z.number().int().min(0).default(0),
  aiDependencyScore: z.number().min(0).max(1).default(0),
});

const DependencySchema = z.object({
  hintRequests: z.number().int().min(0).default(0),
  acceptedAIBlocks: z.number().int().min(0).default(0),
  rejectedAIBlocks: z.number().int().min(0).default(0),
});

const EditorSnapshotSchema = z.object({
  files: z.array(z.unknown()).default(() => []),
  cursor: z.object({ line: z.number().int(), col: z.number().int() }).optional(),
});

export const SessionStateSchema = z.object({
  // studentId·assignmentId는 runtime 구조만 보장하고 UUID 형식은 강제하지 않는다.
  // 이유: Supabase auth UUID 외에도 demo 모드 ID·assignment code(slug) 등 다양한
  // ID 체계가 통과해야 하고, 실제 PostgreSQL 쪽 UUID 컬럼 검증은 DB가 담당한다.
  // Zod 4의 `.uuid()`는 strict RFC 4122 nibble 검증이라 불필요하게 엄격.
  studentId: z.string().min(1),
  assignmentId: z.string().min(1).optional(),
  currentKC: z.array(z.string()).default(() => []),
  mastery: z.record(z.string(), z.number().min(0).max(1)).default(() => ({})),
  learningSignals: LearningSignalsSchema.optional(),
  dependency: DependencySchema.optional(),
  conversation: z.array(z.unknown()).default(() => []),
  editorSnapshot: EditorSnapshotSchema.optional(),
  interventionFlags: z.array(z.string()).default(() => []),
  supportLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).default(0),
  selfExplanationRequired: z.boolean().default(false),
  teacherInterventionLevel: z.enum(["weak", "medium", "strong"]).optional(),
  // 입력은 레거시 값도 허용하지만 normalizeMode 로 solo/pair/coach 로 통일.
  mode: z
    .enum(["solo", "pair", "coach", "silent", "observer", "tutor"])
    .default("pair")
    .transform((m) => normalizeMode(m)),
});

export type SessionState = z.infer<typeof SessionStateSchema>;

const DEFAULT_LEARNING_SIGNALS: NonNullable<SessionState["learningSignals"]> = {
  attemptCount: 0,
  errorTypes: [],
  repeatedErrorCount: 0,
  stagnationSec: 0,
  hintRequests: 0,
  aiDependencyScore: 0,
};

const DEFAULT_DEPENDENCY: NonNullable<SessionState["dependency"]> = {
  hintRequests: 0,
  acceptedAIBlocks: 0,
  rejectedAIBlocks: 0,
};

export function mergeDelta(base: SessionState, delta: Partial<SessionState>): SessionState {
  const merged: SessionState = { ...base };

  if (delta.mastery) {
    // 낙관적 잠금: mastery는 가산만 허용 (delta.mastery는 delta 값 자체)
    const currentMastery = merged.mastery ?? {};
    const nextMastery = { ...currentMastery };
    for (const [kc, val] of Object.entries(delta.mastery)) {
      const current = nextMastery[kc] ?? 0;
      nextMastery[kc] = Math.max(0, Math.min(1, current + val));
    }
    merged.mastery = nextMastery;
  }

  if (delta.learningSignals) {
    merged.learningSignals = {
      ...(merged.learningSignals ?? DEFAULT_LEARNING_SIGNALS),
      ...delta.learningSignals,
    };
  }
  if (delta.dependency) {
    merged.dependency = {
      ...(merged.dependency ?? DEFAULT_DEPENDENCY),
      ...delta.dependency,
    };
  }
  if (delta.interventionFlags) {
    merged.interventionFlags = Array.from(
      new Set([...(merged.interventionFlags ?? []), ...delta.interventionFlags]),
    );
  }
  if (delta.supportLevel !== undefined) {
    merged.supportLevel = delta.supportLevel;
  }
  if (delta.selfExplanationRequired !== undefined) {
    merged.selfExplanationRequired = delta.selfExplanationRequired;
  }
  if (delta.mode) merged.mode = delta.mode;
  if (delta.currentKC) merged.currentKC = delta.currentKC;
  if (delta.editorSnapshot) merged.editorSnapshot = delta.editorSnapshot;
  if (delta.teacherInterventionLevel) {
    merged.teacherInterventionLevel = delta.teacherInterventionLevel;
  }

  return merged;
}
