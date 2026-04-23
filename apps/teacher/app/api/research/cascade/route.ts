import { NextResponse } from "next/server";

import {
  bootstrapCI,
  clusterStudents,
  computeCascadeTransitions,
  computeHintToCorrectLatency,
  describe,
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

  // Contingency table: Hint level × {accepted, skipped→submit, skipped→quit}
  // requestedHint 는 level 정보를 가지고 있으므로 per-level 집계.
  const contingency: Array<{
    level: 1 | 2 | 3 | 4;
    requested: number;
    received: number;
    acceptedL4: number;
    ledToPass: number;
    ledToQuit: number;
  }> = [1, 2, 3, 4].map((level) => ({
    level: level as 1 | 2 | 3 | 4,
    requested: 0,
    received: 0,
    acceptedL4: 0,
    ledToPass: 0,
    ledToQuit: 0,
  }));

  // event 순회 — 각 requestedHint 다음 N분 내 submissionPassed 가 있는지
  const FIVE_MIN = 5 * 60 * 1000;
  const sortedEvents = [...dump.events].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );
  for (let i = 0; i < sortedEvents.length; i++) {
    const e = sortedEvents[i]!;
    const verb = String(e.verb ?? "");
    if (verb.endsWith("requested-hint")) {
      const level = (e.result as { hintLevel?: 1 | 2 | 3 | 4 } | undefined)?.hintLevel;
      if (level && level >= 1 && level <= 4) {
        const row = contingency[level - 1]!;
        row.requested += 1;
        const requestTime = new Date(e.timestamp).getTime();
        const actorId =
          e.actor && typeof e.actor === "object" && "id" in e.actor
            ? String((e.actor as { id?: string }).id ?? "")
            : "";
        // lookahead — 같은 actor 의 다음 이벤트에서 pass 여부 확인
        for (let j = i + 1; j < sortedEvents.length; j++) {
          const ne = sortedEvents[j]!;
          const neActor =
            ne.actor && typeof ne.actor === "object" && "id" in ne.actor
              ? String((ne.actor as { id?: string }).id ?? "")
              : "";
          if (neActor !== actorId) continue;
          const nt = new Date(ne.timestamp).getTime();
          if (nt - requestTime > FIVE_MIN) break;
          const nv = String(ne.verb ?? "");
          if (nv.endsWith("submission-passed")) {
            row.ledToPass += 1;
            break;
          }
        }
      }
    } else if (verb.endsWith("received-hint")) {
      const level = (e.result as { hintLevel?: 1 | 2 | 3 | 4 } | undefined)?.hintLevel;
      if (level && level >= 1 && level <= 4) {
        contingency[level - 1]!.received += 1;
      }
    } else if (verb.endsWith("ai-suggestion-accepted")) {
      // L4 accept
      contingency[3]!.acceptedL4 += 1;
    }
  }

  // Overall latency descriptives + bootstrap CI on median
  const latencies = latency.map((l) => l.latencySec);
  const latencyStats = describe(latencies);
  const latencyMedianCI = bootstrapCI(
    latencies,
    (xs) => {
      if (xs.length === 0) return 0;
      const sorted = [...xs].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
    },
    { iterations: 500, ci: 0.95, seed: 42 },
  );

  // Per-level bootstrap CI
  const latencyCIByLevel: Record<
    number,
    { median: number; lo: number; hi: number; n: number }
  > = {};
  for (const lvl of [1, 2, 3, 4] as const) {
    const sample = latency.filter((l) => l.hintLevel === lvl).map((l) => l.latencySec);
    if (sample.length === 0) {
      latencyCIByLevel[lvl] = { median: 0, lo: 0, hi: 0, n: 0 };
      continue;
    }
    const ci = bootstrapCI(
      sample,
      (xs) => {
        const sorted = [...xs].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
      },
      { iterations: 500, ci: 0.95, seed: 42 + lvl },
    );
    latencyCIByLevel[lvl] = {
      median: ci.estimate,
      lo: ci.lo,
      hi: ci.hi,
      n: sample.length,
    };
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    records: enrichedRecords,
    transitions,
    clusters: enrichedClusters,
    latencySample: latency,
    latencyCdf: overallCdf,
    latencyByLevel,
    contingency,
    latencyStats,
    latencyMedianCI,
    latencyCIByLevel,
  });
}
