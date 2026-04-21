"use client";

import { useState } from "react";

const DEMO_TEACHER_ID = "00000000-0000-4000-8000-000000000001";

interface Props {
  studentId: string;
  displayName: string;
}

export function InterventionActions({ studentId, displayName }: Props) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const send = async (
    type: "mode_change" | "direct_message" | "hint_inject",
    payload: Record<string, unknown>,
  ) => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/intervene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          type,
          payload,
          teacherId: DEMO_TEACHER_ID,
        }),
      });
      if (res.ok) setStatus(`[${type}] ${displayName}에게 전달됨`);
      else setStatus(`실패 (${res.status})`);
    } catch (err) {
      setStatus(String(err));
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async () => {
    const text = prompt(`${displayName}에게 보낼 쪽지 내용을 입력하세요.`);
    if (!text) return;
    await send("direct_message", { text });
  };

  const baseBtn =
    "rounded-md border border-border-soft bg-white px-2.5 py-1 text-[11px] font-medium text-text-primary transition-all hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        onClick={() => void send("mode_change", { mode: "tutor" })}
        disabled={busy}
        className={`${baseBtn} hover:border-error/40 hover:bg-error/5 hover:text-error`}
      >
        → tutor
      </button>
      <button
        onClick={() => void send("mode_change", { mode: "pair" })}
        disabled={busy}
        className={`${baseBtn} hover:border-primary/40 hover:bg-primary/5 hover:text-primary`}
      >
        → pair
      </button>
      <button
        onClick={() => void send("mode_change", { mode: "observer" })}
        disabled={busy}
        className={`${baseBtn} hover:border-warning/40 hover:bg-warning/5 hover:text-warning`}
      >
        → observer
      </button>
      <button
        onClick={() => void sendMessage()}
        disabled={busy}
        className={`${baseBtn} hover:border-primary hover:text-primary`}
      >
        쪽지
      </button>
      <button
        onClick={() => void send("mode_change", { mode: "pair", unlock: true })}
        disabled={busy}
        className="rounded-md border border-success/30 bg-success/5 px-2.5 py-1 text-[11px] font-medium text-success transition-all hover:-translate-y-px hover:bg-success/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        title="학생이 모드를 다시 선택할 수 있게 풀어줌"
      >
        잠금 해제
      </button>
      {status && <span className="ml-1 text-[11px] text-neutral">{status}</span>}
    </div>
  );
}
