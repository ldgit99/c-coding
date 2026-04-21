"use client";

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

  const passed = submissions.filter((s) => s.passed).length;
  const attempts = submissions.length;
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
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="총 제출" value={attempts.toString()} />
            <StatCard label="통과" value={passed.toString()} accent="success" />
            <StatCard
              label="과제 커버리지"
              value={`${byAssignment.size}개`}
              sub="최소 1회 시도"
            />
          </div>

          <section className="mt-6">
            <div className="mb-3 text-[10px] font-medium uppercase tracking-wider text-neutral">
              과제별 최고 점수
            </div>
            {bestScores.length === 0 ? (
              <p className="text-[13px] text-text-secondary">
                아직 제출한 과제가 없어요. 첫 제출부터 여기에 쌓여요.
              </p>
            ) : (
              <ul className="divide-y divide-border-soft rounded-lg border border-border-soft">
                {bestScores.map(({ code, title, best }) => (
                  <li key={code} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-[11px] text-neutral">{code}</span>
                      <span className="text-text-primary">{title ?? code}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-display text-xl font-semibold tracking-tighter ${
                          best.passed ? "text-success" : "text-text-secondary"
                        }`}
                      >
                        {best.finalScore != null ? (best.finalScore * 100).toFixed(0) : "—"}
                      </span>
                      <span
                        className={`rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                          best.passed
                            ? "bg-success/10 text-success"
                            : "bg-warning/10 text-warning"
                        }`}
                      >
                        {best.passed ? "통과" : "재도전"}
                      </span>
                    </div>
                  </li>
                ))}
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
                {submissions.slice(0, 10).map((s) => (
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
                      <span
                        className={`font-mono text-[12px] ${
                          s.passed ? "text-success" : "text-warning"
                        }`}
                      >
                        {s.finalScore != null ? (s.finalScore * 100).toFixed(0) : "—"}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-neutral">
                      {new Date(s.submittedAt).toLocaleString("ko-KR")}
                    </div>
                  </li>
                ))}
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
