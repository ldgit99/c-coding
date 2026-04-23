"use client";

import { useEffect, useMemo, useState } from "react";

type QuestionType = "concept" | "debug" | "answer_request" | "metacognitive" | "other";

interface Turn {
  id: string;
  role: "student" | "ai";
  text: string;
  timestamp: string;
  assignmentId?: string;
  meta?: {
    hintLevel?: 1 | 2 | 3 | 4;
    hintType?: string;
    mode?: string;
    blockedBySafety?: boolean;
  };
}

interface TimelineEvent {
  kind: "student" | "ai" | "run" | "submit";
  at: string;
  label: string;
  sub?: string;
  questionType?: QuestionType;
  detail?: string;
  severity?: "ok" | "warn" | "error";
}

interface ConversationsResponse {
  turns: Turn[];
}

interface StudentDetail {
  recentSubmissions?: Array<{
    assignmentId: string;
    finalScore: number | null;
    passed: boolean;
    submittedAt: string;
  }>;
}

const TYPE_META: Record<QuestionType, { emoji: string; color: string; label: string }> = {
  concept: { emoji: "🔵", color: "border-primary/40 bg-primary/5", label: "개념" },
  debug: { emoji: "🟡", color: "border-warning/40 bg-warning/5", label: "디버깅" },
  answer_request: { emoji: "🔴", color: "border-error/40 bg-error/5", label: "답 요청" },
  metacognitive: { emoji: "🟣", color: "border-success/40 bg-success/5", label: "메타인지" },
  other: { emoji: "⚪", color: "border-border-soft bg-bg", label: "기타" },
};

/**
 * 학생 세션 타임라인 슬라이드오버.
 * ConversationsPage 에서 학생 선택 시 우측에서 열려 대화·실행·제출을 시간순 한 줄로 표시.
 */
export function StudentTimeline({
  studentId,
  displayName,
  assignmentFilter,
  onClose,
}: {
  studentId: string;
  displayName: string;
  assignmentFilter: string;
  onClose: () => void;
}) {
  const [turns, setTurns] = useState<Turn[] | null>(null);
  const [submissions, setSubmissions] = useState<
    Array<{
      assignmentId: string;
      finalScore: number | null;
      passed: boolean;
      submittedAt: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const params = new URLSearchParams({ studentId, limit: "200" });
        if (assignmentFilter !== "all") params.set("assignmentId", assignmentFilter);
        const [convRes, profileRes] = await Promise.all([
          fetch(`/api/student/${studentId}/conversations?${params.toString()}`, {
            cache: "no-store",
          }),
          fetch(`/api/student/${studentId}`, { cache: "no-store" }),
        ]);
        if (cancelled) return;
        const conv = convRes.ok ? ((await convRes.json()) as ConversationsResponse) : { turns: [] };
        setTurns(conv.turns ?? []);
        if (profileRes.ok) {
          const pj = (await profileRes.json()) as { student?: StudentDetail };
          const subs = pj.student?.recentSubmissions ?? [];
          setSubmissions(
            assignmentFilter === "all"
              ? subs
              : subs.filter((s) => s.assignmentId === assignmentFilter),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, assignmentFilter]);

  const events: TimelineEvent[] = useMemo(() => {
    const list: TimelineEvent[] = [];
    for (const t of turns ?? []) {
      if (t.role === "student") {
        list.push({
          kind: "student",
          at: t.timestamp,
          label: t.text,
          sub: t.assignmentId ? t.assignmentId.split("_")[0] : undefined,
          questionType: classifyLite(t.text),
        });
      } else {
        const lvl = t.meta?.hintLevel;
        list.push({
          kind: "ai",
          at: t.timestamp,
          label: t.text,
          sub: lvl ? `L${lvl}${t.meta?.hintType ? ` · ${t.meta.hintType}` : ""}` : "chat",
          severity: t.meta?.blockedBySafety ? "warn" : "ok",
        });
      }
    }
    for (const s of submissions) {
      list.push({
        kind: "submit",
        at: s.submittedAt,
        label: s.passed ? "제출 통과 ✓" : "제출 미통과 ✗",
        sub: s.assignmentId.split("_")[0] ?? s.assignmentId,
        detail: s.finalScore != null ? `score ${(s.finalScore * 100).toFixed(0)}` : undefined,
        severity: s.passed ? "ok" : "error",
      });
    }
    return list.sort((a, b) => a.at.localeCompare(b.at));
  }, [turns, submissions]);

  const summary = useMemo(() => {
    const studentTurns = events.filter((e) => e.kind === "student");
    const typeCounts: Record<QuestionType, number> = {
      concept: 0,
      debug: 0,
      answer_request: 0,
      metacognitive: 0,
      other: 0,
    };
    for (const e of studentTurns) {
      if (e.questionType) typeCounts[e.questionType] += 1;
    }
    const submits = events.filter((e) => e.kind === "submit");
    const passes = submits.filter((e) => e.severity === "ok").length;
    return { turnCount: studentTurns.length, typeCounts, submits: submits.length, passes };
  }, [events]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-text-primary/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-[560px] flex-col overflow-hidden border-l border-border-soft bg-surface shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-border-soft px-5 py-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-neutral">Session Timeline</div>
            <h2 className="mt-0.5 font-display text-xl font-semibold tracking-tight text-text-primary">
              {displayName}
            </h2>
            {!loading && (
              <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-text-secondary">
                <span>{summary.turnCount}발화</span>
                <span>· 제출 {summary.passes}/{summary.submits}</span>
                {(["metacognitive", "concept", "debug", "answer_request"] as QuestionType[]).map(
                  (t) =>
                    summary.typeCounts[t] > 0 && (
                      <span key={t} className="rounded-sm bg-bg px-1.5 py-0.5 font-mono text-[10px]">
                        {TYPE_META[t].emoji} {summary.typeCounts[t]}
                      </span>
                    ),
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border-soft bg-white px-2 py-1 text-[11px] text-text-secondary hover:border-primary hover:text-primary"
          >
            닫기 ×
          </button>
        </header>

        <div className="flex-1 overflow-auto px-5 py-4">
          {loading && <div className="text-[13px] text-neutral">로딩 중…</div>}
          {!loading && events.length === 0 && (
            <div className="text-[13px] text-text-secondary">
              이 과제의 활동 기록이 없어요.
            </div>
          )}
          {!loading && events.length > 0 && (
            <ol className="space-y-2">
              {events.map((e, i) => (
                <TimelineRow key={i} event={e} prev={events[i - 1]} />
              ))}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}

function TimelineRow({ event, prev }: { event: TimelineEvent; prev?: TimelineEvent }) {
  const time = formatTime(event.at);
  const gap = prev ? gapBetween(prev.at, event.at) : null;

  if (event.kind === "submit") {
    const okCls =
      event.severity === "ok"
        ? "border-success/40 bg-success/10 text-success"
        : "border-error/40 bg-error/10 text-error";
    return (
      <li className="flex gap-3">
        <div className="w-14 shrink-0 pt-1 text-right font-mono text-[10px] text-neutral">
          {time}
        </div>
        <div className={`flex-1 rounded-md border px-3 py-2 text-[12px] ${okCls}`}>
          <div className="flex items-center justify-between">
            <span className="font-medium">{event.label}</span>
            {event.sub && <span className="font-mono text-[10px] opacity-70">{event.sub}</span>}
          </div>
          {event.detail && <div className="mt-0.5 text-[10px] opacity-70">{event.detail}</div>}
        </div>
      </li>
    );
  }

  if (event.kind === "ai") {
    return (
      <li className="flex gap-3">
        <div className="w-14 shrink-0 pt-1 text-right font-mono text-[10px] text-neutral">
          {time}
        </div>
        <div className="flex-1 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-[12px] text-text-primary">
          <div className="mb-0.5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-primary">
            AI 튜터
            {event.sub && <span className="font-mono text-neutral">· {event.sub}</span>}
            {event.severity === "warn" && (
              <span className="rounded-sm bg-warning/20 px-1.5 py-0.5 text-warning">safety</span>
            )}
          </div>
          <div className="line-clamp-3 whitespace-pre-wrap text-[12px]">{event.label}</div>
        </div>
      </li>
    );
  }

  // student
  const type = event.questionType ?? "other";
  const tm = TYPE_META[type];
  return (
    <li className="flex gap-3">
      <div className="w-14 shrink-0 pt-1 text-right font-mono text-[10px] text-neutral">
        {time}
        {gap && gap.gapSec > 60 && (
          <div className="mt-0.5 text-[9px] text-neutral/70">+{formatGap(gap.gapSec)}</div>
        )}
      </div>
      <div className={`flex-1 rounded-md border px-3 py-2 text-[12px] ${tm.color}`}>
        <div className="mb-0.5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-text-secondary">
          {tm.emoji} {tm.label}
          {event.sub && <span className="font-mono text-neutral">· {event.sub}</span>}
        </div>
        <div className="line-clamp-3 whitespace-pre-wrap text-text-primary">{event.label}</div>
      </div>
    </li>
  );
}

function classifyLite(text: string): QuestionType {
  const t = text.trim().toLowerCase();
  if (/(세그폴트|segfault|컴파일.*에러|런타임.*에러|왜.*안\s*돌아|에러)/i.test(t)) return "debug";
  if (/(그냥\s*답|정답\s*뭐|전체\s*코드|대신\s*해|완성\s*코드)/.test(t)) return "answer_request";
  if (/(이해했|내가.*만든|정리|납득|생각해)/.test(t)) return "metacognitive";
  if (/(왜|어떻게|무엇|뭐|차이|의미)/.test(t) && /[가-힣]{3,}/.test(t)) return "concept";
  return "other";
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso.slice(11, 16);
  }
}

function gapBetween(a: string, b: string): { gapSec: number } {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  return { gapSec: Math.max(0, Math.round((tb - ta) / 1000)) };
}

function formatGap(sec: number): string {
  if (sec < 3600) return `${Math.round(sec / 60)}분`;
  return `${(sec / 3600).toFixed(1)}시간`;
}
