/**
 * Paper 1 — Hint Cascade Analyzer.
 *
 * xAPI requestedHint/receivedHint/aiSuggestionAccepted 이벤트를 세션 단위로
 * 정리해 다음 분석에 쓸 수 있는 요약을 만든다.
 *
 * - Sankey flow: L1 → L2 → L3 → L4 → Accept/Quit 전환 빈도
 * - Student cluster: 힌트 레벨 분포 기반 4종 군집 (독립/점진/직접/회피)
 * - Hint-to-Correct latency: 힌트 수신 후 다음 성공까지의 시간 분포
 *
 * 모든 계산은 이벤트 메타데이터만 사용 — 발화 원문 없이 reproducible.
 */

import type { XApiStatementT } from "../index";
import { Verbs } from "../verbs";

export type HintLevel = 1 | 2 | 3 | 4;
export type CascadeNode = "L1" | "L2" | "L3" | "L4" | "Accept" | "Submit" | "Quit";

export interface CascadeTransition {
  from: CascadeNode;
  to: CascadeNode;
  count: number;
}

export interface StudentCascadeRecord {
  studentId: string;
  levelCounts: Record<HintLevel, number>;
  totalHints: number;
  submissions: number;
  passes: number;
  acceptEvents: number;
}

export type CascadeCluster = "independent" | "gradual" | "direct" | "avoidant";

export interface ClusterAssignment {
  studentId: string;
  cluster: CascadeCluster;
  rationale: string;
}

/** 이벤트 extensions 필드에서 result 값을 꺼낸다 (xapi buildStatement 규약). */
function extResult(stmt: XApiStatementT): Record<string, unknown> {
  const ext = stmt.result?.extensions ?? {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ext)) {
    const key = k.split("/").pop() ?? k;
    out[key] = v;
  }
  return out;
}

function getStudentId(stmt: XApiStatementT): string {
  return stmt.actor.account.name;
}

function getVerb(stmt: XApiStatementT): string {
  return stmt.verb.id;
}

/**
 * 학생별 Cascade 요약을 만든다. 제출 이벤트가 있으면 세션 경계로 사용.
 */
export function summarizeCascadePerStudent(
  events: XApiStatementT[],
): StudentCascadeRecord[] {
  const byStudent = new Map<string, StudentCascadeRecord>();

  for (const e of events) {
    const sid = getStudentId(e);
    if (!byStudent.has(sid)) {
      byStudent.set(sid, {
        studentId: sid,
        levelCounts: { 1: 0, 2: 0, 3: 0, 4: 0 },
        totalHints: 0,
        submissions: 0,
        passes: 0,
        acceptEvents: 0,
      });
    }
    const rec = byStudent.get(sid)!;
    const verb = getVerb(e);
    const r = extResult(e);

    if (verb === Verbs.requestedHint) {
      const level = Number(r.hintLevel);
      if (level >= 1 && level <= 4) {
        rec.levelCounts[level as HintLevel]++;
        rec.totalHints++;
      }
    } else if (verb === Verbs.submissionPassed) {
      rec.submissions++;
      rec.passes++;
    } else if (verb === Verbs.submissionFailed) {
      rec.submissions++;
    } else if (verb === Verbs.aiSuggestionAccepted) {
      rec.acceptEvents++;
    }
  }

  return Array.from(byStudent.values());
}

/**
 * Sankey 전환 count. 같은 학생 내 연속된 requestedHint 레벨 쌍과, 마지막
 * 힌트 → Submit/Accept 전환을 집계.
 */
export function computeCascadeTransitions(events: XApiStatementT[]): CascadeTransition[] {
  const perStudent = new Map<string, XApiStatementT[]>();
  for (const e of events) {
    const sid = getStudentId(e);
    const bucket = perStudent.get(sid) ?? [];
    bucket.push(e);
    perStudent.set(sid, bucket);
  }

  const transitions = new Map<string, number>();
  const bump = (from: CascadeNode, to: CascadeNode) => {
    const k = `${from}→${to}`;
    transitions.set(k, (transitions.get(k) ?? 0) + 1);
  };

  for (const [, stmts] of perStudent) {
    stmts.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    let lastLevel: HintLevel | null = null;
    for (const e of stmts) {
      const verb = getVerb(e);
      const r = extResult(e);

      if (verb === Verbs.requestedHint) {
        const lvl = Number(r.hintLevel);
        if (lvl >= 1 && lvl <= 4) {
          const to = `L${lvl}` as CascadeNode;
          if (lastLevel !== null) {
            bump(`L${lastLevel}` as CascadeNode, to);
          }
          lastLevel = lvl as HintLevel;
        }
      } else if (verb === Verbs.aiSuggestionAccepted && lastLevel !== null) {
        bump(`L${lastLevel}` as CascadeNode, "Accept");
        lastLevel = null;
      } else if (
        (verb === Verbs.submissionPassed || verb === Verbs.submissionFailed) &&
        lastLevel !== null
      ) {
        bump(`L${lastLevel}` as CascadeNode, "Submit");
        lastLevel = null;
      }
    }
    // 세션 말미에 아직 응답 없는 힌트는 Quit 처리
    if (lastLevel !== null) {
      bump(`L${lastLevel}` as CascadeNode, "Quit");
    }
  }

  return Array.from(transitions.entries()).map(([k, count]) => {
    const [from, to] = k.split("→") as [CascadeNode, CascadeNode];
    return { from, to, count };
  });
}

/**
 * 간단한 규칙 기반 클러스터링. K-means가 분산 파일럿 N=30에서 불안정하므로
 * 해석 가능한 rule-based cutoff를 사용한다.
 */
export function clusterStudents(records: StudentCascadeRecord[]): ClusterAssignment[] {
  return records.map((r) => {
    if (r.totalHints === 0) {
      return {
        studentId: r.studentId,
        cluster: "independent" as const,
        rationale: "힌트 요청 없음",
      };
    }
    const l1l2 = (r.levelCounts[1] + r.levelCounts[2]) / r.totalHints;
    const l4 = r.levelCounts[4] / r.totalHints;
    const passRate = r.submissions > 0 ? r.passes / r.submissions : 0;

    if (l1l2 >= 0.7) {
      return {
        studentId: r.studentId,
        cluster: "independent",
        rationale: `L1~L2 비율 ${(l1l2 * 100).toFixed(0)}%`,
      };
    }
    if (l4 >= 0.4) {
      return {
        studentId: r.studentId,
        cluster: "direct",
        rationale: `L4 비율 ${(l4 * 100).toFixed(0)}%`,
      };
    }
    if (r.totalHints < 3 && passRate < 0.3) {
      return {
        studentId: r.studentId,
        cluster: "avoidant",
        rationale: "힌트 적고 통과율 낮음",
      };
    }
    return {
      studentId: r.studentId,
      cluster: "gradual",
      rationale: "모든 레벨 고르게 사용",
    };
  });
}

/**
 * 힌트 수신 이벤트와 다음 실행/제출 성공 이벤트 간 시간차(초). 없으면 null.
 * Paper 1 Fig 3 — hint-to-correct latency 생존함수 재료.
 */
export interface LatencyDatum {
  studentId: string;
  hintLevel: HintLevel;
  latencySec: number;
}

export function computeHintToCorrectLatency(events: XApiStatementT[]): LatencyDatum[] {
  const perStudent = new Map<string, XApiStatementT[]>();
  for (const e of events) {
    const sid = getStudentId(e);
    const bucket = perStudent.get(sid) ?? [];
    bucket.push(e);
    perStudent.set(sid, bucket);
  }

  const out: LatencyDatum[] = [];
  for (const [sid, stmts] of perStudent) {
    stmts.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    for (let i = 0; i < stmts.length; i++) {
      const e = stmts[i]!;
      if (getVerb(e) !== Verbs.receivedHint) continue;
      const r = extResult(e);
      const lvl = Number(r.hintLevel);
      if (!(lvl >= 1 && lvl <= 4)) continue;
      // 이후 submissionPassed까지 scan
      for (let j = i + 1; j < stmts.length; j++) {
        const next = stmts[j]!;
        if (getVerb(next) === Verbs.submissionPassed) {
          const dt =
            (Date.parse(next.timestamp) - Date.parse(e.timestamp)) / 1000;
          if (dt >= 0 && dt < 60 * 60 * 3) {
            out.push({ studentId: sid, hintLevel: lvl as HintLevel, latencySec: dt });
          }
          break;
        }
      }
    }
  }
  return out;
}

/**
 * eCDF (empirical CDF) 표본 — Fig 3용. 반환 배열은 (x, cumulative_probability).
 */
export function latencyCdf(latencies: number[]): Array<{ x: number; p: number }> {
  if (latencies.length === 0) return [];
  const sorted = [...latencies].sort((a, b) => a - b);
  return sorted.map((x, i) => ({ x, p: (i + 1) / sorted.length }));
}
