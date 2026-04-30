"use client";

import { useEffect, useState } from "react";

interface SubmissionDetail {
  id: string;
  code: string;
  finalScore: number | null;
  status: string;
  rubricScores: Record<string, unknown> | null;
  submittedAt: string | null;
  evaluatedAt: string | null;
}

interface ApiResponse {
  source: "supabase" | "demo";
  submissions: SubmissionDetail[];
  error?: string;
  note?: string;
}

interface Props {
  studentId: string;
  studentName: string;
  assignmentCode: string;
  assignmentTitle: string;
  onClose: () => void;
}

export function SubmissionCodeModal({
  studentId,
  studentName,
  assignmentCode,
  assignmentTitle,
  onClose,
}: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/submission?studentId=${encodeURIComponent(studentId)}&assignmentCode=${encodeURIComponent(assignmentCode)}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as ApiResponse;
        if (!cancelled) {
          setData(json);
          setActiveIdx(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, assignmentCode]);

  // ESC 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const submissions = data?.submissions ?? [];
  const active = submissions[activeIdx] ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border-soft bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-border-soft px-5 py-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
              제출 코드 보기
            </div>
            <h2 className="mt-0.5 font-display text-lg font-semibold tracking-tight text-text-primary">
              {studentName} ·{" "}
              <span className="font-mono text-[14px] text-primary">
                {assignmentCode.split("_")[0]}
              </span>{" "}
              <span className="text-text-secondary">{assignmentTitle}</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border-soft px-2.5 py-1 text-[11px] text-text-secondary transition-colors hover:bg-bg"
          >
            닫기 (ESC)
          </button>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* 왼쪽 — 제출 이력 리스트 */}
          <aside className="w-56 shrink-0 overflow-auto border-r border-border-soft bg-bg">
            {loading && (
              <div className="px-4 py-3 text-[12px] text-neutral">불러오는 중…</div>
            )}
            {!loading && submissions.length === 0 && (
              <div className="px-4 py-3 text-[12px] text-neutral">
                {data?.note ?? data?.error ?? "제출 이력이 없습니다."}
              </div>
            )}
            {!loading &&
              submissions.map((s, idx) => {
                const isActive = idx === activeIdx;
                const score = s.finalScore != null ? Math.round(s.finalScore * 100) : null;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveIdx(idx)}
                    className={`flex w-full flex-col gap-0.5 border-b border-border-soft px-3 py-2 text-left transition-colors ${
                      isActive
                        ? "bg-primary/10 text-text-primary"
                        : "text-text-secondary hover:bg-surface"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono">#{submissions.length - idx}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          s.status === "passed"
                            ? "bg-success/15 text-success"
                            : "bg-error/10 text-error"
                        }`}
                      >
                        {s.status === "passed" ? "✓ 통과" : "✗ 미통과"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-neutral">{formatTime(s.submittedAt)}</span>
                      {score != null && (
                        <span className="font-mono text-text-primary">{score}점</span>
                      )}
                    </div>
                  </button>
                );
              })}
          </aside>

          {/* 오른쪽 — 활성 제출의 코드 본문 */}
          <section className="flex flex-1 flex-col overflow-hidden">
            {data?.source === "demo" && (
              <div className="border-b border-warning/30 bg-warning/10 px-4 py-1.5 text-[11px] text-warning">
                Supabase 미설정 — 코드 본문이 저장되지 않은 데모 모드입니다.
              </div>
            )}
            {data?.error && (
              <div className="border-b border-error/30 bg-error/5 px-4 py-1.5 text-[11px] text-error">
                {data.error}
              </div>
            )}
            {active ? (
              <>
                <div className="flex items-center gap-3 border-b border-border-soft bg-bg px-4 py-2 text-[11px] text-text-secondary">
                  <span className="font-mono">제출 ID {active.id.slice(0, 8)}</span>
                  <span>·</span>
                  <span>{formatTime(active.submittedAt)}</span>
                  {active.rubricScores && <RubricBar rubric={active.rubricScores} />}
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(active.code)}
                    className="ml-auto rounded border border-border-soft bg-surface px-2 py-0.5 text-[10px] hover:bg-bg"
                  >
                    📋 복사
                  </button>
                </div>
                <pre className="flex-1 overflow-auto bg-bg p-4 font-mono text-[12px] leading-relaxed text-text-primary">
                  {active.code || "(코드 본문 없음)"}
                </pre>
              </>
            ) : (
              !loading && (
                <div className="flex flex-1 items-center justify-center text-[12px] text-neutral">
                  표시할 제출이 없습니다.
                </div>
              )
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function RubricBar({ rubric }: { rubric: Record<string, unknown> }) {
  const axes: Array<[string, string]> = [
    ["correctness", "정"],
    ["style", "스"],
    ["memory_safety", "메"],
    ["reflection", "성"],
  ];
  return (
    <div className="flex items-center gap-1.5">
      {axes.map(([k, label]) => {
        const v = rubric[k];
        const score = typeof v === "number" ? v : null;
        const pct = score != null ? Math.round(score * 100) : null;
        return (
          <span
            key={k}
            className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px]"
            title={k}
          >
            {label} {pct != null ? `${pct}` : "-"}
          </span>
        );
      })}
    </div>
  );
}
