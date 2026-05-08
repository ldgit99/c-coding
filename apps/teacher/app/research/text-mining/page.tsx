"use client";

import { useEffect, useState } from "react";

import { CsvExportButton, ReproFooter, SampleBadge } from "@/components/research/SampleBadge";

type TerminativeEnding =
  | "interrogative"
  | "assertive"
  | "hedge"
  | "directive"
  | "none";
type HelpSeekingStrategy = "instrumental" | "executive" | "other";
type DiscourseCategory =
  | "inference"
  | "contrast"
  | "hypothesis"
  | "sequence"
  | "reflection";

interface PerStudent {
  studentIdHashed: string;
  utteranceCount: number;
  terminative: Record<TerminativeEnding, number>;
  helpSeeking: Record<HelpSeekingStrategy, number>;
  helpSeekingInstrumentalShare: number;
  codeSwitchRate: number;
  mtld: number;
  discourseMarkersPerUtterance: number;
  discourseByCategory: Record<DiscourseCategory, number>;
}

interface BootstrapEstimate {
  estimate: number;
  lo: number;
  hi: number;
  n: number;
}

interface Descriptives {
  n: number;
  mean: number;
  sd: number;
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
}

interface Response {
  source: string;
  sample: {
    students: number;
    studentsWithUtterances: number;
    utterances: number;
    windowDays: number;
    since: string;
    until: string;
  };
  cohort: {
    terminative: Record<TerminativeEnding, number> & { total: number };
    helpSeeking: Record<HelpSeekingStrategy, number> & {
      total: number;
      instrumentalShare: number;
    };
    codeSwitch: {
      hangul: number;
      english: number;
      mixed: number;
      total: number;
      codeSwitchRate: number;
    };
    discourse: {
      byCategory: Record<DiscourseCategory, number>;
      byMarker: Record<string, number>;
      markersPerUtterance: number;
    };
    mtld: { score: number; tokenCount: number };
  };
  perStudent: PerStudent[];
  confidenceIntervals: {
    codeSwitchRate: BootstrapEstimate;
    instrumentalShare: BootstrapEstimate;
    mtld: BootstrapEstimate;
    discourseMarkersPerUtterance: BootstrapEstimate;
  };
  descriptives: {
    codeSwitchRate: Descriptives;
    instrumentalShare: Descriptives;
    mtld: Descriptives;
    discourseMarkersPerUtterance: Descriptives;
  };
  trajectory: {
    bins: number;
    binSizeHours: number;
    codeSwitchByDay: number[];
    instrumentalShareByDay: number[];
  };
  generatedAt: string;
  pipeline: string;
}

const TERM_LABEL: Record<TerminativeEnding, { ko: string; hex: string }> = {
  interrogative: { ko: "의문 (~인가요/~죠)", hex: "#6366F1" },
  assertive: { ko: "확신 (~네요/~겠어요)", hex: "#10B981" },
  hedge: { ko: "모호 (~같아요/~듯)", hex: "#F59E0B" },
  directive: { ko: "명령 (~해줘/~주세요)", hex: "#EF4444" },
  none: { ko: "기타", hex: "#94A3B8" },
};

const HS_LABEL: Record<HelpSeekingStrategy, { ko: string; hex: string }> = {
  instrumental: { ko: "Instrumental (이해 추구)", hex: "#10B981" },
  executive: { ko: "Executive (답 요청)", hex: "#EF4444" },
  other: { ko: "Other", hex: "#94A3B8" },
};

const DISC_LABEL: Record<DiscourseCategory, { ko: string; hex: string }> = {
  inference: { ko: "추론 (그래서/따라서)", hex: "#6366F1" },
  contrast: { ko: "대조 (근데/하지만)", hex: "#F59E0B" },
  hypothesis: { ko: "가설 (혹시/만약)", hex: "#10B981" },
  sequence: { ko: "순서 (일단/우선)", hex: "#94A3B8" },
  reflection: { ko: "성찰 (정리하면/요약)", hex: "#8B5CF6" },
};

export default function TextMiningPage() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/research/text-mining", { cache: "no-store" });
        setData((await res.json()) as Response);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-[1280px] px-8 py-8">
      <header className="mb-6 border-b border-border-soft pb-5">
        <div className="text-[10px] font-medium uppercase tracking-wider text-primary">
          Paper 6
        </div>
        <h1 className="mt-0.5 font-display text-3xl font-semibold tracking-tighter text-text-primary">
          Korean CS1 Discourse Patterns in AI-Tutor Dialogue
        </h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-text-secondary">
          <strong>RQ</strong>: Korean CS1 학생의 AI tutor 발화에서 종결어미·코드스위칭·
          help-seeking strategy·담화 마커 패턴이 KC mastery 와 학습 성과를 예측하는가?
          외부 NLP 의존성 없이 결정적 정규식 휴리스틱으로 측정. 분류 규칙은
          단위테스트로 고정 (
          <code className="font-mono text-[12px]">
            packages/xapi/src/analytics/text-mining.ts
          </code>
          ).
        </p>
      </header>

      {loading && <div className="text-[13px] text-neutral">로딩 중…</div>}

      {data && (
        <>
          <div className="mb-6">
            <SampleBadge
              n={data.sample.studentsWithUtterances}
              label="active students"
              period={`${data.sample.since.slice(0, 10)} → ${data.sample.until.slice(0, 10)}`}
              note={`${data.sample.utterances} utterances · cohort N=${data.sample.students}`}
            />
          </div>

          {data.sample.utterances === 0 ? (
            <section className="rounded-xl border border-warning/30 bg-warning/5 p-6 text-[13px] text-warning">
              7일 이내 분석 가능한 학생 발화가 없습니다. 학생 활동을 기다리거나 시간
              윈도우를 넓히세요(현재 7일 고정).
            </section>
          ) : (
            <>
              <Figure1Terminative data={data} />
              <Figure2CodeSwitching data={data} />
              <Figure3MTLD data={data} />
              <Figure4HelpSeeking data={data} />
              <Figure5Discourse data={data} />
            </>
          )}

          <ReproFooter snapshot={data.generatedAt} pipeline={data.pipeline} />
        </>
      )}
    </main>
  );
}

// ============================================================================
// F1 — 종결어미 분포
// ============================================================================
function Figure1Terminative({ data }: { data: Response }) {
  const types: TerminativeEnding[] = [
    "interrogative",
    "assertive",
    "hedge",
    "directive",
    "none",
  ];
  const cohortTotal = data.cohort.terminative.total || 1;
  const csvRows = data.perStudent.map((s) => ({
    studentId_hashed: s.studentIdHashed,
    n: s.utteranceCount,
    interrogative: s.terminative.interrogative,
    assertive: s.terminative.assertive,
    hedge: s.terminative.hedge,
    directive: s.terminative.directive,
    none: s.terminative.none,
  }));

  return (
    <section className="mb-8 rounded-xl border border-border-soft bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Figure 1
          </div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary">
            Terminative Ending Distribution
          </h2>
          <p className="mt-0.5 text-[11px] text-text-secondary">
            Definition: Each utterance categorized by its sentence-ending into 5 mutually exclusive
            classes (rule-based regex; precedence hedge {">"} interrogative {">"} directive {">"}
            assertive). Hedge endings (~같아요/~듯) hypothesized to mark uncertainty during early
            mastery; assertive (~네요/~겠어요) to mark confidence post-mastery.
          </p>
        </div>
        <CsvExportButton filename="paper6_f1_terminative.csv" rows={csvRows} />
      </div>

      {/* cohort 누적 막대 */}
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-wider text-neutral">Cohort total</div>
        <div className="mt-1 flex h-5 overflow-hidden rounded-md">
          {types.map((t) => {
            const n = data.cohort.terminative[t];
            const pct = (n / cohortTotal) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={t}
                className="flex items-center justify-center text-[10px] font-medium text-white"
                style={{ width: `${pct}%`, backgroundColor: TERM_LABEL[t].hex }}
                title={`${TERM_LABEL[t].ko} ${n} (${pct.toFixed(1)}%)`}
              >
                {pct >= 8 ? `${pct.toFixed(0)}%` : ""}
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-text-secondary">
          {types.map((t) => (
            <span key={t} className="inline-flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ backgroundColor: TERM_LABEL[t].hex }}
              />
              {TERM_LABEL[t].ko}
            </span>
          ))}
        </div>
      </div>

      {/* per-student stacked */}
      <div className="space-y-1">
        {data.perStudent.map((s) => {
          const total = s.utteranceCount || 1;
          return (
            <div key={s.studentIdHashed} className="flex items-center gap-2 text-[11px]">
              <span className="w-28 truncate font-mono text-text-secondary">
                {s.studentIdHashed.slice(0, 14)}…
              </span>
              <span className="w-8 text-right font-mono text-text-primary">
                {s.utteranceCount}
              </span>
              <div className="flex h-3 flex-1 overflow-hidden rounded-sm">
                {types.map((t) => {
                  const n = s.terminative[t];
                  const pct = (n / total) * 100;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={t}
                      style={{ width: `${pct}%`, backgroundColor: TERM_LABEL[t].hex }}
                      title={`${TERM_LABEL[t].ko}: ${n}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] italic text-text-secondary">
        Caption: Per-student distribution of terminative-ending classes (n =
        {data.sample.studentsWithUtterances} students with non-empty dialogue, total{" "}
        {data.sample.utterances} utterances). System preset utterances excluded.
      </p>
    </section>
  );
}

// ============================================================================
// F2 — 코드 스위칭 trajectory + cohort
// ============================================================================
function Figure2CodeSwitching({ data }: { data: Response }) {
  const ci = data.confidenceIntervals.codeSwitchRate;
  const csvRows = data.perStudent.map((s) => ({
    studentId_hashed: s.studentIdHashed,
    n: s.utteranceCount,
    code_switch_rate: s.codeSwitchRate,
  }));
  const trajectoryRows = data.trajectory.codeSwitchByDay.map((v, i) => ({
    day_offset: i,
    code_switch_rate: v,
  }));

  return (
    <section className="mb-8 rounded-xl border border-border-soft bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Figure 2
          </div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary">
            Code-Switching Rate (Korean ↔ English Technical Tokens)
          </h2>
          <p className="mt-0.5 text-[11px] text-text-secondary">
            Definition: ratio of (english + mixed) tokens to total tokens per student utterance set.
            Tokens split on whitespace + punctuation + C-syntax operators ({"*"}, {"-"}, {"+"},
            etc.). Hypothesis: rising rate ↔ technical vocabulary acquisition.
          </p>
        </div>
        <CsvExportButton filename="paper6_f2_code_switching.csv" rows={csvRows} />
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-border-soft bg-bg p-3">
          <div className="text-[10px] uppercase tracking-wider text-neutral">
            Cohort token composition
          </div>
          <div className="mt-1 font-mono text-[12px] text-text-primary">
            한글 {data.cohort.codeSwitch.hangul} · 영문{" "}
            {data.cohort.codeSwitch.english} · 혼합 {data.cohort.codeSwitch.mixed}
          </div>
          <div className="mt-1 text-[11px] text-text-secondary">
            전체 {data.cohort.codeSwitch.total.toLocaleString()} tokens · code-switch rate
            <span className="ml-1 font-mono text-text-primary">
              {(data.cohort.codeSwitch.codeSwitchRate * 100).toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="rounded-md border border-border-soft bg-bg p-3">
          <div className="text-[10px] uppercase tracking-wider text-neutral">
            Per-student mean (95% CI, percentile bootstrap)
          </div>
          <div className="mt-1 font-mono text-[12px] text-text-primary">
            {(ci.estimate * 100).toFixed(1)}%
            <span className="ml-1 text-text-secondary">
              [{(ci.lo * 100).toFixed(1)}, {(ci.hi * 100).toFixed(1)}]
            </span>
          </div>
          <div className="mt-1 text-[11px] text-text-secondary">
            iters=2000 · seed=42 · n={ci.n}
          </div>
        </div>
      </div>

      {/* trajectory sparkline */}
      <div className="mb-4 rounded-md border border-border-soft p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wider text-neutral">
            7-day daily trajectory (cohort mean)
          </div>
          <CsvExportButton
            filename="paper6_f2_trajectory.csv"
            rows={trajectoryRows}
            label="📥 traj"
          />
        </div>
        <Sparkline values={data.trajectory.codeSwitchByDay} color="#6366F1" max={0.5} />
        <div className="mt-1 flex justify-between text-[9px] text-neutral">
          {data.trajectory.codeSwitchByDay.map((v, i) => (
            <span key={i}>{(v * 100).toFixed(0)}%</span>
          ))}
        </div>
      </div>

      {/* per-student bars */}
      <div className="space-y-1">
        {data.perStudent.map((s) => (
          <div key={s.studentIdHashed} className="flex items-center gap-2 text-[11px]">
            <span className="w-28 truncate font-mono text-text-secondary">
              {s.studentIdHashed.slice(0, 14)}…
            </span>
            <span className="w-8 text-right font-mono text-text-primary">
              {s.utteranceCount}
            </span>
            <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-border-soft">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, s.codeSwitchRate * 100 * 2)}%` }}
              />
            </div>
            <span className="w-12 text-right font-mono text-text-primary">
              {(s.codeSwitchRate * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[10px] italic text-text-secondary">
        Caption: Code-switching rate per student over 7-day window. Bar width scaled ×2 for
        readability (typical range 0–50%). Cohort mean and 95% percentile bootstrap CI shown above.
      </p>
    </section>
  );
}

// ============================================================================
// F3 — MTLD
// ============================================================================
function Figure3MTLD({ data }: { data: Response }) {
  const ci = data.confidenceIntervals.mtld;
  const desc = data.descriptives.mtld;
  const csvRows = data.perStudent.map((s) => ({
    studentId_hashed: s.studentIdHashed,
    n_utterances: s.utteranceCount,
    mtld: s.mtld,
  }));

  return (
    <section className="mb-8 rounded-xl border border-border-soft bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Figure 3
          </div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary">
            Lexical Diversity (MTLD, McCarthy 2005)
          </h2>
          <p className="mt-0.5 text-[11px] text-text-secondary">
            Definition: Forward and backward MTLD (TTR threshold = 0.72) averaged. Higher = more
            diverse vocabulary. Token cleaning: lowercased, separator-split (no Korean morphological
            analysis — surface form). Hypothesized to rise with KC mastery.
          </p>
        </div>
        <CsvExportButton filename="paper6_f3_mtld.csv" rows={csvRows} />
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <DescriptiveCard label="Mean (95% CI)" value={`${ci.estimate.toFixed(1)}`} sub={`[${ci.lo.toFixed(1)}, ${ci.hi.toFixed(1)}]`} />
        <DescriptiveCard label="Median (Q1, Q3)" value={`${desc.median.toFixed(1)}`} sub={`(${desc.q1.toFixed(1)}, ${desc.q3.toFixed(1)})`} />
        <DescriptiveCard label="Range" value={`${desc.min.toFixed(0)} – ${desc.max.toFixed(0)}`} sub={`SD=${desc.sd.toFixed(1)}`} />
      </div>

      {/* histogram-ish — sorted bar */}
      <div className="space-y-1">
        {[...data.perStudent]
          .sort((a, b) => b.mtld - a.mtld)
          .map((s) => {
            const max = Math.max(1, ...data.perStudent.map((p) => p.mtld));
            return (
              <div key={s.studentIdHashed} className="flex items-center gap-2 text-[11px]">
                <span className="w-28 truncate font-mono text-text-secondary">
                  {s.studentIdHashed.slice(0, 14)}…
                </span>
                <span className="w-8 text-right font-mono text-text-primary">
                  {s.utteranceCount}
                </span>
                <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-border-soft">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full"
                    style={{
                      width: `${(s.mtld / max) * 100}%`,
                      backgroundColor: "#10B981",
                    }}
                  />
                </div>
                <span className="w-14 text-right font-mono text-text-primary">
                  {s.mtld.toFixed(1)}
                </span>
              </div>
            );
          })}
      </div>
    </section>
  );
}

// ============================================================================
// F4 — Help-seeking strategy
// ============================================================================
function Figure4HelpSeeking({ data }: { data: Response }) {
  const ci = data.confidenceIntervals.instrumentalShare;
  const cohortShare = data.cohort.helpSeeking.instrumentalShare;
  const csvRows = data.perStudent.map((s) => ({
    studentId_hashed: s.studentIdHashed,
    n: s.utteranceCount,
    instrumental: s.helpSeeking.instrumental,
    executive: s.helpSeeking.executive,
    other: s.helpSeeking.other,
    instrumental_share: s.helpSeekingInstrumentalShare,
  }));
  const trajRows = data.trajectory.instrumentalShareByDay.map((v, i) => ({
    day_offset: i,
    instrumental_share: v,
  }));

  return (
    <section className="mb-8 rounded-xl border border-border-soft bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Figure 4
          </div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary">
            Help-Seeking Strategy (Instrumental vs Executive)
          </h2>
          <p className="mt-0.5 text-[11px] text-text-secondary">
            Definition: per-utterance classification — <em>instrumental</em> (왜/어떻게/이해 안돼)
            seeks understanding; <em>executive</em> (그냥 답/코드 줘/대신 풀어줘) seeks immediate
            answer. Newman (1990) framework. Instrumental share = inst/(inst+exec). Hypothesized to
            correlate +ve with metacognitive performance.
          </p>
        </div>
        <CsvExportButton filename="paper6_f4_help_seeking.csv" rows={csvRows} />
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-border-soft bg-bg p-3">
          <div className="text-[10px] uppercase tracking-wider text-neutral">Cohort</div>
          <div className="mt-1 font-mono text-[12px] text-text-primary">
            instrumental {data.cohort.helpSeeking.instrumental} · executive{" "}
            {data.cohort.helpSeeking.executive} · other {data.cohort.helpSeeking.other}
          </div>
          <div className="mt-1 text-[11px] text-text-secondary">
            instrumental share <span className="font-mono">{(cohortShare * 100).toFixed(1)}%</span>
          </div>
        </div>
        <div className="rounded-md border border-border-soft bg-bg p-3">
          <div className="text-[10px] uppercase tracking-wider text-neutral">
            Per-student mean (95% CI)
          </div>
          <div className="mt-1 font-mono text-[12px] text-text-primary">
            {(ci.estimate * 100).toFixed(1)}%
            <span className="ml-1 text-text-secondary">
              [{(ci.lo * 100).toFixed(1)}, {(ci.hi * 100).toFixed(1)}]
            </span>
          </div>
        </div>
      </div>

      {/* trajectory */}
      <div className="mb-4 rounded-md border border-border-soft p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wider text-neutral">
            7-day instrumental share trajectory
          </div>
          <CsvExportButton
            filename="paper6_f4_trajectory.csv"
            rows={trajRows}
            label="📥 traj"
          />
        </div>
        <Sparkline values={data.trajectory.instrumentalShareByDay} color="#10B981" max={1} />
        <div className="mt-1 flex justify-between text-[9px] text-neutral">
          {data.trajectory.instrumentalShareByDay.map((v, i) => (
            <span key={i}>{(v * 100).toFixed(0)}%</span>
          ))}
        </div>
      </div>

      {/* per-student stacked + share */}
      <div className="space-y-1">
        {data.perStudent.map((s) => {
          const total = s.helpSeeking.instrumental + s.helpSeeking.executive + s.helpSeeking.other || 1;
          return (
            <div key={s.studentIdHashed} className="flex items-center gap-2 text-[11px]">
              <span className="w-28 truncate font-mono text-text-secondary">
                {s.studentIdHashed.slice(0, 14)}…
              </span>
              <div className="flex h-3 flex-1 overflow-hidden rounded-sm">
                {(["instrumental", "executive", "other"] as HelpSeekingStrategy[]).map((k) => {
                  const n = s.helpSeeking[k];
                  const pct = (n / total) * 100;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={k}
                      style={{ width: `${pct}%`, backgroundColor: HS_LABEL[k].hex }}
                      title={`${HS_LABEL[k].ko}: ${n}`}
                    />
                  );
                })}
              </div>
              <span className="w-16 text-right font-mono text-text-primary">
                share {(s.helpSeekingInstrumentalShare * 100).toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ============================================================================
// F5 — Discourse markers
// ============================================================================
function Figure5Discourse({ data }: { data: Response }) {
  const ci = data.confidenceIntervals.discourseMarkersPerUtterance;
  const cats: DiscourseCategory[] = [
    "inference",
    "contrast",
    "hypothesis",
    "sequence",
    "reflection",
  ];
  const csvRows = data.perStudent.map((s) => ({
    studentId_hashed: s.studentIdHashed,
    n_utterances: s.utteranceCount,
    inference: s.discourseByCategory.inference,
    contrast: s.discourseByCategory.contrast,
    hypothesis: s.discourseByCategory.hypothesis,
    sequence: s.discourseByCategory.sequence,
    reflection: s.discourseByCategory.reflection,
    markers_per_utterance: s.discourseMarkersPerUtterance,
  }));

  // top markers
  const sortedMarkers = Object.entries(data.cohort.discourse.byMarker).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <section className="mb-8 rounded-xl border border-border-soft bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
            Figure 5
          </div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary">
            Discourse Marker Frequency (SRL signals)
          </h2>
          <p className="mt-0.5 text-[11px] text-text-secondary">
            Definition: literal substring matches for 23 Korean discourse markers across 5
            categories (inference, contrast, hypothesis, sequence, reflection). Reflection markers
            (정리하면/요약하면) interpreted as metacognitive. Hypothesized to indicate active
            self-regulated learning.
          </p>
        </div>
        <CsvExportButton filename="paper6_f5_discourse.csv" rows={csvRows} />
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-border-soft bg-bg p-3">
          <div className="text-[10px] uppercase tracking-wider text-neutral">
            Markers per utterance — cohort
          </div>
          <div className="mt-1 font-mono text-[14px] text-text-primary">
            {data.cohort.discourse.markersPerUtterance.toFixed(2)}
          </div>
          <div className="mt-1 text-[11px] text-text-secondary">
            per-student mean {ci.estimate.toFixed(2)}{" "}
            <span className="text-neutral">
              [{ci.lo.toFixed(2)}, {ci.hi.toFixed(2)}]
            </span>
          </div>
        </div>
        <div className="rounded-md border border-border-soft bg-bg p-3">
          <div className="text-[10px] uppercase tracking-wider text-neutral">Top markers</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {sortedMarkers.slice(0, 8).map(([m, n]) => (
              <span
                key={m}
                className="rounded-sm border border-border-soft bg-white px-1.5 py-0.5 font-mono text-[11px] text-text-primary"
              >
                {m}
                <span className="ml-1 text-neutral">×{n}</span>
              </span>
            ))}
            {sortedMarkers.length === 0 && (
              <span className="text-[11px] text-neutral">발견된 마커 없음</span>
            )}
          </div>
        </div>
      </div>

      {/* category bar */}
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-wider text-neutral">
          Cohort category distribution
        </div>
        <div className="mt-1 flex h-5 overflow-hidden rounded-md bg-border-soft">
          {cats.map((c) => {
            const n = data.cohort.discourse.byCategory[c];
            const total = cats.reduce((a, k) => a + data.cohort.discourse.byCategory[k], 0) || 1;
            const pct = (n / total) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={c}
                className="flex items-center justify-center text-[10px] font-medium text-white"
                style={{ width: `${pct}%`, backgroundColor: DISC_LABEL[c].hex }}
                title={`${DISC_LABEL[c].ko}: ${n}`}
              >
                {pct >= 12 ? `${pct.toFixed(0)}%` : ""}
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-text-secondary">
          {cats.map((c) => (
            <span key={c} className="inline-flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ backgroundColor: DISC_LABEL[c].hex }}
              />
              {DISC_LABEL[c].ko}
            </span>
          ))}
        </div>
      </div>

      {/* per-student markers/utterance */}
      <div className="space-y-1">
        {[...data.perStudent]
          .sort((a, b) => b.discourseMarkersPerUtterance - a.discourseMarkersPerUtterance)
          .map((s) => {
            const max = Math.max(0.01, ...data.perStudent.map((p) => p.discourseMarkersPerUtterance));
            return (
              <div key={s.studentIdHashed} className="flex items-center gap-2 text-[11px]">
                <span className="w-28 truncate font-mono text-text-secondary">
                  {s.studentIdHashed.slice(0, 14)}…
                </span>
                <span className="w-8 text-right font-mono text-text-primary">
                  {s.utteranceCount}
                </span>
                <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-border-soft">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full"
                    style={{
                      width: `${(s.discourseMarkersPerUtterance / max) * 100}%`,
                      backgroundColor: "#8B5CF6",
                    }}
                  />
                </div>
                <span className="w-14 text-right font-mono text-text-primary">
                  {s.discourseMarkersPerUtterance.toFixed(2)}
                </span>
              </div>
            );
          })}
      </div>
    </section>
  );
}

// ============================================================================
// helpers
// ============================================================================

function DescriptiveCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-border-soft bg-bg p-3">
      <div className="text-[10px] uppercase tracking-wider text-neutral">{label}</div>
      <div className="mt-1 font-mono text-[14px] text-text-primary">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-text-secondary">{sub}</div>}
    </div>
  );
}

function Sparkline({
  values,
  color,
  max,
}: {
  values: number[];
  color: string;
  max: number;
}) {
  const W = 600;
  const H = 60;
  const pad = 4;
  const w = W - pad * 2;
  const h = H - pad * 2;
  if (values.length === 0) return null;
  const top = Math.max(max, ...values);
  const stepX = values.length > 1 ? w / (values.length - 1) : w;
  const points = values
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + h - (top > 0 ? (v / top) * h : 0);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-12 w-full">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
      {values.map((v, i) => {
        const x = pad + i * stepX;
        const y = pad + h - (top > 0 ? (v / top) * h : 0);
        return <circle key={i} cx={x} cy={y} r={2.5} fill={color} />;
      })}
    </svg>
  );
}
