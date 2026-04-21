/**
 * Paper 3 — Cognitive Offloading Detector.
 *
 * 제출 이력 + 대화 발화 + self-explanation 이벤트를 결합해 학생의 AI
 * 의존도 프로파일을 만든다. Gerlich (2025) cognitive offloading 프레임워크
 * 참조.
 *
 * 핵심 산출:
 * - Dependency Factor Trajectory: 시간에 따른 의존도 변화
 * - Gaming vs Struggling Scatter: L4 빈도 × self-explanation transfer
 * - Linguistic Profile: 언어 특징 (linguistic.ts 재사용)
 */

import type { XApiStatementT } from "../index";
import { Verbs } from "../verbs";
import { computeLinguisticProfile, type LinguisticProfile } from "./linguistic";

export interface TrajectoryPoint {
  timestamp: string;
  dependencyFactor: number;
}

export interface StudentTrajectory {
  studentId: string;
  points: TrajectoryPoint[];
  trend: "rising" | "stable" | "falling";
}

/**
 * 입력: per-student dependencyFactor 시계열 (교사 대시보드의 DEMO_STUDENTS
 * 또는 Supabase assessments 테이블에서 가져온다).
 */
export function computeDependencyTrajectories(
  raw: Array<{ studentId: string; timestamp: string; dependencyFactor: number }>,
): StudentTrajectory[] {
  const byStudent = new Map<string, TrajectoryPoint[]>();
  for (const r of raw) {
    const bucket = byStudent.get(r.studentId) ?? [];
    bucket.push({ timestamp: r.timestamp, dependencyFactor: r.dependencyFactor });
    byStudent.set(r.studentId, bucket);
  }

  const out: StudentTrajectory[] = [];
  for (const [studentId, pts] of byStudent) {
    pts.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const trend = detectTrend(pts.map((p) => p.dependencyFactor));
    out.push({ studentId, points: pts, trend });
  }
  return out;
}

function detectTrend(values: number[]): "rising" | "stable" | "falling" {
  if (values.length < 3) return "stable";
  const half = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, half);
  const secondHalf = values.slice(values.length - half);
  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const diff = avgSecond - avgFirst;
  if (diff > 0.08) return "rising";
  if (diff < -0.08) return "falling";
  return "stable";
}

export type OffloadingQuadrant =
  | "healthy_srl" // 낮은 L4 × 높은 transfer
  | "assisted_learner" // 높은 L4 × 높은 transfer
  | "struggling_independent" // 낮은 L4 × 낮은 transfer
  | "gaming_danger"; // 높은 L4 × 낮은 transfer

export interface OffloadingDatum {
  studentId: string;
  l4Frequency: number; // 0~1, assignment 당 L4 요청 수 중앙값 정규화
  transferAxisMean: number; // 0~1
  quadrant: OffloadingQuadrant;
}

export interface GamingInput {
  studentId: string;
  l4Requests: number;
  assignmentsAttempted: number;
  transferAxisMean: number;
}

/**
 * Gaming-vs-Struggling 사분면 분류.
 * - L4 frequency 기준: 0.5 (중앙값)
 * - Transfer axis 기준: 0.5 (중앙값)
 * 절대 임계값 대신 cohort 중앙값으로 재조정하고 싶다면 후처리 필요.
 */
export function classifyOffloading(inputs: GamingInput[]): OffloadingDatum[] {
  return inputs.map((s) => {
    const freq = s.assignmentsAttempted > 0 ? Math.min(1, s.l4Requests / s.assignmentsAttempted) : 0;
    const highL4 = freq >= 0.5;
    const highTransfer = s.transferAxisMean >= 0.5;
    let quadrant: OffloadingQuadrant;
    if (!highL4 && highTransfer) quadrant = "healthy_srl";
    else if (highL4 && highTransfer) quadrant = "assisted_learner";
    else if (!highL4 && !highTransfer) quadrant = "struggling_independent";
    else quadrant = "gaming_danger";
    return {
      studentId: s.studentId,
      l4Frequency: freq,
      transferAxisMean: s.transferAxisMean,
      quadrant,
    };
  });
}

/**
 * xAPI 이벤트 + conversations turns에서 GamingInput 을 유도.
 */
export function buildGamingInputs(params: {
  events: XApiStatementT[];
  transferAxisByStudent: Map<string, number>;
}): GamingInput[] {
  const l4ByStudent = new Map<string, number>();
  const assignmentsByStudent = new Map<string, Set<string>>();

  for (const e of params.events) {
    const sid = e.actor.account.name;
    const verb = e.verb.id;
    const ext = e.result?.extensions ?? {};
    // hintLevel 추출
    const hintLevelEntry = Object.entries(ext).find(([k]) => k.endsWith("/hintLevel"));
    const hintLevel = hintLevelEntry ? Number(hintLevelEntry[1]) : null;

    if (verb === Verbs.requestedHint && hintLevel === 4) {
      l4ByStudent.set(sid, (l4ByStudent.get(sid) ?? 0) + 1);
    }

    if (verb === Verbs.submissionPassed || verb === Verbs.submissionFailed) {
      const objectId = e.object.id;
      const bucket = assignmentsByStudent.get(sid) ?? new Set();
      bucket.add(objectId);
      assignmentsByStudent.set(sid, bucket);
    }
  }

  const students = new Set<string>([
    ...l4ByStudent.keys(),
    ...assignmentsByStudent.keys(),
    ...params.transferAxisByStudent.keys(),
  ]);

  return Array.from(students).map((sid) => ({
    studentId: sid,
    l4Requests: l4ByStudent.get(sid) ?? 0,
    assignmentsAttempted: assignmentsByStudent.get(sid)?.size ?? 0,
    transferAxisMean: params.transferAxisByStudent.get(sid) ?? 0,
  }));
}

/**
 * 학생별 대화 turns → 언어 프로파일.
 * `turns`는 role=student만 포함되어야 한다 (AI 응답은 제외).
 */
export function computeLinguisticProfilePerStudent(
  turns: Array<{ studentId: string; role: "student" | "ai"; text: string }>,
): Map<string, LinguisticProfile> {
  const byStudent = new Map<string, string[]>();
  for (const t of turns) {
    if (t.role !== "student") continue;
    const bucket = byStudent.get(t.studentId) ?? [];
    bucket.push(t.text);
    byStudent.set(t.studentId, bucket);
  }
  const out = new Map<string, LinguisticProfile>();
  for (const [sid, utts] of byStudent) {
    out.set(sid, computeLinguisticProfile(utts));
  }
  return out;
}
