"use client";

import { useEffect, useState } from "react";

interface SettingsResponse {
  cohort: { id: string; studentCount: number; source: "supabase" | "demo" };
  integrations: {
    supabase: boolean;
    supabaseServiceRole: boolean;
    anthropic: boolean;
    judge0: boolean;
    langfuse: boolean;
    studentApp: { url: string; reachable: boolean };
  };
  runtime: { node: string; platform: string; uptimeSec: number };
  generatedAt: string;
}

export function SettingsPage() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      setData((await res.json()) as SettingsResponse);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="mx-auto max-w-[1024px] px-8 py-8">
      <header className="mb-6 flex items-end justify-between gap-4 border-b border-border-soft pb-5">
        <div>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral">
            Configuration
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tighter text-text-primary">
            설정
          </h1>
          <p className="mt-1 text-[13px] text-text-secondary">
            연결 상태 · 환경 변수 진단 · cohort 스냅샷
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="h-9 rounded-md border border-border-soft bg-surface px-3 text-[12px] font-medium text-text-primary hover:border-primary"
        >
          재검사
        </button>
      </header>

      {loading && !data && <div className="text-[13px] text-neutral">점검 중…</div>}

      {data && (
        <div className="space-y-6">
          <Section title="Cohort" subtitle="현재 대시보드가 바라보는 학급">
            <KV label="cohort id" value={<code className="font-mono text-[12px]">{data.cohort.id}</code>} />
            <KV label="학생 수" value={`${data.cohort.studentCount}명`} />
            <KV
              label="데이터 출처"
              value={
                <StatusPill
                  ok={data.cohort.source === "supabase"}
                  okLabel="Supabase"
                  badLabel="데모 데이터"
                />
              }
            />
          </Section>

          <Section title="Integrations" subtitle="각 외부 의존성 연결 여부">
            <KV
              label="Supabase (Anon)"
              value={<StatusPill ok={data.integrations.supabase} />}
              hint="NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_ANON_KEY"
            />
            <KV
              label="Supabase (Service Role)"
              value={<StatusPill ok={data.integrations.supabaseServiceRole} />}
              hint="SUPABASE_SERVICE_ROLE_KEY · 서버 전용 쓰기"
            />
            <KV
              label="Anthropic"
              value={<StatusPill ok={data.integrations.anthropic} />}
              hint="ANTHROPIC_API_KEY · AI 튜터·Code Review·Assessment LLM"
            />
            <KV
              label="Judge0"
              value={<StatusPill ok={data.integrations.judge0} />}
              hint="JUDGE0_API_URL · C 코드 실행 & hidden tests"
            />
            <KV
              label="Langfuse"
              value={<StatusPill ok={data.integrations.langfuse} />}
              hint="LANGFUSE_PUBLIC_KEY · SECRET_KEY · 비용/품질 추적"
            />
            <KV
              label="학생 앱 연결"
              value={
                <div className="flex items-center gap-2">
                  <StatusPill
                    ok={data.integrations.studentApp.reachable}
                    okLabel="reachable"
                    badLabel="unreachable"
                  />
                  <code className="font-mono text-[11px] text-text-secondary">
                    {data.integrations.studentApp.url}
                  </code>
                </div>
              }
              hint="STUDENT_APP_INTERNAL_URL · 실시간 이벤트·대화 분석 소스"
            />
          </Section>

          <Section title="Runtime" subtitle="현재 배포된 프로세스">
            <KV label="Node" value={<code className="font-mono">{data.runtime.node}</code>} />
            <KV label="Platform" value={<code className="font-mono">{data.runtime.platform}</code>} />
            <KV label="Uptime" value={`${Math.round(data.runtime.uptimeSec / 60)}분`} />
            <KV
              label="생성 시각"
              value={
                <span className="text-[12px] text-text-secondary">
                  {new Date(data.generatedAt).toLocaleString("ko-KR")}
                </span>
              }
            />
          </Section>

          <section className="rounded-xl border border-border-soft bg-bg p-5 text-[13px] leading-relaxed text-text-secondary">
            <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">Tip</div>
            <p className="mt-1">
              환경 변수가 누락되면 해당 기능이 <em>자동으로 데모 모드</em>로 폴백합니다. 파일럿 전에는 위
              6개 integration 중 Supabase(Anon/Service Role)·Anthropic·Judge0 네 개만 녹색이면 충분합니다.
              Langfuse는 선택.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border-soft bg-surface">
      <div className="border-b border-border-soft px-5 py-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">{title}</div>
        {subtitle && <h2 className="mt-0.5 text-[14px] text-text-primary">{subtitle}</h2>}
      </div>
      <dl className="divide-y divide-border-soft">{children}</dl>
    </section>
  );
}

function KV({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="grid grid-cols-[200px_1fr] items-start gap-4 px-5 py-3">
      <dt className="pt-0.5 text-[12px] font-medium text-text-primary">
        {label}
        {hint && <div className="mt-0.5 font-mono text-[10px] text-neutral">{hint}</div>}
      </dt>
      <dd className="text-[13px]">{value}</dd>
    </div>
  );
}

function StatusPill({
  ok,
  okLabel = "연결됨",
  badLabel = "미설정",
}: {
  ok: boolean;
  okLabel?: string;
  badLabel?: string;
}) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-medium ${
        ok
          ? "border-success/30 bg-success/10 text-success"
          : "border-warning/30 bg-warning/10 text-warning"
      }`}
    >
      <span
        className={`mr-1.5 inline-block h-2 w-2 rounded-full ${ok ? "bg-success" : "bg-warning"}`}
      />
      {ok ? okLabel : badLabel}
    </span>
  );
}
