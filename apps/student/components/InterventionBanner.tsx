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
  onModeChange?: (next: Mode, unlock: boolean) => void;
}

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

        const modeChanges = data.interventions.filter((i) => i.type === "mode_change");
        for (const mc of modeChanges) {
          const raw = mc.payload["mode"] as string | undefined;
          // legacy 값(silent/observer/tutor) 자동 정규화.
          const next: Mode =
            raw === "silent" || raw === "observer" || raw === "solo"
              ? "solo"
              : raw === "tutor" || raw === "coach"
                ? "coach"
                : "pair";
          const unlock = mc.payload["unlock"] === true;
          onModeChange?.(next, unlock);
          void fetch("/api/interventions", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: mc.id }),
          });
        }
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
    <div className="border-b border-warning/30 bg-warning/10 px-6 py-3">
      {pending.map((item) => (
        <div key={item.id} className="flex items-start justify-between gap-4 py-1 text-[13px]">
          <div className="flex items-baseline gap-3">
            <span className="rounded-sm bg-warning/90 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
              Teacher
            </span>
            <span className="font-medium text-text-primary">{interventionLabel(item.type)}</span>
            <span className="text-text-secondary">{describePayload(item)}</span>
          </div>
          <button
            onClick={() => void dismiss(item.id)}
            className="text-[11px] uppercase tracking-wider text-text-secondary transition-colors hover:text-primary"
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
