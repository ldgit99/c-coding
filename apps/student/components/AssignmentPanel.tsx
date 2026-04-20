"use client";

import { useEffect, useState } from "react";

export interface AssignmentPublic {
  code: string;
  title: string;
  template: string;
  kcTags: string[];
  difficulty: number;
  rubric: { correctness: number; style: number; memory_safety: number; reflection: number };
  constraints: { timeLimitMs: number; memLimitMb: number; allowedHeaders: string[] };
  starterCode: string;
  visibleTests: Array<{ input: string; expected: string; note?: string }>;
  reflectionPrompts: string[];
  variantCount: number;
  variantIndex: number;
}

interface AssignmentPanelProps {
  selectedCode: string | null;
  onSelect: (assignment: AssignmentPublic) => void;
}

export function AssignmentPanel({ selectedCode, onSelect }: AssignmentPanelProps) {
  const [assignments, setAssignments] = useState<AssignmentPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/assignments");
        const data = (await res.json()) as { assignments: AssignmentPublic[] };
        setAssignments(data.assignments);
        // 첫 과제 자동 선택
        if (!selectedCode && data.assignments[0]) onSelect(data.assignments[0]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = assignments.find((a) => a.code === selectedCode);

  if (loading) {
    return <aside className="overflow-auto p-4 text-sm text-slate-500">과제 목록 로딩 중…</aside>;
  }

  return (
    <aside aria-label="problem-panel" className="flex h-full flex-col overflow-hidden">
      <div className="border-b bg-slate-50 p-2">
        <select
          value={selectedCode ?? ""}
          onChange={(e) => {
            const next = assignments.find((a) => a.code === e.target.value);
            if (next) onSelect(next);
          }}
          className="w-full rounded border px-2 py-1 text-sm"
        >
          {assignments.map((a) => (
            <option key={a.code} value={a.code}>
              [{a.code}] {a.title} · D{a.difficulty}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-auto p-4 text-sm">
        {selected && (
          <>
            <h2 className="text-base font-semibold">{selected.title}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>난이도 {selected.difficulty} · KC {selected.kcTags.join(", ")}</span>
              {selected.variantCount > 1 && (
                <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-800">
                  variant v{selected.variantIndex + 1} / {selected.variantCount}
                </span>
              )}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-slate-800">{selected.template}</p>

            <div className="mt-4">
              <div className="text-xs font-semibold text-slate-600">입출력 예시</div>
              {selected.visibleTests.map((t, i) => (
                <div key={i} className="mt-1 rounded border bg-slate-50 p-2 font-mono text-[11px]">
                  <div className="text-slate-500">input</div>
                  <pre className="whitespace-pre-wrap text-slate-800">{t.input || "(empty)"}</pre>
                  <div className="mt-1 text-slate-500">expected</div>
                  <pre className="whitespace-pre-wrap text-slate-800">{t.expected}</pre>
                  {t.note && <div className="mt-1 text-slate-500">// {t.note}</div>}
                </div>
              ))}
            </div>

            <div className="mt-4">
              <div className="text-xs font-semibold text-slate-600">제약</div>
              <ul className="mt-1 text-xs text-slate-700">
                <li>실행 제한: {selected.constraints.timeLimitMs}ms / {selected.constraints.memLimitMb}MB</li>
                <li>허용 헤더: {selected.constraints.allowedHeaders.join(", ")}</li>
              </ul>
            </div>

            <div className="mt-4">
              <div className="text-xs font-semibold text-slate-600">루브릭 가중치</div>
              <ul className="mt-1 text-xs text-slate-700">
                <li>correctness {selected.rubric.correctness}</li>
                <li>style {selected.rubric.style}</li>
                <li>memory_safety {selected.rubric.memory_safety}</li>
                <li>reflection {selected.rubric.reflection}</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
