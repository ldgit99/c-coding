"use client";

import { useEffect, useMemo, useState } from "react";

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

type Status = "passed" | "attempted" | "untried";

interface SubmissionSummary {
  assignmentCode: string | null;
  finalScore: number | null;
  passed: boolean;
}

interface AssignmentPanelProps {
  selectedCode: string | null;
  onSelect: (assignment: AssignmentPublic) => void;
  /** 진행 상황 표시를 위해 부모가 주입. 변경되면 리렌더. */
  submissions?: SubmissionSummary[];
}

export function AssignmentPanel({ selectedCode, onSelect, submissions = [] }: AssignmentPanelProps) {
  const [assignments, setAssignments] = useState<AssignmentPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/assignments");
        const data = (await res.json()) as { assignments: AssignmentPublic[] };
        setAssignments(data.assignments);
        // 순차적 공개 — locked 아닌 첫 과제를 기본 선택.
        if (!selectedCode) {
          const firstUnlocked = data.assignments.find((a) => !isLocked(a.code));
          if (firstUnlocked) onSelect(firstUnlocked);
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusByCode = useMemo(() => {
    const map = new Map<string, Status>();
    for (const s of submissions) {
      if (!s.assignmentCode) continue;
      const prev = map.get(s.assignmentCode);
      if (s.passed) map.set(s.assignmentCode, "passed");
      else if (prev !== "passed") map.set(s.assignmentCode, "attempted");
    }
    return map;
  }, [submissions]);

  const counts = useMemo(() => {
    let passed = 0;
    let attempted = 0;
    for (const a of assignments) {
      const st = statusByCode.get(a.code);
      if (st === "passed") passed++;
      else if (st === "attempted") attempted++;
    }
    const total = assignments.length;
    return { passed, attempted, untried: total - passed - attempted, total };
  }, [assignments, statusByCode]);

  const selected = assignments.find((a) => a.code === selectedCode);

  if (loading) {
    return (
      <aside className="overflow-auto p-6 text-[13px] text-text-secondary">과제 목록 로딩 중…</aside>
    );
  }

  return (
    <aside aria-label="problem-panel" className="flex h-full flex-col overflow-hidden bg-surface">
      <div className="shrink-0 border-b border-border-soft bg-surface px-4 py-3">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Progress
          </span>
          <span className="font-mono text-[11px] text-text-secondary">
            {counts.passed}/{counts.total} 통과
          </span>
        </div>
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-border-soft">
          <div
            className="h-full bg-success transition-all"
            style={{ width: `${(counts.passed / Math.max(1, counts.total)) * 100}%` }}
          />
          <div
            className="h-full bg-warning/60 transition-all"
            style={{ width: `${(counts.attempted / Math.max(1, counts.total)) * 100}%` }}
          />
        </div>
        <div className="mt-1.5 flex gap-3 text-[10px] uppercase tracking-wider text-neutral">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> 통과 {counts.passed}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-warning/60" /> 시도 {counts.attempted}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-border-soft" /> 미시작 {counts.untried}
          </span>
        </div>
      </div>

      <ul className="max-h-[34vh] shrink-0 overflow-y-auto border-b border-border-soft bg-bg">
        {assignments.map((a) => {
          const st = statusByCode.get(a.code) ?? "untried";
          const active = a.code === selectedCode;
          const locked = isLocked(a.code);
          return (
            <li key={a.code}>
              <button
                type="button"
                onClick={() => {
                  if (!locked) onSelect(a);
                }}
                disabled={locked}
                className={`flex w-full items-center gap-2 px-4 py-2 text-left text-[12px] transition-colors ${
                  locked
                    ? "cursor-not-allowed text-neutral opacity-60"
                    : active
                      ? "bg-primary/5 text-text-primary"
                      : "text-text-secondary hover:bg-surface hover:text-text-primary"
                }`}
                title={locked ? "순차적 공개 — 이전 과제 통과 후 열려요" : a.title}
              >
                {locked ? (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border-soft text-[9px] text-neutral">
                    🔒
                  </span>
                ) : (
                  <StatusDot status={st} />
                )}
                <span className="font-mono text-[10px] text-neutral">
                  {a.code.slice(0, 3)}
                </span>
                <span className="flex-1 truncate">
                  {locked ? "순차적 공개" : a.title}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-neutral">
                  D{a.difficulty}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="min-h-0 flex-1 overflow-auto px-5 py-4 text-[13px]">
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

          </>
        )}
      </div>
    </aside>
  );
}

/**
 * 순차적 공개 정책 — 파일럿 첫 주는 A01 만 열고 나머지는 잠금.
 * 교수가 다음 주차 공개할 때 해당 prefix 추가. 추후 cohort 별로 동적 제어
 * 하려면 Supabase `assignments.active` 필드 또는 별도 release schedule 테이블로.
 */
const UNLOCKED_PREFIXES = ["A01", "A02"];
function isLocked(code: string): boolean {
  return !UNLOCKED_PREFIXES.some((p) => code.startsWith(p));
}

function StatusDot({ status }: { status: Status }) {
  if (status === "passed") {
    return (
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success/20 text-[9px] font-semibold text-success">
        ✓
      </span>
    );
  }
  if (status === "attempted") {
    return (
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-warning/20 text-[9px] text-warning">
        ⏳
      </span>
    );
  }
  return <span className="h-2 w-2 shrink-0 rounded-full bg-border-soft" />;
}
