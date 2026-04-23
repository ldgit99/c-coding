"use client";

import { useEffect, useMemo, useState } from "react";

type QuestionType = "concept" | "debug" | "answer_request" | "metacognitive" | "other";

interface PerStudent {
  studentId: string;
  displayName: string;
  utteranceCount: number;
  distribution: Record<QuestionType, number>;
  frustration: number;
  stuckLoop: { term: string | null; repeat: number } | null;
  offloadingScore: number;
  metacognitiveRate: number;
}

interface Cluster {
  representative: string;
  count: number;
  members: string[];
}

interface RedFlag {
  studentId: string;
  displayName: string;
  kind: "frustration" | "stuck_loop" | "answer_request";
  detail: string;
}

interface AssignmentOption {
  value: string;
  label: string;
  turnCount: number;
}

interface Response {
  cohortId: string;
  source: "supabase" | "memory";
  assignmentFilter: string;
  assignmentOptions: AssignmentOption[];
  collectedTurns: number;
  studentCount: number;
  totalDistribution: Record<QuestionType, number>;
  perStudent: PerStudent[];
  clusters: Cluster[];
  redFlags: RedFlag[];
  generatedAt: string;
}

const TYPE_LABEL: Record<QuestionType, { label: string; emoji: string; color: string }> = {
  concept: { label: "개념", emoji: "🔵", color: "bg-primary/10 text-primary border-primary/20" },
  debug: { label: "디버깅", emoji: "🟡", color: "bg-warning/10 text-warning border-warning/20" },
  answer_request: {
    label: "답 요청",
    emoji: "🔴",
    color: "bg-error/10 text-error border-error/20",
  },
  metacognitive: {
    label: "메타인지",
    emoji: "🟣",
    color: "bg-success/10 text-success border-success/20",
  },
  other: { label: "기타", emoji: "⚪", color: "bg-bg text-neutral border-border-soft" },
};

export function ConversationsPage() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignmentFilter, setAssignmentFilter] = useState<string>("all");

  const load = async (filter = assignmentFilter) => {
    try {
      const q = filter === "all" ? "" : `?assignmentId=${encodeURIComponent(filter)}`;
      const res = await fetch(`/api/conversations${q}`, { cache: "no-store" });
      setData((await res.json()) as Response);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(assignmentFilter);
    const id = setInterval(() => void load(assignmentFilter), 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentFilter]);

  const totalCount = useMemo(() => {
    if (!data) return 0;
    return Object.values(data.totalDistribution).reduce((a, b) => a + b, 0);
  }, [data]);

  return (
    <main className="mx-auto max-w-[1280px] px-8 py-8">
      <header className="mb-6 flex items-end justify-between gap-4 border-b border-border-soft pb-5">
        <div>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral">
            Learning Analytics
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tighter text-text-primary">
            대화 분석
          </h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            학생 발화 유형 분포 · 막힘 신호 · 공통 질문 클러스터 · 30초 자동 갱신
          </p>
        </div>
        {data && (
          <div className="text-right text-[12px] text-text-secondary">
            <div>
              <span className="text-neutral">source · </span>
              <span className={`font-mono ${data.source === "supabase" ? "text-primary" : "text-warning"}`}>
                {data.source}
              </span>
            </div>
            <div className="mt-1 text-neutral">
              {data.collectedTurns}턴 · {data.studentCount}명
            </div>
          </div>
        )}
      </header>

      {/* Assignment 필터 */}
      {data && data.assignmentOptions && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-neutral">과제:</span>
          <select
            value={assignmentFilter}
            onChange={(e) => setAssignmentFilter(e.target.value)}
            className="h-9 rounded-md border border-border-soft bg-surface px-3 text-[13px] text-text-primary focus:border-primary focus:outline-none"
          >
            {data.assignmentOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} · {opt.turnCount}턴
              </option>
            ))}
          </select>
          {assignmentFilter !== "all" && (
            <button
              type="button"
              onClick={() => setAssignmentFilter("all")}
              className="h-9 rounded-md border border-border-soft bg-surface px-2.5 text-[11px] text-text-secondary hover:border-primary hover:text-primary"
            >
              전체로 리셋
            </button>
          )}
        </div>
      )}

      {loading && !data && <div className="text-[13px] text-neutral">로딩 중…</div>}

      {data && totalCount === 0 && (
        <section className="rounded-xl border border-border-soft bg-surface p-8 text-center text-[13px] text-text-secondary">
          수집된 학생 발화가 없습니다. 학생 앱이 켜져 있고 대화가 저장되어야 분석이 표시돼요.
        </section>
      )}

      {data && totalCount > 0 && (
        <>
          <section className="mb-6 overflow-hidden rounded-xl border border-border-soft bg-surface">
            <div className="border-b border-border-soft px-5 py-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
                Overall
              </div>
              <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary">
                이번 세션 질문 유형 분포
              </h2>
            </div>
            <div className="px-5 py-4">
              <DistributionBar distribution={data.totalDistribution} total={totalCount} />
              <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
                {(Object.keys(TYPE_LABEL) as QuestionType[]).map((k) => {
                  const n = data.totalDistribution[k];
                  const rate = totalCount > 0 ? (n / totalCount) * 100 : 0;
                  return (
                    <span
                      key={k}
                      className={`inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-medium ${TYPE_LABEL[k].color}`}
                    >
                      {TYPE_LABEL[k].emoji} {TYPE_LABEL[k].label} · {n} ({rate.toFixed(0)}%)
                    </span>
                  );
                })}
              </div>
            </div>
          </section>

          {data.redFlags.length > 0 && (
            <section className="mb-6 overflow-hidden rounded-xl border border-error/30 bg-error/5">
              <div className="border-b border-error/20 px-5 py-3">
                <div className="text-[10px] font-medium uppercase tracking-wider text-error">
                  🚩 Red Flags
                </div>
                <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary">
                  지금 확인이 필요한 학생
                </h2>
              </div>
              <ul className="divide-y divide-error/10">
                {data.redFlags.map((f, i) => (
                  <li key={i} className="flex items-center justify-between px-5 py-3 text-[13px]">
                    <div className="flex items-center gap-3">
                      <RedFlagIcon kind={f.kind} />
                      <a
                        href={`/student/${f.studentId}`}
                        className="font-medium text-text-primary transition-colors hover:text-primary"
                      >
                        {f.displayName}
                      </a>
                      <span className="text-text-secondary">{f.detail}</span>
                    </div>
                    <a
                      href={`/student/${f.studentId}`}
                      className="text-[11px] uppercase tracking-wider text-primary transition-colors hover:underline"
                    >
                      상세 →
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mb-6 overflow-hidden rounded-xl border border-border-soft bg-surface">
            <div className="border-b border-border-soft px-5 py-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
                Common Questions
              </div>
              <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary">
                상위 공통 질문 클러스터
              </h2>
              <p className="mt-0.5 text-[11px] text-text-secondary">
                토큰 Jaccard ≥ 0.4 그룹 · 2명 이상 · 수업 주제 후보
              </p>
            </div>
            <div className="px-5 py-4">
              {data.clusters.length === 0 ? (
                <p className="text-[12px] text-text-secondary">공통 패턴이 뚜렷하지 않습니다.</p>
              ) : (
                <ul className="space-y-3">
                  {data.clusters.map((c, i) => (
                    <li key={i} className="rounded-md border border-border-soft p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-text-primary">
                          “{c.representative}”
                        </span>
                        <span className="rounded-sm bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          ×{c.count}
                        </span>
                      </div>
                      {c.members.length > 1 && (
                        <ul className="mt-2 space-y-0.5 pl-3 text-[11px] text-text-secondary">
                          {c.members.slice(1, 4).map((m, j) => (
                            <li key={j}>· {m}</li>
                          ))}
                          {c.members.length > 4 && (
                            <li className="text-neutral">· 외 {c.members.length - 4}개</li>
                          )}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-border-soft bg-surface">
            <div className="border-b border-border-soft px-5 py-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
                Per Student
              </div>
              <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary">
                학생별 대화 프로파일
              </h2>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-bg text-left text-[10px] uppercase tracking-wider text-neutral">
                  <tr>
                    <th className="px-4 py-2 font-medium">학생</th>
                    <th className="px-4 py-2 font-medium">턴</th>
                    <th className="px-4 py-2 font-medium">질문 유형 분포</th>
                    <th className="px-4 py-2 font-medium">감정</th>
                    <th className="px-4 py-2 font-medium">오프로딩</th>
                    <th className="px-4 py-2 font-medium">메타인지</th>
                    <th className="px-4 py-2 font-medium">막힘 루프</th>
                  </tr>
                </thead>
                <tbody>
                  {data.perStudent.map((s) => {
                    const total = s.utteranceCount;
                    return (
                      <tr key={s.studentId} className="border-t border-border-soft">
                        <td className="px-4 py-2.5">
                          <a
                            href={`/student/${s.studentId}`}
                            className="font-medium text-text-primary transition-colors hover:text-primary"
                          >
                            {s.displayName}
                          </a>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-text-primary">{total}</td>
                        <td className="px-4 py-2.5">
                          <DistributionBar distribution={s.distribution} total={total} compact />
                        </td>
                        <td className="px-4 py-2.5">
                          <ValueBadge value={s.frustration} invert />
                        </td>
                        <td className="px-4 py-2.5">
                          <ValueBadge value={s.offloadingScore} invert />
                        </td>
                        <td className="px-4 py-2.5">
                          <ValueBadge value={s.metacognitiveRate} />
                        </td>
                        <td className="px-4 py-2.5">
                          {s.stuckLoop ? (
                            <span className="rounded-sm border border-warning/20 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                              {s.stuckLoop.term} ×{s.stuckLoop.repeat}
                            </span>
                          ) : (
                            <span className="text-neutral">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="mt-4 text-right text-[11px] text-neutral">
            generated {new Date(data.generatedAt).toLocaleTimeString("ko-KR")}
          </div>
        </>
      )}
    </main>
  );
}

function DistributionBar({
  distribution,
  total,
  compact,
}: {
  distribution: Record<QuestionType, number>;
  total: number;
  compact?: boolean;
}) {
  if (total === 0) return <span className="text-[11px] text-neutral">—</span>;
  const order: QuestionType[] = ["metacognitive", "concept", "debug", "answer_request", "other"];
  const fillColor: Record<QuestionType, string> = {
    metacognitive: "bg-success",
    concept: "bg-primary",
    debug: "bg-warning",
    answer_request: "bg-error",
    other: "bg-neutral",
  };
  return (
    <div className={`flex overflow-hidden rounded ${compact ? "h-2.5 w-44" : "h-3 w-full"}`}>
      {order.map((k) => {
        const n = distribution[k];
        if (n === 0) return null;
        const pct = (n / total) * 100;
        return (
          <span
            key={k}
            title={`${TYPE_LABEL[k].label} ${n}/${total}`}
            className={`${fillColor[k]}`}
            style={{ width: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}

function ValueBadge({ value, invert }: { value: number; invert?: boolean }) {
  const pct = Math.round(value * 100);
  let color = "bg-bg text-text-secondary";
  if (invert) {
    if (value >= 0.3) color = "bg-error/10 text-error";
    else if (value >= 0.15) color = "bg-warning/10 text-warning";
    else color = "bg-success/10 text-success";
  } else {
    if (value >= 0.2) color = "bg-success/10 text-success";
    else if (value >= 0.1) color = "bg-primary/10 text-primary";
  }
  return (
    <span className={`inline-flex h-5 items-center rounded px-1.5 font-mono text-[10px] font-medium ${color}`}>
      {pct}%
    </span>
  );
}

function RedFlagIcon({ kind }: { kind: RedFlag["kind"] }) {
  const map = {
    frustration: { emoji: "😩", label: "감정" },
    stuck_loop: { emoji: "🔁", label: "막힘" },
    answer_request: { emoji: "🙏", label: "답 요청" },
  };
  const v = map[kind];
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded border border-error/20 bg-white px-2 text-[11px] font-medium text-error">
      {v.emoji} {v.label}
    </span>
  );
}
