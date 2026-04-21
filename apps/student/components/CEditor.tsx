"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";

import type { DebugOutput, Hypothesis } from "@cvibe/agents";
import type { RunCResult } from "@cvibe/wasm-runtime";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="p-6 text-[13px] text-text-secondary">에디터 불러오는 중…</div>,
});

const DEFAULT_CODE = `#include <stdio.h>

int main(void) {
    printf("Hello, CVibe!\\n");
    return 0;
}
`;

interface CEditorProps {
  starterCode?: string;
  onCodeChange?: (code: string) => void;
  onRunComplete?: (result: RunCResult) => void;
}

export function CEditor({ starterCode, onCodeChange, onRunComplete }: CEditorProps) {
  const [code, setCode] = useState(starterCode ?? DEFAULT_CODE);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunCResult | null>(null);
  const [debug, setDebug] = useState<DebugOutput | null>(null);
  const [debugging, setDebugging] = useState(false);

  const handleChange = useCallback(
    (value: string | undefined) => {
      const next = value ?? "";
      setCode(next);
      onCodeChange?.(next);
    },
    [onCodeChange],
  );

  const handleRun = useCallback(async () => {
    setRunning(true);
    setDebug(null);
    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, stdin: "" }),
      });
      const json = (await response.json()) as RunCResult;
      setResult(json);
      onRunComplete?.(json);
    } catch (err) {
      const fallback: RunCResult = {
        executed: false,
        exitCode: null,
        stdout: "",
        stderr: String(err),
        durationMs: 0,
        errorType: "environment",
      };
      setResult(fallback);
      onRunComplete?.(fallback);
    } finally {
      setRunning(false);
    }
  }, [code, onRunComplete]);

  const handleDebug = useCallback(async () => {
    if (!result) return;
    setDebugging(true);
    try {
      const response = await fetch("/api/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, runResult: result }),
      });
      const json = (await response.json()) as { debug: DebugOutput };
      setDebug(json.debug);
    } catch (err) {
      setDebug({
        errorType: "environment",
        hypotheses: [],
        studentFacingMessage: `디버거 호출 실패: ${String(err)}`,
        stateDelta: { errorTypes: ["debugger-fail"], repeatedErrorCount: 0 },
      });
    } finally {
      setDebugging(false);
    }
  }, [code, result]);

  return (
    <section aria-label="editor-panel" className="flex h-full flex-col bg-surface">
      <div className="flex items-center justify-between border-b border-border-soft px-4 py-2.5">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[12px] text-text-primary">main.c</span>
          <span className="text-[10px] uppercase tracking-wider text-neutral">C99</span>
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="inline-flex h-7 items-center rounded-md bg-primary px-3 text-[11px] font-medium text-white transition-all hover:-translate-y-px hover:bg-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          {running ? "실행 중…" : "▶ 실행"}
        </button>
      </div>
      <div className="flex-1">
        <Editor
          language="c"
          value={code}
          onChange={handleChange}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "JetBrains Mono, ui-monospace, monospace",
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
          theme="vs-dark"
        />
      </div>
      <div className="h-56 overflow-auto border-t border-border-soft bg-bg p-4 font-mono text-[11px] text-text-primary">
        {result ? (
          <RunResultPanel
            result={result}
            debug={debug}
            debugging={debugging}
            onDebug={handleDebug}
          />
        ) : (
          <span className="text-neutral">실행 결과가 여기에 표시돼요.</span>
        )}
      </div>
    </section>
  );
}

function RunResultPanel({
  result,
  debug,
  debugging,
  onDebug,
}: {
  result: RunCResult;
  debug: DebugOutput | null;
  debugging: boolean;
  onDebug: () => void;
}) {
  const hasError = result.errorType !== undefined || (result.executed && result.exitCode !== 0);
  const headerColor = result.errorType
    ? "text-error"
    : result.executed
      ? "text-success"
      : "text-text-secondary";
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className={`font-medium ${headerColor}`}>
          {result.errorType ? `[${result.errorType}]` : result.executed ? "정상 종료" : "미실행"}
          <span className="ml-2 text-neutral">
            exit={result.exitCode ?? "—"} · {result.durationMs}ms
          </span>
        </div>
        {hasError && !debug && (
          <button
            onClick={onDebug}
            disabled={debugging}
            className="rounded-md border border-border-soft bg-white px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-secondary transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
          >
            {debugging ? "분석 중…" : "왜 이 에러?"}
          </button>
        )}
      </div>
      {result.stdout && (
        <>
          <div className="mt-2 text-[10px] uppercase tracking-wider text-neutral">stdout</div>
          <pre className="mt-0.5 whitespace-pre-wrap text-text-primary">{result.stdout}</pre>
        </>
      )}
      {result.stderr && (
        <>
          <div className="mt-2 text-[10px] uppercase tracking-wider text-error">stderr</div>
          <pre className="mt-0.5 whitespace-pre-wrap text-error">{result.stderr}</pre>
        </>
      )}
      {debug && <DebugBlock debug={debug} />}
    </div>
  );
}

function DebugBlock({ debug }: { debug: DebugOutput }) {
  return (
    <div className="mt-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-warning">
        Runtime Debugger
      </div>
      <div className="mt-1 whitespace-pre-wrap text-text-primary">{debug.studentFacingMessage}</div>
      {debug.hypotheses.length > 0 && (
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          {debug.hypotheses.map((h: Hypothesis, i: number) => (
            <li key={i}>
              <div className="text-text-primary">{h.cause}</div>
              <div className="text-neutral">근거 · {h.evidence}</div>
              <div className="italic text-text-secondary">→ {h.investigationQuestion}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
