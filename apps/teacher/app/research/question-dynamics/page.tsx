"use client";

import { useEffect, useState } from "react";

import { CsvExportButton, ReproFooter, SampleBadge } from "@/components/research/SampleBadge";

type QuestionType = "concept" | "debug" | "answer_request" | "metacognitive" | "other";

interface Response {
  source: string;
  sample: {
    students: number;
    utterances: number;
    eventsSeen: number;
    passedMarked: number;
  };
  types: QuestionType[];
  transitionMatrix: number[][];
  transitionCounts: number[][];
  entropyPerStudent: Array<{
    studentIdHashed: string;
    n: number;
    entropyBits: number;
    dominantType: QuestionType | null;
  }>;
  contingency: number[][];
  cramerV: { v: number; chiSquare: number; df: number };
  timeBins: {
    binMs: number;
    binCount: number;
    totalPerBin: number[];
    typeRateSeries: Array<{ type: QuestionType; rates: number[] }>;
  };
  generatedAt: string;
}

const TYPE_LABEL: Record<QuestionType, { ko: string; hex: string; short: string }> = {
  concept: { ko: "개념", hex: "#6366F1", short: "Concept" },
  debug: { ko: "디버깅", hex: "#F59E0B", short: "Debug" },
  answer_request: { ko: "답 요청", hex: "#EF4444", short: "Answer" },
  metacognitive: { ko: "메타인지", hex: "#10B981", short: "Meta" },
  other: { ko: "기타", hex: "#94A3B8", short: "Other" },
};

export default function QuestionDynamicsPage() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/research/question-dynamics", { cache: "no-store" });
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
          Paper 3
        </div>
        <h1 className="mt-0.5 font-display text-3xl font-semibold tracking-tighter text-text-primary">
          Question Type Dynamics in ZPD-Calibrated Tutoring
        </h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-text-secondary">
          <strong>RQ</strong>: Do productive conversations follow a predictable type-sequence
          (concept → debug → metacognitive), and does sequence entropy predict passing outcome?
          Target venues: Learning and Instruction / ICER / Computers & Education.
        </p>
      </header>

      {loading && <div className="text-[13px] text-neutral">로딩 중…</div>}

      {data && (
        <>
          <div className="mb-6">
            <SampleBadge
              n={data.sample.students}
              label="students"
              missing={
                data.sample.students > 0
                  ? Math.max(0, 1 - data.sample.passedMarked / data.sample.students)
                  : undefined
              }
              note={`${data.sample.utterances} utterances · ${data.sample.passedMarked} with passed event`}
            />
          </div>

          {/* Figure 1 — Markov transition matrix */}
          <Figure1Markov data={data} />

          {/* Figure 2 — entropy distribution per student */}
          <Figure2Entropy data={data} />

          {/* Table 1 — dominant type × outcome contingency */}
          <Table1Contingency data={data} />

          {/* Figure 3 — time-series of type rates */}
          <Figure3TimeSeries data={data} />

          <ReproFooter snapshot={data.generatedAt} />
        </>
      )}
    </main>
  );
}

function Figure1Markov({ data }: { data: Response }) {
  const types = data.types;
  const rows = types.flatMap((from, i) =>
    types.map((to, j) => ({
      from: TYPE_LABEL[from].short,
      to: TYPE_LABEL[to].short,
      probability: Number(((data.transitionMatrix[i]?.[j] ?? 0) * 100).toFixed(1)),
      count: data.transitionCounts[i]?.[j] ?? 0,
    })),
  );
  return (
    <section className="mb-8 rounded-xl border border-border-soft bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Figure 1
          </div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary">
            Question Type Transition Matrix
          </h2>
          <p className="mt-0.5 text-[11px] text-text-secondary">
            Row-normalized (each row sums to 1). Cell value = P(to | from).
          </p>
        </div>
        <CsvExportButton filename="paper3_fig1_markov.csv" rows={rows} />
      </div>
      <div className="overflow-auto">
        <table className="text-[12px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-neutral">
              <th className="py-1 pr-3 font-medium">from \\ to</th>
              {types.map((t) => (
                <th key={t} className="px-2 py-1 text-center font-medium">
                  {TYPE_LABEL[t].short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {types.map((from, i) => (
              <tr key={from} className="border-t border-border-soft">
                <td className="py-1.5 pr-3 font-mono text-[11px] text-text-primary">
                  {TYPE_LABEL[from].short}
                </td>
                {types.map((to, j) => {
                  const p = data.transitionMatrix[i]?.[j] ?? 0;
                  const hex = TYPE_LABEL[to].hex;
                  const bg = `${hex}${alpha(p)}`;
                  const textColor = p >= 0.55 ? "white" : "#111827";
                  return (
                    <td key={to} className="px-1 py-1 text-center">
                      <div
                        className="mx-auto flex h-9 w-12 items-center justify-center rounded font-mono text-[11px] font-medium"
                        title={`${from}→${to}: P=${p.toFixed(2)} (n=${data.transitionCounts[i]?.[j] ?? 0})`}
                        style={{ backgroundColor: p === 0 ? "transparent" : bg, color: textColor }}
                      >
                        {p === 0 ? "·" : p.toFixed(2)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[10px] italic text-text-secondary">
        Caption: Transition probabilities between successive student utterance types, pooled across{" "}
        {data.sample.students} students and {data.sample.utterances} utterances. System-generated
        preset utterances excluded.
      </p>
    </section>
  );
}

function Figure2Entropy({ data }: { data: Response }) {
  const maxN = Math.max(1, ...data.entropyPerStudent.map((e) => e.n));
  const rows = data.entropyPerStudent.map((e) => ({
    studentId_hashed: e.studentIdHashed,
    utterances: e.n,
    entropy_bits: e.entropyBits,
    dominant_type: e.dominantType ?? "",
  }));
  return (
    <section className="mb-8 rounded-xl border border-border-soft bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Figure 2
          </div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary">
            Shannon Entropy of Question-Type Distribution (per student)
          </h2>
          <p className="mt-0.5 text-[11px] text-text-secondary">
            Higher entropy ≈ more balanced use of multiple question types. Range: 0 (monolithic) to{" "}
            log₂(5) ≈ 2.32 (uniform).
          </p>
        </div>
        <CsvExportButton filename="paper3_fig2_entropy.csv" rows={rows} />
      </div>
      <div className="space-y-1">
        {data.entropyPerStudent.map((e) => (
          <div key={e.studentIdHashed} className="flex items-center gap-2 text-[11px]">
            <span className="w-32 truncate font-mono text-text-secondary">
              {e.studentIdHashed.slice(0, 10)}…
            </span>
            <span className="w-8 text-right font-mono text-text-primary">{e.n}</span>
            <div className="flex h-3 flex-1 items-center gap-0">
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${(e.n / maxN) * 100}%`,
                  backgroundColor: e.dominantType ? TYPE_LABEL[e.dominantType].hex : "#94A3B8",
                  opacity: 0.35,
                }}
              />
            </div>
            <span className="w-14 text-right font-mono text-text-primary">
              {e.entropyBits.toFixed(2)}
            </span>
            <span
              className="w-20 rounded-sm px-1.5 text-center text-[10px] font-medium text-white"
              style={{
                backgroundColor: e.dominantType ? TYPE_LABEL[e.dominantType].hex : "#94A3B8",
              }}
            >
              {e.dominantType ? TYPE_LABEL[e.dominantType].short : "—"}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] italic text-text-secondary">
        Caption: Per-student Shannon entropy of question-type distribution. Bar length = total{" "}
        utterance count; color = dominant type. Higher entropy students use broader range of{" "}
        question forms.
      </p>
    </section>
  );
}

function Table1Contingency({ data }: { data: Response }) {
  const rows = data.types.map((t, i) => ({
    dominant_type: t,
    passed: data.contingency[i]?.[0] ?? 0,
    failed: data.contingency[i]?.[1] ?? 0,
    total: (data.contingency[i]?.[0] ?? 0) + (data.contingency[i]?.[1] ?? 0),
  }));
  const cv = data.cramerV;
  return (
    <section className="mb-8 rounded-xl border border-border-soft bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Table 1
          </div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary">
            Dominant Question Type × Submission Outcome
          </h2>
          <p className="mt-0.5 text-[11px] text-text-secondary">
            χ²({cv.df}) = {cv.chiSquare.toFixed(3)}, Cramér&apos;s V ={" "}
            <strong className="font-mono text-text-primary">{cv.v.toFixed(3)}</strong>{" "}
            ({interpretV(cv.v)})
          </p>
        </div>
        <CsvExportButton filename="paper3_table1_contingency.csv" rows={rows} />
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-border-soft text-left text-[10px] uppercase tracking-wider text-neutral">
            <th className="py-2 pr-4 font-medium">Dominant type</th>
            <th className="py-2 pr-4 text-right font-medium">Passed</th>
            <th className="py-2 pr-4 text-right font-medium">Failed</th>
            <th className="py-2 pr-4 text-right font-medium">Total</th>
            <th className="py-2 text-right font-medium">Pass rate</th>
          </tr>
        </thead>
        <tbody>
          {data.types.map((t, i) => {
            const passed = data.contingency[i]?.[0] ?? 0;
            const failed = data.contingency[i]?.[1] ?? 0;
            const total = passed + failed;
            const rate = total === 0 ? 0 : (passed / total) * 100;
            return (
              <tr key={t} className="border-b border-border-soft last:border-0">
                <td className="py-1.5 pr-4">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: TYPE_LABEL[t].hex }}
                  />
                  <span className="ml-2 font-mono text-text-primary">{TYPE_LABEL[t].short}</span>
                  <span className="ml-1 text-text-secondary">({TYPE_LABEL[t].ko})</span>
                </td>
                <td className="py-1.5 pr-4 text-right font-mono text-text-primary">{passed}</td>
                <td className="py-1.5 pr-4 text-right font-mono text-text-primary">{failed}</td>
                <td className="py-1.5 pr-4 text-right font-mono text-neutral">{total}</td>
                <td className="py-1.5 text-right font-mono text-text-primary">
                  {total === 0 ? "—" : `${rate.toFixed(0)}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-[10px] italic text-text-secondary">
        Caption: Contingency of students&apos; dominant question type versus whether they obtained
        at least one passed submission. Cramér&apos;s V = {cv.v.toFixed(3)}.
      </p>
    </section>
  );
}

function Figure3TimeSeries({ data }: { data: Response }) {
  const { binMs, binCount, totalPerBin, typeRateSeries } = data.timeBins;
  const binMinutes = binMs / 60000;
  const rows = typeRateSeries.flatMap((s) =>
    s.rates.map((r, i) => ({
      type: s.type,
      bin_start_min: i * binMinutes,
      bin_end_min: (i + 1) * binMinutes,
      rate: Number(r.toFixed(3)),
      bin_total: totalPerBin[i] ?? 0,
    })),
  );
  const W = 640;
  const H = 240;
  const PAD = { l: 40, r: 12, t: 12, b: 30 };
  const w = W - PAD.l - PAD.r;
  const h = H - PAD.t - PAD.b;
  return (
    <section className="mb-8 rounded-xl border border-border-soft bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Figure 3
          </div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary">
            Type-rate trajectories from session start
          </h2>
          <p className="mt-0.5 text-[11px] text-text-secondary">
            Proportion of each question type per {binMinutes}-minute bin, 0–{binCount * binMinutes}{" "}
            min after first utterance.
          </p>
        </div>
        <CsvExportButton filename="paper3_fig3_timeseries.csv" rows={rows} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[720px]">
        {/* axes */}
        <line x1={PAD.l} y1={PAD.t + h} x2={PAD.l + w} y2={PAD.t + h} stroke="#E5E7EB" />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + h} stroke="#E5E7EB" />
        {/* axis ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <g key={p}>
            <line
              x1={PAD.l}
              x2={PAD.l + w}
              y1={PAD.t + h * (1 - p)}
              y2={PAD.t + h * (1 - p)}
              stroke="#F1F5F9"
            />
            <text x={PAD.l - 6} y={PAD.t + h * (1 - p) + 4} fontSize="10" textAnchor="end" fill="#94A3B8">
              {(p * 100).toFixed(0)}%
            </text>
          </g>
        ))}
        {Array.from({ length: binCount }, (_, i) => (
          <text
            key={i}
            x={PAD.l + (w / (binCount - 1)) * i}
            y={PAD.t + h + 14}
            fontSize="10"
            textAnchor="middle"
            fill="#94A3B8"
          >
            {i * binMinutes}m
          </text>
        ))}
        {/* lines */}
        {typeRateSeries.map((series) => {
          const pts = series.rates
            .map((r, i) => {
              const x = PAD.l + (w / Math.max(1, binCount - 1)) * i;
              const y = PAD.t + h * (1 - r);
              return `${x},${y}`;
            })
            .join(" ");
          return (
            <g key={series.type}>
              <polyline
                fill="none"
                stroke={TYPE_LABEL[series.type].hex}
                strokeWidth="2"
                points={pts}
              />
              {series.rates.map((r, i) => (
                <circle
                  key={i}
                  cx={PAD.l + (w / Math.max(1, binCount - 1)) * i}
                  cy={PAD.t + h * (1 - r)}
                  r="3"
                  fill={TYPE_LABEL[series.type].hex}
                />
              ))}
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
        {typeRateSeries.map((s) => (
          <span key={s.type} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: TYPE_LABEL[s.type].hex }}
            />
            {TYPE_LABEL[s.type].short}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[10px] italic text-text-secondary">
        Caption: Temporal evolution of question-type rates, aggregated across students. Healthy
        trajectory typically shifts from concept-heavy early bins to debug-then-metacognitive later
        bins.
      </p>
    </section>
  );
}

function alpha(intensity: number): string {
  const a = Math.min(255, Math.max(32, Math.round(intensity * 255)));
  return a.toString(16).padStart(2, "0");
}

function interpretV(v: number): string {
  if (v >= 0.5) return "strong association";
  if (v >= 0.3) return "moderate association";
  if (v >= 0.1) return "weak association";
  return "negligible";
}
