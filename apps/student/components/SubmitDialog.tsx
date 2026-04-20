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
  { key: "Q1_difficult" as const, label: "이 코드에서 가장 어려웠던 부분은?" },
  { key: "Q2_hint_decisive" as const, label: "AI의 어떤 힌트가 결정적이었나?" },
  { key: "Q3_alternatives" as const, label: "가능했던 두 가지 해결안은 무엇이었고, 왜 이 방식을 선택했는가?" },
  { key: "Q4_why" as const, label: "왜 그렇게 생각했는가?" },
  { key: "Q5_next_time" as const, label: "다음에 비슷한 문제를 만나면 어떻게 접근하겠나?" },
];

type ReflectionState = Record<(typeof REFLECTION_PROMPTS)[number]["key"], string>;

export function SubmitDialog({
  editorCode,
  assignmentCode,
  onClose,
}: {
  editorCode: string;
  assignmentCode: string | null;
  onClose: () => void;
}) {
  const [reflection, setReflection] = useState<ReflectionState>({
    Q1_difficult: "",
    Q2_hint_decisive: "",
    Q3_alternatives: "",
    Q4_why: "",
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
      setResult((await res.json()) as SubmitResponse);
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }, [assignmentCode, editorCode, reflection]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded bg-white shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">제출 — 리플렉션 + 채점</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {!result ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
              className="space-y-3"
            >
              <p className="text-sm text-slate-600">
                research.md §3.4 — 제출 전 반드시 리플렉션 5문항에 답해야 해요. 대안 비교 질문(Q3)은 메타인지 훈련의 핵심이에요.
              </p>
              {REFLECTION_PROMPTS.map((p) => (
                <label key={p.key} className="block text-sm">
                  <span className="font-semibold text-slate-700">{p.label}</span>
                  <textarea
                    value={reflection[p.key]}
                    onChange={(e) => setReflection((r) => ({ ...r, [p.key]: e.target.value }))}
                    className="mt-1 w-full rounded border p-2 text-sm"
                    rows={2}
                  />
                </label>
              ))}
              {error && <div className="rounded bg-rose-50 p-2 text-sm text-rose-700">{error}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded border px-3 py-1.5 text-sm"
                  disabled={submitting}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
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
    <div className="space-y-3">
      <div className="rounded border p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">최종 점수</span>
          <span className={`text-2xl font-bold ${result.assessment.passed ? "text-emerald-700" : "text-rose-700"}`}>
            {(result.assessment.finalScore * 100).toFixed(1)}
          </span>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {result.assessment.passed ? "통과" : "재제출 필요"} · {result.mocked ? "[mock]" : result.usedModel}
        </div>
      </div>

      <div className="space-y-2">
        {bars.map(([name, value, weight]) => (
          <div key={name}>
            <div className="flex justify-between text-xs">
              <span className="font-semibold">{name}</span>
              <span className="text-slate-500">
                {value === null ? "—" : value.toFixed(2)} · 가중 {weight}
              </span>
            </div>
            <div className="mt-0.5 h-2 rounded bg-slate-100">
              <div
                className="h-2 rounded bg-slate-700"
                style={{ width: `${(value ?? 0) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <details>
        <summary className="cursor-pointer text-xs text-slate-600">증거 · KC 변동</summary>
        <div className="mt-2 space-y-1 text-xs">
          {result.assessment.evidence.map((e, i) => (
            <div key={i} className="rounded bg-slate-50 p-1.5">
              <span className="font-semibold">{e.criterion}</span>
              {e.partial && <span className="ml-1 text-amber-700">(partial)</span>}
              <div className="text-slate-600">{e.note}</div>
            </div>
          ))}
          {Object.keys(result.assessment.kcDelta).length > 0 && (
            <div className="mt-2 rounded bg-slate-50 p-1.5">
              <span className="font-semibold">KC Delta</span>
              <pre className="mt-1 whitespace-pre-wrap text-[11px]">
                {JSON.stringify(result.assessment.kcDelta, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
