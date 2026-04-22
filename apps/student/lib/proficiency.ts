/**
 * Proficiency Level — 학생 UI 전용 평가 레이어.
 *
 * 원 rubricScores(0~1) 는 그대로 서버에 저장·교사 대시보드에 표시되고,
 * 학생 화면에서만 5단계 레벨로 변환해 노출한다. "36.5점" 같은 좌절 숫자
 * 대신 "Developing" 같은 중립 레이블 + 다음 레벨까지의 거리를 보여준다.
 *
 * 교육학 근거: Mastery Learning (Bloom) + Growth Mindset (Dweck).
 * research.md §6.3 낙인 방지 원칙과 일치.
 */

export type ProficiencyLevel =
  | "exemplary"
  | "proficient"
  | "developing"
  | "emerging"
  | "in_progress";

export interface RubricScoresLike {
  correctness: number | null;
  style: number | null;
  memory_safety: number | null;
  reflection: number | null;
}

interface LevelSpec {
  level: ProficiencyLevel;
  label: string;
  icon: string;
  description: string;
  badgeClass: string;
  accentClass: string;
}

const LEVELS: Record<ProficiencyLevel, LevelSpec> = {
  exemplary: {
    level: "exemplary",
    label: "탁월",
    icon: "🏆",
    description: "깊이 있는 설명까지 담아낸 모범 해답이에요.",
    badgeClass: "bg-success/15 text-success border border-success/30",
    accentClass: "text-success",
  },
  proficient: {
    level: "proficient",
    label: "능숙",
    icon: "✨",
    description: "기대 수준 이상으로 문제를 이해하고 풀어냈어요.",
    badgeClass: "bg-primary/15 text-primary border border-primary/30",
    accentClass: "text-primary",
  },
  developing: {
    level: "developing",
    label: "발전 중",
    icon: "📘",
    description: "핵심은 잡았어요. 일부 케이스만 다시 확인하면 돼요.",
    badgeClass: "bg-warning/15 text-warning border border-warning/30",
    accentClass: "text-warning",
  },
  emerging: {
    level: "emerging",
    label: "시작",
    icon: "🌱",
    description: "첫걸음을 뗐어요. 테스트를 더 통과시켜 보세요.",
    badgeClass: "bg-primary/10 text-primary border border-primary/20",
    accentClass: "text-primary",
  },
  in_progress: {
    level: "in_progress",
    label: "진행",
    icon: "🛠",
    description: "아직 확인할 부분이 남았어요. 다시 실행해 보고 제출해요.",
    badgeClass: "bg-bg text-text-secondary border border-border-soft",
    accentClass: "text-text-secondary",
  },
};

export interface GapToNext {
  nextLevel: ProficiencyLevel;
  nextLabel: string;
  axis: string;
  axisLabel: string;
  needed: number;
  current: number;
}

export interface ProficiencyInfo extends LevelSpec {
  passed: boolean;
  gap?: GapToNext;
}

/**
 * rubricScores 기반으로 5단계 레벨 산출.
 *
 * 규칙:
 * - exemplary: correctness ≥ 0.95 · reflection ≥ 0.7 · style ≥ 0.8
 * - proficient: correctness ≥ 0.8 · reflection ≥ 0.5
 * - developing: correctness ≥ 0.5
 * - emerging: correctness > 0
 * - in_progress: 그 외
 *
 * `passed` 는 proficient 이상을 의미.
 */
export function computeProficiency(scores: RubricScoresLike): ProficiencyInfo {
  const c = scores.correctness ?? 0;
  const s = scores.style ?? 0;
  const r = scores.reflection ?? 0;

  let level: ProficiencyLevel;
  if (c >= 0.95 && r >= 0.7 && s >= 0.8) level = "exemplary";
  else if (c >= 0.8 && r >= 0.5) level = "proficient";
  else if (c >= 0.5) level = "developing";
  else if (c > 0) level = "emerging";
  else level = "in_progress";

  const spec = LEVELS[level];
  const passed = level === "exemplary" || level === "proficient";
  const gap = level === "exemplary" ? undefined : nextLevelGap(level, { c, s, r });

  return { ...spec, passed, gap };
}

function nextLevelGap(
  level: Exclude<ProficiencyLevel, "exemplary">,
  s: { c: number; s: number; r: number },
): GapToNext {
  const axes = { c: "correctness", s: "style", r: "reflection" } as const;
  const axisLabels = {
    c: "정답 정확도",
    s: "코드 스타일",
    r: "성찰 깊이",
  } as const;

  const nextMap: Record<Exclude<ProficiencyLevel, "exemplary">, ProficiencyLevel> = {
    proficient: "exemplary",
    developing: "proficient",
    emerging: "developing",
    in_progress: "emerging",
  };
  const nextLevel = nextMap[level];
  const nextLabel = LEVELS[nextLevel].label;

  // 레벨별 필요 임계값
  const targets: Record<ProficiencyLevel, { c: number; s?: number; r?: number }> = {
    exemplary: { c: 0.95, s: 0.8, r: 0.7 },
    proficient: { c: 0.8, r: 0.5 },
    developing: { c: 0.5 },
    emerging: { c: 0.01 },
    in_progress: { c: 0 },
  };
  const t = targets[nextLevel];

  // 각 축별 현재값과 목표값 차이 계산 → 가장 큰 gap 을 반환
  const candidates: Array<{ axis: "c" | "s" | "r"; gap: number; current: number; needed: number }> =
    [];
  if (t.c !== undefined && s.c < t.c) {
    candidates.push({ axis: "c", gap: t.c - s.c, current: s.c, needed: t.c });
  }
  if (t.s !== undefined && s.s < t.s) {
    candidates.push({ axis: "s", gap: t.s - s.s, current: s.s, needed: t.s });
  }
  if (t.r !== undefined && s.r < t.r) {
    candidates.push({ axis: "r", gap: t.r - s.r, current: s.r, needed: t.r });
  }

  const chosen = candidates.sort((a, b) => b.gap - a.gap)[0];
  if (!chosen) {
    // 모든 축 충족했는데 레벨이 낮은 경우는 발생하지 않음 — 안전 fallback
    return {
      nextLevel,
      nextLabel,
      axis: "correctness",
      axisLabel: "정답 정확도",
      needed: 0,
      current: 0,
    };
  }

  return {
    nextLevel,
    nextLabel,
    axis: axes[chosen.axis],
    axisLabel: axisLabels[chosen.axis],
    needed: chosen.needed,
    current: chosen.current,
  };
}

export function proficiencyLabel(level: ProficiencyLevel): string {
  return LEVELS[level].label;
}

export function proficiencyBadgeClass(level: ProficiencyLevel): string {
  return LEVELS[level].badgeClass;
}
