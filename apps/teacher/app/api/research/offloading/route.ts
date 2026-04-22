import { NextResponse } from "next/server";

import {
  buildGamingInputs,
  classifyOffloading,
  computeDependencyTrajectories,
  computeLinguisticProfilePerStudent,
  computeModeDistribution,
  type ConversationTurn,
  type XApiStatementT,
} from "@cvibe/xapi";

/**
 * GET /api/research/offloading — Paper 3 (Cognitive Offloading Detector).
 *
 * - Dependency Factor Trajectory
 * - Gaming vs Struggling Scatter (L4 freq × transfer axis)
 * - Linguistic Profile (per-student utterance features)
 */
const STUDENT_URL =
  process.env.STUDENT_APP_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_STUDENT_APP_URL ??
  "http://localhost:3000";

interface DumpPayload {
  events: XApiStatementT[];
  turns: ConversationTurn[];
  dependencyFactorHistory: Array<{
    studentId: string;
    studentIdHashed: string;
    dependencyFactor: number;
    timestamp: string;
  }>;
  transferByStudent: Array<{
    studentId: string;
    studentIdHashed: string;
    transferAxisMean: number;
  }>;
  students: Array<{ id: string; idHashed: string; displayName: string }>;
}

export async function GET() {
  let dump: DumpPayload;
  try {
    const res = await fetch(`${STUDENT_URL}/api/analytics/dump`, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: `dump ${res.status}` }, { status: 502 });
    dump = (await res.json()) as DumpPayload;
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  const nameMap = new Map<string, string>();
  for (const s of dump.students) {
    nameMap.set(s.idHashed, s.displayName);
    nameMap.set(s.id, s.displayName);
  }

  // Trajectory
  const trajectories = computeDependencyTrajectories(
    dump.dependencyFactorHistory.map((d) => ({
      studentId: d.studentId,
      timestamp: d.timestamp,
      dependencyFactor: d.dependencyFactor,
    })),
  );

  // Offloading quadrants — event의 actor는 hashedId이므로 그 기준으로 matching
  const transferMap = new Map<string, number>();
  for (const t of dump.transferByStudent) {
    transferMap.set(t.studentIdHashed, t.transferAxisMean);
    transferMap.set(t.studentId, t.transferAxisMean);
  }
  const gamingInputs = buildGamingInputs({
    events: dump.events,
    transferAxisByStudent: transferMap,
  });
  const quadrants = classifyOffloading(gamingInputs);

  // Linguistic profile — turns의 studentId는 학생 앱이 저장할 때 사용한 id
  const perStudentProfile = computeLinguisticProfilePerStudent(dump.turns);

  const enrichedTrajectories = trajectories.map((t) => ({
    ...t,
    displayName: nameMap.get(t.studentId) ?? t.studentId.slice(0, 12),
  }));
  const enrichedQuadrants = quadrants.map((q) => ({
    ...q,
    displayName: nameMap.get(q.studentId) ?? q.studentId.slice(0, 12),
  }));
  const enrichedProfiles = Array.from(perStudentProfile.entries()).map(([sid, p]) => ({
    studentId: sid,
    displayName: nameMap.get(sid) ?? sid.slice(0, 12),
    profile: p,
  }));

  // 모드 분포 (전체 cohort)
  const modeDistribution = computeModeDistribution(dump.turns);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    trajectories: enrichedTrajectories,
    quadrants: enrichedQuadrants,
    linguisticProfiles: enrichedProfiles,
    modeDistribution,
  });
}
