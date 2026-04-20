import { z } from "zod";

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
  studentId: z.string().uuid(),
  assignmentId: z.string().uuid().optional(),
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
  mode: z.enum(["silent", "observer", "pair", "tutor"]).default("pair"),
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
