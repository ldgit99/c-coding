import { CsvExportButton } from "@/components/research/SampleBadge";

/**
 * /research/variables — Variable Registry.
 *
 * 각 측정 변수의 operational definition · source · formula · unit.
 * SSCI reviewer 의 "정의가 모호하다" revision 차단용.
 */

interface VariableDef {
  name: string;
  description: string;
  source: string;
  formula: string;
  unit: string;
  range: string;
  code: string;
  tests: string;
}

const VARIABLES: VariableDef[] = [
  {
    name: "offloading_score",
    description:
      "Offloading 경향. 명령형·정답 요구 빈도에서 WH 질문·메타인지 빈도를 차감한 가중합.",
    source: "conversations (real-utterance subset)",
    formula:
      "0.4·imperative + 0.5·code_first − 0.3·wh − 0.3·metacog + 0.3 (clamped to [0, 1])",
    unit: "[0, 1]",
    range: "0 = exploratory, 1 = pure offloading",
    code: "packages/xapi/src/analytics/linguistic.ts:94 computeLinguisticProfile()",
    tests: "analytics.test.ts × 3 (wh/imperative/meta patterns)",
  },
  {
    name: "question_type",
    description:
      "학생 한 발화의 의도 분류. 메타인지 → 답 요청 → 디버깅 → 개념 → 기타 우선순위.",
    source: "conversations.text",
    formula: "rule-based regex classifier (no LLM)",
    unit: "categorical × 5",
    range: "{concept, debug, answer_request, metacognitive, other}",
    code: "packages/xapi/src/analytics/conversation.ts:64 classifyUtterance()",
    tests: "conversation.test.ts × 5",
  },
  {
    name: "is_real_utterance",
    description:
      "시스템이 자동 삽입한 프리셋(Level N 힌트 요청 등)이 아닌 학생의 자연 발화인지.",
    source: "conversations.text",
    formula:
      "length ≥ 3 AND not match(SYSTEM_PRESET_PATTERNS 7종)",
    unit: "boolean",
    range: "{true, false}",
    code: "packages/xapi/src/analytics/conversation.ts:47 isRealUtterance()",
    tests: "— (pattern inspection)",
  },
  {
    name: "frustration_score",
    description: "최근 10턴 내 frustration 어휘 비율 + 감정 강조 표현 가중.",
    source: "conversations.text (student, last 10 turns)",
    formula:
      "hits/10 + 0.05·intensity_terms, clamped to [0, 1]; hits = match(짜증|포기|모르겠|답답|힘들|어려워|못하겠|하기싫|지친|귀찮)",
    unit: "[0, 1]",
    range: "0 = neutral, 1 = highly frustrated",
    code: "packages/xapi/src/analytics/conversation.ts:89 frustrationScore()",
    tests: "conversation.test.ts × 2",
  },
  {
    name: "stuck_loop_flag",
    description: "최근 N턴에서 동일 KC 키워드가 k회 이상 반복되는지 (기본 window=8, min=3).",
    source: "conversations.text (student utterances)",
    formula:
      "max(count(term in last 8 turns)) ≥ 3 for term ∈ {포인터, 배열, 함수, ..., 세그폴트, null, 에러}",
    unit: "boolean + repeated term",
    range: "{flagged, clear}",
    code: "packages/xapi/src/analytics/conversation.ts:144 detectStuckLoop()",
    tests: "conversation.test.ts × 2",
  },
  {
    name: "hint_level",
    description:
      "Socratic hint cascade 의 단계. L1 question → L2 concept → L3 pseudocode → L4 example code.",
    source: "xAPI requestedHint/receivedHint events · meta.hintLevel",
    formula: "Server-side gated by ceiling rules (mode × attempt × stagnation × hints)",
    unit: "ordinal × 4",
    range: "{1, 2, 3, 4}",
    code: "packages/agents/src/runtime/gating.ts:26 computeAllowedLevel()",
    tests: "gating.test.ts × 5",
  },
  {
    name: "dependency_factor",
    description:
      "제출당 AI 의존도. hints / (hints + attempts) 의 누적 moving average. 학생에겐 노출 안 됨.",
    source: "submissions.dependency_factor · xAPI hint/submit events",
    formula: "hintRequests_thisAssignment / (attempts + hintRequests)",
    unit: "[0, 1]",
    range: "0 = independent, 1 = fully dependent",
    code: "packages/agents/src/runtime/learning-signals.ts:34 computeLearningSignals()",
    tests: "learning-signals.test.ts × 2",
  },
  {
    name: "self_explanation_axes",
    description:
      "Accept Gate 에서 학생이 제출한 자기설명의 3축 LLM 평가. 각 축 [0, 1].",
    source: "xAPI selfExplanationSubmitted event · result.axes",
    formula: "Claude Haiku rates {specificity, causality, transfer}; fallback heuristic if no API",
    unit: "3 × [0, 1]",
    range: "specificity · causality · transfer ∈ [0, 1]",
    code: "packages/agents/src/runtime/self-explanation.ts:evaluateSelfExplanation()",
    tests: "self-explanation.test.ts × 4",
  },
  {
    name: "conversation_arc",
    description: "한 학생의 과제별 대화 시퀀스를 5 canonical arc 로 규칙 기반 분류.",
    source: "conversations (real utterances) + xAPI submission events",
    formula:
      "priority: solo_confident → stuck_loop → answer_seek → productive → wandering",
    unit: "categorical × 5",
    range:
      "{productive, stuck_loop, answer_seek, wandering, solo_confident}",
    code: "packages/xapi/src/analytics/arcs.ts:classifyArc()",
    tests: "—",
  },
  {
    name: "cramer_V",
    description: "두 범주형 변수의 연관강도. Cohen guidelines: 0.1 weak · 0.3 moderate · 0.5 strong.",
    source: "contingency tables",
    formula: "sqrt(chi2 / (N · min(rows, cols) − 1))",
    unit: "[0, 1]",
    range: "0 = independent, 1 = perfect association",
    code: "packages/xapi/src/analytics/effect-sizes.ts:90 cramerV()",
    tests: "effect-sizes.test.ts × 2",
  },
  {
    name: "bootstrap_CI_95",
    description:
      "통계량의 95% 비모수 percentile bootstrap 신뢰구간. xorshift32 seeded (default=42).",
    source: "any numeric sample",
    formula:
      "1000 resamples with replacement, percentile method at [2.5%, 97.5%]",
    unit: "same as statistic",
    range: "[lo, hi]",
    code: "packages/xapi/src/analytics/effect-sizes.ts:148 bootstrapCI()",
    tests: "effect-sizes.test.ts · deterministic-with-seed",
  },
];

export default function VariablesPage() {
  return (
    <main className="mx-auto max-w-[1280px] px-8 py-8">
      <header className="mb-6 border-b border-border-soft pb-5">
        <div className="text-[10px] font-medium uppercase tracking-wider text-primary">
          Supplementary Material
        </div>
        <h1 className="mt-0.5 font-display text-3xl font-semibold tracking-tighter text-text-primary">
          Variable Registry
        </h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-text-secondary">
          각 측정 변수의 operational definition · source · formula · unit · code pointer · 테스트
          커버리지. SSCI supplementary 또는 논문 Methods 섹션 Variables 표로 직접 인용 가능.
        </p>
      </header>

      <div className="mb-4 flex justify-end">
        <CsvExportButton
          filename="variable_registry.csv"
          rows={VARIABLES as unknown as Array<Record<string, string>>}
        />
      </div>

      <div className="space-y-4">
        {VARIABLES.map((v) => (
          <article
            key={v.name}
            className="rounded-xl border border-border-soft bg-surface p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-mono text-[15px] font-semibold text-text-primary">
                  {v.name}
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
                  {v.description}
                </p>
              </div>
              <span className="shrink-0 rounded-sm border border-border-soft bg-bg px-2 py-0.5 text-[10px] font-mono text-text-secondary">
                {v.unit}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 text-[12px] md:grid-cols-2">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-neutral">Formula</dt>
                <dd className="mt-0.5 font-mono text-text-primary">{v.formula}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-neutral">Range</dt>
                <dd className="mt-0.5 font-mono text-text-primary">{v.range}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-neutral">Source</dt>
                <dd className="mt-0.5 font-mono text-text-secondary">{v.source}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-neutral">Code pointer</dt>
                <dd className="mt-0.5 font-mono text-primary">{v.code}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-[10px] uppercase tracking-wider text-neutral">Tests</dt>
                <dd className="mt-0.5 font-mono text-text-secondary">{v.tests}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </main>
  );
}
