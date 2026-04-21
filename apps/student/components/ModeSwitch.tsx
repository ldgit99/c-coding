"use client";

import type { SessionState } from "@cvibe/agents";

export type Mode = SessionState["mode"];

interface ModeSwitchProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
  locked?: boolean;
}

const LABELS: Record<Mode, { label: string; dot: string }> = {
  silent: { label: "silent", dot: "●" },
  observer: { label: "observer", dot: "●" },
  pair: { label: "pair", dot: "●" },
  tutor: { label: "tutor", dot: "●" },
};

const DOT_COLOR: Record<Mode, string> = {
  silent: "text-success",
  observer: "text-warning",
  pair: "text-primary",
  tutor: "text-error",
};

export function ModeSwitch({ mode, onChange, locked }: ModeSwitchProps) {
  const modes: Mode[] = ["silent", "observer", "pair", "tutor"];
  return (
    <div className="flex items-center gap-1 rounded-md border border-border-soft bg-surface px-1 py-0.5">
      <span className="px-2 text-[10px] uppercase tracking-wider text-neutral">AI Mode</span>
      {modes.map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => !locked && onChange(m)}
            disabled={locked}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
              active
                ? "bg-text-primary text-white"
                : "text-text-secondary hover:bg-bg"
            } ${locked ? "cursor-not-allowed opacity-70" : ""}`}
            title={locked && active ? "교사가 잠금" : LABELS[m].label}
          >
            <span className={active ? "text-white" : DOT_COLOR[m]}>{LABELS[m].dot}</span>
            <span>{LABELS[m].label}</span>
          </button>
        );
      })}
      {locked && <span className="ml-1 text-[10px] uppercase tracking-wider text-warning">locked</span>}
    </div>
  );
}
