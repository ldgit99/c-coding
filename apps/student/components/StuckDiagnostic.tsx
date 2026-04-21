"use client";

import { useState } from "react";

export type StuckCategory =
  | "understand"
  | "start"
  | "runtime"
  | "syntax"
  | "none";

const OPTIONS: Array<{ value: Exclude<StuckCategory, "none">; icon: string; label: string }> = [
  { value: "understand", icon: "🔍", label: "문제를 이해 못 했어" },
  { value: "start", icon: "🧩", label: "어떻게 시작할지 모르겠어" },
  { value: "runtime", icon: "🐛", label: "실행했는데 결과가 이상해" },
  { value: "syntax", icon: "📚", label: "특정 문법이 헷갈려" },
];

interface Props {
  onApply: (category: Exclude<StuckCategory, "none">, label: string) => void;
}

/**
 * 막힘 자가 진단 — AI 호출 전 학생이 어려움 유형을 선택하게 한다.
 * 선택이 그대로 다음 발화의 prefix가 되어 Supervisor·Pedagogy Coach 의
 * 컨텍스트로 전달.
 */
export function StuckDiagnostic({ onApply }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full rounded-md border border-dashed border-border-soft bg-bg px-3 py-2 text-[11px] text-text-secondary transition-colors hover:border-primary hover:text-primary"
      >
        🤔 막힌 것 같아? 어떤 종류인지 먼저 짚어보자
      </button>
    );
  }

  return (
    <div className="rounded-md border border-border-soft bg-bg px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-neutral">
          어떻게 막혔어?
        </span>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-[10px] text-neutral hover:text-text-primary"
        >
          닫기
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              onApply(o.value, `[${o.label}] `);
              setExpanded(false);
            }}
            className="flex items-center gap-1.5 rounded-md border border-border-soft bg-surface px-2 py-1.5 text-left text-[11px] text-text-primary transition-all hover:-translate-y-px hover:border-primary"
          >
            <span>{o.icon}</span>
            <span className="truncate">{o.label}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-neutral">
        선택한 유형은 AI에게 컨텍스트로 전달돼서 더 적절한 도움이 와.
      </p>
    </div>
  );
}
