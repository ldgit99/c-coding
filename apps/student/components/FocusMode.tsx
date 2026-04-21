"use client";

import { useEffect, useState } from "react";

interface Props {
  active: boolean;
  minutes: number;
  onEnd: (summary: { completed: boolean; elapsedSec: number }) => void;
}

/**
 * Focus Mode 오버레이 + 카운트다운.
 * AIPanel을 덮는 반투명 오버레이로 시각적으로 "AI 차단" 상태를 표시.
 * 타이머 종료 시 onEnd 콜백.
 */
export function FocusMode({ active, minutes, onEnd }: Props) {
  const [remaining, setRemaining] = useState(minutes * 60);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!active) {
      setRemaining(minutes * 60);
      setStartedAt(null);
      return;
    }
    setStartedAt(Date.now());
    setRemaining(minutes * 60);
  }, [active, minutes]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t);
          onEnd({ completed: true, elapsedSec: minutes * 60 });
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [active, minutes, onEnd]);

  if (!active) return null;

  const mm = Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface/85 backdrop-blur-sm">
      <div className="pointer-events-auto rounded-xl border border-border-soft bg-surface px-6 py-5 text-center shadow-card">
        <div className="text-[10px] font-medium uppercase tracking-wider text-primary">
          Focus Mode
        </div>
        <div className="mt-1 font-display text-3xl font-semibold tracking-tighter text-text-primary">
          AI 도움 없이 집중 중
        </div>
        <div className="mt-3 font-mono text-4xl font-semibold text-primary tabular-nums">
          {mm}:{ss}
        </div>
        <p className="mt-3 max-w-xs text-[12px] leading-relaxed text-text-secondary">
          타이머가 끝날 때까지 AI에 도움을 요청하지 않아요. 지금은 네 머리로
          풀어볼 시간.
        </p>
        <button
          type="button"
          onClick={() => {
            const elapsed = startedAt
              ? Math.floor((Date.now() - startedAt) / 1000)
              : 0;
            onEnd({ completed: false, elapsedSec: elapsed });
          }}
          className="mt-4 rounded-md border border-border-soft px-3 py-1.5 text-[11px] uppercase tracking-wider text-text-secondary transition-colors hover:border-primary hover:text-primary"
        >
          종료
        </button>
      </div>
    </div>
  );
}
