/**
 * Teacher Copilot 런타임 — research.md §4.1 3단 뷰 집계 + §6.4 개입 권고.
 *
 * Week 9 MVP: 결정론적 집계 함수만 — 교사 보고서는 Week 11~12에 LLM으로 보강.
 * 모든 집계는 mock 데이터(DemoStudent[])와 실제 Supabase 쿼리 결과(동일 shape)
 * 양쪽에 적용 가능하도록 순수 함수로 작성.
 */

export interface StudentData {
  id: string;
  displayName: string;
  cohortId: string;
  mastery: Record<string, number>;
  dependencyFactorHistory: number[];
  misconceptions: Array<{ kc: string; pattern: string; occurrences: number }>;
  recentSubmissions: Array<{
    assignmentId: string;
    finalScore: number | null;
    passed: boolean;
    submittedAt: string;
    errorTypes: string[];
    stagnationSec: number;
    hintRequestsL3L4: number;
  }>;
}

export interface ClassroomSummary {
  cohortId: string;
  studentCount: number;
  completionRate: number; // 최근 과제 기준 통과 비율
  avgMasteryByKC: Record<string, number>;
  /** 취약 KC: 평균 mastery < 0.5 */
  weakKCs: string[];
  heatmap: Array<{ studentId: string; displayName: string; mastery: Record<string, number> }>;
}

export function summarizeClassroom(students: StudentData[], cohortId: string): ClassroomSummary {
  const cohort = students.filter((s) => s.cohortId === cohortId);
  const passed = cohort.filter((s) => s.recentSubmissions.some((sub) => sub.passed));
  const completionRate = cohort.length > 0 ? passed.length / cohort.length : 0;

  const kcTotals: Record<string, { sum: number; count: number }> = {};
  for (const s of cohort) {
    for (const [kc, val] of Object.entries(s.mastery)) {
      const bucket = kcTotals[kc] ?? { sum: 0, count: 0 };
      bucket.sum += val;
      bucket.count += 1;
      kcTotals[kc] = bucket;
    }
  }
  const avgMasteryByKC: Record<string, number> = {};
  for (const [kc, { sum, count }] of Object.entries(kcTotals)) {
    avgMasteryByKC[kc] = count > 0 ? sum / count : 0;
  }
  const weakKCs = Object.entries(avgMasteryByKC)
    .filter(([, v]) => v < 0.5)
    .sort(([, a], [, b]) => a - b)
    .map(([k]) => k);

  return {
    cohortId,
    studentCount: cohort.length,
    completionRate,
    avgMasteryByKC,
    weakKCs,
    heatmap: cohort.map((s) => ({
      studentId: s.id,
      displayName: s.displayName,
      mastery: s.mastery,
    })),
  };
}

export type InterventionLevel = "weak" | "medium" | "strong";

export interface InterventionItem {
  studentId: string;
  displayName: string;
  level: InterventionLevel;
  reasons: string[];
  suggestedActions: Array<{ label: string; params?: Record<string, unknown> }>;
}

/**
 * research.md §6.4 트리거:
 * - 동일 오류 3회 이상 + 정체 10분 이상
 * - 강한 힌트 요청이 짧은 시간에 누적 (hintRequestsL3L4 ≥ 3)
 * - AI 의존도 최근 3회 이동평균 상승 ≥ 0.15
 * - 리플렉션 회피·대안 비교 누락 (이번 MVP에서는 의존도 이력으로 대체)
 */
export function buildInterventionQueue(students: StudentData[], cohortId: string): InterventionItem[] {
  const queue: InterventionItem[] = [];
  for (const s of students.filter((x) => x.cohortId === cohortId)) {
    const reasons: string[] = [];

    // 반복 오류 + 정체
    const repeatedErrors = detectRepeatedErrors(s);
    if (repeatedErrors && repeatedErrors.stagnationSec >= 600 && repeatedErrors.count >= 2) {
      reasons.push(
        `반복 오류: ${repeatedErrors.errorType} ${repeatedErrors.count}회 + 정체 ${Math.round(
          repeatedErrors.stagnationSec / 60,
        )}분`,
      );
    }

    // 강한 힌트 누적
    const totalStrongHints = s.recentSubmissions.reduce((a, b) => a + b.hintRequestsL3L4, 0);
    if (totalStrongHints >= 3) {
      reasons.push(`L3/L4 힌트 ${totalStrongHints}회 누적`);
    }

    // 의존도 상승
    const trend = detectDependencyTrend(s.dependencyFactorHistory);
    if (trend.rising) {
      reasons.push(`AI 의존도 상승 추세 (${trend.delta.toFixed(2)})`);
    }

    // 활성 misconception
    const activeMisconceptions = s.misconceptions.filter((m) => m.occurrences >= 3);
    if (activeMisconceptions.length > 0) {
      reasons.push(
        `활성 misconception: ${activeMisconceptions.map((m) => `${m.kc}(${m.occurrences})`).join(", ")}`,
      );
    }

    if (reasons.length === 0) continue;

    const level: InterventionLevel =
      reasons.length >= 3 ? "strong" : reasons.length === 2 ? "medium" : "weak";

    queue.push({
      studentId: s.id,
      displayName: s.displayName,
      level,
      reasons,
      suggestedActions: suggestActions(level, activeMisconceptions),
    });
  }

  return queue.sort((a, b) => LEVEL_ORDER[b.level] - LEVEL_ORDER[a.level]);
}

const LEVEL_ORDER: Record<InterventionLevel, number> = { weak: 1, medium: 2, strong: 3 };

function suggestActions(
  level: InterventionLevel,
  misconceptions: Array<{ kc: string; pattern: string; occurrences: number }>,
): Array<{ label: string; params?: Record<string, unknown> }> {
  const actions: Array<{ label: string; params?: Record<string, unknown> }> = [];
  if (level === "strong") {
    actions.push({ label: "AI 개입 수준을 강(tutor)으로 올리기", params: { mode: "tutor" } });
    actions.push({ label: "쪽지로 직접 힌트 주입" });
  } else if (level === "medium") {
    actions.push({ label: "AI 개입 수준을 중(pair 유지)으로 고정", params: { mode: "pair" } });
    actions.push({ label: "추가 과제 variant 배정" });
  } else {
    actions.push({ label: "관찰 (observer 모드로 일시 전환)", params: { mode: "observer" } });
  }
  if (misconceptions.length > 0) {
    actions.push({
      label: `개념 재학습 권고: ${misconceptions.map((m) => m.kc).join(", ")}`,
    });
  }
  return actions;
}

function detectRepeatedErrors(s: StudentData): { errorType: string; count: number; stagnationSec: number } | null {
  const errorCounts: Record<string, { count: number; stagnationSec: number }> = {};
  for (const sub of s.recentSubmissions) {
    for (const e of sub.errorTypes) {
      const bucket = errorCounts[e] ?? { count: 0, stagnationSec: 0 };
      bucket.count += 1;
      bucket.stagnationSec += sub.stagnationSec;
      errorCounts[e] = bucket;
    }
  }
  let worst: { errorType: string; count: number; stagnationSec: number } | null = null;
  for (const [errorType, data] of Object.entries(errorCounts)) {
    if (!worst || data.count > worst.count) worst = { errorType, ...data };
  }
  return worst;
}

function detectDependencyTrend(history: number[]): { rising: boolean; delta: number } {
  if (history.length < 2) return { rising: false, delta: 0 };
  const recent = history.slice(-3);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const prev = history.slice(-6, -3);
  const prevAvg = prev.length > 0 ? prev.reduce((a, b) => a + b, 0) / prev.length : recent[0] ?? 0;
  const delta = avg - prevAvg;
  return { rising: delta >= 0.15, delta };
}

export interface CommonMisconception {
  kc: string;
  pattern: string;
  affectedStudentCount: number;
  totalOccurrences: number;
}

export function aggregateMisconceptions(students: StudentData[], cohortId: string): CommonMisconception[] {
  const key = (kc: string, pattern: string) => `${kc}::${pattern}`;
  const buckets: Record<string, { kc: string; pattern: string; students: Set<string>; total: number }> = {};
  for (const s of students.filter((x) => x.cohortId === cohortId)) {
    for (const m of s.misconceptions) {
      if (m.occurrences < 3) continue;
      const k = key(m.kc, m.pattern);
      const b = buckets[k] ?? { kc: m.kc, pattern: m.pattern, students: new Set(), total: 0 };
      b.students.add(s.id);
      b.total += m.occurrences;
      buckets[k] = b;
    }
  }
  return Object.values(buckets)
    .map((b) => ({
      kc: b.kc,
      pattern: b.pattern,
      affectedStudentCount: b.students.size,
      totalOccurrences: b.total,
    }))
    .sort((a, b) => b.affectedStudentCount - a.affectedStudentCount);
}
