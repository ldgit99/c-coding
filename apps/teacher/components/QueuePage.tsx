"use client";

import { useEffect, useState } from "react";

import { InterventionActions } from "@/components/InterventionActions";

interface EnrichedQueueItem {
  studentId: string;
  displayName: string;
  level: "weak" | "medium" | "strong";
  reasons: string[];
  suggestedActions: Array<{ label: string }>;
  signals: {
    frustration: number;
    stuckLoop: { term: string | null; repeat: number } | null;
    answerRequestRate: number;
    recentUtteranceCount: number;
  };
  urgency: number;
}

interface QueueResponse {
  cohortId: string;
  queue: EnrichedQueueItem[];
  misconceptions: Array<{ kc: string; pattern: string; affectedStudentCount: number }>;
  generatedAt: string;
}

export function QueuePage() {
  const [data, setData] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch("/api/queue", { cache: "no-store" });
      setData((await res.json()) as QueueResponse);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="mx-auto max-w-[1280px] px-8 py-8">
      <header className="mb-6 flex items-end justify-between gap-4 border-b border-border-soft pb-5">
        <div>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral">
            Teacher Copilot
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tighter text-text-primary">
            개입 큐
          </h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            긴급도 순 정렬 · 개입 이유 + 대화 파생 신호 결합 · 20초 자동 갱신
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="h-9 rounded-md border border-border-soft bg-surface px-3 text-[12px] font-medium text-text-primary hover:border-primary"
        >
          새로고침
        </button>
      </header>

      {loading && !data && (
        <div className="text-[13px] text-neutral">로딩 중…</div>
      )}

      {data && data.queue.length === 0 && (
        <section className="rounded-xl border border-border-soft bg-surface p-8 text-center text-[13px] text-text-secondary">
          개입이 필요한 학생이 없어요. 🎉
        </section>
      )}

      {data && data.queue.length > 0 && (
        <ol className="space-y-3">
          {data.queue.map((item, idx) => (
            <li
              key={item.studentId}
              className="rounded-xl border border-border-soft bg-surface p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-mono text-[10px] text-neutral">
                      #{idx + 1}
                    </span>
                    <a
                      href={`/student/${item.studentId}`}
                      className="font-display text-lg font-semibold tracking-tight text-text-primary transition-colors hover:text-primary"
                    >
                      {item.displayName}
                    </a>
                    <LevelBadge level={item.level} />
                    <UrgencyBar value={item.urgency} />
                  </div>
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[12px] text-text-secondary">
                    {item.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.signals.frustration >= 0.25 && (
                      <SignalChip
                        color="bg-error/10 text-error border-error/20"
                        label={`😩 감정 ${(item.signals.frustration * 100).toFixed(0)}%`}
                        title="최근 10턴 중 frustration 어휘 비율"
                      />
                    )}
                    {item.signals.stuckLoop && (
                      <SignalChip
                        color="bg-warning/10 text-warning border-warning/20"
                        label={`🔁 막힘 루프 · "${item.signals.stuckLoop.term}" ×${item.signals.stuckLoop.repeat}`}
                        title="같은 주제 3회 이상 반복"
                      />
                    )}
                    {item.signals.answerRequestRate >= 0.2 && (
                      <SignalChip
                        color="bg-primary/10 text-primary border-primary/20"
                        label={`🙏 답 요청 ${(item.signals.answerRequestRate * 100).toFixed(0)}%`}
                        title="전체 발화 중 정답/코드 요구 비율"
                      />
                    )}
                    <SignalChip
                      color="bg-bg text-neutral border-border-soft"
                      label={`💬 ${item.signals.recentUtteranceCount}턴`}
                      title="최근 수집된 학생 발화 수"
                    />
                  </div>
                  <div className="mt-3 text-[10px] uppercase tracking-wider text-neutral">
                    Suggested
                  </div>
                  <ul className="text-[12px] text-text-secondary">
                    {item.suggestedActions.map((a, i) => (
                      <li key={i}>· {a.label}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-3">
                <InterventionActions
                  studentId={item.studentId}
                  displayName={item.displayName}
                />
              </div>
            </li>
          ))}
        </ol>
      )}

      {data && data.misconceptions.length > 0 && (
        <section className="mt-8 rounded-xl border border-border-soft bg-surface p-5">
          <h2 className="font-display text-lg font-semibold tracking-tight text-text-primary">
            이번 주 공통 오개념
          </h2>
          <ul className="mt-3 divide-y divide-border-soft">
            {data.misconceptions.map((m, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-[13px]">
                <div>
                  <span className="font-mono text-text-primary">{m.kc}</span>
                  <span className="ml-2 text-text-secondary">{m.pattern}</span>
                </div>
                <span className="text-[11px] text-neutral">{m.affectedStudentCount}명</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && (
        <div className="mt-6 text-right text-[11px] text-neutral">
          generated {new Date(data.generatedAt).toLocaleTimeString("ko-KR")}
        </div>
      )}
    </main>
  );
}

function LevelBadge({ level }: { level: "weak" | "medium" | "strong" }) {
  const cls =
    level === "strong"
      ? "bg-error/10 text-error border-error/20"
      : level === "medium"
        ? "bg-warning/10 text-warning border-warning/20"
        : "bg-bg text-text-secondary border-border-soft";
  return (
    <span className={`rounded-sm border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${cls}`}>
      {level}
    </span>
  );
}

function UrgencyBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-neutral"
      title={`urgency ${value.toFixed(3)}`}
    >
      <span className="relative block h-1.5 w-20 overflow-hidden rounded-full bg-border-soft">
        <span
          className="absolute left-0 top-0 h-full rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="font-mono text-[10px] text-text-primary">{pct}</span>
    </span>
  );
}

function SignalChip({ color, label, title }: { color: string; label: string; title: string }) {
  return (
    <span
      title={title}
      className={`inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-medium ${color}`}
    >
      {label}
    </span>
  );
}
