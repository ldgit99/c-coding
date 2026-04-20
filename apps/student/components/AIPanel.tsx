"use client";

import { useCallback, useState } from "react";

import type { Mode } from "./ModeSwitch";

interface Finding {
  id: string;
  severity: "blocker" | "major" | "minor" | "style";
  line: number;
  category: string;
  kc: string;
  message: string;
  suggestion: string;
  proposedCode?: string;
}

interface ReviewPayload {
  findings: Finding[];
  topIssues: string[];
  analysisMode: "lint+llm" | "llm-only";
  summary: string;
}

interface HintPayload {
  hintLevel: 1 | 2 | 3 | 4;
  hintType: string;
  message: string;
  relatedKC?: string[];
  requiresSelfExplanation?: boolean;
}

interface ChatResponse {
  intent: string;
  route: string;
  reason: string;
  hint?: HintPayload;
  review?: ReviewPayload;
  gating?: { grantedLevel: 1 | 2 | 3 | 4; failedConditions: string[]; fadedFrom?: number };
  usedModel?: string;
  mocked?: boolean;
  error?: string;
}

type Tab = "chat" | "hint" | "reflection" | "review";

interface AIPanelProps {
  editorCode: string;
  studentId: string;
  mode: Mode;
  assignmentCode?: string | null;
}

type HistoryEntry =
  | { kind: "text"; role: "student" | "ai"; text: string; meta?: string; level?: 1 | 2 | 3 | 4; requiresSelfExplanation?: boolean; accepted?: boolean }
  | { kind: "review"; review: ReviewPayload; meta?: string };

export function AIPanel({ editorCode, studentId, mode, assignmentCode }: AIPanelProps) {
  const [tab, setTab] = useState<Tab>("chat");
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [supportLevel, setSupportLevel] = useState<0 | 1 | 2 | 3>(0);
  const [selfExplainTarget, setSelfExplainTarget] = useState<number | null>(null);
  const [selfExplainText, setSelfExplainText] = useState("");

  const callChat = useCallback(
    async (utterance: string, opts: { requestedLevel?: 1 | 2 | 3 | 4 } = {}) => {
      const studentMsg = utterance || `Level ${opts.requestedLevel} 힌트 요청`;
      setHistory((h) => [...h, { kind: "text", role: "student", text: studentMsg }]);
      setLoading(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            utterance: studentMsg,
            sessionState: {
              studentId,
              supportLevel,
              mode,
              currentKC: [],
              learningSignals: {
                attemptCount: editorCode.length > 20 ? 1 : 0,
                errorTypes: [],
                repeatedErrorCount: 0,
                stagnationSec: 0,
                hintRequests: history.filter((h) => h.kind === "text" && h.role === "student").length,
                aiDependencyScore: 0,
              },
            },
            editorHasCode: editorCode.length > 20,
            editorCode,
            assignmentCode,
            requestedLevel: opts.requestedLevel,
          }),
        });
        const data = (await res.json()) as ChatResponse;
        applyChatResponse(data);
      } catch (err) {
        setHistory((h) => [...h, { kind: "text", role: "ai", text: `요청 실패: ${String(err)}` }]);
      } finally {
        setLoading(false);
        setInput("");
      }
    },
    [assignmentCode, editorCode, history, mode, studentId, supportLevel],
  );

  const applyChatResponse = useCallback((data: ChatResponse) => {
    if (data.hint) {
      const meta = data.mocked
        ? `[mock] L${data.hint.hintLevel} ${data.hint.hintType}`
        : `${data.usedModel} · L${data.hint.hintLevel} ${data.hint.hintType}`;
      const gatingNote =
        data.gating && data.gating.failedConditions.length > 0
          ? `\n(게이팅: ${data.gating.failedConditions[0]})`
          : "";
      setHistory((h) => [
        ...h,
        {
          kind: "text",
          role: "ai",
          text: data.hint!.message + gatingNote,
          meta,
          level: data.hint!.hintLevel,
          requiresSelfExplanation: data.hint!.requiresSelfExplanation,
          accepted: false,
        },
      ]);
      setSupportLevel((prev) => Math.max(prev, data.hint!.hintLevel) as 0 | 1 | 2 | 3);
    } else if (data.review) {
      const meta = data.mocked ? `[mock] ${data.review.analysisMode}` : `${data.usedModel} · ${data.review.analysisMode}`;
      setHistory((h) => [...h, { kind: "review", review: data.review!, meta }]);
    } else if (data.error) {
      setHistory((h) => [...h, { kind: "text", role: "ai", text: `[${data.route}] ${data.error}` }]);
    }
  }, []);

  const requestReview = useCallback(async () => {
    if (editorCode.trim().length === 0) {
      setHistory((h) => [...h, { kind: "text", role: "ai", text: "에디터에 코드를 먼저 작성해봐 — Navigator, not Driver 원칙이야." }]);
      return;
    }
    await callChat("이 코드 검토해줘");
  }, [callChat, editorCode]);

  const submitSelfExplanation = useCallback(async () => {
    if (selfExplainTarget === null) return;
    const text = selfExplainText.trim();
    if (text.length < 10) return;
    await fetch("/api/self-explanation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, text, level: 4 }),
    });
    setHistory((h) =>
      h.map((entry, i) =>
        i === selfExplainTarget && entry.kind === "text"
          ? { ...entry, accepted: true }
          : entry,
      ),
    );
    setSelfExplainTarget(null);
    setSelfExplainText("");
  }, [selfExplainTarget, selfExplainText, studentId]);

  return (
    <aside aria-label="ai-panel" className="flex h-full flex-col overflow-hidden">
      <div className="flex border-b bg-slate-50 text-xs">
        {(["chat", "hint", "reflection", "review"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-2 py-2 ${tab === t ? "bg-white font-semibold" : "text-slate-500"}`}
          >
            {tabLabel(t)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-3 text-sm">
        {history.length === 0 && (
          <p className="text-slate-500">
            코드를 한 번이라도 작성하거나 실행해야 도움을 요청할 수 있어요 — Navigator, not Driver.
          </p>
        )}
        {history.map((msg, i) =>
          msg.kind === "text" ? (
            <div key={i} className={`mb-3 ${msg.role === "student" ? "text-slate-900" : "text-slate-700"}`}>
              <div className="text-xs font-semibold text-slate-500">
                {msg.role === "student" ? "나" : "Pedagogy Coach"} {msg.meta && <span className="font-normal text-slate-400">· {msg.meta}</span>}
              </div>
              <div className="whitespace-pre-wrap">{msg.text}</div>
              {msg.role === "ai" && msg.requiresSelfExplanation && !msg.accepted && (
                <button
                  onClick={() => {
                    setSelfExplainTarget(i);
                    setSelfExplainText("");
                  }}
                  className="mt-2 rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-800"
                >
                  💭 이 예시를 내 코드에 반영하려면 → 자기 설명 필요
                </button>
              )}
              {msg.role === "ai" && msg.accepted && (
                <div className="mt-1 text-[11px] text-emerald-700">✓ 자기 설명 제출됨 · 수락됨</div>
              )}
            </div>
          ) : (
            <ReviewCard key={i} review={msg.review} meta={msg.meta} />
          ),
        )}
        {loading && <div className="text-slate-400">생각 중…</div>}
      </div>

      {tab === "hint" && (
        <div className="border-t bg-slate-50 p-2">
          <div className="mb-2 text-xs text-slate-600">계단식 힌트 요청 (게이팅이 실제 레벨을 결정)</div>
          <div className="flex gap-1 text-xs">
            {([1, 2, 3, 4] as const).map((lvl) => (
              <button
                key={lvl}
                disabled={loading}
                onClick={() => void callChat("", { requestedLevel: lvl })}
                className="flex-1 rounded border bg-white px-2 py-1 disabled:opacity-50"
              >
                L{lvl}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "review" && (
        <div className="border-t bg-slate-50 p-2">
          <button
            onClick={() => void requestReview()}
            disabled={loading}
            className="w-full rounded bg-slate-900 px-3 py-1.5 text-xs text-white disabled:opacity-60"
          >
            현재 코드 검토 요청
          </button>
        </div>
      )}

      <div className="border-t bg-white p-2">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void callChat(input);
              }
            }}
            placeholder="질문 또는 힌트 요청…"
            className="flex-1 rounded border px-2 py-1 text-sm"
            disabled={loading}
          />
          <button
            onClick={() => void callChat(input)}
            disabled={loading || !input.trim()}
            className="rounded bg-slate-900 px-3 text-xs text-white disabled:opacity-60"
          >
            보내기
          </button>
        </div>
      </div>

      {selfExplainTarget !== null && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded bg-white p-4 shadow-lg">
            <h3 className="text-sm font-semibold">자기 설명 — 왜 이 수정이 필요한가?</h3>
            <p className="mt-1 text-xs text-slate-600">
              research.md §3.1 — AI 제안을 수락하기 전 1~2문장으로 이유를 적어주세요. 메타인지 훈련의 핵심이에요.
            </p>
            <textarea
              autoFocus
              value={selfExplainText}
              onChange={(e) => setSelfExplainText(e.target.value)}
              className="mt-2 w-full rounded border p-2 text-sm"
              rows={4}
              placeholder="예: 현재 내 코드는 ‥인데 AI의 제안이 ‥를 고쳐서 ‥가 맞아진다고 이해했다"
            />
            <div className="mt-1 text-[11px] text-slate-500">
              {selfExplainText.trim().length}자 (최소 10자)
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setSelfExplainTarget(null);
                  setSelfExplainText("");
                }}
                className="rounded border px-3 py-1 text-xs"
              >
                취소
              </button>
              <button
                onClick={() => void submitSelfExplanation()}
                disabled={selfExplainText.trim().length < 10}
                className="rounded bg-slate-900 px-3 py-1 text-xs text-white disabled:opacity-50"
              >
                제출하고 수락
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function ReviewCard({ review, meta }: { review: ReviewPayload; meta?: string }) {
  const top = review.findings.filter((f) => review.topIssues.includes(f.id));
  const rest = review.findings.filter((f) => !review.topIssues.includes(f.id));
  return (
    <div className="mb-3 rounded border border-slate-200 bg-white p-2">
      <div className="text-xs font-semibold text-slate-500">
        Code Reviewer {meta && <span className="font-normal text-slate-400">· {meta}</span>}
      </div>
      <div className="mt-1 text-xs text-slate-700">{review.summary}</div>
      {top.length === 0 && rest.length === 0 && (
        <div className="mt-2 text-xs text-slate-500">눈에 띄는 이슈 없음.</div>
      )}
      {top.map((f) => (
        <FindingItem key={f.id} finding={f} highlight />
      ))}
      {rest.length > 0 && (
        <details className="mt-1 text-xs">
          <summary className="cursor-pointer text-slate-500">추가 이슈 {rest.length}건</summary>
          {rest.map((f) => (
            <FindingItem key={f.id} finding={f} />
          ))}
        </details>
      )}
    </div>
  );
}

function FindingItem({ finding, highlight }: { finding: Finding; highlight?: boolean }) {
  const color =
    finding.severity === "blocker"
      ? "text-rose-700"
      : finding.severity === "major"
        ? "text-amber-700"
        : "text-slate-700";
  return (
    <div className={`mt-2 rounded ${highlight ? "bg-rose-50 p-2" : "px-1 py-1"}`}>
      <div className={`text-xs font-semibold ${color}`}>
        [{finding.severity}] line {finding.line} · {finding.category} · {finding.kc}
      </div>
      <div className="mt-1 text-xs text-slate-800">{finding.message}</div>
      <div className="mt-1 text-xs italic text-slate-600">{finding.suggestion}</div>
      {finding.proposedCode && (
        <pre className="mt-1 overflow-auto rounded bg-slate-900 p-2 font-mono text-[11px] text-slate-100">
          {finding.proposedCode}
        </pre>
      )}
    </div>
  );
}

function tabLabel(t: Tab): string {
  switch (t) {
    case "chat":
      return "대화";
    case "hint":
      return "힌트";
    case "reflection":
      return "리플렉션";
    case "review":
      return "코드리뷰";
  }
}
