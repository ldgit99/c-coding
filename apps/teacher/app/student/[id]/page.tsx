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

interface ConversationTurn {
  id: string;
  studentId: string;
  role: "student" | "ai";
  text: string;
  timestamp: string;
  assignmentId?: string;
  meta?: {
    hintLevel?: 1 | 2 | 3 | 4;
    hintType?: string;
    mode?: string;
    usedModel?: string;
    blockedBySafety?: boolean;
  };
}

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [convLoading, setConvLoading] = useState(true);

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

  useEffect(() => {
    let cancelled = false;
    const fetchTurns = async () => {
      try {
        const res = await fetch(`/api/student/${id}/conversations?limit=100`);
        if (!res.ok) return;
        const data = (await res.json()) as { turns: ConversationTurn[] };
        if (!cancelled) setTurns(data.turns ?? []);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setConvLoading(false);
      }
    };
    void fetchTurns();
    const t = setInterval(fetchTurns, 10000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [id]);

  if (loading) return <main className="p-12 text-sm text-neutral">로딩 중…</main>;
  if (!student)
    return <main className="p-12 text-sm text-error">학생을 찾을 수 없어요.</main>;

  return (
    <main className="mx-auto max-w-[1280px] px-6 py-10">
      <nav className="mb-6 text-[11px] uppercase tracking-wider">
        <a href="/" className="text-neutral transition-colors hover:text-primary">
          ← 대시보드
        </a>
      </nav>
      <header className="mb-8 border-b border-border-soft pb-6">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
          Student Detail
        </div>
        <h1 className="mt-0.5 font-display text-4xl font-semibold tracking-tighter text-text-primary">
          {student.displayName}
        </h1>
        <div className="mt-2 font-mono text-[12px] text-text-secondary">{student.id}</div>
      </header>

      <section className="mb-8 overflow-hidden rounded-xl border border-border-soft bg-surface">
        <div className="border-b border-border-soft px-6 py-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Mastery
          </div>
          <h2 className="mt-0.5 font-display text-xl font-semibold tracking-tighter text-text-primary">
            KC 숙련도
          </h2>
        </div>
        <ul className="space-y-2 px-6 py-4 text-[12px]">
          {Object.entries(student.mastery)
            .sort(([, a], [, b]) => b - a)
            .map(([kc, v]) => (
              <li key={kc}>
                <div className="flex justify-between">
                  <span className="font-mono text-text-primary">{kc}</span>
                  <span className="font-mono text-neutral">{v.toFixed(2)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border-soft">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${v * 100}%` }}
                  />
                </div>
              </li>
            ))}
        </ul>
      </section>

      <section className="mb-8 overflow-hidden rounded-xl border border-border-soft bg-surface">
        <div className="border-b border-border-soft px-6 py-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Teacher Only
          </div>
          <h2 className="mt-0.5 font-display text-xl font-semibold tracking-tighter text-text-primary">
            Dependency Factor 이력
          </h2>
        </div>
        <div className="px-6 py-4">
          <div className="flex gap-1">
            {student.dependencyFactorHistory.map((d, i) => (
              <div
                key={i}
                className="flex h-12 flex-1 items-end rounded-md bg-bg"
                title={`#${i + 1}: ${d.toFixed(2)}`}
              >
                <div
                  className="w-full rounded-md bg-warning"
                  style={{ height: `${d * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-neutral">
            최신값 {student.dependencyFactorHistory.at(-1)?.toFixed(2)} · 학생 UI에는 노출되지 않음
          </div>
        </div>
      </section>

      <section className="mb-8 overflow-hidden rounded-xl border border-border-soft bg-surface">
        <div className="border-b border-border-soft px-6 py-4">
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Submissions
          </div>
          <h2 className="mt-0.5 font-display text-xl font-semibold tracking-tighter text-text-primary">
            최근 제출
          </h2>
        </div>
        <div className="px-6 py-4">
          {student.recentSubmissions.length === 0 ? (
            <p className="text-[13px] text-text-secondary">제출 기록 없음.</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border-soft text-left text-[10px] uppercase tracking-wider text-neutral">
                  <th className="py-2 pr-4 font-medium">과제</th>
                  <th className="py-2 pr-4 font-medium">점수</th>
                  <th className="py-2 pr-4 font-medium">통과</th>
                  <th className="py-2 pr-4 font-medium">오류</th>
                  <th className="py-2 pr-4 font-medium">정체(s)</th>
                  <th className="py-2 font-medium">L3/L4 힌트</th>
                </tr>
              </thead>
              <tbody>
                {student.recentSubmissions.map((s, i) => (
                  <tr key={i} className="border-b border-border-soft last:border-0">
                    <td className="py-2 pr-4 font-mono text-text-primary">{s.assignmentId}</td>
                    <td className="py-2 pr-4 font-mono text-text-primary">
                      {s.finalScore?.toFixed(2) ?? "—"}
                    </td>
                    <td className={`py-2 pr-4 ${s.passed ? "text-success" : "text-error"}`}>
                      {s.passed ? "✓" : "✗"}
                    </td>
                    <td className="py-2 pr-4 text-text-secondary">
                      {s.errorTypes.join(", ") || "—"}
                    </td>
                    <td className="py-2 pr-4 font-mono text-text-secondary">{s.stagnationSec}</td>
                    <td className="py-2 font-mono text-text-secondary">{s.hintRequestsL3L4}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="mb-8 overflow-hidden rounded-xl border border-border-soft bg-surface">
        <div className="flex items-center justify-between border-b border-border-soft px-6 py-4">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
              Teacher Only · Privacy Sensitive
            </div>
            <h2 className="mt-0.5 font-display text-xl font-semibold tracking-tighter text-text-primary">
              학생-AI 대화 로그
            </h2>
          </div>
          <span className="text-[11px] uppercase tracking-wider text-neutral">
            {turns.length}턴 · 10초마다 새로고침
          </span>
        </div>
        <div className="max-h-[480px] overflow-auto px-6 py-4">
          {convLoading ? (
            <p className="text-[13px] text-text-secondary">대화 로그 불러오는 중…</p>
          ) : turns.length === 0 ? (
            <p className="text-[13px] text-text-secondary">
              아직 기록된 대화가 없어요. 학생이 채팅/힌트를 사용하면 실시간으로 나타납니다.
            </p>
          ) : (
            <ul className="space-y-3">
              {turns.map((t) => (
                <li key={t.id} className="flex gap-3">
                  <span className="shrink-0 font-mono text-[11px] text-neutral">
                    {new Date(t.timestamp).toLocaleTimeString("ko-KR", { hour12: false })}
                  </span>
                  <div
                    className={`flex-1 rounded-md border px-3 py-2 text-[12px] leading-relaxed ${
                      t.role === "student"
                        ? "border-border-soft bg-bg text-text-primary"
                        : "border-primary/20 bg-primary/5 text-text-primary"
                    }`}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider">
                      <span
                        className={
                          t.role === "student" ? "text-text-secondary" : "text-primary"
                        }
                      >
                        {t.role === "student" ? "학생" : "AI"}
                      </span>
                      {t.assignmentId && (
                        <span className="font-mono text-neutral">· {t.assignmentId}</span>
                      )}
                      {t.meta?.hintLevel && (
                        <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-primary">
                          L{t.meta.hintLevel}
                          {t.meta.hintType ? ` · ${t.meta.hintType}` : ""}
                        </span>
                      )}
                      {t.meta?.mode && <span className="text-neutral">{t.meta.mode}</span>}
                      {t.meta?.blockedBySafety && (
                        <span className="rounded-sm bg-error/10 px-1.5 py-0.5 text-error">
                          blocked
                        </span>
                      )}
                      {t.meta?.usedModel && (
                        <span className="font-mono text-neutral">{t.meta.usedModel}</span>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap">{t.text}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {student.misconceptions.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-border-soft bg-surface">
          <div className="border-b border-border-soft px-6 py-4">
            <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
              Student Modeler
            </div>
            <h2 className="mt-0.5 font-display text-xl font-semibold tracking-tighter text-text-primary">
              Misconceptions
            </h2>
          </div>
          <ul className="divide-y divide-border-soft px-6 py-3">
            {student.misconceptions.map((m, i) => (
              <li key={i} className="py-3 text-[13px]">
                <span className="font-mono text-text-primary">{m.kc}</span>
                <span className="ml-2 text-text-secondary">{m.pattern}</span>
                <span className="ml-2 text-[11px] text-neutral">({m.occurrences}회)</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
