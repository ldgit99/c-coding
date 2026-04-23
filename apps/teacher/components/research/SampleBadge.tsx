/**
 * SSCI-grade research figure 상단에 붙이는 sample-size gate.
 * N < 20 이면 "Pilot sample" 워터마크, missing 률 10% 이상이면 경고.
 */
export function SampleBadge({
  n,
  label = "students",
  period,
  missing,
  note,
}: {
  n: number;
  label?: string;
  /** 데이터 수집 기간 문자열, 예: "2026-04-22 ~ 2026-04-23". */
  period?: string;
  /** 결측 비율 0~1. 10% 이상이면 주의 컬러. */
  missing?: number;
  note?: string;
}) {
  const isPilot = n < 20;
  const missingPct = missing != null ? missing * 100 : null;
  const missingAlert = missingPct != null && missingPct >= 10;

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-text-secondary">
      <span className="rounded-sm border border-border-soft bg-bg px-1.5 py-0.5">
        N {label}={n}
      </span>
      {isPilot && (
        <span className="rounded-sm border border-warning/30 bg-warning/10 px-1.5 py-0.5 font-medium text-warning">
          PILOT SAMPLE
        </span>
      )}
      {period && (
        <span className="rounded-sm border border-border-soft bg-bg px-1.5 py-0.5">
          {period}
        </span>
      )}
      {missingPct != null && (
        <span
          className={`rounded-sm border px-1.5 py-0.5 ${
            missingAlert
              ? "border-error/30 bg-error/10 font-medium text-error"
              : "border-border-soft bg-bg"
          }`}
        >
          missing={missingPct.toFixed(1)}%
        </span>
      )}
      {note && <span className="text-neutral">· {note}</span>}
    </div>
  );
}

/**
 * CSV 다운로드 버튼. rows 는 동일 key 를 가진 객체 배열.
 * 첫 row 의 key 순서대로 header 가 생성됨.
 */
export function CsvExportButton<T extends Record<string, string | number | null | undefined>>({
  filename,
  rows,
  label = "📥 CSV",
}: {
  filename: string;
  rows: T[];
  label?: string;
}) {
  const disabled = rows.length === 0;
  const onClick = () => {
    if (rows.length === 0) return;
    const keys = Object.keys(rows[0]!);
    const escape = (val: string | number | null | undefined): string => {
      if (val == null) return "";
      const s = String(val);
      if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const header = keys.join(",");
    const lines = rows.map((r) => keys.map((k) => escape(r[k])).join(","));
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-7 items-center rounded-md border border-border-soft bg-white px-2.5 text-[10px] font-medium uppercase tracking-wider text-text-secondary transition-all hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}

/**
 * git SHA + 데이터 스냅샷 타임스탬프 footer.
 * SSCI reviewer 가 재현가능성을 확인할 때 cite 할 수 있는 정보.
 */
export function ReproFooter({
  sha,
  snapshot,
  pipeline,
}: {
  sha?: string;
  snapshot?: string;
  pipeline?: string;
}) {
  return (
    <div className="mt-3 border-t border-border-soft pt-3 text-[10px] font-mono text-neutral">
      Code: git {sha ?? "unknown"} · Data snapshot:{" "}
      {snapshot ?? new Date().toISOString().slice(0, 19)} ·{" "}
      Pipeline: {pipeline ?? "cvibe-analytics@0.1.0"}
    </div>
  );
}
