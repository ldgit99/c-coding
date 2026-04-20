/**
 * Student Modeler 런타임 — kc-mastery-tracking 스킬 규약.
 *
 * research.md §5.2: BKT 스타일 가중 업데이트 + misconception 탐지 + fading signal.
 * 순수 함수형 — Supabase mastery 테이블과의 I/O는 호출부(API route 또는 Cron)가 담당.
 */

export interface MasteryEntry {
  value: number;
  confidence: number;
  observations: number;
  lastUpdated?: string;
}

export interface MisconceptionEntry {
  kc: string;
  pattern: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
}

export interface FadingSignal {
  kc: string;
  action: "reduce-support" | "reinforce";
}

export interface XApiEventLite {
  verb: string;
  kc?: string;
  errorType?: string;
  timestamp: string;
  resultExt?: Record<string, unknown>;
}

export interface UpdateMasteryInput {
  currentMastery: Record<string, MasteryEntry>;
  currentMisconceptions: MisconceptionEntry[];
  kcDelta?: Record<string, number>;
  events?: XApiEventLite[];
  dependencyFactorHistory?: number[];
  /** 배치 실행마다 갱신되는 마커 — 같은 이벤트를 두 번 처리하지 않도록 보장. */
  lastProcessedEventAt?: string;
}

export interface UpdateMasteryOutput {
  masteryUpdated: Record<string, MasteryEntry>;
  misconceptions: MisconceptionEntry[];
  fadingSignals: FadingSignal[];
  interventionFlags: string[];
  lastProcessedEventAt: string;
}

const DELTA_CAP = 0.15;
const MISCONCEPTION_THRESHOLD = 3;
const FADING_MASTERY = 0.75;
const FADING_CONFIDENCE = 0.7;
const REINFORCE_MASTERY = 0.3;
const REINFORCE_MIN_OBSERVATIONS = 5;
const AI_DEPENDENCY_TREND = 0.15;

/**
 * xAPI verb → kcDelta 기여값 매핑 (kc-mastery-tracking 스킬 표).
 */
const VERB_DELTAS: Record<string, number> = {
  "compile-success": +0.03,
  "compile-error": -0.05,
  "ai-suggestion-accepted": -0.04, // without rationale 기본 가정 — 호출부가 구분 가능
  "ai-suggestion-rejected": +0.02,
  "self-explanation-submitted": +0.05,
  "submission-passed": +0.08,
  "submission-failed": -0.05,
};

export function updateMastery(input: UpdateMasteryInput): UpdateMasteryOutput {
  const mastery: Record<string, MasteryEntry> = structuredClone(input.currentMastery ?? {});
  const misconceptions: MisconceptionEntry[] = [...(input.currentMisconceptions ?? [])];
  const now = new Date().toISOString();
  const lastProcessed = input.lastProcessedEventAt
    ? new Date(input.lastProcessedEventAt).getTime()
    : 0;

  // (A) kcDelta 직접 반영
  if (input.kcDelta) {
    for (const [kc, rawDelta] of Object.entries(input.kcDelta)) {
      applyDelta(mastery, kc, rawDelta, now);
    }
  }

  // (B) 이벤트 로그 배치 처리
  let latestEventMs = lastProcessed;
  if (input.events) {
    for (const ev of input.events) {
      const evMs = new Date(ev.timestamp).getTime();
      if (evMs <= lastProcessed) continue;
      if (evMs > latestEventMs) latestEventMs = evMs;

      const kc = ev.kc;
      if (!kc) continue;

      const verbKey = shortVerb(ev.verb);
      const delta = VERB_DELTAS[verbKey];
      if (delta !== undefined) applyDelta(mastery, kc, delta, ev.timestamp);

      // Misconception 패턴 누적 (compile-error / runtime-error 반복)
      if ((verbKey === "compile-error" || verbKey === "runtime-error") && ev.errorType) {
        accrueMisconception(misconceptions, kc, ev.errorType, ev.timestamp);
      }

      // 자기 설명 품질 신호
      if (verbKey === "self-explanation-submitted") {
        const quality = Number(ev.resultExt?.["quality"] ?? 0);
        if (quality > 0.7) applyDelta(mastery, kc, +0.02, ev.timestamp);
      }
    }
  }

  // (C) Fading signals
  const fadingSignals: FadingSignal[] = [];
  for (const [kc, entry] of Object.entries(mastery)) {
    if (entry.value >= FADING_MASTERY && entry.confidence >= FADING_CONFIDENCE) {
      fadingSignals.push({ kc, action: "reduce-support" });
    } else if (entry.value < REINFORCE_MASTERY && entry.observations >= REINFORCE_MIN_OBSERVATIONS) {
      fadingSignals.push({ kc, action: "reinforce" });
    }
  }

  // (D) AI dependency trend
  const interventionFlags: string[] = [];
  const trend = detectDependencyTrend(input.dependencyFactorHistory ?? []);
  if (trend) interventionFlags.push("ai_dependency_trend");

  // 데이터 부족 학생 플래그
  const lowDataKCs = Object.values(mastery).filter((m) => m.confidence < 0.3 && m.observations < 3);
  if (lowDataKCs.length > 5) interventionFlags.push("insufficient_data");

  return {
    masteryUpdated: mastery,
    misconceptions,
    fadingSignals,
    interventionFlags,
    lastProcessedEventAt: new Date(Math.max(latestEventMs, Date.parse(now))).toISOString(),
  };
}

// =============================================================================
// 내부 헬퍼
// =============================================================================

function applyDelta(
  mastery: Record<string, MasteryEntry>,
  kc: string,
  rawDelta: number,
  timestamp: string,
): void {
  const capped = Math.max(-DELTA_CAP, Math.min(DELTA_CAP, rawDelta));
  const prev = mastery[kc] ?? { value: 0.5, confidence: 0, observations: 0 };
  const newValue = prev.value + capped * (1 - prev.confidence);
  mastery[kc] = {
    value: Math.max(0, Math.min(1, newValue)),
    confidence: Math.min(1, prev.confidence + 0.05),
    observations: prev.observations + 1,
    lastUpdated: timestamp,
  };
}

function accrueMisconception(
  list: MisconceptionEntry[],
  kc: string,
  errorType: string,
  timestamp: string,
): void {
  const existing = list.find((m) => m.kc === kc && m.pattern === errorType);
  if (existing) {
    existing.occurrences += 1;
    existing.lastSeen = timestamp;
    return;
  }
  // 신규 기록을 임시 누적 (occurrences 1부터 시작)
  list.push({
    kc,
    pattern: errorType,
    occurrences: 1,
    firstSeen: timestamp,
    lastSeen: timestamp,
  });
}

/**
 * misconceptions 중 occurrences ≥ 3만 "활성 misconception"으로 간주한다는 규약.
 * 호출부에서 필터링해서 Teacher Copilot에 전달.
 */
export function activeMisconceptions(list: MisconceptionEntry[]): MisconceptionEntry[] {
  return list.filter((m) => m.occurrences >= MISCONCEPTION_THRESHOLD);
}

function detectDependencyTrend(history: number[]): boolean {
  if (history.length < 6) return false;
  const recent = avg(history.slice(-3));
  const prev = avg(history.slice(-6, -3));
  return recent - prev >= AI_DEPENDENCY_TREND;
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function shortVerb(verb: string): string {
  // https://cvibe.app/verbs/compile-error → "compile-error"
  const idx = verb.lastIndexOf("/");
  return idx >= 0 ? verb.slice(idx + 1) : verb;
}
