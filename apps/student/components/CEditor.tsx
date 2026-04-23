"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DebugOutput, Hypothesis } from "@cvibe/agents";
import type { RunCResult } from "@cvibe/wasm-runtime";

export interface EditorFocus {
  line: number;
  column?: number;
  selectionText?: string;
}

export interface VisibleTestExample {
  input: string;
  expected: string;
  note?: string;
}

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
  /** 커서·선택 영역 변화를 상위(AIPanel)로 전달 — 튜터 맥락 인지용. */
  onFocusChange?: (focus: EditorFocus | null) => void;
  /** stdin 입력란 저장 key — 과제별 분리. 없으면 generic. */
  assignmentCode?: string | null;
  /** 예제 불러오기 드롭다운 — 과제의 visibleTests. 없으면 드롭다운 숨김. */
  visibleTests?: VisibleTestExample[];
}

const SCANF_RE = /\bscanf\s*\(|\bgets\s*\(|\bgetchar\s*\(|\bfgets\s*\(/;

export function CEditor({
  starterCode,
  onCodeChange,
  onRunComplete,
  onFocusChange,
  assignmentCode,
  visibleTests = [],
}: CEditorProps) {
  const [code, setCode] = useState(starterCode ?? DEFAULT_CODE);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunCResult | null>(null);
  const [debug, setDebug] = useState<DebugOutput | null>(null);
  const [debugging, setDebugging] = useState(false);
  const [stdin, setStdin] = useState("");
  const [stdinOpen, setStdinOpen] = useState(false);
  const editorRef = useRef<unknown>(null);

  const needsInput = useMemo(() => SCANF_RE.test(code), [code]);

  const stdinKey = useMemo(
    () => (assignmentCode ? `cvibe.student.stdin.${assignmentCode}` : null),
    [assignmentCode],
  );

  // 과제 전환·마운트 시 stdin 복원 + scanf 있으면 자동 펼침
  useEffect(() => {
    let restored = "";
    if (stdinKey) {
      try {
        restored = localStorage.getItem(stdinKey) ?? "";
      } catch {
        // ignore
      }
    }
    setStdin(restored);
    // starterCode 에 scanf 류가 있으면 자동 펼침, 없으면 접힘
    setStdinOpen(SCANF_RE.test(starterCode ?? "") || restored.length > 0);
  }, [stdinKey, starterCode]);

  // stdin 변경 시 저장 (과제별 key)
  useEffect(() => {
    if (!stdinKey) return;
    try {
      if (stdin.length === 0) {
        localStorage.removeItem(stdinKey);
      } else {
        localStorage.setItem(stdinKey, stdin);
      }
    } catch {
      // ignore
    }
  }, [stdin, stdinKey]);

  const handleChange = useCallback(
    (value: string | undefined) => {
      const next = value ?? "";
      setCode(next);
      onCodeChange?.(next);
    },
    [onCodeChange],
  );

  const handleMount = useCallback(
    (editor: unknown) => {
      editorRef.current = editor;
      if (!onFocusChange) return;
      const e = editor as {
        onDidChangeCursorPosition: (cb: (ev: { position: { lineNumber: number; column: number } }) => void) => void;
        onDidChangeCursorSelection: (cb: (ev: { selection: unknown }) => void) => void;
        getSelection: () => unknown;
        getModel: () => { getValueInRange: (sel: unknown) => string } | null;
        getPosition: () => { lineNumber: number; column: number } | null;
      };
      const report = () => {
        const pos = e.getPosition();
        const model = e.getModel();
        const sel = e.getSelection();
        let selectionText: string | undefined;
        if (model && sel) {
          try {
            const text = model.getValueInRange(sel);
            if (text && text.trim().length > 0) selectionText = text.slice(0, 300);
          } catch {
            // ignore
          }
        }
        if (pos) {
          onFocusChange({ line: pos.lineNumber, column: pos.column, selectionText });
        }
      };
      e.onDidChangeCursorPosition(report);
      e.onDidChangeCursorSelection(report);
      report();
    },
    [onFocusChange],
  );

  const handleRun = useCallback(async () => {
    setRunning(true);
    setDebug(null);
    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, stdin }),
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
  }, [code, stdin, onRunComplete]);

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
        <div className="flex items-center gap-2">
          {needsInput && stdin.trim().length === 0 && (
            <button
              type="button"
              onClick={() => setStdinOpen(true)}
              className="inline-flex h-7 items-center rounded-md border border-warning/30 bg-warning/10 px-2 text-[10px] font-medium text-warning transition-colors hover:bg-warning/20"
              title="scanf 가 있는데 stdin 이 비어 있어요. 클릭하면 입력란이 펼쳐집니다."
            >
              ⚠ 입력값 비어있음
            </button>
          )}
          <button
            onClick={handleRun}
            disabled={running}
            className="inline-flex h-7 items-center rounded-md bg-primary px-3 text-[11px] font-medium text-white transition-all hover:-translate-y-px hover:bg-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            {running ? "실행 중…" : "▶ 실행"}
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          language="c"
          value={code}
          onChange={handleChange}
          onMount={handleMount}
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

      {/* stdin 입력 영역 — scanf 있는 과제에서 입력값 주입 */}
      <StdinSection
        value={stdin}
        onChange={setStdin}
        open={stdinOpen}
        onToggle={() => setStdinOpen((v) => !v)}
        needsInput={needsInput}
        visibleTests={visibleTests}
      />

      <div className="h-44 overflow-auto border-t border-border-soft bg-bg p-4 font-mono text-[11px] text-text-primary">
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

function StdinSection({
  value,
  onChange,
  open,
  onToggle,
  needsInput,
  visibleTests,
}: {
  value: string;
  onChange: (v: string) => void;
  open: boolean;
  onToggle: () => void;
  needsInput: boolean;
  visibleTests: VisibleTestExample[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const lineCount = value.length === 0 ? 0 : value.split("\n").length;
  const previewLabel =
    lineCount === 0 ? "(비어있음)" : `${lineCount}줄 저장됨`;

  return (
    <div className="shrink-0 border-t border-border-soft bg-surface">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-[11px] hover:bg-bg"
      >
        <span className="text-[10px] text-neutral">{open ? "▾" : "▸"}</span>
        <span className="font-medium text-text-primary">📥 표준 입력 (stdin)</span>
        <span className="text-text-secondary">· {previewLabel}</span>
        {needsInput && lineCount === 0 && (
          <span className="ml-auto rounded-sm bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
            scanf 있음
          </span>
        )}
      </button>
      {open && (
        <div className="border-t border-border-soft px-4 pb-3 pt-2">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[10px] text-neutral">
              한 줄씩 엔터로 구분 · scanf 가 위에서부터 읽어요
            </span>
            {visibleTests.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="inline-flex h-6 items-center rounded-md border border-border-soft bg-white px-2 text-[10px] font-medium text-text-secondary hover:border-primary hover:text-primary"
                >
                  예제 불러오기 ▾
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-md border border-border-soft bg-surface shadow-card">
                    <ul className="max-h-60 overflow-auto p-1 text-[11px]">
                      {visibleTests.map((t, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            onClick={() => {
                              onChange(t.input ?? "");
                              setMenuOpen(false);
                            }}
                            className="block w-full rounded px-2 py-1.5 text-left hover:bg-bg"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-text-primary">
                                예제 {i + 1}
                              </span>
                              {t.note && (
                                <span className="ml-2 truncate text-[10px] text-neutral">
                                  {t.note}
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 truncate font-mono text-[10px] text-text-secondary">
                              {t.input.length > 0 ? t.input.replace(/\n/g, "⏎ ") : "(입력 없음)"}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="실행 시 프로그램에 전달할 입력 (예: 3\n1 2 3)"
            rows={4}
            spellCheck={false}
            className="w-full resize-y rounded-md border border-border-soft bg-white px-2.5 py-1.5 font-mono text-[12px] text-text-primary placeholder:text-neutral focus:border-primary focus:outline-none focus:shadow-ring"
          />
        </div>
      )}
    </div>
  );
}
