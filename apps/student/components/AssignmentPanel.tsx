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
  learningObjectives?: string[];
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
        if (!selectedCode && data.assignments[0]) onSelect(data.assignments[0]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = assignments.find((a) => a.code === selectedCode);

  if (loading) {
    return (
      <aside className="overflow-auto p-6 text-[13px] text-text-secondary">과제 목록 로딩 중…</aside>
    );
  }

  return (
    <aside aria-label="problem-panel" className="flex h-full flex-col overflow-hidden bg-surface">
      <div className="border-b border-border-soft bg-surface px-4 py-3">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral">
          Assignment
        </div>
        <select
          value={selectedCode ?? ""}
          onChange={(e) => {
            const next = assignments.find((a) => a.code === e.target.value);
            if (next) onSelect(next);
          }}
          className="w-full rounded-md border border-border-soft bg-white px-2.5 py-1.5 text-[13px] text-text-primary transition-colors focus:border-primary focus:outline-none focus:shadow-ring"
        >
          {assignments.map((a) => (
            <option key={a.code} value={a.code}>
              [{a.code}] {a.title} · D{a.difficulty}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-auto px-5 py-4 text-[13px]">
        {selected && (
          <>
            <h2 className="font-display text-xl font-semibold tracking-tighter text-text-primary">
              {selected.title}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full border border-border-soft px-2 py-0.5 font-mono text-neutral">
                D{selected.difficulty}
              </span>
              {selected.kcTags.map((kc) => (
                <span
                  key={kc}
                  className="rounded-full bg-primary/5 px-2 py-0.5 font-mono text-primary"
                >
                  {kc}
                </span>
              ))}
              {selected.variantCount > 1 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                  v{selected.variantIndex + 1} / {selected.variantCount}
                </span>
              )}
            </div>
            <p className="mt-4 whitespace-pre-wrap leading-relaxed text-text-primary">
              {selected.template}
            </p>

            {selected.learningObjectives && selected.learningObjectives.length > 0 && (
              <div className="mt-5 rounded-lg border border-primary/15 bg-primary/5 p-3">
                <div className="text-[10px] font-medium uppercase tracking-wider text-primary">
                  Learning Objectives
                </div>
                <ul className="mt-2 space-y-1.5">
                  {selected.learningObjectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-text-primary">
                      <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-medium text-primary">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6">
              <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-neutral">
                Examples
              </div>
              <div className="space-y-2">
                {selected.visibleTests.map((t, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border-soft bg-bg p-3 font-mono text-[11px]"
                  >
                    <div className="text-[10px] uppercase tracking-wider text-neutral">input</div>
                    <pre className="mt-1 whitespace-pre-wrap text-text-primary">
                      {t.input || "(empty)"}
                    </pre>
                    <div className="mt-2 text-[10px] uppercase tracking-wider text-neutral">
                      expected
                    </div>
                    <pre className="mt-1 whitespace-pre-wrap text-text-primary">{t.expected}</pre>
                    {t.note && <div className="mt-2 text-text-secondary">// {t.note}</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-neutral">
                Constraints
              </div>
              <ul className="space-y-1 text-[12px] text-text-secondary">
                <li>
                  실행 제한 · {selected.constraints.timeLimitMs}ms / {selected.constraints.memLimitMb}MB
                </li>
                <li>허용 헤더 · {selected.constraints.allowedHeaders.join(", ")}</li>
              </ul>
            </div>

            <div className="mt-6">
              <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-neutral">
                Rubric
              </div>
              <ul className="space-y-1 text-[12px] text-text-secondary">
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
