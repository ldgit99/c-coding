"use client";

import { computeProficiency, computeWeeklyGrowth } from "@/lib/proficiency";

interface SubmissionRow {
  id: string;
  assignmentCode: string | null;
  assignmentTitle: string | null;
  kcTags: string[];
  difficulty: number | null;
  finalScore: number | null;
  passed: boolean;
  rubricScores: Record<string, number | null> | null;
  submittedAt: string;
}

interface Props {
  submissions: SubmissionRow[];
  source: "supabase" | "memory";
  onClose: () => void;
}

export function MyLearningDialog({ submissions, source, onClose }: Props) {
  const byAssignment = new Map<string, SubmissionRow[]>();
  for (const s of submissions) {
    if (!s.assignmentCode) continue;
    const bucket = byAssignment.get(s.assignmentCode) ?? [];
    bucket.push(s);
    byAssignment.set(s.assignmentCode, bucket);
  }

  const attempts = submissions.length;
  const proficientCount = submissions.filter((s) => {
    if (!s.rubricScores) return s.passed;
    const p = computeProficiency({
      correctness: s.rubricScores.correctness ?? null,
      style: s.rubricScores.style ?? null,
      memory_safety: s.rubricScores.memory_safety ?? null,
      reflection: s.rubricScores.reflection ?? null,
    });
    return p.passed;
  }).length;
  const bestScores = Array.from(byAssignment.entries())
    .map(([code, rows]) => {
      const best = rows.reduce(
        (a, b) => ((b.finalScore ?? 0) > (a.finalScore ?? 0) ? b : a),
        rows[0]!,
      );
      return { code, title: best.assignmentTitle, best };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border-soft bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-border-soft px-6 py-4">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
              My Learning
            </div>
            <h2 className="mt-0.5 font-display text-2xl font-semibold tracking-tighter text-text-primary">
              내 학습 기록
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[20px] text-neutral transition-colors hover:text-text-primary"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5 text-[13px]">
          <WeeklyGrowthCard submissions={submissions} />
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="총 제출" value={attempts.toString()} />
            <StatCard
              label="학습 완료"
              value={proficientCount.toString()}
              sub="능숙 이상"
              accent="success"
            />
            <StatCard
              label="과제 커버리지"
              value={`${byAssignment.size}개`}
              sub="최소 1회 시도"
            />
          </div>

          <section className="mt-6">
            <div className="mb-3 text-[10px] font-medium uppercase tracking-wider text-neutral">
              과제별 최고 수준
            </div>
            {bestScores.length === 0 ? (
              <p className="text-[13px] text-text-secondary">
                아직 제출한 과제가 없어요. 첫 제출부터 여기에 쌓여요.
              </p>
            ) : (
              <ul className="divide-y divide-border-soft rounded-lg border border-border-soft">
                {bestScores.map(({ code, title, best }) => {
                  const prof = best.rubricScores
                    ? computeProficiency({
                        correctness: best.rubricScores.correctness ?? null,
                        style: best.rubricScores.style ?? null,
                        memory_safety: best.rubricScores.memory_safety ?? null,
                        reflection: best.rubricScores.reflection ?? null,
                      })
                    : null;
                  const attempts = byAssignment.get(code)?.length ?? 0;
                  return (
                    <li key={code} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-baseline gap-3">
                        <span className="font-mono text-[11px] text-neutral">{code}</span>
                        <span className="text-text-primary">{title ?? code}</span>
                        {attempts > 1 && (
                          <span className="rounded border border-border-soft px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
                            {attempts}회 시도
                          </span>
                        )}
                      </div>
                      {prof ? (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${prof.badgeClass}`}
                        >
                          <span>{prof.icon}</span>
                          <span>{prof.label}</span>
                        </span>
                      ) : (
                        <span className="rounded-full border border-border-soft px-2.5 py-1 text-[11px] text-text-secondary">
                          기록 없음
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="mt-6">
            <div className="mb-3 text-[10px] font-medium uppercase tracking-wider text-neutral">
              최근 제출 (시간순)
            </div>
            {submissions.length === 0 ? (
              <p className="text-[13px] text-text-secondary">
                {source === "memory"
                  ? "데모 모드에선 제출 이력이 저장되지 않아요."
                  : "아직 제출이 없어요."}
              </p>
            ) : (
              <ul className="space-y-2">
                {submissions.slice(0, 10).map((s) => {
                  const prof = s.rubricScores
                    ? computeProficiency({
                        correctness: s.rubricScores.correctness ?? null,
                        style: s.rubricScores.style ?? null,
                        memory_safety: s.rubricScores.memory_safety ?? null,
                        reflection: s.rubricScores.reflection ?? null,
                      })
                    : null;
                  return (
                    <li
                      key={s.id}
                      className="rounded-lg border border-border-soft bg-bg px-4 py-2.5"
                    >
                      <div className="flex items-baseline justify-between">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-[11px] text-neutral">
                            {s.assignmentCode?.slice(0, 3)}
                          </span>
                          <span className="text-[13px] text-text-primary">
                            {s.assignmentTitle ?? s.assignmentCode}
                          </span>
                        </div>
                        {prof && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${prof.badgeClass}`}
                          >
                            {prof.icon} {prof.label}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-neutral">
                        {new Date(s.submittedAt).toLocaleString("ko-KR")}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="mt-6 rounded-lg border border-border-soft bg-bg p-4 text-[11px] leading-relaxed text-text-secondary">
            <span className="font-medium text-text-primary">낙인 방지 원칙 · </span>
            다른 학생과 비교되는 수치는 여기에 표시하지 않아요. 내가 지난 주보다
            얼마나 나아졌는지만 주목해보세요.
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "success" | "primary";
}) {
  const valueColor = accent === "success" ? "text-success" : "text-text-primary";
  return (
    <div className="rounded-lg border border-border-soft bg-bg p-4">
      <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">{label}</div>
      <div className={`mt-1 font-display text-3xl font-semibold tracking-tighter ${valueColor}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-text-secondary">{sub}</div>}
    </div>
  );
}

function WeeklyGrowthCard({ submissions }: { submissions: SubmissionRow[] }) {
  const growth = computeWeeklyGrowth(
    submissions.map((s) => ({
      submittedAt: s.submittedAt,
      rubricScores: s.rubricScores
        ? {
            correctness: s.rubricScores.correctness ?? null,
            style: s.rubricScores.style ?? null,
            memory_safety: s.rubricScores.memory_safety ?? null,
            reflection: s.rubricScores.reflection ?? null,
          }
        : null,
    })),
  );

  if (growth.thisWeekCount === 0 && growth.lastWeekCount === 0) return null;

  const icon =
    growth.direction === "up"
      ? "↑"
      : growth.direction === "down"
        ? "↓"
        : growth.direction === "new"
          ? "✨"
          : "→";
  const tone =
    growth.direction === "up"
      ? "text-success"
      : growth.direction === "down"
        ? "text-warning"
        : growth.direction === "new"
          ? "text-primary"
          : "text-neutral";

  const message =
    growth.direction === "new"
      ? "이번 주 첫 기록이에요. 계속 쌓아봐요."
      : growth.direction === "up"
        ? "지난 주보다 좋아지고 있어요."
        : growth.direction === "down"
          ? "지난 주보다 조금 내려갔어요. 괜찮아요, 다시 쌓으면 돼요."
          : "지난 주와 비슷한 흐름이에요.";

  return (
    <section className="mb-6 rounded-xl border border-border-soft bg-bg p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Weekly Growth
          </div>
          <h3 className="mt-0.5 font-display text-lg font-semibold tracking-tighter text-text-primary">
            내 성장 (자기 비교)
          </h3>
        </div>
        <span className={`font-display text-3xl font-semibold tracking-tighter ${tone}`}>
          {icon}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
        <div className="rounded-md border border-border-soft bg-surface px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-neutral">지난 주</div>
          <div className="mt-1 font-mono text-[16px] text-text-primary">
            {growth.lastWeekAvg != null ? (growth.lastWeekAvg * 100).toFixed(0) : "—"}
          </div>
          <div className="text-[10px] text-neutral">{growth.lastWeekCount}회 제출</div>
        </div>
        <div className="rounded-md border border-border-soft bg-surface px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-neutral">이번 주</div>
          <div className={`mt-1 font-mono text-[16px] ${tone}`}>
            {growth.thisWeekAvg != null ? (growth.thisWeekAvg * 100).toFixed(0) : "—"}
          </div>
          <div className="text-[10px] text-neutral">{growth.thisWeekCount}회 제출</div>
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-text-secondary">{message}</p>
      <p className="mt-1 text-[10px] text-neutral">
        다른 학생과 비교하지 않아요 — 오직 내 과거와만.
      </p>
    </section>
  );
}
