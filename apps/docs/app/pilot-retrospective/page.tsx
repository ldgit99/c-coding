import Link from "next/link";

export default function PilotRetrospective() {
  return (
    <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto", fontFamily: "system-ui, sans-serif", lineHeight: 1.6 }}>
      <nav><Link href="/">← 문서 홈</Link></nav>
      <h1>파일럿 회고 (템플릿)</h1>
      <p>첫 수업에서 얻은 로그를 바탕으로 다음 이터레이션을 계획할 때 이 템플릿을 복제해서 채워. research.md §10.1 반복 개선 루프의 구체화야.</p>

      <h2>1. 관측</h2>
      <ul>
        <li>참여 학생 수 / 제출률 / 평균 점수</li>
        <li>KC별 평균 숙련도 변화 (수업 전→수업 후)</li>
        <li>Intervention Queue에 올라간 학생 수 · 개입 수용률</li>
        <li>AI 의존도 분포 — 의미 있는 이상치가 있었는가</li>
      </ul>

      <h2>2. 교육적 신호</h2>
      <ul>
        <li>Socratic 4단계 중 어느 레벨이 가장 자주 호출됐는가 — 과제 난이도와 매칭되나?</li>
        <li>리플렉션 Q3(대안 비교)의 품질 평균 — 형식적 답 vs 실제 비교</li>
        <li>AI 제안 수락 시 자기 설명 품질 분포</li>
      </ul>

      <h2>3. 시스템 신호</h2>
      <ul>
        <li>Pedagogy Coach 응답 중 Safety Guard가 차단한 건수와 사유</li>
        <li>Runtime Debugger 폴백 경로(Judge0 → clang.wasm) 실행 비율</li>
        <li>Promptfoo 회귀 실패 — 어떤 시나리오에서 퇴행이 잡혔나</li>
      </ul>

      <h2>4. 개선 항목</h2>
      <p>각 신호에 대해 구체적인 다음 액션을 한 줄로 적어.</p>
      <ul>
        <li>[프롬프트] …</li>
        <li>[UI] …</li>
        <li>[피드백 규칙] …</li>
        <li>[에이전트 조합] …</li>
      </ul>

      <h2>5. 설계 자산화</h2>
      <p>효과가 검증된 프롬프트 템플릿·개입 규칙·대시보드 카드는 <code>packages/agents/src/prompts/</code> 또는 <code>.claude/skills/</code>의 references에 커밋해 재사용.</p>
    </main>
  );
}
