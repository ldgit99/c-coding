"use client";

import { useEffect, useRef, useState } from "react";

export interface CelebrationMessage {
  id: string;
  kind: "compile" | "visible-test" | "submit";
  title: string;
  body?: string;
}

interface Props {
  message: CelebrationMessage | null;
  onDismiss: () => void;
}

/**
 * 작은 성공 축하 토스트 — 우측 하단에 slide-in, 4초 후 자동 dismiss.
 * 과하지 않은 편집 미학 — 뱃지·점수·애니메이션 남발 금지.
 *
 * 주의: onDismiss 를 deps 에 넣으면 부모 리렌더마다 타이머가 리셋되어 토스트가
 * 영구 잔류하는 버그가 생긴다. ref 로 최신 함수를 보존하고, message.id 에만
 * 반응하도록 deps 를 고정한다.
 */
export function Celebration({ message, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const fadeOut = setTimeout(() => setVisible(false), 4000);
    const dismiss = setTimeout(() => onDismissRef.current?.(), 4300);
    return () => {
      clearTimeout(fadeOut);
      clearTimeout(dismiss);
    };
  }, [message?.id]);

  if (!message) return null;

  const color =
    message.kind === "submit"
      ? "border-success/40 bg-success/10 text-success"
      : message.kind === "visible-test"
        ? "border-primary/40 bg-primary/10 text-primary"
        : "border-warning/40 bg-warning/10 text-warning";

  const icon =
    message.kind === "submit" ? "🎉" : message.kind === "visible-test" ? "🎯" : "👏";

  return (
    <div
      className={`fixed bottom-6 right-6 z-40 max-w-sm rounded-xl border bg-surface px-4 py-3 shadow-card transition-all duration-300 ${color} ${
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="text-xl">{icon}</span>
        <div className="flex-1">
          <div className="text-[13px] font-medium text-text-primary">{message.title}</div>
          {message.body && (
            <div className="mt-0.5 text-[11px] text-text-secondary">{message.body}</div>
          )}
        </div>
      </div>
    </div>
  );
}
