"use client";

import { useCallback, useState } from "react";

import { computeProficiency } from "@/lib/proficiency";

interface RubricScores {
  correctness: number | null;
  style: number | null;
  memory_safety: number | null;
  reflection: number | null;
}

interface SubmitResponse {
  assessment: {
    rubricScores: RubricScores;
    finalScore: number;
    passed: boolean;
    evidence: Array<{ criterion: string; note: string; partial: boolean }>;
    kcDelta: Record<string, number>;
  };
  usedModel: string;
  mocked: boolean;
}

const REFLECTION_PROMPTS = [
  {
    key: "Q1_difficult" as const,
    label: "이 과제에서 가장 어려웠던 부분은 무엇이고, 어떻게 해결했나요?",
  },
  {
    key: "Q3_alternatives" as const,
    label: "다른 방법으로도 풀 수 있었나요? 그중 왜 이 방식을 택했는지 한 문장으로 적어봐요.",
  },
  {
    key: "Q5_next_time" as const,
    label: "비슷한 문제를 다시 만나면 무엇을 다르게 하겠나요?",
  },
];

type ReflectionState = Record<(typeof REFLECTION_PROMPTS)[number]["key"], string>;

export function SubmitDialog({
  editorCode,
  assignmentCode,
  onClose,
  onSubmitted,
}: {
  editorCode: string;
  assignmentCode: string | null;
  onClose: () => void;
  onSubmitted?: (passed: boolean) => void;
}) {
  const [reflection, setReflection] = useState<ReflectionState>({
    Q1_difficult: "",
    Q3_alternatives: "",
    Q5_next_time: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: editorCode,
          reflection,
          assignment: assignmentCode ? { id: assignmentCode } : undefined,
        }),
      });
      if (!res.ok) {
        const msg = await res.text();
        setError(`제출 실패: ${msg}`);
        return;
      }
      const parsed = (await res.json()) as SubmitResponse;
      setResult(parsed);
      onSubmitted?.(parsed.assessment.passed);
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }, [assignmentCode, editorCode, reflection, onSubmitted]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border-soft bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-border-soft px-6 py-4">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
              Submit
            </div>
            <h2 className="mt-0.5 font-display text-xl font-semibold tracking-tighter text-text-primary">
              리플렉션 + 채점
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

        <div className="flex-1 overflow-auto px-6 py-5">
          {!result ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
              className="space-y-4"
            >
              <p className="text-[13px] leading-relaxed text-text-secondary">
                제출 전 3문항에 답해야 해요. 두 번째 질문(대안 비교)이 메타인지 훈련의 핵심이에요.
              </p>
              {REFLECTION_PROMPTS.map((p, i) => (
                <label key={p.key} className="block">
                  <div className="flex items-baseline gap-2 text-[10px] uppercase tracking-wider text-neutral">
                    <span className="font-mono text-primary">Q{i + 1}</span>
                  </div>
                  <span className="mt-0.5 block text-[13px] font-medium text-text-primary">
                    {p.label}
                  </span>
                  <textarea
                    value={reflection[p.key]}
                    onChange={(e) => setReflection((r) => ({ ...r, [p.key]: e.target.value }))}
                    className="mt-2 w-full rounded-md border border-border-soft bg-white p-3 text-[13px] text-text-primary focus:border-primary focus:outline-none focus:shadow-ring"
                    rows={2}
                  />
                </label>
              ))}
              {error && (
                <div className="rounded-md border border-error/20 bg-error/5 p-3 text-[13px] text-error">
                  {error}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-border-soft px-4 py-2 text-[13px] text-text-primary transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
                  disabled={submitting}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-white transition-all hover:-translate-y-px hover:bg-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  disabled={submitting}
                >
                  {submitting ? "채점 중…" : "제출하기"}
                </button>
              </div>
            </form>
          ) : (
            <ScoreCard result={result} />
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreCard({ result }: { result: SubmitResponse }) {
  const s = result.assessment.rubricScores;
  const prof = computeProficiency(s);
  const evidenceByCriterion = new Map<string, Array<{ note: string; partial: boolean }>>();
  for (const e of result.assessment.evidence) {
    const bucket = evidenceByCriterion.get(e.criterion) ?? [];
    bucket.push({ note: e.note, partial: e.partial });
    evidenceByCriterion.set(e.criterion, bucket);
  }

  return (
    <div className="space-y-5">
      {/* 상단 — Proficiency 레벨 배지 + 다음 레벨 가이드 */}
      <div className="rounded-xl border border-border-soft bg-bg p-5">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
          Proficiency
        </div>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl">{prof.icon}</span>
              <span
                className={`font-display text-3xl font-semibold tracking-tighter ${prof.accentClass}`}
              >
                {prof.label}
              </span>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">
              {prof.description}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${prof.badgeClass}`}
          >
            {prof.passed ? "학습 완료" : "진행 중"}
          </span>
        </div>
        {prof.gap && (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-border-soft bg-surface px-3 py-2 text-[12px] text-text-secondary">
            <span className="text-[10px] uppercase tracking-wider text-neutral">
              Next → {prof.gap.nextLabel}
            </span>
            <span className="text-text-primary">
              <strong className="font-medium">{prof.gap.axisLabel}</strong> 을 지금{" "}
              <span className="font-mono">{(prof.gap.current * 100).toFixed(0)}</span> 에서{" "}
              <span className="font-mono text-primary">
                {(prof.gap.needed * 100).toFixed(0)}
              </span>{" "}
              이상으로
            </span>
          </div>
        )}
      </div>

      {/* ① 문제 해결 */}
      <DiagnosticSection
        number="①"
        title="문제 해결"
        subtitle="제시된 입력을 올바른 출력으로 변환했는지"
        primaryAxis={{ name: "정답 정확도", value: s.correctness }}
        secondaryAxes={[{ name: "메모리 안전성", value: s.memory_safety }]}
        evidence={[
          ...(evidenceByCriterion.get("correctness") ?? []),
          ...(evidenceByCriterion.get("memory_safety") ?? []),
        ]}
        guidance={guidanceForCorrectness(s.correctness)}
      />

      {/* ② 코드 품질 */}
      <DiagnosticSection
        number="②"
        title="코드 품질"
        subtitle="가독성·관습·구조가 잘 지켜졌는지"
        primaryAxis={{ name: "코드 스타일", value: s.style }}
        secondaryAxes={[]}
        evidence={evidenceByCriterion.get("style") ?? []}
        guidance={guidanceForStyle(s.style)}
      />

      {/* ③ 성찰 깊이 */}
      <DiagnosticSection
        number="③"
        title="성찰 깊이"
        subtitle="풀이 과정과 대안을 스스로 설명했는지"
        primaryAxis={{ name: "리플렉션", value: s.reflection }}
        secondaryAxes={[]}
        evidence={evidenceByCriterion.get("reflection") ?? []}
        guidance={guidanceForReflection(s.reflection)}
      />

      {/* KC 변동 — 접이식 */}
      {Object.keys(result.assessment.kcDelta).length > 0 && (
        <details className="rounded-lg border border-border-soft bg-bg p-3">
          <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-neutral hover:text-text-secondary">
            KC 변동 보기
          </summary>
          <div className="mt-3 space-y-1 font-mono text-[11px]">
            {Object.entries(result.assessment.kcDelta).map(([kc, delta]) => (
              <div key={kc} className="flex justify-between">
                <span className="text-text-primary">{kc}</span>
                <span
                  className={
                    delta >= 0 ? "text-success" : "text-error"
                  }
                >
                  {delta >= 0 ? "+" : ""}
                  {delta.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="text-right text-[10px] font-mono text-neutral">
        {result.mocked ? "[mock]" : result.usedModel}
      </div>
    </div>
  );
}

function DiagnosticSection({
  number,
  title,
  subtitle,
  primaryAxis,
  secondaryAxes,
  evidence,
  guidance,
}: {
  number: string;
  title: string;
  subtitle: string;
  primaryAxis: { name: string; value: number | null };
  secondaryAxes: Array<{ name: string; value: number | null }>;
  evidence: Array<{ note: string; partial: boolean }>;
  guidance: string;
}) {
  return (
    <section className="rounded-xl border border-border-soft bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="font-display text-2xl font-semibold tracking-tighter text-primary">
          {number}
        </span>
        <div className="flex-1">
          <h3 className="font-display text-base font-semibold tracking-tighter text-text-primary">
            {title}
          </h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-text-secondary">{subtitle}</p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <AxisBar axis={primaryAxis} isPrimary />
        {secondaryAxes.map((a) => (
          <AxisBar key={a.name} axis={a} />
        ))}
      </div>

      {evidence.length > 0 && (
        <ul className="mt-3 space-y-1 text-[11px] text-text-secondary">
          {evidence.map((e, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-neutral" />
              <span>
                {e.note}
                {e.partial && (
                  <span className="ml-1 rounded-sm bg-warning/10 px-1 py-0.5 text-[9px] uppercase tracking-wider text-warning">
                    partial
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 rounded-md bg-bg px-3 py-2 text-[12px] leading-relaxed text-text-primary">
        <span className="mr-1 text-primary">→</span>
        {guidance}
      </div>
    </section>
  );
}

function AxisBar({
  axis,
  isPrimary,
}: {
  axis: { name: string; value: number | null };
  isPrimary?: boolean;
}) {
  const v = axis.value ?? 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px]">
        <span className={isPrimary ? "font-medium text-text-primary" : "text-text-secondary"}>
          {axis.name}
        </span>
        <span className="font-mono text-neutral">
          {axis.value === null ? "—" : (v * 100).toFixed(0)}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border-soft">
        <div
          className={`h-full rounded-full transition-all ${
            v >= 0.8 ? "bg-success" : v >= 0.5 ? "bg-primary" : "bg-warning"
          }`}
          style={{ width: `${v * 100}%` }}
        />
      </div>
    </div>
  );
}

function guidanceForCorrectness(value: number | null): string {
  if (value === null) return "숨은 테스트가 실행되지 않았어요. 서버 설정을 확인해보세요.";
  if (value >= 0.95) return "거의 모든 테스트를 통과했어요. 기본기가 탄탄해요.";
  if (value >= 0.5) return "핵심 로직은 맞았지만 일부 경계 케이스가 남아있어요. 입력값이 극단일 때를 다시 점검해보세요.";
  if (value > 0) return "일부만 통과했어요. 기본 예시부터 다시 실행해 보고 출력 형식(개행·공백)을 확인해보세요.";
  return "아직 테스트를 통과하지 못했어요. 주어진 예시를 먼저 맞춰보세요.";
}

function guidanceForStyle(value: number | null): string {
  if (value === null) return "코드 스타일 분석이 없었어요.";
  if (value >= 0.9) return "군더더기 없는 깔끔한 코드예요.";
  if (value >= 0.7) return "읽기 좋은 편이에요. 매직 넘버·긴 함수 등 한두 군데만 정리하면 더 좋아져요.";
  return "변수명·들여쓰기·상수화 등 기본 관습을 점검해보세요. 주석으로 의도를 남기는 것도 도움이 돼요.";
}

function guidanceForReflection(value: number | null): string {
  if (value === null) return "리플렉션이 집계되지 않았어요.";
  if (value >= 0.7) return "과정·대안·전이까지 풍부하게 정리됐어요. 좋은 학습 습관이에요.";
  if (value >= 0.4)
    return "답을 좀 더 구체적으로 — 변수·함수 이름을 넣거나 '다른 방법으로는 ~' 같은 대조어를 써보세요.";
  return "성찰 답변이 짧아요. 한 문장씩만 늘려도 학습 효과가 크게 올라가요.";
}
