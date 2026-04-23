"use client";

import { useEffect, useState } from "react";

import { CsvExportButton, ReproFooter, SampleBadge } from "@/components/research/SampleBadge";

interface Desc {
  n: number;
  mean: number;
  sd: number;
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
}

interface Response {
  generatedAt: string;
  sample: {
    selfExplanations: number;
    studentsWithSE: number;
    studentsWithSubmissions: number;
  };
  descriptives: {
    specificity: Desc;
    causality: Desc;
    transfer: Desc;
    overall: Desc;
  };
  correlations: {
    specificity_vs_score: number;
    causality_vs_score: number;
    transfer_vs_score: number;
    overall_vs_score: number;
  };
  cohensD: number;
  groupMeansCI: {
    submitted: { estimate: number; lo: number; hi: number; n: number };
    notSubmitted: { estimate: number; lo: number; hi: number; n: number };
  };
  scatter: Array<{
    studentIdHashed: string;
    axisMean: number;
    finalScoreMean: number;
    n: number;
  }>;
  histogram: {
    specificity: number[];
    causality: number[];
    transfer: number[];
    overall: number[];
  };
}

const AXES = [
  { key: "specificity" as const, ko: "구체성", hex: "#6366F1" },
  { key: "causality" as const, ko: "인과성", hex: "#F59E0B" },
  { key: "transfer" as const, ko: "전이", hex: "#10B981" },
  { key: "overall" as const, ko: "종합", hex: "#64748B" },
];

export default function SelfExplanationPage() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/research/self-explanation", { cache: "no-store" });
        setData((await res.json()) as Response);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-[1280px] px-8 py-8">
      <header className="mb-6 border-b border-border-soft pb-5">
        <div className="text-[10px] font-medium uppercase tracking-wider text-primary">
          Paper 4
        </div>
        <h1 className="mt-0.5 font-display text-3xl font-semibold tracking-tighter text-text-primary">
          Self-Explanation Quality & Transfer Gain
        </h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-text-secondary">
          <strong>RQ</strong>: Do higher-quality self-explanations (specificity · causality ·
          transfer) predict better submission outcomes? Evaluated by Claude Haiku using a 3-axis
          rubric.
        </p>
      </header>

      {loading && <div className="text-[13px] text-neutral">로딩 중…</div>}

      {data && (
        <>
          <div className="mb-6">
            <SampleBadge
              n={data.sample.studentsWithSE}
              label="students with SE"
              note={`${data.sample.selfExplanations} self-explanations · ${data.sample.studentsWithSubmissions} with submissions`}
            />
          </div>

          <Table1Descriptives data={data} />
          <Figure1Histograms data={data} />
          <Figure2Scatter data={data} />
          <Table2Effect data={data} />

          <ReproFooter snapshot={data.generatedAt} />
        </>
      )}
    </main>
  );
}

function Table1Descriptives({ data }: { data: Response }) {
  const rows = AXES.map((a) => {
    const d = data.descriptives[a.key];
    return {
      axis: a.key,
      n: d.n,
      mean: Number(d.mean.toFixed(3)),
      sd: Number(d.sd.toFixed(3)),
      median: Number(d.median.toFixed(3)),
      q1: Number(d.q1.toFixed(3)),
      q3: Number(d.q3.toFixed(3)),
      r_vs_score: data.correlations[`${a.key}_vs_score` as keyof Response["correlations"]],
    };
  });
  return (
    <section className="mb-8 rounded-xl border border-border-soft bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Table 1
          </div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary">
            Self-Explanation Axis Descriptives
          </h2>
          <p className="mt-0.5 text-[11px] text-text-secondary">
            M, SD, median, IQR per axis + Pearson r with mean final score.
          </p>
        </div>
        <CsvExportButton filename="paper4_table1_descriptives.csv" rows={rows} />
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-border-soft text-left text-[10px] uppercase tracking-wider text-neutral">
            <th className="py-2 pr-4 font-medium">Axis</th>
            <th className="py-2 pr-4 text-right font-medium">N</th>
            <th className="py-2 pr-4 text-right font-medium">M</th>
            <th className="py-2 pr-4 text-right font-medium">SD</th>
            <th className="py-2 pr-4 text-right font-medium">Mdn</th>
            <th className="py-2 pr-4 text-right font-medium">Q1</th>
            <th className="py-2 pr-4 text-right font-medium">Q3</th>
            <th className="py-2 text-right font-medium">r with score</th>
          </tr>
        </thead>
        <tbody>
          {AXES.map((a) => {
            const d = data.descriptives[a.key];
            const r =
              data.correlations[`${a.key}_vs_score` as keyof Response["correlations"]];
            return (
              <tr key={a.key} className="border-b border-border-soft last:border-0">
                <td className="py-1.5 pr-4">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: a.hex }}
                  />
                  <span className="ml-2 font-mono text-text-primary">{a.key}</span>
                  <span className="ml-1 text-text-secondary">({a.ko})</span>
                </td>
                <td className="py-1.5 pr-4 text-right font-mono">{d.n}</td>
                <td className="py-1.5 pr-4 text-right font-mono text-text-primary">
                  {d.mean.toFixed(2)}
                </td>
                <td className="py-1.5 pr-4 text-right font-mono">{d.sd.toFixed(2)}</td>
                <td className="py-1.5 pr-4 text-right font-mono">{d.median.toFixed(2)}</td>
                <td className="py-1.5 pr-4 text-right font-mono">{d.q1.toFixed(2)}</td>
                <td className="py-1.5 pr-4 text-right font-mono">{d.q3.toFixed(2)}</td>
                <td className="py-1.5 text-right font-mono text-text-primary">
                  {r.toFixed(3)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-[10px] italic text-text-secondary">
        Caption: Descriptive statistics for three-axis self-explanation rubric evaluated by an
        LLM rater (Claude Haiku). Right-most column: Pearson r between each axis and the student&apos;s
        mean submission finalScore.
      </p>
    </section>
  );
}

function Figure1Histograms({ data }: { data: Response }) {
  return (
    <section className="mb-8 rounded-xl border border-border-soft bg-surface p-5">
      <div className="mb-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
          Figure 1
        </div>
        <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary">
          Score Distribution per Axis
        </h2>
        <p className="mt-0.5 text-[11px] text-text-secondary">
          10 bins in [0, 1]. Each row is one axis.
        </p>
      </div>
      <div className="space-y-4">
        {AXES.map((a) => {
          const bins = data.histogram[a.key];
          const max = Math.max(1, ...bins);
          return (
            <div key={a.key}>
              <div className="mb-1 text-[11px] text-text-secondary">
                <span
                  className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ backgroundColor: a.hex }}
                />
                {a.key}
              </div>
              <div className="flex h-14 items-end gap-1">
                {bins.map((n, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t"
                    style={{
                      height: `${(n / max) * 100}%`,
                      backgroundColor: a.hex,
                      opacity: n === 0 ? 0.1 : 0.7,
                    }}
                    title={`[${(i / 10).toFixed(1)}, ${((i + 1) / 10).toFixed(1)}): ${n}`}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[9px] font-mono text-neutral">
                <span>0.0</span>
                <span>0.5</span>
                <span>1.0</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[10px] italic text-text-secondary">
        Caption: Empirical distributions of three-axis self-explanation scores and the averaged
        overall dimension. Bars represent frequency in deciles of the unit interval.
      </p>
    </section>
  );
}

function Figure2Scatter({ data }: { data: Response }) {
  const W = 560;
  const H = 320;
  const PAD = { l: 46, r: 12, t: 14, b: 36 };
  const w = W - PAD.l - PAD.r;
  const h = H - PAD.t - PAD.b;
  const toX = (v: number) => PAD.l + v * w;
  const toY = (v: number) => PAD.t + (1 - v) * h;
  const r = data.correlations.overall_vs_score;

  return (
    <section className="mb-8 rounded-xl border border-border-soft bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Figure 2
          </div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary">
            Mean Self-Explanation × Mean Final Score
          </h2>
          <p className="mt-0.5 text-[11px] text-text-secondary">
            Each point = one student. X = mean overall axis · Y = mean finalScore. Pearson r ={" "}
            <strong className="font-mono text-text-primary">{r.toFixed(3)}</strong>.
          </p>
        </div>
        <CsvExportButton
          filename="paper4_fig2_scatter.csv"
          rows={data.scatter.map((p) => ({
            student_id_hashed: p.studentIdHashed,
            axis_mean: p.axisMean,
            final_score_mean: p.finalScoreMean,
            se_count: p.n,
          }))}
        />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[640px]">
        <line x1={PAD.l} y1={PAD.t + h} x2={PAD.l + w} y2={PAD.t + h} stroke="#E5E7EB" />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + h} stroke="#E5E7EB" />
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <g key={p}>
            <text
              x={PAD.l - 6}
              y={toY(p) + 4}
              fontSize="10"
              textAnchor="end"
              fill="#94A3B8"
            >
              {p.toFixed(2)}
            </text>
            <text
              x={toX(p)}
              y={PAD.t + h + 14}
              fontSize="10"
              textAnchor="middle"
              fill="#94A3B8"
            >
              {p.toFixed(2)}
            </text>
          </g>
        ))}
        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#64748B">
          Mean self-explanation (overall)
        </text>
        <text
          x={-H / 2}
          y={14}
          transform="rotate(-90)"
          textAnchor="middle"
          fontSize="10"
          fill="#64748B"
        >
          Mean finalScore
        </text>
        {data.scatter.map((p, i) => (
          <circle
            key={i}
            cx={toX(p.axisMean)}
            cy={toY(p.finalScoreMean)}
            r={3 + Math.min(5, p.n)}
            fill="#6366F1"
            fillOpacity={0.65}
          >
            <title>
              {p.studentIdHashed.slice(0, 10)} · axis={p.axisMean.toFixed(2)} · score=
              {p.finalScoreMean.toFixed(2)} · n={p.n}
            </title>
          </circle>
        ))}
      </svg>
      <p className="mt-3 text-[10px] italic text-text-secondary">
        Caption: Per-student association between mean self-explanation quality (3-axis average)
        and mean submission finalScore. Point size encodes the number of self-explanations.
      </p>
    </section>
  );
}

function Table2Effect({ data }: { data: Response }) {
  const sub = data.groupMeansCI.submitted;
  const notSub = data.groupMeansCI.notSubmitted;
  const rows = [
    {
      group: "submitted_self_explanation",
      n: sub.n,
      mean_score: Number(sub.estimate.toFixed(3)),
      ci95_lo: Number(sub.lo.toFixed(3)),
      ci95_hi: Number(sub.hi.toFixed(3)),
    },
    {
      group: "never_submitted",
      n: notSub.n,
      mean_score: Number(notSub.estimate.toFixed(3)),
      ci95_lo: Number(notSub.lo.toFixed(3)),
      ci95_hi: Number(notSub.hi.toFixed(3)),
    },
    {
      group: "cohens_d",
      n: sub.n + notSub.n,
      mean_score: data.cohensD,
      ci95_lo: 0,
      ci95_hi: 0,
    },
  ];
  return (
    <section className="mb-8 rounded-xl border border-border-soft bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Table 2
          </div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary">
            Group Comparison: Self-Explanation Submitted vs Not
          </h2>
          <p className="mt-0.5 text-[11px] text-text-secondary">
            Cohen&apos;s d ={" "}
            <strong className="font-mono text-text-primary">{data.cohensD.toFixed(3)}</strong>{" "}
            ({interpretD(data.cohensD)})
          </p>
        </div>
        <CsvExportButton filename="paper4_table2_groups.csv" rows={rows} />
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-border-soft text-left text-[10px] uppercase tracking-wider text-neutral">
            <th className="py-2 pr-4 font-medium">Group</th>
            <th className="py-2 pr-4 text-right font-medium">N</th>
            <th className="py-2 pr-4 text-right font-medium">Mean score</th>
            <th className="py-2 text-right font-medium">95% bootstrap CI</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border-soft">
            <td className="py-1.5 pr-4 font-mono text-text-primary">Submitted SE</td>
            <td className="py-1.5 pr-4 text-right font-mono">{sub.n}</td>
            <td className="py-1.5 pr-4 text-right font-mono text-text-primary">
              {sub.estimate.toFixed(3)}
            </td>
            <td className="py-1.5 text-right font-mono">
              [{sub.lo.toFixed(3)}, {sub.hi.toFixed(3)}]
            </td>
          </tr>
          <tr className="border-b border-border-soft">
            <td className="py-1.5 pr-4 font-mono text-text-primary">Never submitted</td>
            <td className="py-1.5 pr-4 text-right font-mono">{notSub.n}</td>
            <td className="py-1.5 pr-4 text-right font-mono text-text-primary">
              {notSub.estimate.toFixed(3)}
            </td>
            <td className="py-1.5 text-right font-mono">
              [{notSub.lo.toFixed(3)}, {notSub.hi.toFixed(3)}]
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-[10px] italic text-text-secondary">
        Caption: Mean submission finalScore for students who submitted at least one
        self-explanation vs. those who did not. Effect size reported as Cohen&apos;s d
        (pooled SD). 95% CIs via non-parametric bootstrap (B = 500, seeded).
      </p>
    </section>
  );
}

function interpretD(d: number): string {
  const abs = Math.abs(d);
  if (abs >= 0.8) return "large";
  if (abs >= 0.5) return "medium";
  if (abs >= 0.2) return "small";
  return "negligible";
}
