"use client";

import { useEffect, useMemo, useState } from "react";

interface CascadeRecord {
  studentId: string;
  displayName: string;
  levelCounts: Record<1 | 2 | 3 | 4, number>;
  totalHints: number;
  submissions: number;
  passes: number;
  acceptEvents: number;
}

interface CascadeTransition {
  from: "L1" | "L2" | "L3" | "L4" | "Accept" | "Submit" | "Quit";
  to: "L1" | "L2" | "L3" | "L4" | "Accept" | "Submit" | "Quit";
  count: number;
}

interface ClusterAssignment {
  studentId: string;
  displayName: string;
  cluster: "independent" | "gradual" | "direct" | "avoidant";
  rationale: string;
}

interface CascadeResponse {
  generatedAt: string;
  records: CascadeRecord[];
  transitions: CascadeTransition[];
  clusters: ClusterAssignment[];
  latencyCdf: Array<{ x: number; p: number }>;
  latencyByLevel: Record<number, Array<{ x: number; p: number }>>;
  latencySample: Array<{ studentId: string; hintLevel: number; latencySec: number }>;
}

const CLUSTER_LABEL: Record<ClusterAssignment["cluster"], { label: string; color: string }> = {
  independent: { label: "Independent", color: "bg-success/20 text-success" },
  gradual: { label: "Gradual", color: "bg-primary/20 text-primary" },
  direct: { label: "Direct", color: "bg-warning/20 text-warning" },
  avoidant: { label: "Avoidant", color: "bg-error/20 text-error" },
};

const NODE_ORDER = ["L1", "L2", "L3", "L4", "Accept", "Submit", "Quit"] as const;

export default function CascadePage() {
  const [data, setData] = useState<CascadeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/research/cascade");
        if (!res.ok) {
          setErr(`HTTP ${res.status}`);
          return;
        }
        setData((await res.json()) as CascadeResponse);
      } catch (e) {
        setErr(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const clusterCounts = useMemo(() => {
    if (!data) return null;
    const c = { independent: 0, gradual: 0, direct: 0, avoidant: 0 };
    for (const cl of data.clusters) c[cl.cluster]++;
    return c;
  }, [data]);

  const maxTransitionCount = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.transitions.map((t) => t.count));
  }, [data]);

  if (loading) return <main className="p-12 text-sm text-neutral">분석 중…</main>;
  if (err || !data) return <main className="p-12 text-sm text-error">오류: {err}</main>;

  return (
    <main className="mx-auto max-w-[1280px] px-6 py-10">
      <nav className="mb-6 flex items-center gap-3 text-[11px] uppercase tracking-wider">
        <a href="/research" className="text-neutral transition-colors hover:text-primary">
          ← Research Lab
        </a>
        <span className="text-neutral">/</span>
        <span className="text-text-primary">Paper 1 · Cascade Analyzer</span>
      </nav>

      <header className="mb-10 border-b border-border-soft pb-6">
        <div className="text-[10px] font-medium uppercase tracking-wider text-primary">
          Paper 1
        </div>
        <h1 className="mt-0.5 font-display text-4xl font-semibold tracking-tighter text-text-primary">
          Hint Cascade Analyzer
        </h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-text-secondary">
          L1~L4 요청 전환, 학생 4-cluster 분포, hint-to-correct latency. 각 Figure는
          변수 정의·표본 크기·계산식이 함께 표기되어 논문 Method section에 그대로
          옮길 수 있어요.
        </p>
        <div className="mt-3 font-mono text-[11px] text-neutral">
          Generated {new Date(data.generatedAt).toLocaleString("ko-KR")} ·
          {" "}{data.records.length} students · {sumHints(data.records)} hints ·{" "}
          {data.latencySample.length} latency obs
        </div>
      </header>

      {/* Fig 1 — Sankey */}
      <FigureFrame
        fig="Fig 1"
        title="Cascade Transitions (Sankey)"
        variable="transition_count(from, to)"
        formula="paired consecutive requestedHint levels + terminal Accept/Submit/Quit"
      >
        <div className="flex items-start gap-6">
          {NODE_ORDER.map((n) => {
            const outgoing = data.transitions.filter((t) => t.from === n);
            const incoming = data.transitions.filter((t) => t.to === n);
            const out = outgoing.reduce((a, b) => a + b.count, 0);
            const inn = incoming.reduce((a, b) => a + b.count, 0);
            return (
              <div
                key={n}
                className="min-w-[84px] rounded-lg border border-border-soft bg-bg p-3 text-center"
              >
                <div className={`text-[10px] font-medium uppercase tracking-wider ${nodeColor(n)}`}>
                  {n}
                </div>
                <div className="mt-1 font-mono text-[13px] text-text-primary">in {inn}</div>
                <div className="font-mono text-[13px] text-text-primary">out {out}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-6 overflow-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border-soft text-left text-[10px] uppercase tracking-wider text-neutral">
                <th className="py-2 pr-4 font-medium">from</th>
                <th className="py-2 pr-4 font-medium">to</th>
                <th className="py-2 pr-4 font-medium">count</th>
                <th className="py-2 font-medium">weight</th>
              </tr>
            </thead>
            <tbody>
              {data.transitions
                .sort((a, b) => b.count - a.count)
                .map((t, i) => (
                  <tr key={i} className="border-b border-border-soft last:border-0">
                    <td className="py-2 pr-4 font-mono text-text-primary">{t.from}</td>
                    <td className="py-2 pr-4 font-mono text-text-primary">{t.to}</td>
                    <td className="py-2 pr-4 font-mono text-text-primary">{t.count}</td>
                    <td className="py-2">
                      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-border-soft">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(t.count / maxTransitionCount) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              {data.transitions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-neutral">
                    아직 수집된 전환이 없어요. 학생이 힌트를 요청하기 시작하면 채워집니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </FigureFrame>

      {/* Fig 2 — Cluster histogram */}
      <FigureFrame
        fig="Fig 2"
        title="Student Cluster Distribution"
        variable="cluster(student) ∈ {independent, gradual, direct, avoidant}"
        formula="rule-based cutoff on L1+L2 share, L4 share, total hints, pass rate"
      >
        {clusterCounts ? (
          <div className="grid grid-cols-4 gap-4">
            {(Object.keys(CLUSTER_LABEL) as Array<ClusterAssignment["cluster"]>).map((k) => {
              const n = clusterCounts[k];
              const total = data.clusters.length || 1;
              return (
                <div
                  key={k}
                  className="rounded-lg border border-border-soft bg-bg p-4 text-center"
                >
                  <div
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${CLUSTER_LABEL[k].color}`}
                  >
                    {CLUSTER_LABEL[k].label}
                  </div>
                  <div className="mt-3 font-display text-3xl font-semibold tracking-tighter text-text-primary">
                    {n}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-neutral">
                    {((n / total) * 100).toFixed(0)}%
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
        <div className="mt-6 overflow-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border-soft text-left text-[10px] uppercase tracking-wider text-neutral">
                <th className="py-2 pr-4 font-medium">student</th>
                <th className="py-2 pr-4 font-medium">cluster</th>
                <th className="py-2 pr-4 font-medium">rationale</th>
                <th className="py-2 font-medium">L1/L2/L3/L4</th>
              </tr>
            </thead>
            <tbody>
              {data.clusters.map((c) => {
                const rec = data.records.find((r) => r.studentId === c.studentId);
                return (
                  <tr key={c.studentId} className="border-b border-border-soft last:border-0">
                    <td className="py-2 pr-4 text-text-primary">{c.displayName}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${CLUSTER_LABEL[c.cluster].color}`}
                      >
                        {CLUSTER_LABEL[c.cluster].label}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-text-secondary">{c.rationale}</td>
                    <td className="py-2 font-mono text-neutral">
                      {rec
                        ? `${rec.levelCounts[1]}/${rec.levelCounts[2]}/${rec.levelCounts[3]}/${rec.levelCounts[4]}`
                        : "0/0/0/0"}
                    </td>
                  </tr>
                );
              })}
              {data.clusters.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-neutral">
                    분류할 학생 데이터가 없어요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </FigureFrame>

      {/* Fig 3 — Latency eCDF */}
      <FigureFrame
        fig="Fig 3"
        title="Hint-to-Correct Latency (eCDF)"
        variable="latency_sec = submissionPassed.t − receivedHint.t"
        formula="empirical CDF (x sorted ascending, p = i/N)"
      >
        {data.latencyCdf.length === 0 ? (
          <p className="text-[13px] text-neutral">
            아직 관측된 latency 쌍이 없어요. 학생이 힌트 후 제출을 통과하면 축적됩니다.
          </p>
        ) : (
          <>
            <CdfPlot cdf={data.latencyCdf} />
            <div className="mt-4 grid grid-cols-2 gap-3 text-[12px] md:grid-cols-4">
              {[1, 2, 3, 4].map((lvl) => {
                const arr = data.latencyByLevel[lvl] ?? [];
                const median = arr.find((p) => p.p >= 0.5);
                return (
                  <div
                    key={lvl}
                    className="rounded-lg border border-border-soft bg-bg px-3 py-2"
                  >
                    <div className="text-[10px] uppercase tracking-wider text-neutral">
                      L{lvl}
                    </div>
                    <div className="font-mono text-text-primary">
                      N = {arr.length}
                    </div>
                    <div className="font-mono text-neutral">
                      median {median ? median.x.toFixed(0) + "s" : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </FigureFrame>

      <section className="rounded-xl border border-border-soft bg-bg p-6 text-[13px] leading-relaxed text-text-secondary">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
          Reproducibility Note
        </div>
        <h3 className="mt-1 font-display text-xl font-semibold tracking-tighter text-text-primary">
          계산식은 어디에 있나요
        </h3>
        <p className="mt-2">
          모든 집계 함수는{" "}
          <code className="font-mono text-[12px]">packages/xapi/src/analytics/cascade.ts</code>의
          순수 함수입니다. 같은 이벤트 입력을 주면 같은 출력이 나오며, 단위 테스트가
          4개 케이스(독립형·직접형·전환·empty)를 커버합니다. 논문 Methods에는 이
          파일의 SHA로 pin하면 됩니다.
        </p>
      </section>
    </main>
  );
}

function FigureFrame({
  fig,
  title,
  variable,
  formula,
  children,
}: {
  fig: string;
  title: string;
  variable: string;
  formula: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10 overflow-hidden rounded-xl border border-border-soft bg-surface">
      <div className="border-b border-border-soft px-6 py-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-primary">
          {fig}
        </div>
        <h2 className="mt-0.5 font-display text-xl font-semibold tracking-tighter text-text-primary">
          {title}
        </h2>
        <div className="mt-2 grid gap-1 text-[11px] font-mono text-text-secondary">
          <div>
            <span className="text-neutral">variable:</span> {variable}
          </div>
          <div>
            <span className="text-neutral">formula:</span> {formula}
          </div>
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

function CdfPlot({ cdf }: { cdf: Array<{ x: number; p: number }> }) {
  const W = 560;
  const H = 200;
  const padL = 36;
  const padB = 24;
  const padR = 10;
  const padT = 10;
  if (cdf.length === 0) return null;
  const xMax = Math.max(...cdf.map((d) => d.x));
  const xMin = 0;
  const px = (x: number) =>
    padL + ((x - xMin) / (xMax - xMin || 1)) * (W - padL - padR);
  const py = (p: number) => H - padB - p * (H - padT - padB);
  const path = cdf
    .map((d, i) => `${i === 0 ? "M" : "L"} ${px(d.x).toFixed(1)} ${py(d.p).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="latency eCDF"
      className="rounded-lg border border-border-soft bg-bg"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((p) => (
        <g key={p}>
          <line
            x1={padL}
            x2={W - padR}
            y1={py(p)}
            y2={py(p)}
            stroke="#E8E8EC"
            strokeDasharray={p === 0.5 ? "" : "2,2"}
          />
          <text x={4} y={py(p) + 3} fontSize="10" fill="#9C9C9C">
            {p.toFixed(2)}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="#6366F1" strokeWidth="1.8" />
      <text x={padL} y={H - 6} fontSize="10" fill="#9C9C9C">
        0s
      </text>
      <text x={W - padR - 40} y={H - 6} fontSize="10" fill="#9C9C9C">
        {Math.round(xMax)}s
      </text>
      <text
        x={W / 2}
        y={H - 6}
        fontSize="10"
        fill="#6B6B6B"
        textAnchor="middle"
      >
        hint→correct latency (sec)
      </text>
    </svg>
  );
}

function sumHints(records: CascadeRecord[]): number {
  return records.reduce((a, b) => a + b.totalHints, 0);
}

function nodeColor(n: (typeof NODE_ORDER)[number]): string {
  if (n === "Accept" || n === "Submit") return "text-success";
  if (n === "Quit") return "text-error";
  return "text-primary";
}
