import { NextResponse } from "next/server";

import {
  clusterStudents,
  computeCascadeTransitions,
  computeHintToCorrectLatency,
  latencyCdf,
  summarizeCascadePerStudent,
  type XApiStatementT,
} from "@cvibe/xapi";

/**
 * GET /api/research/cascade — Paper 1 (Hint Cascade Analyzer).
 *
 * 학생 앱의 /api/analytics/dump에서 이벤트를 가져와 cascade 집계를 수행한다.
 * 연구용 · 교사 실시간 의사결정과 레이어 분리.
 */
const STUDENT_URL =
  process.env.STUDENT_APP_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_STUDENT_APP_URL ??
  "http://localhost:3000";

interface DumpPayload {
  events: XApiStatementT[];
  students: Array<{ id: string; idHashed: string; displayName: string }>;
}

export async function GET() {
  let dump: DumpPayload;
  try {
    const res = await fetch(`${STUDENT_URL}/api/analytics/dump`, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: `dump ${res.status}` },
        { status: 502 },
      );
    }
    dump = (await res.json()) as DumpPayload;
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }

  const perStudent = summarizeCascadePerStudent(dump.events);
  const transitions = computeCascadeTransitions(dump.events);
  const clusters = clusterStudents(perStudent);
  const latency = computeHintToCorrectLatency(dump.events);
  const overallCdf = latencyCdf(latency.map((l) => l.latencySec));
  const latencyByLevel: Record<number, Array<{ x: number; p: number }>> = {};
  for (const lvl of [1, 2, 3, 4] as const) {
    latencyByLevel[lvl] = latencyCdf(
      latency.filter((l) => l.hintLevel === lvl).map((l) => l.latencySec),
    );
  }

  // 학생 hashed id → displayName 맵
  const nameMap = new Map<string, string>();
  for (const s of dump.students) {
    nameMap.set(s.idHashed, s.displayName);
    nameMap.set(s.id, s.displayName);
  }

  const enrichedRecords = perStudent.map((r) => ({
    ...r,
    displayName: nameMap.get(r.studentId) ?? r.studentId.slice(0, 12),
  }));
  const enrichedClusters = clusters.map((c) => ({
    ...c,
    displayName: nameMap.get(c.studentId) ?? c.studentId.slice(0, 12),
  }));

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    records: enrichedRecords,
    transitions,
    clusters: enrichedClusters,
    latencySample: latency,
    latencyCdf: overallCdf,
    latencyByLevel,
  });
}
