import Link from "next/link";

export default function TeacherManual() {
  return (
    <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto", fontFamily: "system-ui, sans-serif", lineHeight: 1.6 }}>
      <nav><Link href="/">← 문서 홈</Link></nav>
      <h1>교사 매뉴얼</h1>

      <h2>1. 대시보드 3단 뷰</h2>
      <ul>
        <li><strong>Classroom</strong> — KC×학생 히트맵. 붉은 셀이 많은 KC는 다음 수업의 보충 대상.</li>
        <li><strong>Student</strong> — 개별 학생의 숙련도·의존도 이력·최근 제출. Dependency Factor는 학생에게는 절대 노출되지 않는다.</li>
        <li><strong>Assignment</strong> — 과제별 공통 오답. Problem Architect가 다음 이터레이션에서 variant 조정에 반영.</li>
      </ul>

      <h2>2. AI 개입 수준(모드) 판단</h2>
      <table cellPadding={6} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ background: "#f3f4f6" }}>
            <th align="left">모드</th><th align="left">언제 쓰나</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>🟢 silent</td><td>시험 중, 또는 과제 스펙 재진술만 원할 때</td></tr>
          <tr><td>🟡 observer</td><td>명백한 컴파일·런타임 오류만 알려주고 나머지는 학생 판단에 맡길 때</td></tr>
          <tr><td>🟠 pair (기본)</td><td>Socratic 4단계 힌트. 일반 수업에서 기본값.</td></tr>
          <tr><td>🔴 tutor</td><td>학생이 3회 이상 시도 후 Level 3~4 힌트가 필요할 때만 임시 개방.</td></tr>
        </tbody>
      </table>

      <h2>3. 개입 권고 해석</h2>
      <p>Teacher Copilot이 <em>Intervention Queue</em>에 학생을 올리면, 다음 세 단계 중 하나로 제안해요.</p>
      <ul>
        <li><strong>weak</strong> — 트리거 1개 충족. 관찰만 유지하고 나중에 재평가.</li>
        <li><strong>medium</strong> — 2개 이상 충족. 추가 variant를 배정하거나 모드를 pair로 고정.</li>
        <li><strong>strong</strong> — 3개 이상 + 반복 오류. 쪽지 개입, 모드 tutor 일시 상승, 필요 시 수동 힌트 주입.</li>
      </ul>

      <h2>4. 낙인 방지 원칙</h2>
      <p>Dependency Factor, misconception 라벨, 개입 큐의 모든 정보는 <strong>교사 세션 내부에서만</strong> 해석된다. 학생의 최종 점수에 의존도 감점은 절대 반영되지 않으며(§6.3 권고), 학생 UI에는 통계 숫자 대신 "함께 생각해보자" 형태의 피드백만 흘러간다.</p>

      <h2>5. 주간 운영 루프</h2>
      <ol>
        <li>수업 후 10분 — Classroom Heatmap을 열고 공통 취약 KC 확인.</li>
        <li>Intervention Queue의 strong 학생 3명을 우선 개별 쪽지.</li>
        <li>Common Misconceptions 상위 2개를 다음 수업의 5분 미니 피드백 카드로.</li>
        <li>Problem Architect에 해당 KC 난이도 조정 또는 variant 추가 요청.</li>
      </ol>

      <h2>6. 보안 체크리스트</h2>
      <ul>
        <li>과제 reference_solution은 <code>supabase/seed-private/</code>에만 둔다 (Git 커밋 금지).</li>
        <li>시험 모드에서는 mode=exam으로 전환 — Safety Guard가 outbound 코드 블록 전부 차단.</li>
        <li>학생 이름·이메일이 포함된 로그는 export 전 PII 필터링 필요 (xAPI 스테이트먼트의 learner_id 해시).</li>
      </ul>
    </main>
  );
}
