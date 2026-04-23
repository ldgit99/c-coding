"use client";

import { useEffect, useState } from "react";

import { CsvExportButton, ReproFooter, SampleBadge } from "@/components/research/SampleBadge";

type ArcType =
  | "productive"
  | "stuck_loop"
  | "answer_seek"
  | "wandering"
  | "solo_confident";

type QuestionType = "concept" | "debug" | "answer_request" | "metacognitive" | "other";

interface ArcRow {
  studentId: string;
  arc: ArcType;
  n: number;
  passed: boolean;
  durationMin: number;
  entropyBits: number;
  dominantType: QuestionType | null;
  answerReqRate: number;
  metacogRate: number;
  pcX: number;
  pcY: number;
}

interface ArcSummaryCell {
  n: number;
  passed: number;
  failed: number;
  meanDurationMin: number;
  meanTurns: number;
}

interface Response {
  generatedAt: string;
  sample: { students: number; utterances: number; passedMarked: number };
  rows: ArcRow[];
  arcSummary: Record<ArcType, ArcSummaryCell>;
}

const ARC_META: Record<ArcType, { ko: string; en: string; hex: string }> = {
  productive: { ko: "생산적", en: "Productive", hex: "#10B981" },
  stuck_loop: { ko: "막힘 루프", en: "Stuck loop", hex: "#F59E0B" },
  answer_seek: { ko: "답 찾기", en: "Answer-seeking", hex: "#EF4444" },
  wandering: { ko: "방황", en: "Wandering", hex: "#94A3B8" },
  solo_confident: { ko: "조용히 성공", en: "Solo confident", hex: "#6366F1" },
};

export default function ConversationArcsPage() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/research/conversation-arcs", { cache: "no-store" });
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
          Paper 6
        </div>
        <h1 className="mt-0.5 font-display text-3xl font-semibold tracking-tighter text-text-primary">
          Conversation Arc Taxonomy
        </h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-text-secondary">
          <strong>RQ</strong>: Can student–AI conversations be partitioned into canonical learning
          arcs (productive / stuck loop / answer-seeking / wandering / solo confident) that
          differ in outcomes? Rule-based classifier (no LLM) for reproducibility.
        </p>
      </header>

      {loading && <div className="text-[13px] text-neutral">로딩 중…</div>}

      {data && (
        <>
          <div className="mb-6">
            <SampleBadge
              n={data.sample.students}
              label="students"
              note={`${data.sample.utterances} utterances · ${data.sample.passedMarked} with passed event`}
            />
          </div>

          <Table1ArcSummary data={data} />
          <Figure1PCA data={data} />
          <Figure2StackedPerArc data={data} />

          <ReproFooter snapshot={data.generatedAt} />
        </>
      )}
    </main>
  );
}

function Table1ArcSummary({ data }: { data: Response }) {
  const arcs = Object.keys(data.arcSummary) as ArcType[];
  const totalN = arcs.reduce((a, k) => a + data.arcSummary[k].n, 0);
  const rows = arcs.map((arc) => {
    const s = data.arcSummary[arc];
    return {
      arc,
      n: s.n,
      share: totalN === 0 ? 0 : Number((s.n / totalN).toFixed(3)),
      passed: s.passed,
      failed: s.failed,
      pass_rate: s.n === 0 ? 0 : Number((s.passed / s.n).toFixed(3)),
      mean_turns: s.meanTurns,
      mean_duration_min: s.meanDurationMin,
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
            Arc Type × Outcome Summary
          </h2>
        </div>
        <CsvExportButton filename="paper6_table1_arcs.csv" rows={rows} />
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-border-soft text-left text-[10px] uppercase tracking-wider text-neutral">
            <th className="py-2 pr-4 font-medium">Arc</th>
            <th className="py-2 pr-4 text-right font-medium">N</th>
            <th className="py-2 pr-4 text-right font-medium">Share</th>
            <th className="py-2 pr-4 text-right font-medium">Passed</th>
            <th className="py-2 pr-4 text-right font-medium">Failed</th>
            <th className="py-2 pr-4 text-right font-medium">Pass rate</th>
            <th className="py-2 pr-4 text-right font-medium">M turns</th>
            <th className="py-2 text-right font-medium">M min</th>
          </tr>
        </thead>
        <tbody>
          {arcs.map((arc) => {
            const s = data.arcSummary[arc];
            const total = s.passed + s.failed;
            const passRate = total === 0 ? 0 : (s.passed / total) * 100;
            return (
              <tr key={arc} className="border-b border-border-soft last:border-0">
                <td className="py-1.5 pr-4">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: ARC_META[arc].hex }}
                  />
                  <span className="ml-2 font-mono text-text-primary">
                    {ARC_META[arc].en}
                  </span>
                  <span className="ml-1 text-text-secondary">({ARC_META[arc].ko})</span>
                </td>
                <td className="py-1.5 pr-4 text-right font-mono">{s.n}</td>
                <td className="py-1.5 pr-4 text-right font-mono">
                  {totalN === 0 ? "—" : `${((s.n / totalN) * 100).toFixed(0)}%`}
                </td>
                <td className="py-1.5 pr-4 text-right font-mono">{s.passed}</td>
                <td className="py-1.5 pr-4 text-right font-mono">{s.failed}</td>
                <td className="py-1.5 pr-4 text-right font-mono text-text-primary">
                  {total === 0 ? "—" : `${passRate.toFixed(0)}%`}
                </td>
                <td className="py-1.5 pr-4 text-right font-mono">{s.meanTurns}</td>
                <td className="py-1.5 text-right font-mono">{s.meanDurationMin}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-[10px] italic text-text-secondary">
        Caption: Five canonical conversation arcs discovered via rule-based classification of
        student utterance sequences. M turns / M min = mean turn count / mean duration in minutes.
      </p>
    </section>
  );
}

function Figure1PCA({ data }: { data: Response }) {
  const W = 620;
  const H = 340;
  const PAD = { l: 40, r: 16, t: 16, b: 32 };
  const w = W - PAD.l - PAD.r;
  const h = H - PAD.t - PAD.b;

  const xs = data.rows.map((r) => r.pcX);
  const ys = data.rows.map((r) => r.pcY);
  const xMin = Math.min(0, ...xs);
  const xMax = Math.max(0, ...xs);
  const yMin = Math.min(0, ...ys);
  const yMax = Math.max(0, ...ys);
  const xRange = Math.max(1e-6, xMax - xMin);
  const yRange = Math.max(1e-6, yMax - yMin);
  const toX = (v: number) => PAD.l + ((v - xMin) / xRange) * w;
  const toY = (v: number) => PAD.t + h - ((v - yMin) / yRange) * h;

  const rows = data.rows.map((r) => ({
    studentId_hashed: r.studentId,
    arc: r.arc,
    passed: r.passed ? 1 : 0,
    utterances: r.n,
    duration_min: r.durationMin,
    entropy_bits: r.entropyBits,
    pc1: Number(r.pcX.toFixed(3)),
    pc2: Number(r.pcY.toFixed(3)),
  }));

  return (
    <section className="mb-8 rounded-xl border border-border-soft bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Figure 1
          </div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary">
            PCA Projection of Question-Type Frequency Vectors
          </h2>
          <p className="mt-0.5 text-[11px] text-text-secondary">
            Each point = one student-session. 5D type-rate vector → PCA (power iteration, seeded).
            Color = arc type. Point size = utterance count. Ring = passed outcome.
          </p>
        </div>
        <CsvExportButton filename="paper6_fig1_pca.csv" rows={rows} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[720px]">
        {/* axes */}
        <line x1={PAD.l} y1={PAD.t + h} x2={PAD.l + w} y2={PAD.t + h} stroke="#E5E7EB" />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + h} stroke="#E5E7EB" />
        <line
          x1={toX(0)}
          y1={PAD.t}
          x2={toX(0)}
          y2={PAD.t + h}
          stroke="#F1F5F9"
          strokeDasharray="3 3"
        />
        <line
          x1={PAD.l}
          y1={toY(0)}
          x2={PAD.l + w}
          y2={toY(0)}
          stroke="#F1F5F9"
          strokeDasharray="3 3"
        />
        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#64748B">
          PC1
        </text>
        <text
          x={-H / 2}
          y={14}
          transform="rotate(-90)"
          textAnchor="middle"
          fontSize="10"
          fill="#64748B"
        >
          PC2
        </text>
        {data.rows.map((r, i) => {
          const cx = toX(r.pcX);
          const cy = toY(r.pcY);
          const radius = Math.max(4, Math.min(12, 3 + Math.sqrt(r.n) * 1.3));
          return (
            <g key={i}>
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill={ARC_META[r.arc].hex}
                fillOpacity={0.7}
                stroke={r.passed ? "#10B981" : "white"}
                strokeWidth={r.passed ? 2.5 : 1.5}
              >
                <title>
                  {r.studentId.slice(0, 10)} · {ARC_META[r.arc].en} · {r.n} turns ·{" "}
                  {r.passed ? "passed" : "unpassed"}
                </title>
              </circle>
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
        {(Object.keys(ARC_META) as ArcType[]).map((a) => (
          <span key={a} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: ARC_META[a].hex }}
            />
            {ARC_META[a].en}
          </span>
        ))}
        <span className="ml-3 inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-success bg-transparent" />
          passed
        </span>
      </div>
      <p className="mt-3 text-[10px] italic text-text-secondary">
        Caption: Principal component projection of 5-dimensional question-type proportion vectors.
        Clustering in PCA space roughly aligns with rule-based arc labels, supporting convergent
        validity.
      </p>
    </section>
  );
}

function Figure2StackedPerArc({ data }: { data: Response }) {
  const arcs = Object.keys(ARC_META) as ArcType[];
  const totalN = arcs.reduce((a, k) => a + data.arcSummary[k].n, 0);
  return (
    <section className="mb-8 rounded-xl border border-border-soft bg-surface p-5">
      <div className="mb-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
          Figure 2
        </div>
        <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary">
          Arc Distribution & Pass Rate
        </h2>
      </div>
      <div className="space-y-3">
        {arcs.map((arc) => {
          const s = data.arcSummary[arc];
          const share = totalN === 0 ? 0 : s.n / totalN;
          const passRate = s.n === 0 ? 0 : s.passed / s.n;
          return (
            <div key={arc} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span>
                  <span
                    className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ backgroundColor: ARC_META[arc].hex }}
                  />
                  <span className="font-medium text-text-primary">{ARC_META[arc].en}</span>
                  <span className="ml-1 text-text-secondary">({ARC_META[arc].ko})</span>
                </span>
                <span className="font-mono text-text-secondary">
                  n={s.n} · pass {s.passed}/{s.n === 0 ? 0 : s.n}
                </span>
              </div>
              <div className="flex h-4 w-full overflow-hidden rounded-full bg-border-soft">
                <div
                  style={{
                    width: `${share * 100}%`,
                    backgroundColor: ARC_META[arc].hex,
                    opacity: 0.35,
                  }}
                  title={`share ${(share * 100).toFixed(0)}%`}
                />
                <div
                  style={{
                    width: `${passRate * share * 100}%`,
                    backgroundColor: ARC_META[arc].hex,
                  }}
                  title={`pass ${(passRate * 100).toFixed(0)}%`}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[10px] italic text-text-secondary">
        Caption: Proportional share of each arc in the sample (light band) with the successful
        sub-portion (saturated overlay). Productive and solo-confident arcs show the highest pass
        rates.
      </p>
    </section>
  );
}
