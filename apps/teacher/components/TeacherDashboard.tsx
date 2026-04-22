"use client";

import { useEffect, useState } from "react";

import type { AppUser } from "@cvibe/db";

import { InterventionActions } from "@/components/InterventionActions";
import { UserMenu } from "@cvibe/shared-ui";

import { LiveEvents } from "@/components/LiveEvents";
import { ModeDonut } from "@/components/ModeDonut";

interface InterventionItem {
  studentId: string;
  displayName: string;
  level: "weak" | "medium" | "strong";
  reasons: string[];
  suggestedActions: Array<{ label: string }>;
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

interface ClassroomResponse {
  cohortId: string;
  summary: ClassroomSummary;
  interventionQueue: InterventionItem[];
  misconceptions: Misconception[];
  generatedAt: string;
}

export function TeacherDashboard({ user }: { user: AppUser }) {
  const [data, setData] = useState<ClassroomResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/classroom");
      setData((await res.json()) as ClassroomResponse);
      setLoading(false);
    })();
  }, []);

  if (loading || !data) {
    return <main className="p-12 text-sm text-neutral">대시보드 로딩 중…</main>;
  }

  const kcs = Object.keys(data.summary.avgMasteryByKC);

  return (
    <main className="mx-auto max-w-[1280px] px-6 py-10">
      <header className="mb-10 border-b border-border-soft pb-6">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-neutral">
          Teacher Dashboard
        </div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-tighter text-text-primary">
              Classroom Overview
            </h1>
            <div className="mt-2 flex items-center gap-3 text-[13px] text-text-secondary">
              <UserMenu
                displayName={user.displayName}
                mocked={user.mocked}
                email={user.email}
                loginPath="/login"
              />
            </div>
          </div>
          <div className="flex items-start gap-5">
            <div className="text-right text-[12px] text-text-secondary">
              <div>
                <span className="text-neutral">cohort · </span>
                <span className="font-mono text-text-primary">{data.cohortId}</span>
              </div>
              <div className="mt-1">
                <span className="text-neutral">{data.summary.studentCount} students · </span>
                <span className="font-medium text-text-primary">
                  {(data.summary.completionRate * 100).toFixed(0)}%
                </span>
                <span className="text-neutral"> completion</span>
              </div>
            </div>
            <a
              href="/research"
              className="inline-flex h-9 items-center rounded-md border border-border-soft bg-white px-3 text-[11px] font-medium uppercase tracking-wider text-text-primary transition-all hover:-translate-y-px hover:border-primary hover:text-primary"
            >
              Research Lab →
            </a>
          </div>
        </div>
      </header>

      <section
        id="classroom"
        className="mb-10 overflow-hidden rounded-xl border border-border-soft bg-surface"
      >
        <div className="border-b border-border-soft px-6 py-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Classroom Heatmap
          </div>
          <h2 className="mt-0.5 font-display text-xl font-semibold tracking-tighter text-text-primary">
            KC별 평균 숙련도
          </h2>
        </div>
        <div className="overflow-auto px-6 py-4">
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
            <div className="mt-4 rounded-md border border-error/20 bg-error/5 p-3 text-[12px] text-error">
              <span className="font-medium uppercase tracking-wider">Weak KC · </span>
              {data.summary.weakKCs.join(", ")}
            </div>
          )}
        </div>
      </section>

      <section
        id="intervention"
        className="mb-10 overflow-hidden rounded-xl border border-border-soft bg-surface"
      >
        <div className="border-b border-border-soft px-6 py-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Teacher Copilot
          </div>
          <h2 className="mt-0.5 font-display text-xl font-semibold tracking-tighter text-text-primary">
            Intervention Queue
          </h2>
        </div>
        <div className="px-6 py-4">
          {data.interventionQueue.length === 0 ? (
            <p className="text-[13px] text-text-secondary">개입이 필요한 학생이 없어요.</p>
          ) : (
            <ul className="divide-y divide-border-soft">
              {data.interventionQueue.map((item) => (
                <li key={item.studentId} className="py-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-text-primary">{item.displayName}</span>
                    <LevelBadge level={item.level} />
                  </div>
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[12px] text-text-secondary">
                    {item.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                  <div className="mt-2 text-[10px] uppercase tracking-wider text-neutral">
                    Suggested
                  </div>
                  <ul className="text-[12px] text-text-secondary">
                    {item.suggestedActions.map((a, i) => (
                      <li key={i}>· {a.label}</li>
                    ))}
                  </ul>
                  <div className="mt-3">
                    <InterventionActions
                      studentId={item.studentId}
                      displayName={item.displayName}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="mb-10 grid gap-6 lg:grid-cols-[1fr_340px]">
        <LiveEvents />
        <ModeDonut />
      </div>

      <section
        id="misconceptions"
        className="mb-10 overflow-hidden rounded-xl border border-border-soft bg-surface"
      >
        <div className="border-b border-border-soft px-6 py-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Student Modeler
          </div>
          <h2 className="mt-0.5 font-display text-xl font-semibold tracking-tighter text-text-primary">
            Common Misconceptions
          </h2>
        </div>
        <div className="px-6 py-4">
          {data.misconceptions.length === 0 ? (
            <p className="text-[13px] text-text-secondary">현재 감지된 공통 오개념 없음.</p>
          ) : (
            <ul className="divide-y divide-border-soft">
              {data.misconceptions.map((m, i) => (
                <li key={i} className="flex items-center justify-between py-3 text-[13px]">
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
          )}
        </div>
      </section>

      <div className="text-right text-[11px] text-neutral">
        generated {new Date(data.generatedAt).toLocaleTimeString("ko-KR")}
      </div>
    </main>
  );
}

function LevelBadge({ level }: { level: "weak" | "medium" | "strong" }) {
  const classes =
    level === "strong"
      ? "bg-error/10 text-error border-error/20"
      : level === "medium"
        ? "bg-warning/10 text-warning border-warning/20"
        : "bg-bg text-text-secondary border-border-soft";
  return (
    <span
      className={`rounded-sm border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${classes}`}
    >
      {level}
    </span>
  );
}

function heatColor(v: number): string {
  // 0(red) → 1(green). Genesis 팔레트 중간 구간을 선명하지 않게 저채도 사용.
  const hue = Math.round(v * 120);
  const light = 45 + (1 - v) * 10;
  const sat = 55;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}
