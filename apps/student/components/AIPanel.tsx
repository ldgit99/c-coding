"use client";

import { useCallback, useState } from "react";

interface HintResponse {
  intent: string;
  route: string;
  reason: string;
  hint?: {
    hintLevel: 1 | 2 | 3 | 4;
    hintType: string;
    message: string;
    relatedKC?: string[];
    requiresSelfExplanation?: boolean;
  };
  gating?: {
    grantedLevel: 1 | 2 | 3 | 4;
    failedConditions: string[];
    fadedFrom?: number;
  };
  usedModel?: string;
  mocked?: boolean;
  error?: string;
}

type Tab = "chat" | "hint" | "reflection" | "review";

interface AIPanelProps {
  editorCode: string;
  studentId: string;
}

export function AIPanel({ editorCode, studentId }: AIPanelProps) {
  const [tab, setTab] = useState<Tab>("chat");
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<Array<{ role: "student" | "ai"; text: string; meta?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [supportLevel, setSupportLevel] = useState<0 | 1 | 2 | 3>(0);

  const send = useCallback(
    async (utterance: string, requestedLevel?: 1 | 2 | 3 | 4) => {
      if (!utterance.trim() && !requestedLevel) return;
      setLoading(true);
      const studentMsg = utterance || `Level ${requestedLevel} 힌트 요청`;
      setHistory((h) => [...h, { role: "student", text: studentMsg }]);

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
                hintRequests: history.filter((h) => h.role === "student").length,
                aiDependencyScore: 0,
              },
            },
            editorHasCode: editorCode.length > 20,
            requestedLevel,
          }),
        });
        const data = (await res.json()) as HintResponse;
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
            { role: "ai", text: data.hint!.message + gatingNote, meta },
          ]);
          setSupportLevel(Math.max(supportLevel, data.hint.hintLevel) as 0 | 1 | 2 | 3);
        } else if (data.error) {
          setHistory((h) => [...h, { role: "ai", text: `[${data.route}] ${data.error}` }]);
        }
      } catch (err) {
        setHistory((h) => [...h, { role: "ai", text: `요청 실패: ${String(err)}` }]);
      } finally {
        setLoading(false);
        setInput("");
      }
    },
    [editorCode, history, studentId, supportLevel],
  );

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
        {history.map((msg, i) => (
          <div key={i} className={`mb-3 ${msg.role === "student" ? "text-slate-900" : "text-slate-700"}`}>
            <div className="text-xs font-semibold text-slate-500">
              {msg.role === "student" ? "나" : "Pedagogy Coach"} {msg.meta && <span className="font-normal text-slate-400">· {msg.meta}</span>}
            </div>
            <div className="whitespace-pre-wrap">{msg.text}</div>
          </div>
        ))}
        {loading && <div className="text-slate-400">생각 중…</div>}
      </div>

      {tab === "hint" && (
        <div className="border-t bg-slate-50 p-2">
          <div className="mb-2 text-xs text-slate-600">계단식 힌트 요청 (게이팅 규칙이 실제 레벨을 결정)</div>
          <div className="flex gap-1 text-xs">
            {([1, 2, 3, 4] as const).map((lvl) => (
              <button
                key={lvl}
                disabled={loading}
                onClick={() => send("", lvl)}
                className="flex-1 rounded border bg-white px-2 py-1 disabled:opacity-50"
              >
                L{lvl}
              </button>
            ))}
          </div>
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
                void send(input);
              }
            }}
            placeholder="질문 또는 힌트 요청…"
            className="flex-1 rounded border px-2 py-1 text-sm"
            disabled={loading}
          />
          <button
            onClick={() => void send(input)}
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
