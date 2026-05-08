"use client";

import { useEffect, useState } from "react";

interface SubmissionDetail {
  id: string;
  code: string;
  finalScore: number | null;
  status: string;
  rubricScores: Record<string, unknown> | null;
  evidence: Record<string, unknown> | null;
  reflection: Record<string, string> | null;
  submittedAt: string | null;
  evaluatedAt: string | null;
}

interface AiAnalysis {
  id: number;
  kind: "code-review" | "runtime-debug";
  timestamp: string;
  result: Record<string, unknown> | null;
}

interface ConversationTurn {
  id: string;
  role: "student" | "ai";
  text: string;
  createdAt: string;
  meta: Record<string, unknown> | null;
}

interface ApiResponse {
  source: "supabase" | "demo";
  submissions: SubmissionDetail[];
  aiAnalyses?: AiAnalysis[];
  conversation?: ConversationTurn[];
  reflectionPrompts?: string[];
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
  const [tab, setTab] = useState<"code" | "ai" | "chat" | "reflection">("code");

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
  const aiAnalyses = data?.aiAnalyses ?? [];
  const conversation = data?.conversation ?? [];
  const reflectionPrompts = data?.reflectionPrompts ?? [];
  const active = submissions[activeIdx] ?? null;
  const reflectionEntries = active?.reflection
    ? Object.entries(active.reflection).filter(([, v]) => typeof v === "string" && v.trim().length > 0)
    : [];

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

          {/* 오른쪽 — 탭: 코드 / AI 분석 */}
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

            {/* 탭 헤더 */}
            <div className="flex border-b border-border-soft bg-bg">
              <TabButton
                active={tab === "code"}
                onClick={() => setTab("code")}
                label="코드"
                count={submissions.length}
              />
              <TabButton
                active={tab === "ai"}
                onClick={() => setTab("ai")}
                label="AI 분석"
                count={aiAnalyses.length}
              />
              <TabButton
                active={tab === "chat"}
                onClick={() => setTab("chat")}
                label="대화"
                count={conversation.length}
              />
              <TabButton
                active={tab === "reflection"}
                onClick={() => setTab("reflection")}
                label="성찰"
                count={reflectionEntries.length}
              />
            </div>

            {tab === "code" && (
              active ? (
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
                  {active.evidence && (
                    <EvidenceStrip evidence={active.evidence} />
                  )}
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
              )
            )}

            {tab === "ai" && (
              <div className="flex-1 overflow-auto">
                {aiAnalyses.length === 0 ? (
                  !loading && (
                    <div className="flex h-full items-center justify-center px-6 text-center text-[12px] text-neutral">
                      이 학생 × 과제에서 기록된 AI 분석이 없습니다.
                      <br />
                      (Code Reviewer · Runtime Debugger 호출 시 자동 기록됨)
                    </div>
                  )
                ) : (
                  <ul className="divide-y divide-border-soft">
                    {aiAnalyses.map((a) => (
                      <AnalysisItem key={a.id} analysis={a} />
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === "chat" && (
              <div className="flex-1 overflow-auto bg-bg">
                {conversation.length === 0 ? (
                  !loading && (
                    <div className="flex h-full items-center justify-center px-6 text-center text-[12px] text-neutral">
                      이 학생 × 과제에서 기록된 AI 챗봇 대화가 없습니다.
                    </div>
                  )
                ) : (
                  <ul className="space-y-2 px-4 py-3">
                    {conversation.map((t) => (
                      <ChatBubble key={t.id} turn={t} />
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === "reflection" && (
              active ? (
                <div className="flex-1 overflow-auto bg-bg">
                  {reflectionEntries.length === 0 ? (
                    !loading && (
                      <div className="flex h-full items-center justify-center px-6 text-center text-[12px] text-neutral">
                        이 제출에는 성찰일지 응답이 없습니다.
                      </div>
                    )
                  ) : (
                    <div className="space-y-3 px-4 py-3">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-neutral">
                        <span>제출 #{submissions.length - activeIdx}</span>
                        <span>·</span>
                        <span>{formatTime(active.submittedAt)}</span>
                      </div>
                      <ReflectionList
                        reflection={active.reflection ?? {}}
                        prompts={reflectionPrompts}
                      />
                    </div>
                  )}
                </div>
              ) : (
                !loading && (
                  <div className="flex flex-1 items-center justify-center text-[12px] text-neutral">
                    표시할 제출이 없습니다.
                  </div>
                )
              )
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 text-[12px] transition-colors ${
        active
          ? "border-b-2 border-primary bg-surface font-semibold text-text-primary"
          : "text-text-secondary hover:bg-surface"
      }`}
    >
      {label}
      <span
        className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
          active ? "bg-primary/15 text-primary" : "bg-bg text-neutral"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function AnalysisItem({ analysis }: { analysis: AiAnalysis }) {
  const [expanded, setExpanded] = useState(false);
  const result = analysis.result ?? {};
  const isReview = analysis.kind === "code-review";
  const summary =
    (typeof result.summary === "string" ? result.summary : "") ||
    (typeof result.studentFacingMessage === "string" ? result.studentFacingMessage : "") ||
    "";
  const findings = Array.isArray(result.findings) ? (result.findings as Array<Record<string, unknown>>) : [];
  const hypotheses = Array.isArray(result.hypotheses) ? (result.hypotheses as Array<Record<string, unknown>>) : [];
  const usedModel = typeof result.usedModel === "string" ? result.usedModel : "?";
  const triggeredBy = typeof result.triggeredBy === "string" ? result.triggeredBy : null;
  const errorType = typeof result.errorType === "string" ? result.errorType : null;

  return (
    <li className="px-4 py-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 text-left"
      >
        <span
          className={`mt-0.5 inline-flex h-5 shrink-0 items-center rounded px-1.5 font-mono text-[10px] font-semibold ${
            isReview ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning"
          }`}
        >
          {isReview ? "🔍 review" : "🐛 debug"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2 text-[11px] text-text-secondary">
            <span className="font-mono text-text-primary">{formatTime(analysis.timestamp)}</span>
            {triggeredBy && (
              <span className="rounded bg-bg px-1.5 py-0.5 font-mono text-[10px]">
                {triggeredBy}
              </span>
            )}
            {errorType && (
              <span className="rounded bg-error/10 px-1.5 py-0.5 font-mono text-[10px] text-error">
                {errorType}
              </span>
            )}
            <span className="text-neutral">·</span>
            <span className="font-mono text-[10px] text-neutral">{usedModel}</span>
          </div>
          {summary && (
            <p className="mt-1 line-clamp-2 text-[12px] text-text-primary">{summary}</p>
          )}
          <div className="mt-1 text-[11px] text-text-secondary">
            {isReview
              ? `findings ${findings.length}건${expanded ? "" : " — 클릭하여 펼치기"}`
              : `hypotheses ${hypotheses.length}건${expanded ? "" : " — 클릭하여 펼치기"}`}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-2 rounded-md border border-border-soft bg-bg p-3 text-[11px]">
          {summary && (
            <p className="mb-2 whitespace-pre-wrap text-text-primary">{summary}</p>
          )}
          {isReview && findings.length > 0 && (
            <ul className="space-y-2">
              {findings.map((f, i) => (
                <li key={i} className="rounded border border-border-soft bg-surface p-2">
                  <div className="flex flex-wrap items-baseline gap-2 text-[10px]">
                    <SeverityBadge severity={String(f.severity ?? "")} />
                    <span className="font-mono text-neutral">L{String(f.line ?? "?")}</span>
                    <span className="rounded bg-bg px-1.5 py-0.5 font-mono">
                      {String(f.category ?? "")}
                    </span>
                    {Boolean(f.kc) && (
                      <span className="rounded bg-bg px-1.5 py-0.5 font-mono text-primary">
                        {String(f.kc)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-text-primary">
                    {String(f.message ?? "")}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {!isReview && hypotheses.length > 0 && (
            <ol className="space-y-2 pl-4 list-decimal">
              {hypotheses.map((h, i) => (
                <li key={i} className="rounded border border-border-soft bg-surface p-2">
                  <p className="whitespace-pre-wrap text-text-primary">
                    <span className="font-semibold">원인:</span> {String(h.cause ?? "")}
                  </p>
                  {Boolean(h.evidence) && (
                    <p className="mt-1 whitespace-pre-wrap text-text-secondary">
                      <span className="font-semibold">근거:</span> {String(h.evidence)}
                    </p>
                  )}
                  {Boolean(h.investigationQuestion) && (
                    <p className="mt-1 whitespace-pre-wrap text-text-secondary">
                      <span className="font-semibold">진단 질문:</span>{" "}
                      {String(h.investigationQuestion)}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </li>
  );
}

function EvidenceStrip({ evidence }: { evidence: Record<string, unknown> }) {
  const hiddenTests = Array.isArray(evidence.hiddenTests)
    ? (evidence.hiddenTests as Array<{ id: number; passed: boolean }>)
    : [];
  const hiddenPassed = typeof evidence.hiddenPassed === "number"
    ? (evidence.hiddenPassed as number)
    : null;
  const hiddenTotal = typeof evidence.hiddenTotal === "number"
    ? (evidence.hiddenTotal as number)
    : null;
  if (hiddenTests.length === 0) return null;
  return (
    <div className="border-b border-border-soft bg-surface px-4 py-2">
      <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-neutral">
        Hidden Tests
        {hiddenPassed != null && hiddenTotal != null && (
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
              hiddenPassed === hiddenTotal
                ? "bg-success/15 text-success"
                : "bg-warning/15 text-warning"
            }`}
          >
            {hiddenPassed}/{hiddenTotal}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {hiddenTests.map((t) => (
          <span
            key={t.id}
            title={`테스트 #${t.id} ${t.passed ? "통과" : "실패"}`}
            className={`inline-flex h-5 min-w-[28px] items-center justify-center rounded font-mono text-[10px] font-semibold ${
              t.passed
                ? "bg-success/15 text-success"
                : "bg-error/10 text-error"
            }`}
          >
            #{t.id} {t.passed ? "✓" : "✗"}
          </span>
        ))}
      </div>
    </div>
  );
}

function ChatBubble({ turn }: { turn: ConversationTurn }) {
  const isStudent = turn.role === "student";
  const meta = turn.meta ?? {};
  const mode =
    typeof meta.mode === "string" ? (meta.mode as string) : null;
  const supportLevel =
    typeof meta.supportLevel === "number"
      ? (meta.supportLevel as number)
      : null;
  return (
    <li
      className={`flex w-full ${isStudent ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[78%] rounded-lg border px-3 py-2 text-[12px] ${
          isStudent
            ? "border-primary/30 bg-primary/5 text-text-primary"
            : "border-border-soft bg-surface text-text-primary"
        }`}
      >
        <div className="mb-1 flex flex-wrap items-baseline gap-2 text-[10px] text-neutral">
          <span
            className={`rounded px-1.5 py-0.5 font-mono font-semibold ${
              isStudent
                ? "bg-primary/15 text-primary"
                : "bg-warning/15 text-warning"
            }`}
          >
            {isStudent ? "🧑 학생" : "🤖 AI"}
          </span>
          <span className="font-mono text-text-secondary">
            {formatTime(turn.createdAt)}
          </span>
          {mode && (
            <span className="rounded bg-bg px-1.5 py-0.5 font-mono">
              {mode}
            </span>
          )}
          {supportLevel != null && (
            <span className="rounded bg-bg px-1.5 py-0.5 font-mono">
              L{supportLevel}
            </span>
          )}
        </div>
        <p className="whitespace-pre-wrap break-words leading-relaxed">
          {turn.text}
        </p>
      </div>
    </li>
  );
}

function ReflectionList({
  reflection,
  prompts,
}: {
  reflection: Record<string, string>;
  prompts: string[];
}) {
  // 학생 SubmitDialog 의 ReflectionState 키 순서: Q1_difficult → Q3_alternatives → Q5_next_time
  // assignments.reflection_prompts(string[]) 와 1:1 대응. 키 정렬은 라벨 순서 안정성을 위해
  // 학번처럼 보이는 prefix(Q1/Q3/Q5) 를 우선시하고 모르는 키는 뒤로.
  const orderedKeys = Object.keys(reflection).sort((a, b) => {
    const matchA = a.match(/^Q(\d+)/);
    const matchB = b.match(/^Q(\d+)/);
    const numA = matchA ? Number(matchA[1]) : 99;
    const numB = matchB ? Number(matchB[1]) : 99;
    return numA - numB;
  });

  return (
    <ul className="space-y-3">
      {orderedKeys.map((key, idx) => {
        const answer = reflection[key]?.trim() ?? "";
        if (answer.length === 0) return null;
        const promptText = prompts[idx] ?? "";
        const labelMatch = key.match(/^Q(\d+)/);
        const label = labelMatch ? `Q${labelMatch[1]}` : key;
        return (
          <li
            key={key}
            className="rounded-lg border border-border-soft bg-surface p-4"
          >
            <div className="mb-2 flex items-baseline gap-2">
              <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                {label}
              </span>
              {promptText && (
                <span className="text-[12px] font-medium text-text-primary">
                  {promptText}
                </span>
              )}
            </div>
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-text-primary">
              {answer}
            </p>
            <div className="mt-2 text-[10px] text-neutral">
              {answer.length} 자
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    blocker: "bg-error/15 text-error",
    major: "bg-warning/15 text-warning",
    minor: "bg-bg text-text-secondary",
    style: "bg-primary/10 text-primary",
  };
  const cls = map[severity] ?? "bg-bg text-neutral";
  return (
    <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${cls}`}>
      {severity || "?"}
    </span>
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
