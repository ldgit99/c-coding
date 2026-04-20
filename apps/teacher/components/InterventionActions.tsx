"use client";

import { useState } from "react";

interface Props {
  studentId: string;
  displayName: string;
}

/**
 * 교사가 개별 학생에 직접 쪽지/모드 변경/수동 힌트를 전송.
 * /api/intervene(교사 앱) → 학생 앱의 /api/interventions로 프록시 전달.
 */
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
          teacherId: "demo-teacher-001",
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => void send("mode_change", { mode: "tutor" })}
        disabled={busy}
        className="rounded border bg-white px-2 py-1 text-xs disabled:opacity-50"
      >
        🔴 tutor로 상승
      </button>
      <button
        onClick={() => void send("mode_change", { mode: "pair" })}
        disabled={busy}
        className="rounded border bg-white px-2 py-1 text-xs disabled:opacity-50"
      >
        🟠 pair 유지
      </button>
      <button
        onClick={() => void send("mode_change", { mode: "observer" })}
        disabled={busy}
        className="rounded border bg-white px-2 py-1 text-xs disabled:opacity-50"
      >
        🟡 observer 관찰
      </button>
      <button
        onClick={() => void sendMessage()}
        disabled={busy}
        className="rounded border bg-white px-2 py-1 text-xs disabled:opacity-50"
      >
        📝 쪽지 전송
      </button>
      <button
        onClick={() => void send("mode_change", { mode: "pair", unlock: true })}
        disabled={busy}
        className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 disabled:opacity-50"
        title="학생이 모드를 다시 선택할 수 있게 풀어줌"
      >
        🔓 잠금 해제
      </button>
      {status && <span className="text-xs text-slate-500">{status}</span>}
    </div>
  );
}
