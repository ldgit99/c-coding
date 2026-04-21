"use client";

import { useCallback, useState } from "react";

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
  const bars: Array<[string, number | null, number]> = [
    ["correctness", s.correctness, 0.5],
    ["style", s.style, 0.15],
    ["memory_safety", s.memory_safety, 0.2],
    ["reflection", s.reflection, 0.15],
  ];
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border-soft bg-bg p-5">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
          Final Score
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span
            className={`font-display text-5xl font-semibold tracking-tighter ${
              result.assessment.passed ? "text-success" : "text-error"
            }`}
          >
            {(result.assessment.finalScore * 100).toFixed(1)}
          </span>
          <span
            className={`rounded-sm px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
              result.assessment.passed
                ? "bg-success/10 text-success"
                : "bg-error/10 text-error"
            }`}
          >
            {result.assessment.passed ? "통과" : "재제출"}
          </span>
        </div>
        <div className="mt-1 text-[11px] font-mono text-neutral">
          {result.mocked ? "[mock]" : result.usedModel}
        </div>
      </div>

      <div className="space-y-3">
        {bars.map(([name, value, weight]) => (
          <div key={name}>
            <div className="flex items-baseline justify-between text-[12px]">
              <span className="font-medium uppercase tracking-wider text-text-primary">{name}</span>
              <span className="font-mono text-neutral">
                {value === null ? "—" : value.toFixed(2)} · w{weight}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border-soft">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(value ?? 0) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <details className="rounded-lg border border-border-soft bg-bg p-3">
        <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-neutral hover:text-text-secondary">
          증거 · KC 변동
        </summary>
        <div className="mt-3 space-y-2 text-[12px]">
          {result.assessment.evidence.map((e, i) => (
            <div key={i} className="rounded-md border border-border-soft bg-surface p-2">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-text-primary">{e.criterion}</span>
                {e.partial && (
                  <span className="rounded-sm bg-warning/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-warning">
                    partial
                  </span>
                )}
              </div>
              <div className="mt-1 text-text-secondary">{e.note}</div>
            </div>
          ))}
          {Object.keys(result.assessment.kcDelta).length > 0 && (
            <div className="rounded-md border border-border-soft bg-surface p-2">
              <div className="font-medium text-text-primary">KC Delta</div>
              <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px] text-text-secondary">
                {JSON.stringify(result.assessment.kcDelta, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
