"use client";

import { useState } from "react";

import type { SessionState } from "@cvibe/agents";

export type Mode = SessionState["mode"];

interface ModeSwitchProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
  locked?: boolean;
}

const MODE_INFO: Record<
  Mode,
  { label: string; short: string; description: string; example: string }
> = {
  silent: {
    label: "silent",
    short: "AI 끔",
    description: "AI가 말을 걸지 않아요. 스스로 끝까지 풀어볼 때.",
    example: "시험·퀴즈·자가 진단",
  },
  observer: {
    label: "observer",
    short: "관찰만",
    description: "AI는 지켜보기만 하다가, 명확히 막힐 때만 질문을 던져요.",
    example: "Level 1 소크라틱 질문까지",
  },
  pair: {
    label: "pair",
    short: "짝 프로그래밍",
    description: "기본 모드. 힌트를 요청하면 계단식으로 단서를 줘요.",
    example: "Level 1~3 힌트 · 코드 리뷰",
  },
  tutor: {
    label: "tutor",
    short: "튜터",
    description: "막힘이 길어질 때 예시 코드까지 보여줘요. 수락 전 자기 설명 필요.",
    example: "Level 4 예시 코드 + Accept Gate",
  },
};

const DOT_COLOR: Record<Mode, string> = {
  silent: "text-success",
  observer: "text-warning",
  pair: "text-primary",
  tutor: "text-error",
};

export function ModeSwitch({ mode, onChange, locked }: ModeSwitchProps) {
  const modes: Mode[] = ["silent", "observer", "pair", "tutor"];
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="relative flex items-center gap-1 rounded-md border border-border-soft bg-surface px-1 py-0.5">
      <span className="px-2 text-[10px] uppercase tracking-wider text-neutral">AI Mode</span>
      {modes.map((m) => {
        const active = mode === m;
        const info = MODE_INFO[m];
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
            title={locked && active ? "교사가 잠금" : `${info.label} — ${info.description}`}
          >
            <span className={active ? "text-white" : DOT_COLOR[m]}>●</span>
            <span>{info.label}</span>
          </button>
        );
      })}
      {locked && (
        <span className="ml-1 text-[10px] uppercase tracking-wider text-warning">locked</span>
      )}
      <button
        type="button"
        onClick={() => setShowHelp((v) => !v)}
        className="ml-1 flex h-5 w-5 items-center justify-center rounded-full border border-border-soft text-[10px] font-medium text-neutral transition-colors hover:border-primary hover:text-primary"
        aria-label="AI 모드 설명 열기"
        title="모드별 의미 보기"
      >
        ?
      </button>

      {showHelp && (
        <>
          <button
            type="button"
            onClick={() => setShowHelp(false)}
            className="fixed inset-0 z-30 cursor-default"
            aria-label="닫기"
          />
          <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-xl border border-border-soft bg-surface p-4 shadow-card">
            <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
              AI Mode
            </div>
            <h3 className="mt-0.5 font-display text-base font-semibold tracking-tighter text-text-primary">
              AI가 얼마나 개입할까?
            </h3>
            <ul className="mt-3 space-y-3">
              {modes.map((m) => {
                const info = MODE_INFO[m];
                return (
                  <li key={m} className="flex items-start gap-2.5">
                    <span className={`mt-1 ${DOT_COLOR[m]}`}>●</span>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-[12px] font-semibold text-text-primary">
                          {info.label}
                        </span>
                        <span className="text-[11px] text-text-secondary">· {info.short}</span>
                      </div>
                      <div className="text-[12px] leading-relaxed text-text-secondary">
                        {info.description}
                      </div>
                      <div className="text-[11px] font-mono text-neutral">{info.example}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 border-t border-border-soft pt-3 text-[11px] leading-relaxed text-text-secondary">
              <span className="font-medium text-text-primary">Navigator, not Driver</span> —
              AI는 조수이고, 운전대는 내가 잡는다는 원칙이에요.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
