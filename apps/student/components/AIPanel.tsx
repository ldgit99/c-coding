"use client";

import { useCallback, useState } from "react";

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
}

type HistoryEntry =
  | { kind: "text"; role: "student" | "ai"; text: string; meta?: string }
  | { kind: "review"; review: ReviewPayload; meta?: string };

export function AIPanel({ editorCode, studentId }: AIPanelProps) {
  const [tab, setTab] = useState<Tab>("chat");
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [supportLevel, setSupportLevel] = useState<0 | 1 | 2 | 3>(0);

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
              mode: "pair",
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
    [editorCode, history, studentId, supportLevel],
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
      setHistory((h) => [...h, { kind: "text", role: "ai", text: data.hint!.message + gatingNote, meta }]);
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
