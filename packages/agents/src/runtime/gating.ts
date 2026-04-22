import { HINT_CEILING, normalizeMode, type SessionState } from "../state";

/**
 * socratic-hinting 스킬의 게이팅 규칙을 코드로 고정.
 * 스킬 문서(.claude/skills/socratic-hinting/SKILL.md)와 동기화 유지.
 *
 * 규칙은 AND 조건 — 모두 충족해야 다음 레벨 개방.
 */

export type HintLevel = 1 | 2 | 3 | 4;

export interface GatingContext {
  state: SessionState;
  requestedLevel?: HintLevel;
  /** 학생이 이번 발화에서 문제를 자기 말로 재진술했는가. 초기 구현은 항상 false. */
  restatedProblem?: boolean;
  /** 학생이 막힌 지점을 구체적으로 지목했는가. 초기 구현은 항상 false. */
  namedStuckPoint?: boolean;
}

export interface GatingResult {
  grantedLevel: HintLevel;
  failedConditions: string[];
}

export function computeAllowedLevel(ctx: GatingContext): GatingResult {
  const requested = (ctx.requestedLevel ?? 1) as HintLevel;
  const state = ctx.state;
  const mode = normalizeMode(state.mode);
  const ceiling = HINT_CEILING[mode];
  const learning = state.learningSignals ?? {
    attemptCount: 0,
    errorTypes: [],
    repeatedErrorCount: 0,
    stagnationSec: 0,
    hintRequests: 0,
    aiDependencyScore: 0,
  };

  // exam: 힌트 전면 차단. requestHint 단계에서 응답 생성 전에 막는다.
  if (mode === "exam") {
    return {
      grantedLevel: 1,
      failedConditions: [
        "시험(exam) 모드에서는 AI 힌트를 받을 수 없어요. 담당 교사만 해제할 수 있어요.",
      ],
    };
  }

  // 3단계 모드 상한: solo=L1, pair=L3, coach=L4. 상한을 넘는 요청은 즉시 ceiling 으로 축소.
  if (ceiling > 0 && requested > ceiling) {
    const failed = [
      `현재 모드(${mode})에서는 L${ceiling}까지만 받을 수 있어요. 더 깊은 도움이 필요하면 모드를 올려주세요.`,
    ];
    return { grantedLevel: ceiling as 1 | 2 | 3 | 4, failedConditions: failed };
  }

  const failed: string[] = [];

  // L1 → L2
  const l2Allowed =
    learning.attemptCount >= 1 &&
    (ctx.restatedProblem === true ||
      (state.currentKC?.length ?? 0) > 0); // KC 태그 있으면 개념 단계 부분 통과
  if (requested >= 2 && !l2Allowed) {
    failed.push("L1→L2: attemptCount≥1 또는 문제 재진술 필요");
    return { grantedLevel: 1, failedConditions: failed };
  }

  // L2 → L3 : 두 번 이상 시도했거나, 충분히 머물렀거나(≥120s), 에러 반복(≥2)
  const l3Allowed =
    learning.attemptCount >= 2 ||
    learning.stagnationSec >= 120 ||
    learning.repeatedErrorCount >= 2 ||
    learning.hintRequests >= 2;
  if (requested >= 3 && !l3Allowed) {
    failed.push(
      `L2→L3: attemptCount≥2 또는 stagnation≥120s 또는 repeatedError≥2 또는 hintRequests≥2 중 하나 필요 ` +
        `(현재 attempt=${learning.attemptCount}, stagnation=${learning.stagnationSec}s, repeated=${learning.repeatedErrorCount}, hints=${learning.hintRequests})`,
    );
    return { grantedLevel: 2, failedConditions: failed };
  }

  // L3 → L4 : mode=coach + (namedStuckPoint OR 충분한 시도/힌트) 중 하나
  const l4StruggledEnough =
    learning.attemptCount >= 3 ||
    learning.hintRequests >= 3 ||
    learning.repeatedErrorCount >= 2;
  const l4Allowed =
    mode === "coach" && (ctx.namedStuckPoint === true || l4StruggledEnough);
  if (requested >= 4 && !l4Allowed) {
    if (mode !== "coach") failed.push(`L3→L4: mode=coach 필요 (현재 ${mode})`);
    if (!ctx.namedStuckPoint && !l4StruggledEnough) {
      failed.push("L3→L4: 구체적 막힌 지점 지목 또는 충분한 시도(attempt≥3/hints≥3/repeat≥2) 필요");
    }
    return { grantedLevel: 3, failedConditions: failed };
  }

  return { grantedLevel: requested, failedConditions: [] };
}

/**
 * Fading: mastery가 임계를 넘으면 해당 KC에 대해 레벨을 한 단계 낮춤.
 * (Student Modeler가 보내는 fadingSignals와 별개의 즉시 판정)
 */
export function applyFading(
  grantedLevel: HintLevel,
  state: SessionState,
  relatedKC: string[],
): HintLevel {
  const masteryValues = relatedKC
    .map((kc) => state.mastery?.[kc] ?? 0)
    .filter((v) => v > 0);
  if (masteryValues.length === 0) return grantedLevel;
  const avgMastery = masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length;
  if (avgMastery >= 0.75 && grantedLevel > 1) {
    return (grantedLevel - 1) as HintLevel;
  }
  return grantedLevel;
}
