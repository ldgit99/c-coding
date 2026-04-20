"use client";

import { use, useEffect, useState } from "react";

interface StudentDetail {
  id: string;
  displayName: string;
  mastery: Record<string, number>;
  dependencyFactorHistory: number[];
  misconceptions: Array<{ kc: string; pattern: string; occurrences: number }>;
  recentSubmissions: Array<{
    assignmentId: string;
    finalScore: number | null;
    passed: boolean;
    submittedAt: string;
    errorTypes: string[];
    stagnationSec: number;
    hintRequestsL3L4: number;
  }>;
}

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/student/${id}`);
      if (res.ok) {
        const data = (await res.json()) as { student: StudentDetail };
        setStudent(data.student);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <main className="p-6 text-slate-500">로딩 중…</main>;
  if (!student) return <main className="p-6 text-rose-700">학생을 찾을 수 없어요.</main>;

  return (
    <main className="p-6">
      <nav className="mb-3 text-sm">
        <a href="/" className="text-slate-600 hover:underline">
          ← 대시보드
        </a>
      </nav>
      <header className="mb-4">
        <h1 className="text-xl font-semibold">{student.displayName}</h1>
        <div className="text-xs text-slate-500">{student.id}</div>
      </header>

      <section className="mb-5 rounded border p-4">
        <h2 className="mb-2 font-semibold text-sm">KC 숙련도</h2>
        <ul className="space-y-1 text-xs">
          {Object.entries(student.mastery)
            .sort(([, a], [, b]) => b - a)
            .map(([kc, v]) => (
              <li key={kc}>
                <div className="flex justify-between">
                  <span>{kc}</span>
                  <span className="text-slate-500">{v.toFixed(2)}</span>
                </div>
                <div className="mt-0.5 h-1.5 rounded bg-slate-100">
                  <div className="h-1.5 rounded bg-slate-700" style={{ width: `${v * 100}%` }} />
                </div>
              </li>
            ))}
        </ul>
      </section>

      <section className="mb-5 rounded border p-4">
        <h2 className="mb-2 font-semibold text-sm">Dependency Factor 이력 (교사 전용)</h2>
        <div className="flex gap-1">
          {student.dependencyFactorHistory.map((d, i) => (
            <div
              key={i}
              className="flex h-10 flex-1 items-end rounded bg-slate-100"
              title={`#${i + 1}: ${d.toFixed(2)}`}
            >
              <div
                className="w-full rounded bg-amber-500"
                style={{ height: `${d * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 text-[11px] text-slate-500">
          최신값 {student.dependencyFactorHistory.at(-1)?.toFixed(2)} — 학생 UI에는 노출되지 않음
        </div>
      </section>

      <section className="mb-5 rounded border p-4">
        <h2 className="mb-2 font-semibold text-sm">최근 제출</h2>
        {student.recentSubmissions.length === 0 ? (
          <p className="text-xs text-slate-500">제출 기록 없음.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1">과제</th>
                <th>점수</th>
                <th>통과</th>
                <th>오류</th>
                <th>정체(s)</th>
                <th>L3/L4 힌트</th>
              </tr>
            </thead>
            <tbody>
              {student.recentSubmissions.map((s, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1">{s.assignmentId}</td>
                  <td>{s.finalScore?.toFixed(2) ?? "—"}</td>
                  <td>{s.passed ? "✓" : "✗"}</td>
                  <td>{s.errorTypes.join(", ") || "—"}</td>
                  <td>{s.stagnationSec}</td>
                  <td>{s.hintRequestsL3L4}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {student.misconceptions.length > 0 && (
        <section className="rounded border p-4">
          <h2 className="mb-2 font-semibold text-sm">Misconceptions</h2>
          <ul className="space-y-1 text-xs">
            {student.misconceptions.map((m, i) => (
              <li key={i} className="rounded bg-slate-50 p-2">
                <span className="font-semibold">{m.kc}</span> — {m.pattern}
                <span className="ml-2 text-slate-500">({m.occurrences}회)</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
