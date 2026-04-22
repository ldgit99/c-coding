"use client";

import { use, useEffect, useState } from "react";

type QuestionType = "concept" | "debug" | "answer_request" | "metacognitive" | "other";

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

interface ProfileResponse {
  student: StudentDetail;
  source: "supabase" | "demo";
  conversation: {
    turnCount: number;
    studentUtteranceCount: number;
    questionDistribution: Record<QuestionType, number>;
    frustration: number;
    offloadingScore: number;
    metacognitiveRate: number;
    avgUtteranceLength: number;
    stuckLoop: { term: string | null; repeat: number } | null;
  };
  supportLadder: Record<"1" | "2" | "3" | "4", number>;
  copyPasteFlags: Array<{
    assignmentId: string;
    submittedAt: string;
    gapSec: number | null;
    suspected: boolean;
  }>;
  latestSuspectedCopyPaste: {
    assignmentId: string;
    submittedAt: string;
    gapSec: number | null;
  } | null;
  conversationArcs: Array<{
    assignmentId: string;
    turnCount: number;
    startedAt: string | null;
    lastAt: string | null;
    hintRequests: number;
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

const TYPE_LABEL: Record<QuestionType, { label: string; color: string }> = {
  concept: { label: "개념", color: "bg-primary" },
  debug: { label: "디버깅", color: "bg-warning" },
  answer_request: { label: "답 요청", color: "bg-error" },
  metacognitive: { label: "메타인지", color: "bg-success" },
  other: { label: "기타", color: "bg-neutral" },
};

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [convLoading, setConvLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/student/${id}/profile`, { cache: "no-store" });
        if (res.ok) {
          setProfile((await res.json()) as ProfileResponse);
        }
      } finally {
        setLoading(false);
      }
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
  if (!profile)
    return <main className="p-12 text-sm text-error">학생을 찾을 수 없어요.</main>;

  const { student, conversation, supportLadder, copyPasteFlags, latestSuspectedCopyPaste, conversationArcs } =
    profile;
  const totalDistribution = Object.values(conversation.questionDistribution).reduce(
    (a, b) => a + b,
    0,
  );

  return (
    <main className="mx-auto max-w-[1280px] px-8 py-8">
      <header className="mb-6 border-b border-border-soft pb-5">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
          Student Detail
        </div>
        <h1 className="mt-0.5 font-display text-3xl font-semibold tracking-tighter text-text-primary">
          {student.displayName}
        </h1>
        <div className="mt-1 font-mono text-[11px] text-text-secondary">{student.id}</div>
      </header>

      {/* Conversation Insights Row */}
      <section className="mb-6 grid gap-4 md:grid-cols-[1fr_1fr_1fr]">
        <Card title="질문 유형 분포" subtitle={`총 ${conversation.studentUtteranceCount}개 발화`}>
          {totalDistribution === 0 ? (
            <div className="text-[12px] text-text-secondary">수집된 발화가 없어요.</div>
          ) : (
            <>
              <div className="flex h-3 overflow-hidden rounded">
                {(["metacognitive", "concept", "debug", "answer_request", "other"] as QuestionType[]).map(
                  (k) => {
                    const n = conversation.questionDistribution[k];
                    if (n === 0) return null;
                    const pct = (n / totalDistribution) * 100;
                    return (
                      <span
                        key={k}
                        className={TYPE_LABEL[k].color}
                        style={{ width: `${pct}%` }}
                        title={`${TYPE_LABEL[k].label} ${n}`}
                      />
                    );
                  },
                )}
              </div>
              <ul className="mt-3 space-y-1 text-[11px]">
                {(Object.keys(conversation.questionDistribution) as QuestionType[]).map((k) => {
                  const n = conversation.questionDistribution[k];
                  if (n === 0) return null;
                  return (
                    <li key={k} className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${TYPE_LABEL[k].color}`} />
                        {TYPE_LABEL[k].label}
                      </span>
                      <span className="font-mono text-text-primary">{n}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>

        <Card title="대화 신호" subtitle="0 ~ 100%">
          <div className="space-y-2.5">
            <Signal
              label="감정"
              value={conversation.frustration}
              invert
              hint="최근 10턴 frustration 어휘 비율"
            />
            <Signal
              label="오프로딩"
              value={conversation.offloadingScore}
              invert
              hint="명령형 · 답 요구 비율 가중합"
            />
            <Signal
              label="메타인지"
              value={conversation.metacognitiveRate}
              hint="내가/나는 + 이해했/생각 패턴"
            />
          </div>
          {conversation.stuckLoop && (
            <div className="mt-3 rounded border border-warning/30 bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
              🔁 막힘 루프 · &ldquo;{conversation.stuckLoop.term}&rdquo; ×
              {conversation.stuckLoop.repeat}
            </div>
          )}
        </Card>

        <Card title="Support Ladder" subtitle="힌트 레벨별 제공 횟수">
          <ul className="space-y-2">
            {([1, 2, 3, 4] as const).map((level) => {
              const n = supportLadder[String(level) as "1" | "2" | "3" | "4"] ?? 0;
              const total =
                (supportLadder["1"] ?? 0) +
                (supportLadder["2"] ?? 0) +
                (supportLadder["3"] ?? 0) +
                (supportLadder["4"] ?? 0);
              const pct = total > 0 ? (n / total) * 100 : 0;
              return (
                <li key={level} className="text-[11px]">
                  <div className="flex justify-between">
                    <span className="font-mono text-text-primary">L{level}</span>
                    <span className="font-mono text-neutral">{n}회</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border-soft">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>

      {/* Copy-paste red flag */}
      {latestSuspectedCopyPaste && (
        <section className="mb-6 overflow-hidden rounded-xl border border-error/30 bg-error/5">
          <div className="px-5 py-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-error">
              🚩 Copy-paste 의심
            </div>
            <div className="mt-1 text-[13px] text-text-primary">
              <span className="font-mono">{latestSuspectedCopyPaste.assignmentId}</span>
              <span className="ml-2 text-text-secondary">
                AI 응답 {latestSuspectedCopyPaste.gapSec}초 후 제출
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Conversation Arcs */}
      {conversationArcs.length > 0 && (
        <section className="mb-6 overflow-hidden rounded-xl border border-border-soft bg-surface">
          <div className="border-b border-border-soft px-5 py-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
              Conversation Arcs
            </div>
            <h2 className="mt-0.5 font-display text-lg font-semibold tracking-tight text-text-primary">
              과제별 대화 호
            </h2>
          </div>
          <ul className="divide-y divide-border-soft">
            {conversationArcs.map((arc) => (
              <li key={arc.assignmentId} className="flex items-center justify-between px-5 py-3 text-[12px]">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-text-primary">{arc.assignmentId}</span>
                  <span className="text-text-secondary">{arc.turnCount}턴</span>
                  {arc.hintRequests > 0 && (
                    <span className="rounded-sm border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      힌트 {arc.hintRequests}회
                    </span>
                  )}
                </div>
                <span className="font-mono text-[10px] text-neutral">
                  {arc.lastAt ? new Date(arc.lastAt).toLocaleString("ko-KR") : "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Existing: Mastery */}
      <section className="mb-6 overflow-hidden rounded-xl border border-border-soft bg-surface">
        <div className="border-b border-border-soft px-5 py-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Mastery
          </div>
          <h2 className="mt-0.5 font-display text-lg font-semibold tracking-tight text-text-primary">
            KC 숙련도
          </h2>
        </div>
        <ul className="space-y-2 px-5 py-3 text-[12px]">
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

      {/* Existing: Dependency */}
      <section className="mb-6 overflow-hidden rounded-xl border border-border-soft bg-surface">
        <div className="border-b border-border-soft px-5 py-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Teacher Only
          </div>
          <h2 className="mt-0.5 font-display text-lg font-semibold tracking-tight text-text-primary">
            Dependency Factor 이력
          </h2>
        </div>
        <div className="px-5 py-3">
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

      {/* Existing: Submissions with copy-paste flag integrated */}
      <section className="mb-6 overflow-hidden rounded-xl border border-border-soft bg-surface">
        <div className="border-b border-border-soft px-5 py-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Submissions
          </div>
          <h2 className="mt-0.5 font-display text-lg font-semibold tracking-tight text-text-primary">
            최근 제출
          </h2>
        </div>
        <div className="px-5 py-3">
          {student.recentSubmissions.length === 0 ? (
            <p className="text-[13px] text-text-secondary">제출 기록 없음.</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border-soft text-left text-[10px] uppercase tracking-wider text-neutral">
                  <th className="py-2 pr-4 font-medium">과제</th>
                  <th className="py-2 pr-4 font-medium">점수</th>
                  <th className="py-2 pr-4 font-medium">통과</th>
                  <th className="py-2 pr-4 font-medium">AI 응답 → 제출</th>
                  <th className="py-2 pr-4 font-medium">L3/L4</th>
                </tr>
              </thead>
              <tbody>
                {student.recentSubmissions.map((s, i) => {
                  const flag = copyPasteFlags.find(
                    (f) => f.assignmentId === s.assignmentId && f.submittedAt === s.submittedAt,
                  );
                  return (
                    <tr key={i} className="border-b border-border-soft last:border-0">
                      <td className="py-2 pr-4 font-mono text-text-primary">{s.assignmentId}</td>
                      <td className="py-2 pr-4 font-mono text-text-primary">
                        {s.finalScore?.toFixed(2) ?? "—"}
                      </td>
                      <td className={`py-2 pr-4 ${s.passed ? "text-success" : "text-error"}`}>
                        {s.passed ? "✓" : "✗"}
                      </td>
                      <td className="py-2 pr-4">
                        {flag?.gapSec != null ? (
                          <span
                            className={
                              flag.suspected
                                ? "inline-flex h-5 items-center rounded bg-error/10 px-1.5 font-mono text-[10px] font-medium text-error"
                                : "font-mono text-neutral"
                            }
                          >
                            {flag.suspected ? "🚩 " : ""}
                            {flag.gapSec}초
                          </span>
                        ) : (
                          <span className="text-neutral">—</span>
                        )}
                      </td>
                      <td className="py-2 font-mono text-text-secondary">{s.hintRequestsL3L4}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Conversation log (existing, preserved) */}
      <section className="mb-6 overflow-hidden rounded-xl border border-border-soft bg-surface">
        <div className="flex items-center justify-between border-b border-border-soft px-5 py-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
              Teacher Only · Privacy Sensitive
            </div>
            <h2 className="mt-0.5 font-display text-lg font-semibold tracking-tight text-text-primary">
              학생-AI 대화 로그
            </h2>
          </div>
          <span className="text-[11px] uppercase tracking-wider text-neutral">
            {turns.length}턴 · 10초 갱신
          </span>
        </div>
        <div className="max-h-[480px] overflow-auto px-5 py-3">
          {convLoading ? (
            <p className="text-[13px] text-text-secondary">대화 로그 불러오는 중…</p>
          ) : turns.length === 0 ? (
            <p className="text-[13px] text-text-secondary">
              아직 기록된 대화가 없어요. 학생이 채팅을 사용하면 실시간으로 나타납니다.
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
          <div className="border-b border-border-soft px-5 py-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
              Student Modeler
            </div>
            <h2 className="mt-0.5 font-display text-lg font-semibold tracking-tight text-text-primary">
              Misconceptions
            </h2>
          </div>
          <ul className="divide-y divide-border-soft px-5 py-2">
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

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-soft bg-surface">
      <div className="border-b border-border-soft px-4 py-2.5">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
          {title}
        </div>
        {subtitle && (
          <div className="mt-0.5 text-[11px] text-text-secondary">{subtitle}</div>
        )}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function Signal({
  label,
  value,
  invert,
  hint,
}: {
  label: string;
  value: number;
  invert?: boolean;
  hint?: string;
}) {
  const pct = Math.round(value * 100);
  const good = invert ? value < 0.15 : value >= 0.2;
  const bad = invert ? value >= 0.3 : value < 0.05;
  let color = "bg-border-soft";
  let text = "text-text-secondary";
  if (bad) {
    color = "bg-error";
    text = "text-error";
  } else if (good) {
    color = "bg-success";
    text = "text-success";
  } else {
    color = "bg-primary";
    text = "text-primary";
  }
  return (
    <div title={hint}>
      <div className="flex justify-between text-[11px]">
        <span className="text-text-primary">{label}</span>
        <span className={`font-mono ${text}`}>{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border-soft">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
