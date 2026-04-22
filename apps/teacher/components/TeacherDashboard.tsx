"use client";

import { useEffect, useState } from "react";

import type { AppUser } from "@cvibe/db";

import { InterventionActions } from "@/components/InterventionActions";

import { LiveEvents } from "@/components/LiveEvents";
import { ModeDonut } from "@/components/ModeDonut";

interface HealthCard {
  id: string;
  displayName: string;
  status: "flow" | "watch" | "critical";
  reasons: string[];
  avgMastery: number;
  latestDependency: number;
  frustration: number;
  stuckLoop: { term: string | null; repeat: number } | null;
  utteranceCount: number;
  submissionCount: number;
  passRate: number;
  minutesSinceActivity: number | null;
}

interface ClassroomSummary {
  cohortId: string;
  studentCount: number;
  completionRate: number;
  avgMasteryByKC: Record<string, number>;
  weakKCs: string[];
  heatmap: Array<{ studentId: string; displayName: string; mastery: Record<string, number> }>;
}

interface Misconception {
  kc: string;
  pattern: string;
  affectedStudentCount: number;
  totalOccurrences: number;
}

interface OverviewResponse {
  cohortId: string;
  source: "supabase" | "demo";
  cards: HealthCard[];
  atRisk: HealthCard[];
  statusCounts: { flow: number; watch: number; critical: number };
  summary: ClassroomSummary;
  misconceptions: Misconception[];
  generatedAt: string;
}

export function TeacherDashboard({ user }: { user: AppUser }) {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch("/api/overview", { cache: "no-store" });
      setData((await res.json()) as OverviewResponse);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, []);

  if (loading && !data) {
    return <main className="p-12 text-sm text-neutral">대시보드 로딩 중…</main>;
  }
  if (!data) return <main className="p-12 text-sm text-error">데이터를 불러올 수 없어요.</main>;

  const kcs = Object.keys(data.summary.avgMasteryByKC);

  return (
    <main className="mx-auto max-w-[1280px] px-8 py-8">
      <header className="mb-8 flex items-end justify-between gap-4 border-b border-border-soft pb-5">
        <div>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral">
            Teacher Dashboard
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tighter text-text-primary">
            Classroom Overview
          </h1>
          <p className="mt-1 text-[12px] text-text-secondary">
            {user.displayName} · {user.email}
          </p>
        </div>
        <div className="text-right text-[12px] text-text-secondary">
          <div>
            <span className="text-neutral">cohort · </span>
            <span className="font-mono text-text-primary">{data.cohortId}</span>
            <span className="ml-2 text-neutral">source · </span>
            <span
              className={`font-mono ${
                data.source === "supabase" ? "text-primary" : "text-warning"
              }`}
            >
              {data.source}
            </span>
          </div>
          <div className="mt-1">
            <span className="text-neutral">{data.summary.studentCount} students · </span>
            <span className="font-medium text-text-primary">
              {(data.summary.completionRate * 100).toFixed(0)}%
            </span>
            <span className="text-neutral"> completion</span>
          </div>
        </div>
      </header>

      {/* Status Strip */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatusTile
          color="success"
          emoji="🟢"
          label="흐름"
          count={data.statusCounts.flow}
          total={data.cards.length}
        />
        <StatusTile
          color="warning"
          emoji="🟡"
          label="주의"
          count={data.statusCounts.watch}
          total={data.cards.length}
        />
        <StatusTile
          color="error"
          emoji="🔴"
          label="개입"
          count={data.statusCounts.critical}
          total={data.cards.length}
        />
      </div>

      {/* At-Risk Strip */}
      {data.atRisk.length > 0 && (
        <section className="mb-8 overflow-hidden rounded-xl border border-border-soft bg-surface">
          <div className="border-b border-border-soft px-5 py-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
              At-Risk · Top {data.atRisk.length}
            </div>
            <h2 className="mt-0.5 font-display text-lg font-semibold tracking-tight text-text-primary">
              지금 주목이 필요한 학생
            </h2>
          </div>
          <ul className="divide-y divide-border-soft">
            {data.atRisk.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 px-5 py-3 text-[13px]"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <StatusDot status={c.status} />
                  <a
                    href={`/student/${c.id}`}
                    className="font-medium text-text-primary transition-colors hover:text-primary"
                  >
                    {c.displayName}
                  </a>
                  <span className="truncate text-text-secondary">
                    {c.reasons.slice(0, 2).join(" · ")}
                  </span>
                </div>
                <InterventionActions studentId={c.id} displayName={c.displayName} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Health Cards Grid */}
      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
              Health Cards
            </div>
            <h2 className="mt-0.5 font-display text-xl font-semibold tracking-tighter text-text-primary">
              학생 전체
            </h2>
          </div>
          <div className="text-[11px] text-neutral">
            클릭 시 개별 학생 상세로 이동 · 20초 자동 갱신
          </div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
          {data.cards.map((c) => (
            <StudentCard key={c.id} card={c} />
          ))}
        </div>
      </section>

      {/* Heatmap 기존 유지 — 상세 KC 정보는 여전히 필요 */}
      <section className="mb-8 overflow-hidden rounded-xl border border-border-soft bg-surface">
        <div className="border-b border-border-soft px-5 py-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Classroom Heatmap
          </div>
          <h2 className="mt-0.5 font-display text-lg font-semibold tracking-tight text-text-primary">
            KC별 평균 숙련도
          </h2>
        </div>
        <div className="overflow-auto px-5 py-3">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border-soft text-left text-[10px] uppercase tracking-wider text-neutral">
                <th className="sticky left-0 bg-surface py-2 pr-4 font-medium">Student</th>
                {kcs.map((kc) => (
                  <th key={kc} className="whitespace-nowrap py-2 pr-3 font-medium">
                    {kc}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.summary.heatmap.map((row) => (
                <tr key={row.studentId} className="border-b border-border-soft last:border-0">
                  <td className="sticky left-0 bg-surface py-2 pr-4 font-medium text-text-primary">
                    <a
                      href={`/student/${row.studentId}`}
                      className="transition-colors hover:text-primary"
                    >
                      {row.displayName}
                    </a>
                  </td>
                  {kcs.map((kc) => {
                    const v = row.mastery[kc] ?? 0;
                    return (
                      <td key={kc} className="py-2 pr-3">
                        <div
                          className="flex h-6 w-14 items-center justify-center rounded-md text-[10px] font-medium text-white"
                          style={{ background: heatColor(v) }}
                          title={`${kc}: ${v.toFixed(2)}`}
                        >
                          {v.toFixed(2)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-border-soft bg-bg text-[10px] uppercase tracking-wider text-neutral">
                <td className="sticky left-0 bg-bg py-2 pr-4 font-medium">Average</td>
                {kcs.map((kc) => (
                  <td key={kc} className="py-2 pr-3 font-mono text-[11px] text-text-primary">
                    {data.summary.avgMasteryByKC[kc]?.toFixed(2)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          {data.summary.weakKCs.length > 0 && (
            <div className="mt-3 rounded-md border border-error/20 bg-error/5 p-3 text-[12px] text-error">
              <span className="font-medium uppercase tracking-wider">Weak KC · </span>
              {data.summary.weakKCs.join(", ")}
            </div>
          )}
        </div>
      </section>

      {/* Live Events + ModeDonut */}
      <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <LiveEvents />
        <ModeDonut />
      </div>

      {data.misconceptions.length > 0 && (
        <section className="mb-6 overflow-hidden rounded-xl border border-border-soft bg-surface">
          <div className="border-b border-border-soft px-5 py-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
              Student Modeler
            </div>
            <h2 className="mt-0.5 font-display text-lg font-semibold tracking-tight text-text-primary">
              Common Misconceptions
            </h2>
          </div>
          <ul className="divide-y divide-border-soft">
            {data.misconceptions.slice(0, 5).map((m, i) => (
              <li
                key={i}
                className="flex items-center justify-between px-5 py-3 text-[13px]"
              >
                <div>
                  <span className="font-mono text-text-primary">{m.kc}</span>
                  <span className="ml-2 text-text-secondary">{m.pattern}</span>
                </div>
                <span className="text-[11px] text-neutral">
                  {m.affectedStudentCount} students · {m.totalOccurrences}×
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="text-right text-[11px] text-neutral">
        generated {new Date(data.generatedAt).toLocaleTimeString("ko-KR")}
      </div>
    </main>
  );
}

function StatusTile({
  color,
  emoji,
  label,
  count,
  total,
}: {
  color: "success" | "warning" | "error";
  emoji: string;
  label: string;
  count: number;
  total: number;
}) {
  const rate = total > 0 ? (count / total) * 100 : 0;
  return (
    <div
      className={`rounded-xl border bg-surface p-4 ${
        color === "success"
          ? "border-success/20"
          : color === "warning"
            ? "border-warning/30"
            : "border-error/30"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-neutral">
          {emoji} {label}
        </div>
        <div
          className={`font-mono text-[10px] ${
            color === "success"
              ? "text-success"
              : color === "warning"
                ? "text-warning"
                : "text-error"
          }`}
        >
          {rate.toFixed(0)}%
        </div>
      </div>
      <div className="mt-1 font-display text-3xl font-semibold tracking-tighter text-text-primary">
        {count}
        <span className="ml-1 text-[14px] font-normal text-neutral">/{total}</span>
      </div>
    </div>
  );
}

function StudentCard({ card }: { card: HealthCard }) {
  const border =
    card.status === "critical"
      ? "border-error/40 hover:border-error"
      : card.status === "watch"
        ? "border-warning/40 hover:border-warning"
        : "border-border-soft hover:border-primary";

  return (
    <a
      href={`/student/${card.id}`}
      className={`group block rounded-xl border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:shadow-card ${border}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <StatusDot status={card.status} />
            <span className="truncate font-medium text-text-primary group-hover:text-primary">
              {card.displayName}
            </span>
          </div>
        </div>
        <span className="shrink-0 font-mono text-[10px] text-neutral">
          {card.submissionCount}회
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-[10px]">
        <Metric label="숙련" value={card.avgMastery} />
        <Metric label="통과" value={card.passRate} />
        {card.frustration > 0 && (
          <Metric
            label="감정"
            value={card.frustration}
            tint={card.frustration >= 0.3 ? "error" : "warning"}
            invert
          />
        )}
      </div>

      {card.reasons.length > 0 && (
        <ul className="mt-3 space-y-0.5 text-[11px] leading-snug text-text-secondary">
          {card.reasons.slice(0, 2).map((r, i) => (
            <li key={i}>· {r}</li>
          ))}
          {card.reasons.length > 2 && (
            <li className="text-neutral">· 외 {card.reasons.length - 2}건</li>
          )}
        </ul>
      )}

      {card.reasons.length === 0 && card.minutesSinceActivity != null && (
        <div className="mt-3 text-[11px] text-neutral">
          {card.minutesSinceActivity}분 전 활동
        </div>
      )}
    </a>
  );
}

function Metric({
  label,
  value,
  tint,
  invert,
}: {
  label: string;
  value: number;
  tint?: "error" | "warning" | "primary";
  invert?: boolean;
}) {
  const pct = Math.round(value * 100);
  let color = "bg-bg text-text-secondary";
  if (tint === "error") color = "bg-error/10 text-error";
  else if (tint === "warning") color = "bg-warning/10 text-warning";
  else if (tint === "primary") color = "bg-primary/10 text-primary";
  else if (!invert && value >= 0.7) color = "bg-success/10 text-success";
  else if (!invert && value < 0.4) color = "bg-error/10 text-error";
  return (
    <span
      className={`inline-flex h-5 items-center rounded px-1.5 font-mono text-[10px] font-medium ${color}`}
    >
      {label} {pct}
    </span>
  );
}

function StatusDot({ status }: { status: "flow" | "watch" | "critical" }) {
  const color =
    status === "flow"
      ? "bg-success"
      : status === "watch"
        ? "bg-warning"
        : "bg-error";
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} />;
}

function heatColor(v: number): string {
  const hue = Math.round(v * 120);
  const light = 45 + (1 - v) * 10;
  const sat = 55;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}
