"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";

import type { DebugOutput, Hypothesis } from "@cvibe/agents";
import type { RunCResult } from "@cvibe/wasm-runtime";

// Monaco는 SSR 불가 — 클라이언트 전용 동적 로딩
const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="p-4 text-slate-500">에디터 불러오는 중…</div>,
});

const DEFAULT_CODE = `#include <stdio.h>

int main(void) {
    printf("Hello, CVibe!\\n");
    return 0;
}
`;

interface CEditorProps {
  /** 과제 시작 코드 (주어지면 학생 초기 버퍼로 사용). */
  starterCode?: string;
  /** 힌트 요청이 가능한 상태인지 — codeFirstGate에 쓰인다. */
  onCodeChange?: (code: string) => void;
  /** 실행 후 호출되어 Student Modeler에 이벤트 전송 등에 사용. */
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
    <section aria-label="editor-panel" className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b bg-slate-50 px-3 py-1.5 text-xs">
        <span>main.c</span>
        <button
          onClick={handleRun}
          disabled={running}
          className="rounded bg-slate-900 px-3 py-1 text-xs text-white disabled:opacity-60"
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
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
          theme="vs-dark"
        />
      </div>
      <div className="h-52 overflow-auto border-t bg-slate-50 p-3 font-mono text-xs text-slate-700">
        {result ? (
          <RunResultPanel
            result={result}
            debug={debug}
            debugging={debugging}
            onDebug={handleDebug}
          />
        ) : (
          <span className="text-slate-500">실행 결과가 여기에 표시돼요.</span>
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
    ? "text-rose-600"
    : result.executed
      ? "text-emerald-700"
      : "text-slate-600";
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className={`mb-1 font-semibold ${headerColor}`}>
          {result.errorType ? `[${result.errorType}]` : result.executed ? "정상 종료" : "미실행"}
          <span className="ml-2 text-slate-500">
            exit={result.exitCode ?? "—"} · {result.durationMs}ms
          </span>
        </div>
        {hasError && !debug && (
          <button
            onClick={onDebug}
            disabled={debugging}
            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700 disabled:opacity-60"
          >
            {debugging ? "분석 중…" : "왜 이 에러?"}
          </button>
        )}
      </div>
      {result.stdout && (
        <>
          <div className="text-slate-500">stdout</div>
          <pre className="whitespace-pre-wrap text-slate-800">{result.stdout}</pre>
        </>
      )}
      {result.stderr && (
        <>
          <div className="mt-1 text-rose-500">stderr</div>
          <pre className="whitespace-pre-wrap text-rose-700">{result.stderr}</pre>
        </>
      )}
      {debug && <DebugBlock debug={debug} />}
    </div>
  );
}

function DebugBlock({ debug }: { debug: DebugOutput }) {
  return (
    <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2">
      <div className="text-[11px] font-semibold text-amber-800">Runtime Debugger</div>
      <div className="mt-1 whitespace-pre-wrap text-slate-800">{debug.studentFacingMessage}</div>
      {debug.hypotheses.length > 0 && (
        <ol className="mt-2 list-decimal pl-4">
          {debug.hypotheses.map((h: Hypothesis, i: number) => (
            <li key={i} className="mb-1">
              <div className="text-slate-800">{h.cause}</div>
              <div className="text-slate-500">근거: {h.evidence}</div>
              <div className="italic text-slate-700">→ {h.investigationQuestion}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
