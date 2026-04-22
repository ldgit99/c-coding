"use client";

import { useEffect, useMemo, useState } from "react";

interface StudentRow {
  id: string;
  displayName: string;
  email: string | null;
  cohortId: string;
  role: string;
  status: "active" | "inactive" | "removed";
  lastActiveAt: string | null;
  submissionCount: number;
  passedCount: number;
  createdAt: string | null;
}

interface StudentsResponse {
  cohortId: string;
  source: "supabase" | "demo";
  students: StudentRow[];
  error?: string;
}

type StatusFilter = "all" | "active" | "inactive" | "removed";

export function StudentsPage() {
  const [data, setData] = useState<StudentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [pending, setPending] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/students", { cache: "no-store" });
      setData((await res.json()) as StudentsResponse);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const rows = data?.students ?? [];
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.displayName.toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    });
  }, [data, query, statusFilter]);

  const onStatusChange = async (
    id: string,
    next: "active" | "inactive" | "removed",
  ) => {
    setPending(id);
    try {
      const res = await fetch("/api/students", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status: next }),
      });
      const json = (await res.json()) as { ok?: boolean; note?: string; error?: string };
      if (json.ok) {
        setFlash(`상태 변경 완료 · ${id.slice(0, 8)}… → ${next}`);
        await load();
      } else {
        setFlash(json.error ?? json.note ?? "변경 실패");
      }
    } catch (err) {
      setFlash(`네트워크 오류: ${String(err)}`);
    } finally {
      setPending(null);
      setTimeout(() => setFlash(null), 3000);
    }
  };

  const onRename = async (id: string, current: string) => {
    const next = window.prompt("새 이름", current);
    if (!next || next === current) return;
    setPending(id);
    try {
      const res = await fetch("/api/students", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, displayName: next }),
      });
      const json = (await res.json()) as { ok?: boolean; note?: string; error?: string };
      if (json.ok) {
        setFlash(`이름 변경 완료 → ${next}`);
        await load();
      } else {
        setFlash(json.error ?? json.note ?? "변경 실패");
      }
    } finally {
      setPending(null);
      setTimeout(() => setFlash(null), 3000);
    }
  };

  const counts = useMemo(() => {
    const rows = data?.students ?? [];
    return {
      all: rows.length,
      active: rows.filter((r) => r.status === "active").length,
      inactive: rows.filter((r) => r.status === "inactive").length,
      removed: rows.filter((r) => r.status === "removed").length,
    };
  }, [data]);

  return (
    <main className="mx-auto max-w-[1280px] px-8 py-8">
      <header className="mb-6 flex items-end justify-between gap-4 border-b border-border-soft pb-5">
        <div>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral">
            Teacher Dashboard
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tighter text-text-primary">
            학생 명단
          </h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            cohort 소속 학생 관리 · 상태 변경 · 이름 수정
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
              <span className="text-neutral">cohort · </span>
              <span className="font-mono text-text-primary">{data.cohortId}</span>
            </div>
          </div>
        )}
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름·이메일·ID 검색"
          className="h-9 flex-1 min-w-[200px] max-w-[360px] rounded-md border border-border-soft bg-surface px-3 text-[13px] text-text-primary outline-none placeholder:text-neutral focus:border-primary"
        />
        <div className="flex items-center gap-1 rounded-md border border-border-soft bg-surface p-1">
          {(["all", "active", "inactive", "removed"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors ${
                statusFilter === s
                  ? "bg-primary text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {s} · {counts[s]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="h-9 rounded-md border border-border-soft bg-surface px-3 text-[12px] font-medium text-text-primary hover:border-primary"
        >
          새로고침
        </button>
      </div>

      {flash && (
        <div className="mb-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-[12px] text-primary">
          {flash}
        </div>
      )}
      {data?.source === "demo" && (
        <div className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-[12px] text-warning">
          Supabase 미설정 — 데모 데이터 · 회원 관리 작업은 실제 반영되지 않습니다.
        </div>
      )}
      {data?.error && (
        <div className="mb-3 rounded-md border border-error/30 bg-error/5 px-3 py-2 text-[12px] text-error">
          {data.error}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-border-soft bg-surface">
        <div className="overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg text-left text-[10px] uppercase tracking-wider text-neutral">
              <tr>
                <th className="px-4 py-2 font-medium">이름</th>
                <th className="px-4 py-2 font-medium">이메일</th>
                <th className="px-4 py-2 font-medium">상태</th>
                <th className="px-4 py-2 font-medium">제출</th>
                <th className="px-4 py-2 font-medium">최근 활동</th>
                <th className="px-4 py-2 font-medium">가입일</th>
                <th className="px-4 py-2 font-medium">관리</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-neutral">
                    불러오는 중…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-neutral">
                    조건에 맞는 학생이 없어요.
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((s) => {
                  const passRate =
                    s.submissionCount > 0 ? s.passedCount / s.submissionCount : 0;
                  return (
                    <tr key={s.id} className="border-t border-border-soft">
                      <td className="px-4 py-2.5">
                        <a
                          href={`/student/${s.id}`}
                          className="font-medium text-text-primary transition-colors hover:text-primary"
                        >
                          {s.displayName}
                        </a>
                        <div className="mt-0.5 font-mono text-[10px] text-neutral">
                          {s.id.slice(0, 8)}…
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary">{s.email ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary">
                        <div className="font-mono text-text-primary">
                          {s.passedCount}/{s.submissionCount}
                        </div>
                        <div className="mt-0.5 text-[10px] text-neutral">
                          {s.submissionCount > 0 ? `${(passRate * 100).toFixed(0)}%` : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary">
                        {formatRelative(s.lastActiveAt)}
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary">
                        {formatDate(s.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={pending === s.id}
                            onClick={() => void onRename(s.id, s.displayName)}
                            className="rounded border border-border-soft px-2 py-0.5 text-[11px] text-text-secondary hover:border-primary hover:text-primary disabled:opacity-50"
                          >
                            이름
                          </button>
                          {s.status !== "active" && (
                            <button
                              type="button"
                              disabled={pending === s.id}
                              onClick={() => void onStatusChange(s.id, "active")}
                              className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                            >
                              활성화
                            </button>
                          )}
                          {s.status === "active" && (
                            <button
                              type="button"
                              disabled={pending === s.id}
                              onClick={() => void onStatusChange(s.id, "inactive")}
                              className="rounded border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning hover:bg-warning/20 disabled:opacity-50"
                            >
                              비활성
                            </button>
                          )}
                          {s.status !== "removed" && (
                            <button
                              type="button"
                              disabled={pending === s.id}
                              onClick={() => {
                                if (window.confirm(`${s.displayName} 을(를) 제적 처리할까요?`)) {
                                  void onStatusChange(s.id, "removed");
                                }
                              }}
                              className="rounded border border-error/30 px-2 py-0.5 text-[11px] font-medium text-error hover:bg-error/10 disabled:opacity-50"
                            >
                              제적
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-4 text-[11px] leading-relaxed text-neutral">
        신규 학생 가입은 학생 앱의 매직 링크/비밀번호 로그인으로 이루어지며,
        Supabase <code className="font-mono">profiles</code> 트리거가 cohort에
        자동 배정합니다. 여기서는 상태 변경 · 이름 수정만 제공합니다.
      </p>
    </main>
  );
}

function StatusBadge({ status }: { status: "active" | "inactive" | "removed" }) {
  const map = {
    active: "border-success/30 bg-success/10 text-success",
    inactive: "border-warning/30 bg-warning/10 text-warning",
    removed: "border-error/30 bg-error/10 text-error",
  } as const;
  const label = { active: "활성", inactive: "비활성", removed: "제적" }[status];
  return (
    <span
      className={`rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${map[status]}`}
    >
      {label}
    </span>
  );
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" });
}
