"use client";

import { useEffect, useState } from "react";

interface ModeDistribution {
  solo: number;
  pair: number;
  coach: number;
  total: number;
}

interface ApiResponse {
  distribution: ModeDistribution;
  sampled?: number;
  generatedAt?: string;
}

/**
 * 교사 Orchestration Cockpit 용 실시간 모드 분포 도넛.
 * /api/classroom/modes 를 20초마다 폴링.
 */
export function ModeDonut() {
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/classroom/modes", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as ApiResponse;
        if (!cancelled) setData(json);
      } catch {
        // ignore
      }
    };
    void tick();
    const t = setInterval(tick, 20000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (!data) return null;
  const d = data.distribution;
  const total = Math.max(1, d.total);
  const soloPct = (d.solo / total) * 100;
  const pairPct = (d.pair / total) * 100;
  const coachPct = (d.coach / total) * 100;

  // SVG 도넛 — stroke-dasharray 기반
  const R = 42;
  const CIRC = 2 * Math.PI * R;
  let offset = 0;
  const segments = [
    { pct: soloPct, color: "#10B981", label: "Solo" },
    { pct: pairPct, color: "#6366F1", label: "Pair" },
    { pct: coachPct, color: "#F59E0B", label: "Coach" },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-border-soft bg-surface">
      <div className="border-b border-border-soft px-6 py-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
          Orchestration
        </div>
        <h2 className="mt-0.5 font-display text-xl font-semibold tracking-tighter text-text-primary">
          AI Mode 분포
        </h2>
      </div>
      <div className="flex items-center gap-6 px-6 py-5">
        <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
          <circle cx="60" cy="60" r={R} fill="none" stroke="#E8E8EC" strokeWidth="14" />
          {segments.map((s, i) => {
            const dash = (s.pct / 100) * CIRC;
            const gap = CIRC - dash;
            const el = (
              <circle
                key={i}
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth="14"
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 60 60)"
              />
            );
            offset += dash;
            return el;
          })}
          <text
            x="60"
            y="64"
            textAnchor="middle"
            fontSize="16"
            fontWeight="600"
            fill="#0A0A0A"
          >
            {d.total}
          </text>
        </svg>
        <ul className="flex-1 space-y-2 text-[12px]">
          {segments.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: s.color }}
              />
              <span className="font-medium text-text-primary">{s.label}</span>
              <span className="ml-auto font-mono text-neutral">
                {s.pct.toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-border-soft px-6 py-2 text-[10px] uppercase tracking-wider text-neutral">
        최근 {data.sampled ?? 0}턴 · 20초마다 갱신
      </div>
    </section>
  );
}
