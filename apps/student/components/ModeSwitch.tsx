"use client";

import { useState } from "react";

/**
 * AI 개입 강도 3단계 (2026-04-22 재설계).
 *
 * - solo  : 혼자 푸는 시간. L1 상한. 선제 발화 없음.
 * - pair  : 기본 짝 프로그래밍. L3 상한 (의사코드까지). 예시 코드 금지.
 * - coach : 적극 도움. L4 상한 (예시 코드 허용) + Accept Gate.
 *
 * 레거시 값(silent/observer/tutor)은 부모가 normalizeMode 로 변환해서 전달.
 */
export type Mode = "solo" | "pair" | "coach";

interface ModeSwitchProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
  locked?: boolean;
}

interface ModeInfo {
  label: string;
  short: string;
  description: string;
  ceiling: string;
  example: string;
  dot: string;
  active: string;
  barShare: number; // 0~1 — 스펙트럼 상 위치
}

const MODE_INFO: Record<Mode, ModeInfo> = {
  solo: {
    label: "Solo",
    short: "혼자 풀기",
    description: "AI는 거의 침묵해요. 스스로 끝까지 풀어볼 때.",
    ceiling: "힌트 L1 까지 · 방향 잡아주는 질문만",
    example: "시험·자가 진단",
    dot: "text-success",
    active: "bg-success/10 text-success border-success/30",
    barShare: 0.0,
  },
  pair: {
    label: "Pair",
    short: "짝 프로그래밍",
    description: "기본 모드. 원리·접근법·의사코드까지 받아요.",
    ceiling: "힌트 L3 까지 · 실제 코드 예시는 제공 안 함",
    example: "평소 학습",
    dot: "text-primary",
    active: "bg-primary/10 text-primary border-primary/30",
    barShare: 0.5,
  },
  coach: {
    label: "Coach",
    short: "튜터링",
    description: "막힘이 길어지면 예시 코드까지 같이 봐요.",
    ceiling: "힌트 L4 까지 · Accept Gate + 자기 설명 필수",
    example: "새 개념 수업 직후 · 오래 막힘",
    dot: "text-warning",
    active: "bg-warning/10 text-warning border-warning/30",
    barShare: 1.0,
  },
};

const MODES: Mode[] = ["solo", "pair", "coach"];

export function ModeSwitch({ mode, onChange, locked }: ModeSwitchProps) {
  const [showHelp, setShowHelp] = useState(false);
  const current = MODE_INFO[mode];

  return (
    <div className="relative flex items-center gap-1 rounded-md border border-border-soft bg-surface px-1 py-0.5">
      <span className="px-2 text-[10px] uppercase tracking-wider text-neutral">AI Mode</span>
      {MODES.map((m) => {
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
                ? `border ${info.active}`
                : "border border-transparent text-text-secondary hover:bg-bg"
            } ${locked ? "cursor-not-allowed opacity-70" : ""}`}
            title={
              locked && active
                ? `교사가 잠금 · ${info.label} — ${info.description}`
                : `${info.label} (${info.short}) — ${info.description}\n${info.ceiling}\n예: ${info.example}`
            }
            aria-label={`${info.label} 모드 — ${info.short}. ${info.ceiling}`}
          >
            <span className={active ? "" : info.dot}>●</span>
            <span>{info.label}</span>
          </button>
        );
      })}
      {locked && (
        <span className="ml-1 text-[10px] uppercase tracking-wider text-warning">
          🔒 locked
        </span>
      )}
      <button
        type="button"
        onClick={() => setShowHelp((v) => !v)}
        className="ml-1 flex h-6 items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 text-[11px] font-medium text-primary transition-all hover:-translate-y-px hover:bg-primary/10"
        aria-label="AI 모드 설명 열기"
        title={`지금: ${current.label} · ${current.ceiling}\n(클릭하면 각 모드 상세 설명)`}
      >
        <span className="text-[12px]">ℹ️</span>
        <span className="hidden sm:inline">모드 설명</span>
      </button>

      {showHelp && (
        <>
          <button
            type="button"
            onClick={() => setShowHelp(false)}
            className="fixed inset-0 z-30 cursor-default"
            aria-label="닫기"
          />
          <div className="absolute right-0 top-full z-40 mt-2 w-[420px] rounded-xl border border-border-soft bg-surface p-5 shadow-card">
            <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
              AI Mode · 짝 프로그래밍 강도 3단계
            </div>
            <h3 className="mt-0.5 font-display text-lg font-semibold tracking-tighter text-text-primary">
              AI 가 얼마나 개입할까?
            </h3>

            {/* 스펙트럼 바 */}
            <div className="mt-4">
              <div className="relative h-1.5 rounded-full bg-border-soft">
                <div
                  className="absolute top-0 h-1.5 rounded-full bg-gradient-to-r from-success via-primary to-warning"
                  style={{ width: "100%" }}
                />
                <div
                  className="absolute -top-1 h-3.5 w-3.5 rounded-full border-2 border-surface bg-text-primary transition-all"
                  style={{ left: `calc(${current.barShare * 100}% - 7px)` }}
                  aria-hidden
                />
              </div>
              <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wider">
                <span className="text-success">Solo</span>
                <span className="text-primary">Pair</span>
                <span className="text-warning">Coach</span>
              </div>
            </div>

            <ul className="mt-4 space-y-3">
              {MODES.map((m) => {
                const info = MODE_INFO[m];
                const isCurrent = m === mode;
                return (
                  <li
                    key={m}
                    className={`flex items-start gap-2.5 rounded-md border p-2.5 ${
                      isCurrent ? info.active : "border-border-soft bg-bg"
                    }`}
                  >
                    <span className={`mt-1 ${info.dot}`}>●</span>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[12px] font-semibold text-text-primary">
                          {info.label}
                        </span>
                        <span className="text-[11px] text-text-secondary">
                          · {info.short}
                        </span>
                        {isCurrent && (
                          <span className="ml-auto text-[10px] uppercase tracking-wider text-text-primary">
                            현재
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[12px] leading-relaxed text-text-secondary">
                        {info.description}
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-neutral">
                        {info.ceiling}
                      </div>
                      <div className="mt-0.5 text-[10px] text-neutral">
                        예: {info.example}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 border-t border-border-soft pt-3 text-[11px] leading-relaxed text-text-secondary">
              <span className="font-medium text-text-primary">Navigator, not Driver</span>{" "}
              — 핸들은 내가 잡고, AI 는 옆에서 길을 알려주는 역할이에요.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export { MODE_INFO };
