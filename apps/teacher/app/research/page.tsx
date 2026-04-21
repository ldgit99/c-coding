export default function ResearchLabPage() {
  const papers = [
    {
      href: "/research/cascade",
      tag: "Paper 1",
      title: "Hint Cascade Analyzer",
      venue: "Computers & Education / JCAL / ICER",
      figures: [
        "Sankey L1 → L2 → L3 → L4 → Accept/Submit/Quit",
        "Student cluster histogram (4 types)",
        "Hint-to-Correct latency eCDF",
      ],
      dataNeeded: "xAPI requestedHint / receivedHint / submissionPassed",
    },
    {
      href: "/research/offloading",
      tag: "Paper 3",
      title: "Cognitive Offloading Detector",
      venue: "CHI / CSCW / IJAIED",
      figures: [
        "Dependency Factor Trajectory (per-student time series)",
        "Gaming vs Struggling Scatter (L4 freq × transfer axis)",
        "Korean Utterance Linguistic Profile",
      ],
      dataNeeded: "conversations turns + self-explanation axes + submissions",
    },
  ];

  return (
    <main className="mx-auto max-w-[1280px] px-6 py-10">
      <nav className="mb-6 text-[11px] uppercase tracking-wider">
        <a href="/" className="text-neutral transition-colors hover:text-primary">
          ← 대시보드
        </a>
      </nav>
      <header className="mb-10 border-b border-border-soft pb-6">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
          Research Lab
        </div>
        <h1 className="mt-0.5 font-display text-4xl font-semibold tracking-tighter text-text-primary">
          논문용 분석 뷰
        </h1>
        <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-text-secondary">
          교사 실시간 대시보드와 분리된 연구 전용 레이어. 여기의 뷰는
          변수·표본·효과크기를 명시해 Figure/Table로 바로 옮길 수 있게 설계되어
          있어요. 데이터는 <code className="font-mono text-[12px]">/api/analytics/dump</code>에서
          cohort 범위로 집계되며, 집계 함수는{" "}
          <code className="font-mono text-[12px]">packages/xapi/src/analytics</code>에 결정적
          코드로 존재합니다.
        </p>
      </header>

      <ul className="grid gap-6 md:grid-cols-2">
        {papers.map((p) => (
          <li key={p.href}>
            <a
              href={p.href}
              className="block rounded-xl border border-border-soft bg-surface p-6 transition-all hover:-translate-y-0.5 hover:shadow-card"
            >
              <div className="text-[10px] font-medium uppercase tracking-wider text-primary">
                {p.tag}
              </div>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-tighter text-text-primary">
                {p.title}
              </h2>
              <div className="mt-2 text-[11px] uppercase tracking-wider text-neutral">
                Target venue · {p.venue}
              </div>
              <ul className="mt-4 space-y-1.5 text-[13px] text-text-primary">
                {p.figures.map((f, i) => (
                  <li key={i} className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] text-primary">Fig {i + 1}</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 text-[11px] leading-relaxed text-text-secondary">
                <span className="font-medium text-text-primary">Data: </span>
                <span className="font-mono">{p.dataNeeded}</span>
              </div>
            </a>
          </li>
        ))}
      </ul>

      <section className="mt-12 rounded-xl border border-border-soft bg-bg p-6 text-[13px] leading-relaxed text-text-secondary">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
          Layer Separation
        </div>
        <h3 className="mt-1 font-display text-xl font-semibold tracking-tighter text-text-primary">
          왜 교사 대시보드와 분리했나
        </h3>
        <p className="mt-2">
          교사는 <em>즉시 행동</em>을 원하고, 논문 reviewer는 <em>변수 정의·표본·효과
          크기</em>를 원합니다. 같은 수치라도 전자는 &ldquo;이 학생에게 개입할까&rdquo;로,
          후자는 &ldquo;이 지표가 학습 성과를 예측하는가&rdquo;로 사용됩니다. 둘을
          분리하면 (1) 교사 화면의 인지 부하가 줄고, (2) 연구 지표를 바꿔도 교사
          UX에 영향이 없으며, (3) IRB·익명화 경계를 명확히 할 수 있어요.
        </p>
      </section>
    </main>
  );
}
