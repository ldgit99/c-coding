"use client";

/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";

import type { Mode } from "./ModeSwitch";

interface Intervention {
  id: string;
  studentId: string;
  type: "mode_change" | "direct_message" | "hint_inject" | "difficulty_patch";
  payload: Record<string, unknown>;
  createdAt: string;
  applied: boolean;
}

interface Props {
  studentId: string;
  /**
   * mode_change 개입 수신 시 호출되는 콜백.
   * payload.unlock=true이면 학생이 다시 모드를 선택할 수 있도록 잠금 해제.
   */
  onModeChange?: (next: Mode, unlock: boolean) => void;
}

/**
 * 교사 개입 쪽지 수신 배너 — 5초 폴링.
 * mode_change는 학생 확인 없이 즉시 반영(교사 강제 권한).
 */
export function InterventionBanner({ studentId, onModeChange }: Props) {
  const [pending, setPending] = useState<Intervention[]>([]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/interventions?studentId=${encodeURIComponent(studentId)}&pending=1`);
        if (!res.ok) return;
        const data = (await res.json()) as { interventions: Intervention[] };
        if (cancelled) return;

        // mode_change는 확인 없이 즉시 반영
        const modeChanges = data.interventions.filter((i) => i.type === "mode_change");
        for (const mc of modeChanges) {
          const next = (mc.payload["mode"] as Mode | undefined) ?? "pair";
          const unlock = mc.payload["unlock"] === true;
          onModeChange?.(next, unlock);
          void fetch("/api/interventions", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: mc.id }),
          });
        }
        // 나머지는 배너로 남긴다 (학생 확인 대기)
        setPending(data.interventions.filter((i) => i.type !== "mode_change"));
      } catch {
        // ignore transient network errors
      }
    };
    void poll();
    const t = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [studentId]);

  const dismiss = async (id: string) => {
    await fetch("/api/interventions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setPending((prev) => prev.filter((i) => i.id !== id));
  };

  if (pending.length === 0) return null;

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2">
      {pending.map((item) => (
        <div key={item.id} className="flex items-start justify-between gap-3 py-1 text-sm">
          <div>
            <span className="mr-2 rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              교사 개입
            </span>
            <span className="font-semibold">{interventionLabel(item.type)}</span>
            <span className="ml-2 text-slate-700">{describePayload(item)}</span>
          </div>
          <button
            onClick={() => void dismiss(item.id)}
            className="text-xs text-slate-600 hover:text-slate-900"
          >
            확인
          </button>
        </div>
      ))}
    </div>
  );
}

function interventionLabel(type: Intervention["type"]): string {
  switch (type) {
    case "mode_change":
      return "AI 모드 변경";
    case "direct_message":
      return "쪽지";
    case "hint_inject":
      return "수동 힌트";
    case "difficulty_patch":
      return "난이도 조정";
  }
}

function describePayload(item: Intervention): string {
  if (item.type === "mode_change") return `→ ${item.payload["mode"] ?? "pair"}`;
  if (item.type === "direct_message") return String(item.payload["text"] ?? "");
  if (item.type === "hint_inject") return String(item.payload["hint"] ?? "");
  return JSON.stringify(item.payload);
}
