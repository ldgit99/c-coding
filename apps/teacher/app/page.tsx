"use client";

import { useEffect, useState } from "react";

import { InterventionActions } from "@/components/InterventionActions";
import { LiveEvents } from "@/components/LiveEvents";

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

export default function TeacherHome() {
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
    return <main className="p-6 text-slate-500">대시보드 로딩 중…</main>;
  }

  const kcs = Object.keys(data.summary.avgMasteryByKC);

  return (
    <main className="p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">CVibe — 교사 대시보드</h1>
        <div className="text-xs text-slate-500">
          cohort {data.cohortId} · {data.summary.studentCount}명 · 완료율 {(data.summary.completionRate * 100).toFixed(0)}%
        </div>
      </header>

      <section id="classroom" className="mb-6 rounded border p-4">
        <h2 className="mb-3 font-semibold">Classroom Heatmap — KC별 평균 숙련도</h2>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white p-1 text-left">학생</th>
                {kcs.map((kc) => (
                  <th key={kc} className="whitespace-nowrap p-1 text-left font-normal text-slate-600">
                    {kc}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.summary.heatmap.map((row) => (
                <tr key={row.studentId}>
                  <td className="sticky left-0 bg-white p-1 font-semibold">
                    <a href={`/student/${row.studentId}`} className="text-slate-900 hover:underline">
                      {row.displayName}
                    </a>
                  </td>
                  {kcs.map((kc) => {
                    const v = row.mastery[kc] ?? 0;
                    return (
                      <td key={kc} className="p-1">
                        <div
                          className="flex h-6 w-full items-center justify-center rounded text-[10px] text-white"
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
              <tr className="border-t-2 border-slate-200 font-semibold">
                <td className="sticky left-0 bg-white p-1">평균</td>
                {kcs.map((kc) => (
                  <td key={kc} className="p-1 text-[10px] text-slate-600">
                    {data.summary.avgMasteryByKC[kc]?.toFixed(2)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        {data.summary.weakKCs.length > 0 && (
          <div className="mt-3 text-xs text-rose-700">
            취약 KC (평균 {"<"} 0.5): {data.summary.weakKCs.join(", ")}
          </div>
        )}
      </section>

      <section id="intervention" className="mb-6 rounded border p-4">
        <h2 className="mb-2 font-semibold">Intervention Queue — Teacher Copilot 권고</h2>
        {data.interventionQueue.length === 0 ? (
          <p className="text-sm text-slate-500">개입이 필요한 학생이 없어요.</p>
        ) : (
          <ul className="space-y-2">
            {data.interventionQueue.map((item) => (
              <li key={item.studentId} className="rounded border bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{item.displayName}</span>
                  <span className={`rounded px-2 py-0.5 text-xs text-white ${LEVEL_BADGE[item.level]}`}>
                    {item.level}
                  </span>
                </div>
                <ul className="mt-2 list-disc pl-4 text-xs text-slate-700">
                  {item.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
                <div className="mt-2 text-xs text-slate-500">권고 액션:</div>
                <ul className="text-xs text-slate-600">
                  {item.suggestedActions.map((a, i) => (
                    <li key={i}>· {a.label}</li>
                  ))}
                </ul>
                <div className="mt-2">
                  <InterventionActions studentId={item.studentId} displayName={item.displayName} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mb-6">
        <LiveEvents />
      </div>

      <section id="misconceptions" className="rounded border p-4">
        <h2 className="mb-2 font-semibold">Common Misconceptions</h2>
        {data.misconceptions.length === 0 ? (
          <p className="text-sm text-slate-500">현재 감지된 공통 오개념 없음.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.misconceptions.map((m, i) => (
              <li key={i} className="rounded bg-slate-50 p-2">
                <span className="font-semibold">{m.kc}</span>
                <span className="ml-2 text-slate-600">{m.pattern}</span>
                <span className="ml-2 text-xs text-slate-500">
                  {m.affectedStudentCount}명 · 누적 {m.totalOccurrences}회
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-4 text-right text-xs text-slate-400">
        generated {new Date(data.generatedAt).toLocaleTimeString("ko-KR")}
      </div>
    </main>
  );
}

const LEVEL_BADGE = {
  weak: "bg-slate-400",
  medium: "bg-amber-500",
  strong: "bg-rose-600",
} as const;

function heatColor(v: number): string {
  // 0(붉음) → 1(초록). HSL hue 0→120
  const hue = Math.round(v * 120);
  const light = 40 + (1 - v) * 15;
  return `hsl(${hue}, 60%, ${light}%)`;
}
