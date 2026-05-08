"use client";

import { useEffect, useMemo, useState } from "react";

import { SubmissionCodeModal } from "./SubmissionCodeModal";

type CellStatus = "passed" | "failed" | "in_progress" | "none";

interface Cell {
  status: CellStatus;
  attempts: number;
  lastScore: number | null;
  lastAt: string | null;
}

interface AssignmentInfo {
  code: string;
  title: string;
  difficulty: number;
  kcTags: string[];
}

interface StudentRow {
  studentId: string;
  displayName: string;
  cells: Record<string, Cell>;
}

interface GridResponse {
  cohortId: string;
  source: "supabase" | "demo";
  assignments: AssignmentInfo[];
  students: StudentRow[];
  error?: string;
}

export function SubmissionsPage() {
  const [data, setData] = useState<GridResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);
  const [focusCode, setFocusCode] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    studentId: string;
    studentName: string;
    assignmentCode: string;
    assignmentTitle: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/submissions/grid", { cache: "no-store" });
        if (cancelled) return;
        setData((await res.json()) as GridResponse);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ?focus=<code> 가 들어오면 해당 과제 칼럼으로 스크롤하고 잠시 하이라이트.
  // 데이터 로드 후에 DOM 이 그려져 있어야 하므로 data 의존.
  useEffect(() => {
    if (!data || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const target = params.get("focus");
    if (!target) return;
    const exists = data.assignments.some((a) => a.code === target);
    if (!exists) return;
    setFocusCode(target);
    // 다음 frame 에서 querySelector — table 이 mount 된 직후
    requestAnimationFrame(() => {
      const el = document.querySelector(
        `[data-assignment-col="${CSS.escape(target)}"]`,
      );
      if (el && "scrollIntoView" in el) {
        (el as HTMLElement).scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
      }
    });
    // 3초 후 하이라이트 제거 — 시각적 노이즈 방지
    const timer = window.setTimeout(() => setFocusCode(null), 3000);
    return () => window.clearTimeout(timer);
  }, [data]);

  const filteredStudents = useMemo(() => {
    const rows = data?.students ?? [];
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (q ? r.displayName.toLowerCase().includes(q) : true))
      .filter((r) =>
        hideEmpty
          ? Object.values(r.cells).some((c) => c.attempts > 0)
          : true,
      );
  }, [data, query, hideEmpty]);

  const perAssignment = useMemo(() => {
    if (!data) return [] as Array<{ code: string; passed: number; attempted: number; total: number }>;
    const total = data.students.length;
    return data.assignments.map((a) => {
      let passed = 0;
      let attempted = 0;
      for (const s of data.students) {
        const c = s.cells[a.code];
        if (!c) continue;
        if (c.attempts > 0) attempted += 1;
        if (c.status === "passed") passed += 1;
      }
      return { code: a.code, passed, attempted, total };
    });
  }, [data]);

  return (
    <main className="mx-auto max-w-[1600px] px-8 py-8">
      <header className="mb-6 flex items-end justify-between gap-4 border-b border-border-soft pb-5">
        <div>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral">
            Teacher Dashboard
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tighter text-text-primary">
            제출 현황
          </h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            학생 × 과제 · ✓ 통과 · ⏳ 시도 중 · ⚪ 미제출
          </p>
        </div>
        {data && (
          <div className="text-right text-[12px] text-text-secondary">
            <div>
              <span className="text-neutral">source · </span>
              <span
                className={`font-mono ${
                  data.source === "supabase" ? "text-primary" : "text-warning"
                }`}
              >
                {data.source}
              </span>
            </div>
            <div className="mt-1">
              <span className="text-neutral">{data.students.length} students · </span>
              <span className="font-medium text-text-primary">
                {data.assignments.length} assignments
              </span>
            </div>
          </div>
        )}
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="학생 이름 검색"
          className="h-9 min-w-[200px] max-w-[320px] flex-1 rounded-md border border-border-soft bg-surface px-3 text-[13px] text-text-primary outline-none placeholder:text-neutral focus:border-primary"
        />
        <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border-soft bg-surface px-3 text-[12px] text-text-secondary">
          <input
            type="checkbox"
            checked={hideEmpty}
            onChange={(e) => setHideEmpty(e.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
          />
          미제출 학생 숨기기
        </label>
      </div>

      {data?.source === "demo" && (
        <div className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-[12px] text-warning">
          Supabase 미설정 — 데모 데이터 기반 매트릭스입니다.
        </div>
      )}
      {data?.error && (
        <div className="mb-3 rounded-md border border-error/30 bg-error/5 px-3 py-2 text-[12px] text-error">
          {data.error}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-border-soft bg-surface">
        <div className="overflow-auto">
          <table className="min-w-full text-[12px]">
            <thead className="bg-bg">
              <tr className="text-left text-[10px] uppercase tracking-wider text-neutral">
                <th className="sticky left-0 z-10 bg-bg px-3 py-2 font-medium">
                  학생
                </th>
                {data?.assignments.map((a) => {
                  const focused = focusCode === a.code;
                  return (
                    <th
                      key={a.code}
                      data-assignment-col={a.code}
                      className={`whitespace-nowrap px-2 py-2 text-center font-medium transition-colors ${
                        focused ? "bg-primary/10 ring-2 ring-primary" : ""
                      }`}
                      title={`${a.title} (난이도 ${a.difficulty})`}
                    >
                      <div className="font-mono text-[10px] text-text-primary">
                        {a.code.split("_")[0]}
                      </div>
                      <div className="mt-0.5 max-w-[90px] truncate text-[10px] text-neutral">
                        {a.title}
                      </div>
                    </th>
                  );
                })}
                <th className="px-3 py-2 text-center font-medium">통과</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={(data?.assignments.length ?? 0) + 2}
                    className="px-4 py-6 text-center text-neutral"
                  >
                    불러오는 중…
                  </td>
                </tr>
              )}
              {!loading && filteredStudents.length === 0 && (
                <tr>
                  <td
                    colSpan={(data?.assignments.length ?? 0) + 2}
                    className="px-4 py-6 text-center text-neutral"
                  >
                    조건에 맞는 학생이 없어요.
                  </td>
                </tr>
              )}
              {!loading &&
                filteredStudents.map((row) => {
                  const total = data?.assignments.length ?? 0;
                  const passed = data?.assignments.filter(
                    (a) => row.cells[a.code]?.status === "passed",
                  ).length ?? 0;
                  return (
                    <tr key={row.studentId} className="border-t border-border-soft">
                      <td className="sticky left-0 z-10 bg-surface px-3 py-2">
                        <a
                          href={`/student/${row.studentId}`}
                          className="font-medium text-text-primary transition-colors hover:text-primary"
                        >
                          {row.displayName}
                        </a>
                      </td>
                      {data?.assignments.map((a) => {
                        const cell = row.cells[a.code] ?? {
                          status: "none" as const,
                          attempts: 0,
                          lastScore: null,
                          lastAt: null,
                        };
                        const clickable = cell.attempts > 0;
                        const focused = focusCode === a.code;
                        return (
                          <td
                            key={a.code}
                            className={`px-2 py-1 text-center transition-colors ${
                              focused ? "bg-primary/5" : ""
                            }`}
                          >
                            <StatusCell
                              cell={cell}
                              onClick={
                                clickable
                                  ? () =>
                                      setModal({
                                        studentId: row.studentId,
                                        studentName: row.displayName,
                                        assignmentCode: a.code,
                                        assignmentTitle: a.title,
                                      })
                                  : undefined
                              }
                            />
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center font-mono text-text-primary">
                        {passed}/{total}
                      </td>
                    </tr>
                  );
                })}
              {!loading && data && (
                <tr className="border-t-2 border-border-soft bg-bg text-[10px] uppercase tracking-wider text-neutral">
                  <td className="sticky left-0 z-10 bg-bg px-3 py-2 font-medium">
                    과제별 통과율
                  </td>
                  {perAssignment.map((p) => {
                    const rate = p.total > 0 ? p.passed / p.total : 0;
                    const pct = `${Math.round(rate * 100)}%`;
                    const focused = focusCode === p.code;
                    return (
                      <td
                        key={p.code}
                        className={`px-2 py-2 text-center transition-colors ${
                          focused ? "bg-primary/10" : ""
                        }`}
                      >
                        <div className="font-mono text-[11px] text-text-primary">
                          {p.passed}/{p.total}
                        </div>
                        <div className="mt-0.5 text-[9px] text-neutral">{pct}</div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Legend />

      {modal && (
        <SubmissionCodeModal
          studentId={modal.studentId}
          studentName={modal.studentName}
          assignmentCode={modal.assignmentCode}
          assignmentTitle={modal.assignmentTitle}
          onClose={() => setModal(null)}
        />
      )}
    </main>
  );
}

function StatusCell({ cell, onClick }: { cell: Cell; onClick?: () => void }) {
  const { status, attempts, lastScore } = cell;
  const Wrap = ({
    children,
    title,
    className,
  }: {
    children: React.ReactNode;
    title: string;
    className: string;
  }) => {
    if (onClick) {
      return (
        <button
          type="button"
          onClick={onClick}
          title={`${title} · 클릭하여 코드 보기`}
          className={`${className} cursor-pointer transition-transform hover:scale-105`}
        >
          {children}
        </button>
      );
    }
    return (
      <div title={title} className={className}>
        {children}
      </div>
    );
  };
  if (status === "passed") {
    return (
      <Wrap
        title={
          lastScore != null
            ? `통과 · 점수 ${(lastScore * 100).toFixed(0)} · 시도 ${attempts}회`
            : `통과 · 시도 ${attempts}회`
        }
        className="mx-auto flex h-7 w-11 items-center justify-center gap-0.5 rounded-md bg-success/15 text-[11px] font-semibold text-success"
      >
        ✓ {attempts > 1 ? <span className="font-mono text-[9px]">{attempts}</span> : null}
      </Wrap>
    );
  }
  if (status === "failed") {
    return (
      <Wrap
        title={
          lastScore != null
            ? `미통과 · 점수 ${(lastScore * 100).toFixed(0)} · 시도 ${attempts}회`
            : `미통과 · 시도 ${attempts}회`
        }
        className="mx-auto flex h-7 w-11 items-center justify-center gap-0.5 rounded-md bg-error/10 text-[11px] font-semibold text-error"
      >
        ✗ <span className="font-mono text-[9px]">{attempts}</span>
      </Wrap>
    );
  }
  if (status === "in_progress") {
    return (
      <Wrap
        title={`시도 중 · ${attempts}회`}
        className="mx-auto flex h-7 w-11 items-center justify-center rounded-md bg-warning/15 text-[11px] font-semibold text-warning"
      >
        ⏳
      </Wrap>
    );
  }
  return (
    <div
      className="mx-auto flex h-7 w-11 items-center justify-center rounded-md border border-dashed border-border-soft text-[11px] text-neutral"
      title="미제출"
    >
      ⚪
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-text-secondary">
      <LegendItem color="bg-success/15 text-success" label="✓ 통과" />
      <LegendItem color="bg-error/10 text-error" label="✗ 미통과 (시도 횟수)" />
      <LegendItem color="bg-warning/15 text-warning" label="⏳ 시도 중" />
      <LegendItem color="border border-dashed border-border-soft text-neutral" label="⚪ 미제출" />
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-md px-2 text-[11px] font-medium ${color}`}
    >
      {label}
    </span>
  );
}
