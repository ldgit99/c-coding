"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { StudentTimeline } from "@/components/StudentTimeline";

type QuestionType = "concept" | "debug" | "answer_request" | "metacognitive" | "other";

interface PerStudent {
  studentId: string;
  displayName: string;
  utteranceCount: number;
  distribution: Record<QuestionType, number>;
  frustration: number;
  stuckLoop: { term: string | null; repeat: number } | null;
  offloadingScore: number;
  metacognitiveRate: number;
}

interface Cluster {
  representative: string;
  count: number;
  members: string[];
}

interface RedFlag {
  studentId: string;
  displayName: string;
  kind: "frustration" | "stuck_loop" | "answer_request";
  detail: string;
}

interface AssignmentOption {
  value: string;
  label: string;
  turnCount: number;
}

interface HeatmapRow {
  assignmentCode: string;
  title: string;
  counts: Record<QuestionType, number>;
  total: number;
}

interface Response {
  cohortId: string;
  source: "supabase" | "memory";
  assignmentFilter: string;
  assignmentOptions: AssignmentOption[];
  collectedTurns: number;
  studentCount: number;
  totalDistribution: Record<QuestionType, number>;
  perStudent: PerStudent[];
  clusters: Cluster[];
  redFlags: RedFlag[];
  heatmap: HeatmapRow[];
  cohortAverages: {
    frustration: number;
    offloadingScore: number;
    metacognitiveRate: number;
  };
  summaryStrip: {
    offloadingHigh: number;
    offloadingMid: number;
    offloadingLow: number;
    frustrationAlert: number;
    metacognitiveActive: number;
    stuckLoop: number;
    totalStudents: number;
  };
  generatedAt: string;
}

const TYPE_LABEL: Record<QuestionType, { label: string; emoji: string; hex: string }> = {
  concept: { label: "개념", emoji: "🔵", hex: "#6366F1" },
  debug: { label: "디버깅", emoji: "🟡", hex: "#F59E0B" },
  answer_request: { label: "답 요청", emoji: "🔴", hex: "#EF4444" },
  metacognitive: { label: "메타인지", emoji: "🟣", hex: "#10B981" },
  other: { label: "기타", emoji: "⚪", hex: "#94A3B8" },
};

export function ConversationsPage() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignmentFilter, setAssignmentFilter] = useState<string>("all");
  const [selectedStudent, setSelectedStudent] = useState<{
    id: string;
    displayName: string;
  } | null>(null);

  const load = async (filter = assignmentFilter) => {
    try {
      const q = filter === "all" ? "" : `?assignmentId=${encodeURIComponent(filter)}`;
      const res = await fetch(`/api/conversations${q}`, { cache: "no-store" });
      setData((await res.json()) as Response);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(assignmentFilter);
    const id = setInterval(() => void load(assignmentFilter), 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentFilter]);

  const totalCount = useMemo(() => {
    if (!data) return 0;
    return Object.values(data.totalDistribution).reduce((a, b) => a + b, 0);
  }, [data]);

  return (
    <main className="mx-auto max-w-[1280px] px-8 py-8">
      <header className="mb-6 flex items-end justify-between gap-4 border-b border-border-soft pb-5">
        <div>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral">
            Learning Analytics
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tighter text-text-primary">
            대화 분석
          </h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            학생 발화 유형 · 막힘 신호 · 과제별 패턴 · 30초 자동 갱신
          </p>
        </div>
        {data && (
          <div className="text-right text-[12px] text-text-secondary">
            <div>
              <span className="text-neutral">source · </span>
              <span className={`font-mono ${data.source === "supabase" ? "text-primary" : "text-warning"}`}>
                {data.source}
              </span>
            </div>
            <div className="mt-1 text-neutral">
              {data.collectedTurns}턴 · {data.studentCount}명
            </div>
          </div>
        )}
      </header>

      {/* Assignment 필터 */}
      {data && data.assignmentOptions && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-neutral">과제:</span>
          <select
            value={assignmentFilter}
            onChange={(e) => setAssignmentFilter(e.target.value)}
            className="h-9 rounded-md border border-border-soft bg-surface px-3 text-[13px] text-text-primary focus:border-primary focus:outline-none"
          >
            {data.assignmentOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} · {opt.turnCount}턴
              </option>
            ))}
          </select>
          {assignmentFilter !== "all" && (
            <button
              type="button"
              onClick={() => setAssignmentFilter("all")}
              className="h-9 rounded-md border border-border-soft bg-surface px-2.5 text-[11px] text-text-secondary hover:border-primary hover:text-primary"
            >
              전체로 리셋
            </button>
          )}
        </div>
      )}

      {loading && !data && <div className="text-[13px] text-neutral">로딩 중…</div>}

      {data && totalCount === 0 && (
        <section className="rounded-xl border border-border-soft bg-surface p-8 text-center text-[13px] text-text-secondary">
          수집된 학생 발화가 없습니다. 과제 필터를 바꾸거나 학생 대화를 기다려주세요.
        </section>
      )}

      {data && totalCount > 0 && (
        <>
          {/* Layer 1 — 요약 스트립 */}
          <SummaryStrip data={data} />

          {/* Red Flags */}
          {data.redFlags.length > 0 && (
            <section className="mb-6 overflow-hidden rounded-xl border border-error/30 bg-error/5">
              <div className="border-b border-error/20 px-5 py-3">
                <div className="text-[10px] font-medium uppercase tracking-wider text-error">
                  🚩 Red Flags
                </div>
                <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary">
                  지금 확인이 필요한 학생
                </h2>
              </div>
              <ul className="divide-y divide-error/10">
                {data.redFlags.map((f, i) => (
                  <li key={i} className="flex items-center justify-between px-5 py-3 text-[13px]">
                    <div className="flex items-center gap-3">
                      <RedFlagIcon kind={f.kind} />
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedStudent({ id: f.studentId, displayName: f.displayName })
                        }
                        className="font-medium text-text-primary transition-colors hover:text-primary"
                      >
                        {f.displayName}
                      </button>
                      <span className="text-text-secondary">{f.detail}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedStudent({ id: f.studentId, displayName: f.displayName })
                      }
                      className="text-[11px] uppercase tracking-wider text-primary transition-colors hover:underline"
                    >
                      타임라인 →
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Layer 2 — 학생 산점도 */}
          <StudentScatter
            students={data.perStudent}
            averages={data.cohortAverages}
            onSelect={(s) =>
              setSelectedStudent({ id: s.studentId, displayName: s.displayName })
            }
          />

          {/* Layer 3 — 과제 × 유형 히트맵 */}
          <AssignmentHeatmap rows={data.heatmap} />

          {/* 상위 공통 질문 클러스터 — 노이즈 필터링된 버전 */}
          <section className="mb-6 overflow-hidden rounded-xl border border-border-soft bg-surface">
            <div className="border-b border-border-soft px-5 py-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
                Common Questions
              </div>
              <h2 className="mt-0.5 font-display text-xl font-semibold tracking-tight text-text-primary">
                상위 공통 질문 클러스터
              </h2>
              <p className="mt-0.5 text-[11px] text-text-secondary">
                시스템 단축 발화 제외 · 구두점 정규화 · 2명 이상
              </p>
            </div>
            <div className="px-5 py-4">
              {data.clusters.length === 0 ? (
                <p className="text-[12px] text-text-secondary">공통 패턴이 뚜렷하지 않습니다.</p>
              ) : (
                <ul className="space-y-3">
                  {data.clusters.map((c, i) => (
                    <li key={i} className="rounded-md border border-border-soft p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-text-primary">
                          “{c.representative}”
                        </span>
                        <span className="rounded-sm bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          ×{c.count}
                        </span>
                      </div>
                      {c.members.length > 1 && (
                        <ul className="mt-2 space-y-0.5 pl-3 text-[11px] text-text-secondary">
                          {c.members.slice(1, 4).map((m, j) => (
                            <li key={j}>· {m}</li>
                          ))}
                          {c.members.length > 4 && (
                            <li className="text-neutral">· 외 {c.members.length - 4}개</li>
                          )}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Per-student 테이블 — 컴팩트화 */}
          <section className="overflow-hidden rounded-xl border border-border-soft bg-surface">
            <div className="border-b border-border-soft px-5 py-3">
              <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
                Per Student
              </div>
              <h2 className="mt-0.5 font-display text-xl font-semibold tracking-tight text-text-primary">
                학생별 대화 프로파일
              </h2>
              <p className="mt-0.5 text-[11px] text-text-secondary">
                행을 클릭하면 세션 타임라인이 열립니다.
              </p>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-bg text-left text-[10px] uppercase tracking-wider text-neutral">
                  <tr>
                    <th className="px-4 py-2 font-medium">학생</th>
                    <th className="px-4 py-2 font-medium">턴</th>
                    <th className="px-4 py-2 font-medium">질문 유형</th>
                    <th className="px-4 py-2 font-medium">감정</th>
                    <th className="px-4 py-2 font-medium">오프로딩</th>
                    <th className="px-4 py-2 font-medium">메타인지</th>
                    <th className="px-4 py-2 font-medium">루프</th>
                  </tr>
                </thead>
                <tbody>
                  {data.perStudent.map((s) => {
                    const total = s.utteranceCount;
                    return (
                      <tr
                        key={s.studentId}
                        onClick={() =>
                          setSelectedStudent({
                            id: s.studentId,
                            displayName: s.displayName,
                          })
                        }
                        className="cursor-pointer border-t border-border-soft hover:bg-bg"
                      >
                        <td className="px-4 py-2.5">
                          <span className="font-medium text-text-primary">
                            {s.displayName}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-text-primary">{total}</td>
                        <td className="px-4 py-2.5">
                          <DistributionBar distribution={s.distribution} total={total} compact />
                        </td>
                        <td className="px-4 py-2.5">
                          <DeltaBadge
                            value={s.frustration}
                            avg={data.cohortAverages.frustration}
                            invert
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <DeltaBadge
                            value={s.offloadingScore}
                            avg={data.cohortAverages.offloadingScore}
                            invert
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <DeltaBadge
                            value={s.metacognitiveRate}
                            avg={data.cohortAverages.metacognitiveRate}
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          {s.stuckLoop ? (
                            <span className="rounded-sm border border-warning/20 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                              {s.stuckLoop.term} ×{s.stuckLoop.repeat}
                            </span>
                          ) : (
                            <span className="text-neutral">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="mt-4 text-right text-[11px] text-neutral">
            generated {new Date(data.generatedAt).toLocaleTimeString("ko-KR")}
          </div>
        </>
      )}

      {/* 학생 세션 타임라인 슬라이드오버 */}
      {selectedStudent && (
        <StudentTimeline
          studentId={selectedStudent.id}
          displayName={selectedStudent.displayName}
          assignmentFilter={assignmentFilter}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </main>
  );
}

function SummaryStrip({ data }: { data: Response }) {
  const s = data.summaryStrip;
  return (
    <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StripTile
        color="error"
        title="오프로딩 경고"
        main={s.offloadingHigh}
        caption={`반 ${s.totalStudents}명 중 의존도 높음`}
        secondary={`🟡 ${s.offloadingMid} · 🟢 ${s.offloadingLow}`}
      />
      <StripTile
        color="warning"
        title="감정 주의"
        main={s.frustrationAlert}
        caption="frustration ≥ 30% 학생"
      />
      <StripTile
        color="success"
        title="메타인지 활성"
        main={s.metacognitiveActive}
        caption="이해·정리 언급 비율 높음"
      />
      <StripTile
        color="neutral"
        title="막힘 루프"
        main={s.stuckLoop}
        caption="같은 주제 3회 이상 반복"
      />
    </section>
  );
}

function StripTile({
  color,
  title,
  main,
  caption,
  secondary,
}: {
  color: "error" | "warning" | "success" | "neutral";
  title: string;
  main: number;
  caption: string;
  secondary?: string;
}) {
  const ringClass = {
    error: "border-error/30 bg-error/5",
    warning: "border-warning/30 bg-warning/5",
    success: "border-success/30 bg-success/5",
    neutral: "border-border-soft bg-surface",
  }[color];
  const textClass = {
    error: "text-error",
    warning: "text-warning",
    success: "text-success",
    neutral: "text-text-primary",
  }[color];
  return (
    <div className={`rounded-xl border p-4 ${ringClass}`}>
      <div className="text-[10px] uppercase tracking-wider text-neutral">{title}</div>
      <div className={`mt-1 font-display text-3xl font-semibold tracking-tighter ${textClass}`}>
        {main}
      </div>
      <div className="mt-1 text-[11px] text-text-secondary">{caption}</div>
      {secondary && <div className="mt-0.5 text-[10px] text-neutral">{secondary}</div>}
    </div>
  );
}

function StudentScatter({
  students,
  averages,
  onSelect,
}: {
  students: PerStudent[];
  averages: { frustration: number; offloadingScore: number; metacognitiveRate: number };
  onSelect: (s: PerStudent) => void;
}) {
  // X = offloadingScore 0~1, Y = metacognitiveRate 0~1. 반전(Y는 위)
  const W = 640;
  const H = 340;
  const PAD = { l: 48, r: 16, t: 16, b: 36 };
  const w = W - PAD.l - PAD.r;
  const h = H - PAD.t - PAD.b;

  const toX = (v: number) => PAD.l + Math.min(1, Math.max(0, v)) * w;
  const toY = (v: number) => PAD.t + (1 - Math.min(1, Math.max(0, v))) * h;

  const [hover, setHover] = useState<PerStudent | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-border-soft bg-surface">
      <div className="border-b border-border-soft px-5 py-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
          Student Scatter
        </div>
        <h2 className="mt-0.5 font-display text-xl font-semibold tracking-tight text-text-primary">
          오프로딩 × 메타인지 맵
        </h2>
        <p className="mt-0.5 text-[11px] text-text-secondary">
          점 크기 = 총 턴 수 · 점 클릭 = 세션 타임라인 · 반 평균은 점선 교차
        </p>
      </div>
      <div className="overflow-auto px-5 py-4">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full max-w-[720px]"
          role="img"
          aria-label="학생 분포 맵"
        >
          {/* 사분면 영역 음영 */}
          <rect
            x={toX(0)}
            y={toY(1)}
            width={toX(averages.offloadingScore) - toX(0)}
            height={toY(averages.metacognitiveRate) - toY(1)}
            fill="rgba(16,185,129,0.06)"
          />
          <rect
            x={toX(averages.offloadingScore)}
            y={toY(averages.metacognitiveRate)}
            width={toX(1) - toX(averages.offloadingScore)}
            height={toY(0) - toY(averages.metacognitiveRate)}
            fill="rgba(239,68,68,0.06)"
          />

          {/* 축 */}
          <line x1={PAD.l} y1={toY(0)} x2={toX(1)} y2={toY(0)} stroke="#E5E7EB" />
          <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={toY(0)} stroke="#E5E7EB" />
          {/* 축 레이블 */}
          <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#64748B">
            오프로딩 ({"낮음 → 높음"})
          </text>
          <text
            x={-H / 2}
            y={14}
            transform={`rotate(-90)`}
            textAnchor="middle"
            fontSize="11"
            fill="#64748B"
          >
            메타인지 ({"낮음 → 높음"})
          </text>

          {/* 반 평균 교차선 */}
          <line
            x1={toX(averages.offloadingScore)}
            y1={PAD.t}
            x2={toX(averages.offloadingScore)}
            y2={toY(0)}
            stroke="#94A3B8"
            strokeDasharray="4 3"
          />
          <line
            x1={PAD.l}
            y1={toY(averages.metacognitiveRate)}
            x2={toX(1)}
            y2={toY(averages.metacognitiveRate)}
            stroke="#94A3B8"
            strokeDasharray="4 3"
          />
          <text
            x={toX(averages.offloadingScore) + 4}
            y={PAD.t + 10}
            fontSize="10"
            fill="#94A3B8"
          >
            반 평균
          </text>

          {/* 사분면 라벨 */}
          <text x={PAD.l + 6} y={PAD.t + 14} fontSize="10" fill="#10B981" opacity="0.85">
            ✨ 독립 탐구형
          </text>
          <text x={toX(1) - 78} y={PAD.t + 14} fontSize="10" fill="#6366F1" opacity="0.85">
            🙋 말수 많지만 자기주도
          </text>
          <text x={PAD.l + 6} y={toY(0) - 8} fontSize="10" fill="#F59E0B" opacity="0.85">
            🤫 관망형
          </text>
          <text x={toX(1) - 80} y={toY(0) - 8} fontSize="10" fill="#EF4444" opacity="0.85">
            🚨 답 찾기 패턴
          </text>

          {/* 점 */}
          {students.map((s) => {
            const r = Math.max(4, Math.min(14, 3 + Math.sqrt(s.utteranceCount) * 1.5));
            const cx = toX(s.offloadingScore);
            const cy = toY(s.metacognitiveRate);
            const isHover = hover?.studentId === s.studentId;
            // 색상: 상단좌 녹색, 하단우 적색, 기타 파랑
            let fill = "#6366F1";
            if (
              s.offloadingScore < 0.25 &&
              s.metacognitiveRate >= 0.15
            ) {
              fill = "#10B981";
            } else if (s.offloadingScore >= 0.35) {
              fill = "#EF4444";
            } else if (s.metacognitiveRate < 0.08 && s.offloadingScore >= 0.2) {
              fill = "#F59E0B";
            }
            return (
              <g
                key={s.studentId}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect(s)}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={fill}
                  fillOpacity={isHover ? 0.95 : 0.7}
                  stroke={isHover ? "#111827" : "white"}
                  strokeWidth={isHover ? 2 : 1.5}
                />
                {isHover && (
                  <text
                    x={cx}
                    y={cy - r - 6}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="600"
                    fill="#111827"
                  >
                    {s.displayName}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hover && (
          <div className="mt-2 rounded-md border border-border-soft bg-bg px-3 py-2 text-[11px] text-text-secondary">
            <span className="font-medium text-text-primary">{hover.displayName}</span>
            <span className="ml-2">턴 {hover.utteranceCount}</span>
            <span className="ml-2">오프로딩 {(hover.offloadingScore * 100).toFixed(0)}%</span>
            <span className="ml-2">메타인지 {(hover.metacognitiveRate * 100).toFixed(0)}%</span>
            <span className="ml-2">감정 {(hover.frustration * 100).toFixed(0)}%</span>
          </div>
        )}
      </div>
    </section>
  );
}

function AssignmentHeatmap({ rows }: { rows: HeatmapRow[] }) {
  const TYPES: QuestionType[] = ["concept", "debug", "answer_request", "metacognitive", "other"];
  const maxCount = Math.max(
    1,
    ...rows.flatMap((r) => TYPES.map((t) => r.counts[t])),
  );

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-border-soft bg-surface">
      <div className="border-b border-border-soft px-5 py-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
          Curriculum Signal
        </div>
        <h2 className="mt-0.5 font-display text-xl font-semibold tracking-tight text-text-primary">
          과제 × 질문 유형 히트맵
        </h2>
        <p className="mt-0.5 text-[11px] text-text-secondary">
          색 진하기 = 해당 (과제, 유형) 조합의 실제 발화 수 · 답요청 열이 특히 진한 과제는 재설계
          후보
        </p>
      </div>
      <div className="overflow-auto px-5 py-4">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-neutral">
              <th className="py-2 pr-4 font-medium">과제</th>
              {TYPES.map((t) => (
                <th key={t} className="px-2 py-2 text-center font-medium">
                  {TYPE_LABEL[t].emoji} {TYPE_LABEL[t].label}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-medium">턴</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.assignmentCode} className="border-t border-border-soft">
                <td className="py-2 pr-4">
                  <div className="font-mono text-[11px] text-text-primary">
                    {r.assignmentCode.split("_")[0]}
                  </div>
                  <div className="text-[11px] text-text-secondary">{r.title}</div>
                </td>
                {TYPES.map((t) => {
                  const n = r.counts[t];
                  const intensity = n / maxCount;
                  const hex = TYPE_LABEL[t].hex;
                  return (
                    <td key={t} className="px-2 py-2 text-center">
                      <div
                        className="mx-auto flex h-8 w-14 items-center justify-center rounded text-[11px] font-medium"
                        title={`${TYPE_LABEL[t].label} ${n}회`}
                        style={{
                          backgroundColor: n === 0 ? "transparent" : `${hex}${alpha(intensity)}`,
                          color: intensity >= 0.55 ? "white" : "#111827",
                          border: n === 0 ? "1px dashed #E5E7EB" : "none",
                        }}
                      >
                        {n === 0 ? "·" : n}
                      </div>
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-right font-mono text-neutral">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function alpha(intensity: number): string {
  const a = Math.min(255, Math.max(32, Math.round(intensity * 255)));
  return a.toString(16).padStart(2, "0");
}

function DistributionBar({
  distribution,
  total,
  compact,
}: {
  distribution: Record<QuestionType, number>;
  total: number;
  compact?: boolean;
}) {
  if (total === 0) return <span className="text-[11px] text-neutral">—</span>;
  const order: QuestionType[] = ["metacognitive", "concept", "debug", "answer_request", "other"];
  const fillColor: Record<QuestionType, string> = {
    metacognitive: "bg-success",
    concept: "bg-primary",
    debug: "bg-warning",
    answer_request: "bg-error",
    other: "bg-neutral",
  };
  return (
    <div className={`flex overflow-hidden rounded ${compact ? "h-2.5 w-44" : "h-3 w-full"}`}>
      {order.map((k) => {
        const n = distribution[k];
        if (n === 0) return null;
        const pct = (n / total) * 100;
        return (
          <span
            key={k}
            title={`${TYPE_LABEL[k].label} ${n}/${total}`}
            className={`${fillColor[k]}`}
            style={{ width: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}

function DeltaBadge({
  value,
  avg,
  invert,
}: {
  value: number;
  avg: number;
  invert?: boolean;
}) {
  const pct = Math.round(value * 100);
  const delta = value - avg;
  const deltaPct = Math.round(delta * 100);
  // 색상 판정 — invert true 이면 낮을수록 좋음
  let color = "bg-bg text-text-secondary";
  if (invert) {
    if (value >= 0.3) color = "bg-error/10 text-error";
    else if (value >= 0.15) color = "bg-warning/10 text-warning";
    else color = "bg-success/10 text-success";
  } else {
    if (value >= 0.2) color = "bg-success/10 text-success";
    else if (value >= 0.1) color = "bg-primary/10 text-primary";
  }
  const deltaSign = delta > 0 ? "+" : "";
  const deltaColor =
    Math.abs(delta) < 0.03
      ? "text-neutral"
      : (invert ? delta < 0 : delta > 0)
        ? "text-success"
        : "text-error";
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`inline-flex h-5 items-center rounded px-1.5 font-mono text-[10px] font-medium ${color}`}
      >
        {pct}%
      </span>
      {Math.abs(deltaPct) >= 3 && (
        <span className={`font-mono text-[10px] ${deltaColor}`}>
          {deltaSign}
          {deltaPct}
        </span>
      )}
    </span>
  );
}

function RedFlagIcon({ kind }: { kind: RedFlag["kind"] }) {
  const map = {
    frustration: { emoji: "😩", label: "감정" },
    stuck_loop: { emoji: "🔁", label: "막힘" },
    answer_request: { emoji: "🙏", label: "답 요청" },
  };
  const v = map[kind];
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded border border-error/20 bg-white px-2 text-[11px] font-medium text-error">
      {v.emoji} {v.label}
    </span>
  );
}
