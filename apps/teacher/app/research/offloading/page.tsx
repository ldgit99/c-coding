"use client";

import { useEffect, useState } from "react";

interface TrajectoryPoint {
  timestamp: string;
  dependencyFactor: number;
}

interface StudentTrajectory {
  studentId: string;
  displayName: string;
  points: TrajectoryPoint[];
  trend: "rising" | "stable" | "falling";
}

interface OffloadingDatum {
  studentId: string;
  displayName: string;
  l4Frequency: number;
  transferAxisMean: number;
  quadrant:
    | "healthy_srl"
    | "assisted_learner"
    | "struggling_independent"
    | "gaming_danger";
}

interface LinguisticProfile {
  totalUtterances: number;
  avgLength: number;
  whQuestionRate: number;
  imperativeRate: number;
  codeFirstRate: number;
  metacognitiveRate: number;
  offloadingScore: number;
}

interface LinguisticEntry {
  studentId: string;
  displayName: string;
  profile: LinguisticProfile;
}

interface OffloadingResponse {
  generatedAt: string;
  trajectories: StudentTrajectory[];
  quadrants: OffloadingDatum[];
  linguisticProfiles: LinguisticEntry[];
}

const QUADRANT_LABEL: Record<
  OffloadingDatum["quadrant"],
  { label: string; color: string; note: string }
> = {
  healthy_srl: {
    label: "Healthy SRL",
    color: "bg-success/20 text-success",
    note: "낮은 L4, 높은 transfer",
  },
  assisted_learner: {
    label: "Assisted Learner",
    color: "bg-primary/20 text-primary",
    note: "높은 L4지만 이해·전이 지표 양호",
  },
  struggling_independent: {
    label: "Struggling Indep.",
    color: "bg-warning/20 text-warning",
    note: "AI 도움 적지만 성과 미흡",
  },
  gaming_danger: {
    label: "Gaming Danger",
    color: "bg-error/20 text-error",
    note: "AI 남용 + 낮은 전이 (주의 개입)",
  },
};

export default function OffloadingPage() {
  const [data, setData] = useState<OffloadingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/research/offloading");
        if (!res.ok) {
          setErr(`HTTP ${res.status}`);
          return;
        }
        setData((await res.json()) as OffloadingResponse);
      } catch (e) {
        setErr(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <main className="p-12 text-sm text-neutral">분석 중…</main>;
  if (err || !data) return <main className="p-12 text-sm text-error">오류: {err}</main>;

  return (
    <main className="mx-auto max-w-[1280px] px-6 py-10">
      <nav className="mb-6 flex items-center gap-3 text-[11px] uppercase tracking-wider">
        <a href="/research" className="text-neutral transition-colors hover:text-primary">
          ← Research Lab
        </a>
        <span className="text-neutral">/</span>
        <span className="text-text-primary">Paper 3 · Offloading Detector</span>
      </nav>

      <header className="mb-10 border-b border-border-soft pb-6">
        <div className="text-[10px] font-medium uppercase tracking-wider text-primary">
          Paper 3
        </div>
        <h1 className="mt-0.5 font-display text-4xl font-semibold tracking-tighter text-text-primary">
          Cognitive Offloading Detector
        </h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-text-secondary">
          Gerlich (2025) cognitive offloading 프레임워크 기반 Mixed-methods
          분석. 행동 지표(L4 빈도 · dependency factor)와 언어 특징(WH-question ·
          imperative · code-first)을 결합해 학습자 유형을 분류합니다.
        </p>
        <div className="mt-3 font-mono text-[11px] text-neutral">
          Generated {new Date(data.generatedAt).toLocaleString("ko-KR")} ·
          {" "}{data.quadrants.length} students ·{" "}
          {sumUtterances(data.linguisticProfiles)} utterances
        </div>
      </header>

      {/* Fig 1 — Dependency Trajectory */}
      <FigureFrame
        fig="Fig 1"
        title="Dependency Factor Trajectory"
        variable="dep_t = dependency_factor at submission t"
        formula="rising/stable/falling by split-half mean comparison (Δ>0.08)"
      >
        {data.trajectories.length === 0 ? (
          <p className="text-[13px] text-neutral">의존도 이력 데이터가 없어요.</p>
        ) : (
          <ul className="space-y-3">
            {data.trajectories.map((t) => (
              <li
                key={t.studentId}
                className="rounded-lg border border-border-soft bg-bg px-4 py-3"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[13px] font-medium text-text-primary">
                    {t.displayName}
                  </span>
                  <TrendBadge trend={t.trend} />
                </div>
                <TrajectorySparkline points={t.points} />
                <div className="mt-1 font-mono text-[10px] text-neutral">
                  N={t.points.length} · last{" "}
                  {t.points.at(-1)?.dependencyFactor.toFixed(2) ?? "—"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </FigureFrame>

      {/* Fig 2 — Quadrant Scatter */}
      <FigureFrame
        fig="Fig 2"
        title="Gaming vs Struggling Scatter"
        variable="x = L4_freq ∈ [0,1],  y = transfer_axis_mean ∈ [0,1]"
        formula="quadrant = (x≥0.5, y≥0.5) ↦ {healthy_srl, assisted_learner, struggling_independent, gaming_danger}"
      >
        <QuadrantPlot data={data.quadrants} />
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {(
            Object.keys(QUADRANT_LABEL) as Array<OffloadingDatum["quadrant"]>
          ).map((k) => {
            const count = data.quadrants.filter((d) => d.quadrant === k).length;
            return (
              <div
                key={k}
                className="rounded-lg border border-border-soft bg-bg p-3"
              >
                <div
                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${QUADRANT_LABEL[k].color}`}
                >
                  {QUADRANT_LABEL[k].label}
                </div>
                <div className="mt-2 font-display text-2xl font-semibold tracking-tighter text-text-primary">
                  {count}
                </div>
                <div className="mt-1 text-[11px] leading-relaxed text-text-secondary">
                  {QUADRANT_LABEL[k].note}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-6 overflow-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border-soft text-left text-[10px] uppercase tracking-wider text-neutral">
                <th className="py-2 pr-4 font-medium">student</th>
                <th className="py-2 pr-4 font-medium">L4 freq</th>
                <th className="py-2 pr-4 font-medium">transfer mean</th>
                <th className="py-2 font-medium">quadrant</th>
              </tr>
            </thead>
            <tbody>
              {data.quadrants.map((q) => (
                <tr
                  key={q.studentId}
                  className="border-b border-border-soft last:border-0"
                >
                  <td className="py-2 pr-4 text-text-primary">{q.displayName}</td>
                  <td className="py-2 pr-4 font-mono text-text-secondary">
                    {q.l4Frequency.toFixed(2)}
                  </td>
                  <td className="py-2 pr-4 font-mono text-text-secondary">
                    {q.transferAxisMean.toFixed(2)}
                  </td>
                  <td className="py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${QUADRANT_LABEL[q.quadrant].color}`}
                    >
                      {QUADRANT_LABEL[q.quadrant].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FigureFrame>

      {/* Fig 3 — Linguistic Profile */}
      <FigureFrame
        fig="Fig 3"
        title="Korean Utterance Linguistic Profile"
        variable="rate_x(student) = |utt where has(x)| / |utt|"
        formula="offloading_score = 0.4·imp + 0.5·codef − 0.3·wh − 0.3·metacog + 0.3 (clamped 0~1)"
      >
        {data.linguisticProfiles.length === 0 ? (
          <p className="text-[13px] text-neutral">
            학생 발화가 아직 없어요. 채팅이 쌓이면 자동으로 나타납니다.
          </p>
        ) : (
          <ul className="space-y-3">
            {data.linguisticProfiles.map((p) => (
              <li
                key={p.studentId}
                className="rounded-lg border border-border-soft bg-bg p-4"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-medium text-text-primary">
                    {p.displayName}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${offloadingBadge(p.profile.offloadingScore)}`}
                  >
                    offloading {p.profile.offloadingScore.toFixed(2)}
                  </span>
                </div>
                <div className="mt-1 font-mono text-[10px] text-neutral">
                  N = {p.profile.totalUtterances} · avg {p.profile.avgLength}자
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  <FeatureBar
                    label="wh"
                    value={p.profile.whQuestionRate}
                    color="bg-success"
                  />
                  <FeatureBar
                    label="metacog"
                    value={p.profile.metacognitiveRate}
                    color="bg-primary"
                  />
                  <FeatureBar
                    label="imp"
                    value={p.profile.imperativeRate}
                    color="bg-warning"
                  />
                  <FeatureBar
                    label="code-first"
                    value={p.profile.codeFirstRate}
                    color="bg-error"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </FigureFrame>

      <section className="rounded-xl border border-border-soft bg-bg p-6 text-[13px] leading-relaxed text-text-secondary">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
          IRB Note
        </div>
        <h3 className="mt-1 font-display text-xl font-semibold tracking-tighter text-text-primary">
          연구 사용 시 주의
        </h3>
        <p className="mt-2">
          Linguistic profile은 학생 발화 원문을 서버에서 처리하지만 rate 값만 보여
          줍니다. 발화 원문 자체를 논문 부록에 싣고 싶다면 IRB에 원문 인용 조항을
          포함해야 합니다. 3-axis self-explanation 자동 채점은 inter-rater
          reliability(Cohen&apos;s κ) 검증 전 <em>supplementary</em>로만 사용하세요.
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

function TrendBadge({ trend }: { trend: StudentTrajectory["trend"] }) {
  const map = {
    rising: { label: "↑ rising", color: "text-error" },
    falling: { label: "↓ falling", color: "text-success" },
    stable: { label: "→ stable", color: "text-neutral" },
  } as const;
  const v = map[trend];
  return (
    <span className={`font-mono text-[11px] uppercase tracking-wider ${v.color}`}>
      {v.label}
    </span>
  );
}

function TrajectorySparkline({ points }: { points: TrajectoryPoint[] }) {
  if (points.length === 0) return null;
  const W = 480;
  const H = 40;
  const max = Math.max(...points.map((p) => p.dependencyFactor), 0.01);
  const step = points.length === 1 ? W : W / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${(H - (p.dependencyFactor / max) * (H - 4) - 2).toFixed(1)}`)
    .join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="mt-2">
      <path d={d} fill="none" stroke="#6366F1" strokeWidth="1.6" />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={(i * step).toFixed(1)}
          cy={(H - (p.dependencyFactor / max) * (H - 4) - 2).toFixed(1)}
          r={2}
          fill="#6366F1"
        />
      ))}
    </svg>
  );
}

function QuadrantPlot({ data }: { data: OffloadingDatum[] }) {
  const W = 520;
  const H = 320;
  const pad = 36;
  const px = (x: number) => pad + x * (W - pad * 2);
  const py = (y: number) => H - pad - y * (H - pad * 2);
  const color: Record<OffloadingDatum["quadrant"], string> = {
    healthy_srl: "#10B981",
    assisted_learner: "#6366F1",
    struggling_independent: "#F59E0B",
    gaming_danger: "#EF4444",
  };
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      className="rounded-lg border border-border-soft bg-bg"
    >
      {/* quadrant dividers */}
      <line
        x1={px(0.5)}
        x2={px(0.5)}
        y1={pad}
        y2={H - pad}
        stroke="#E8E8EC"
        strokeDasharray="3,3"
      />
      <line
        x1={pad}
        x2={W - pad}
        y1={py(0.5)}
        y2={py(0.5)}
        stroke="#E8E8EC"
        strokeDasharray="3,3"
      />
      {/* axes */}
      <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke="#6B6B6B" />
      <line x1={pad} x2={pad} y1={pad} y2={H - pad} stroke="#6B6B6B" />
      <text x={W / 2} y={H - 8} fontSize="10" fill="#6B6B6B" textAnchor="middle">
        L4 frequency
      </text>
      <text
        x={10}
        y={H / 2}
        fontSize="10"
        fill="#6B6B6B"
        textAnchor="middle"
        transform={`rotate(-90 10 ${H / 2})`}
      >
        transfer axis mean
      </text>
      {/* quadrant labels */}
      <text x={px(0.25)} y={py(0.85)} fontSize="9" fill="#10B981" textAnchor="middle">
        healthy_srl
      </text>
      <text x={px(0.75)} y={py(0.85)} fontSize="9" fill="#6366F1" textAnchor="middle">
        assisted
      </text>
      <text x={px(0.25)} y={py(0.12)} fontSize="9" fill="#F59E0B" textAnchor="middle">
        struggling
      </text>
      <text x={px(0.75)} y={py(0.12)} fontSize="9" fill="#EF4444" textAnchor="middle">
        gaming
      </text>
      {data.map((d) => (
        <g key={d.studentId}>
          <circle
            cx={px(Math.min(1, d.l4Frequency))}
            cy={py(Math.min(1, Math.max(0, d.transferAxisMean)))}
            r={6}
            fill={color[d.quadrant]}
            fillOpacity={0.4}
            stroke={color[d.quadrant]}
            strokeWidth="1.3"
          />
          <title>
            {d.displayName} · L4={d.l4Frequency.toFixed(2)}, transfer={d.transferAxisMean.toFixed(2)}
          </title>
        </g>
      ))}
    </svg>
  );
}

function FeatureBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-neutral">
        <span>{label}</span>
        <span className="font-mono text-text-primary">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border-soft">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

function offloadingBadge(score: number): string {
  if (score < 0.3) return "bg-success/20 text-success";
  if (score < 0.55) return "bg-primary/20 text-primary";
  if (score < 0.75) return "bg-warning/20 text-warning";
  return "bg-error/20 text-error";
}

function sumUtterances(profiles: LinguisticEntry[]): number {
  return profiles.reduce((a, p) => a + p.profile.totalUtterances, 0);
}
