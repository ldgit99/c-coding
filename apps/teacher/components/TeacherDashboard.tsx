"use client";

import { useEffect, useState } from "react";

import type { AppUser } from "@cvibe/db";

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

interface ActionCard {
  icon: string;
  title: string;
  observation: string;
  cta: { label: string; href: string };
  priority: number;
}

interface AssignmentProgress {
  code: string;
  title: string;
  difficulty: number;
  studentsPassed: number;
  studentsStarted: number;
  totalStudents: number;
  passRate: number;
  avgAttempts: number;
}

interface TrendSparks {
  passRateByDay: number[];
  dependencyByDay: number[];
  frustrationCountByDay: number[];
  submissionsByDay: number[];
  today: {
    passRate: number;
    meanDependency: number;
    frustrationCount: number;
    submissions: number;
  };
  yesterday: { passRate: number; submissions: number };
}

interface InterpretedEvent {
  at: string;
  icon: string;
  text: string;
  severity: "ok" | "warn" | "critical" | "info";
  studentId?: string;
}

interface OverviewResponse {
  cohortId: string;
  source: "supabase" | "demo";
  cards: HealthCard[];
  atRisk: HealthCard[];
  statusCounts: { flow: number; watch: number; critical: number };
  summary: ClassroomSummary;
  misconceptions: Misconception[];
  today: {
    submissions: number;
    submissionsDelta: number;
    activeStudents: number;
    totalStudents: number;
    recentNotable: Array<{
      at: string;
      kind: string;
      text: string;
      displayName: string;
    }>;
  };
  actionCards: ActionCard[];
  assignmentProgress: AssignmentProgress[];
  trendSparks: TrendSparks;
  kcInsights: string[];
  interpretedEvents: InterpretedEvent[];
  generatedAt: string;
}

export function TeacherDashboard({ user }: { user: AppUser }) {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthCardsOpen, setHealthCardsOpen] = useState(false);

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
    <main className="mx-auto max-w-[1280px] px-8 py-6">
      {/* 1. Today at a glance — 스티키 헤더 */}
      <TodayGlance data={data} user={user} />

      {/* 2. Action Cards × 3 */}
      <ActionCardsGrid cards={data.actionCards} critical={data.statusCounts.critical} />

      {/* 3. Assignment Progress Strip */}
      <AssignmentProgressSection rows={data.assignmentProgress} />

      {/* 4. Health Cards Grid (접기) */}
      <HealthCardsCollapsible
        cards={data.cards}
        isOpen={healthCardsOpen}
        toggle={() => setHealthCardsOpen((v) => !v)}
        statusCounts={data.statusCounts}
      />

      {/* 5. Live Events + ModeDonut — compact side-by-side */}
      <section className="mb-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <InterpretedLiveEvents events={data.interpretedEvents} fallback={<LiveEvents />} />
        <ModeDonut />
      </section>

      {/* 6. Trend Sparks × 3 */}
      <TrendSparksSection sparks={data.trendSparks} />

      {/* 7. KC Insight + Heatmap */}
      <KCInsightSection
        insights={data.kcInsights}
        heatmap={data.summary.heatmap}
        avgByKC={data.summary.avgMasteryByKC}
        kcs={kcs}
        weakKCs={data.summary.weakKCs}
      />

      {/* 8. Common Misconceptions (footer) */}
      {data.misconceptions.length > 0 && (
        <section className="mb-6 overflow-hidden rounded-xl border border-border-soft bg-surface">
          <div className="border-b border-border-soft px-5 py-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
              Common Misconceptions
            </div>
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
                  {m.affectedStudentCount}명 · {m.totalOccurrences}회
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

function TodayGlance({ data, user }: { data: OverviewResponse; user: AppUser }) {
  const t = data.today;
  const deltaSign = t.submissionsDelta > 0 ? "▲" : t.submissionsDelta < 0 ? "▼" : "—";
  const deltaColor =
    t.submissionsDelta > 0
      ? "text-success"
      : t.submissionsDelta < 0
        ? "text-warning"
        : "text-neutral";
  return (
    <header className="sticky top-0 z-10 -mx-8 mb-5 border-b border-border-soft bg-bg/90 px-8 py-4 backdrop-blur">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="font-display text-2xl font-semibold tracking-tighter text-text-primary">
              Today at a glance
            </h1>
            <span className="text-[11px] text-text-secondary">
              {user.displayName} · cohort{" "}
              <span className="font-mono">{data.cohortId.slice(0, 8)}…</span>
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-text-secondary">
            <span>
              <span className="text-neutral">활동 학생 </span>
              <span className="font-mono text-text-primary">
                {t.activeStudents}/{t.totalStudents}
              </span>
            </span>
            <span>
              <span className="text-neutral">오늘 제출 </span>
              <span className="font-mono text-text-primary">{t.submissions}건</span>
              <span className={`ml-1 font-mono text-[11px] ${deltaColor}`}>
                {deltaSign}{" "}
                {Math.abs(t.submissionsDelta)} vs 어제
              </span>
            </span>
            <span>
              <StatusDot status="flow" /> {data.statusCounts.flow}
              <StatusDot status="watch" className="ml-2" /> {data.statusCounts.watch}
              <StatusDot status="critical" className="ml-2" />{" "}
              <span className={data.statusCounts.critical > 0 ? "text-error" : ""}>
                {data.statusCounts.critical}
              </span>
            </span>
          </div>
          {t.recentNotable.length > 0 && (
            <div className="mt-1 text-[11px] text-text-secondary">
              <span className="text-neutral">최근: </span>
              {t.recentNotable[0]!.displayName} {t.recentNotable[0]!.text} ·{" "}
              {formatRelative(t.recentNotable[0]!.at)}
            </div>
          )}
        </div>
        <a
          href="/queue"
          className="inline-flex items-center gap-1 rounded-md border border-error/30 bg-error/10 px-3 py-1.5 text-[12px] font-medium text-error transition-all hover:-translate-y-px hover:bg-error/20"
        >
          🚨 개입 큐 {data.statusCounts.critical > 0 ? `(${data.statusCounts.critical})` : ""} →
        </a>
      </div>
    </header>
  );
}

function ActionCardsGrid({
  cards,
  critical,
}: {
  cards: ActionCard[];
  critical: number;
}) {
  if (cards.length === 0) {
    return (
      <section className="mb-6 rounded-xl border border-success/20 bg-success/5 p-5 text-center">
        <div className="text-[13px] text-success">
          ✨ 현재 주목할 신호 없음 — 전원 안정적인 상태
          {critical > 0 && ` · 개입 큐에 ${critical}명 대기`}
        </div>
      </section>
    );
  }
  const colors = {
    "🚨": "border-error/30 bg-error/5 text-error",
    "💬": "border-primary/30 bg-primary/5 text-primary",
    "📝": "border-warning/30 bg-warning/5 text-warning",
  } as Record<string, string>;
  return (
    <section className="mb-6 grid gap-3 md:grid-cols-3">
      {cards.map((c, i) => {
        const chrome = colors[c.icon] ?? "border-border-soft bg-surface text-text-primary";
        return (
          <a
            key={i}
            href={c.cta.href}
            className={`rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-card ${chrome}`}
          >
            <div className="text-[10px] font-medium uppercase tracking-wider opacity-70">
              {c.icon} {c.title}
            </div>
            <div className="mt-1.5 text-[13px] leading-relaxed text-text-primary">
              {c.observation}
            </div>
            <div className="mt-3 text-[11px] font-medium uppercase tracking-wider opacity-80">
              {c.cta.label} →
            </div>
          </a>
        );
      })}
    </section>
  );
}

function AssignmentProgressSection({ rows }: { rows: AssignmentProgress[] }) {
  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-border-soft bg-surface">
      <div className="border-b border-border-soft px-5 py-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
          Assignment Progress
        </div>
        <h2 className="mt-0.5 font-display text-lg font-semibold tracking-tight text-text-primary">
          과제 진행률
        </h2>
      </div>
      <ul className="divide-y divide-border-soft">
        {rows.slice(0, 11).map((r) => {
          const passPct = Math.round(r.passRate * 100);
          const notStarted = r.studentsStarted === 0;
          const state = notStarted
            ? { label: "미시작", color: "text-neutral" }
            : r.passRate >= 0.9
              ? { label: "완료", color: "text-success" }
              : r.passRate >= 0.4
                ? { label: "진행 중", color: "text-primary" }
                : { label: "초반부", color: "text-warning" };
          return (
            <li key={r.code} className="px-5 py-2.5 text-[12px]">
              <div className="flex items-center gap-3">
                <div className="w-16 shrink-0 font-mono text-[11px] text-text-secondary">
                  {r.code.split("_")[0]}
                </div>
                <div className="min-w-0 flex-[1.5] truncate text-text-primary">{r.title}</div>
                <div className="relative h-2.5 flex-[3] overflow-hidden rounded-full bg-border-soft">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${passPct}%` }}
                  />
                </div>
                <div className="w-20 shrink-0 text-right font-mono text-[11px] text-text-primary">
                  {r.studentsPassed}/{r.totalStudents}
                </div>
                <div className="w-10 shrink-0 text-right font-mono text-[11px] text-text-secondary">
                  {passPct}%
                </div>
                <div className={`w-20 shrink-0 text-right text-[10px] ${state.color}`}>
                  {state.label}
                </div>
                <div className="w-16 shrink-0 text-right font-mono text-[10px] text-neutral">
                  {r.avgAttempts > 0 ? `${r.avgAttempts}회` : "—"}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function HealthCardsCollapsible({
  cards,
  isOpen,
  toggle,
  statusCounts,
}: {
  cards: HealthCard[];
  isOpen: boolean;
  toggle: () => void;
  statusCounts: OverviewResponse["statusCounts"];
}) {
  return (
    <section className="mb-6">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between rounded-xl border border-border-soft bg-surface px-5 py-3 text-left transition-colors hover:border-primary"
      >
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Health Cards
          </div>
          <div className="mt-0.5 font-display text-lg font-semibold tracking-tight text-text-primary">
            학생 전체 {cards.length}명
            <span className="ml-3 text-[11px] font-normal text-text-secondary">
              🟢 {statusCounts.flow} · 🟡 {statusCounts.watch} · 🔴 {statusCounts.critical}
            </span>
          </div>
        </div>
        <span className="text-[11px] text-neutral">{isOpen ? "접기 ▲" : "펼치기 ▼"}</span>
      </button>
      {isOpen && (
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
          {cards.map((c) => (
            <StudentCard key={c.id} card={c} />
          ))}
        </div>
      )}
    </section>
  );
}

function InterpretedLiveEvents({
  events,
  fallback,
}: {
  events: InterpretedEvent[];
  fallback: React.ReactNode;
}) {
  if (events.length === 0) {
    return <>{fallback}</>;
  }
  return (
    <section className="overflow-hidden rounded-xl border border-border-soft bg-surface">
      <div className="flex items-center justify-between border-b border-border-soft px-4 py-2.5">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Live · interpreted
          </div>
          <h3 className="font-display text-sm font-semibold text-text-primary">지난 5분</h3>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-success">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          live
        </span>
      </div>
      <ul className="max-h-[320px] divide-y divide-border-soft overflow-auto">
        {events.map((e, i) => (
          <li key={i} className="flex items-start gap-3 px-4 py-2 text-[12px]">
            <span className="shrink-0">{e.icon}</span>
            <span className="min-w-0 flex-1 text-text-primary">{e.text}</span>
            <span className="shrink-0 font-mono text-[10px] text-neutral">
              {formatRelative(e.at)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TrendSparksSection({ sparks }: { sparks: TrendSparks }) {
  return (
    <section className="mb-6 grid gap-3 sm:grid-cols-3">
      <SparkTile
        label="평균 통과율"
        values={sparks.passRateByDay}
        current={sparks.today.passRate}
        prev={sparks.yesterday.passRate}
        formatValue={(v) => `${Math.round(v * 100)}%`}
        invert={false}
      />
      <SparkTile
        label="평균 의존도"
        values={sparks.dependencyByDay}
        current={sparks.today.meanDependency}
        prev={undefined}
        formatValue={(v) => v.toFixed(2)}
        invert
      />
      <SparkTile
        label="감정 경고 (🔴 학생 수)"
        values={sparks.frustrationCountByDay}
        current={sparks.today.frustrationCount}
        prev={undefined}
        formatValue={(v) => `${Math.round(v)}명`}
        invert
        integer
      />
    </section>
  );
}

function SparkTile({
  label,
  values,
  current,
  prev,
  formatValue,
  invert,
  integer,
}: {
  label: string;
  values: number[];
  current: number;
  prev?: number;
  formatValue: (v: number) => string;
  invert?: boolean;
  integer?: boolean;
}) {
  const max = Math.max(1, ...values);
  const W = 120;
  const H = 32;
  const stepX = values.length > 1 ? W / (values.length - 1) : 0;
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = H - (integer ? (v / Math.max(1, max)) * H : (v / Math.max(1, max)) * H);
      return `${x},${y}`;
    })
    .join(" ");
  const delta = prev != null ? current - prev : null;
  const deltaColor =
    delta == null || Math.abs(delta) < 0.01
      ? "text-neutral"
      : invert
        ? delta < 0
          ? "text-success"
          : "text-error"
        : delta > 0
          ? "text-success"
          : "text-error";
  const deltaStr =
    delta == null
      ? ""
      : `${delta > 0 ? "↑" : delta < 0 ? "↓" : "—"} ${
          integer ? Math.abs(Math.round(delta)) : Math.abs(delta).toFixed(2)
        }`;
  return (
    <div className="rounded-xl border border-border-soft bg-surface p-4">
      <div className="flex items-start justify-between">
        <div className="text-[11px] text-text-secondary">{label}</div>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-8 w-28">
          <polyline fill="none" stroke="#6366F1" strokeWidth="1.5" points={points} />
        </svg>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-2xl font-semibold tracking-tighter text-text-primary">
          {formatValue(current)}
        </span>
        {delta != null && <span className={`text-[11px] ${deltaColor}`}>{deltaStr}</span>}
      </div>
    </div>
  );
}

function KCInsightSection({
  insights,
  heatmap,
  avgByKC,
  kcs,
  weakKCs,
}: {
  insights: string[];
  heatmap: Array<{ studentId: string; displayName: string; mastery: Record<string, number> }>;
  avgByKC: Record<string, number>;
  kcs: string[];
  weakKCs: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-border-soft bg-surface">
      <div className="border-b border-border-soft px-5 py-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
          Knowledge Components
        </div>
        <h2 className="mt-0.5 font-display text-lg font-semibold tracking-tight text-text-primary">
          💡 KC Insight
        </h2>
      </div>
      {insights.length > 0 && (
        <ul className="divide-y divide-border-soft">
          {insights.map((line, i) => (
            <li key={i} className="px-5 py-2.5 text-[13px] text-text-primary">
              · {line}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between border-t border-border-soft px-5 py-2">
        <span className="text-[11px] text-neutral">KC별 학생 숙련도 행렬</span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-primary hover:underline"
        >
          {expanded ? "접기 ▲" : "Heatmap 펼치기 ▼"}
        </button>
      </div>
      {expanded && (
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
              {heatmap.map((row) => (
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
                    {avgByKC[kc]?.toFixed(2)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          {weakKCs.length > 0 && (
            <div className="mt-3 rounded-md border border-error/20 bg-error/5 p-3 text-[12px] text-error">
              <span className="font-medium uppercase tracking-wider">Weak KC · </span>
              {weakKCs.join(", ")}
            </div>
          )}
        </div>
      )}
    </section>
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
      className={`group block rounded-xl border bg-surface p-3 transition-all hover:-translate-y-0.5 hover:shadow-card ${border}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <StatusDot status={card.status} />
            <span className="truncate text-[13px] font-medium text-text-primary group-hover:text-primary">
              {card.displayName}
            </span>
          </div>
        </div>
        <span className="shrink-0 font-mono text-[10px] text-neutral">
          {card.submissionCount}회
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-[10px]">
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
        <ul className="mt-2 space-y-0.5 text-[11px] leading-snug text-text-secondary">
          {card.reasons.slice(0, 2).map((r, i) => (
            <li key={i}>· {r}</li>
          ))}
        </ul>
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

function StatusDot({
  status,
  className = "",
}: {
  status: "flow" | "watch" | "critical";
  className?: string;
}) {
  const color =
    status === "flow"
      ? "bg-success"
      : status === "watch"
        ? "bg-warning"
        : "bg-error";
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color} ${className}`} />;
}

function heatColor(v: number): string {
  const hue = Math.round(v * 120);
  const light = 45 + (1 - v) * 10;
  const sat = 55;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}
