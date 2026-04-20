"use client";

import type { SessionState } from "@cvibe/agents";

export type Mode = SessionState["mode"];

interface ModeSwitchProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
  /** 교사가 lock해두면 학생은 변경 불가. mode_change 개입 이후 상태. */
  locked?: boolean;
}

const LABELS: Record<Mode, { label: string; dot: string; short: string }> = {
  silent: { label: "조용히", dot: "🟢", short: "silent" },
  observer: { label: "관찰자", dot: "🟡", short: "observer" },
  pair: { label: "페어", dot: "🟠", short: "pair" },
  tutor: { label: "튜터", dot: "🔴", short: "tutor" },
};

/**
 * AI 개입 수준 스위치 — research.md §3.2.
 * 기본값 pair. 교사의 mode_change 개입을 받으면 자동 전환 + lock.
 */
export function ModeSwitch({ mode, onChange, locked }: ModeSwitchProps) {
  const modes: Mode[] = ["silent", "observer", "pair", "tutor"];
  return (
    <div className="flex items-center gap-1 rounded border bg-white px-1 py-0.5 text-[11px]">
      <span className="px-1 text-slate-500">AI 모드</span>
      {modes.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => !locked && onChange(m)}
          disabled={locked}
          className={`rounded px-1.5 py-0.5 ${
            mode === m ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
          } ${locked ? "cursor-not-allowed opacity-70" : ""}`}
          title={locked && mode === m ? "교사가 잠금" : LABELS[m].label}
        >
          {LABELS[m].dot} {LABELS[m].short}
        </button>
      ))}
      {locked && <span className="ml-1 text-[10px] text-amber-700">🔒 교사 잠금</span>}
    </div>
  );
}
