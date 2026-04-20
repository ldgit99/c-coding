import Link from "next/link";

export default function StudentOnboarding() {
  return (
    <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto", fontFamily: "system-ui, sans-serif", lineHeight: 1.6 }}>
      <nav><Link href="/">← 문서 홈</Link></nav>
      <h1>학생 온보딩</h1>

      <h2>1. Navigator, not Driver</h2>
      <p>CVibe의 AI는 <em>답을 주는 도구</em>가 아니라 <em>네 옆에서 질문을 던지는 동료</em>야. 네가 먼저 코드를 써 보고, 막히면 계단식 힌트를 써. 첫 단계는 항상 "지금 해결하려는 게 정확히 뭐야?"라는 질문이야.</p>

      <h2>2. 계단식 힌트 4단계</h2>
      <ol>
        <li><strong>L1 정의 질문</strong> — 문제를 네 말로 재진술.</li>
        <li><strong>L2 개념 설명</strong> — 관련 지식 조각을 떠올려보는 시간.</li>
        <li><strong>L3 의사코드</strong> — 언어와 상관없는 논리 흐름.</li>
        <li><strong>L4 예시 코드</strong> — 시도를 3번 이상 해봤고 모드가 tutor일 때만 열려. 에디터에 직접 삽입되지 않고 diff 뷰로만 제안돼.</li>
      </ol>

      <h2>3. AI 제안을 수락하기 전 자기 설명</h2>
      <p>AI가 코드 수정을 제안하면, 수락 버튼을 누르기 전에 "왜 이 수정이 필요한지" 한두 문장으로 설명해야 해. 이게 메타인지 훈련의 핵심이야. 설명을 못 적으면 수락할 수 없어.</p>

      <h2>4. 리플렉션 5문항</h2>
      <p>제출 전에 반드시 5개 질문에 답해야 해:</p>
      <ol>
        <li>가장 어려웠던 부분은?</li>
        <li>어떤 힌트가 결정적이었어?</li>
        <li>가능했던 <strong>두 가지 해결안</strong>은 뭐고, 왜 이걸 선택했어?</li>
        <li>왜 그렇게 생각했어?</li>
        <li>다음에 비슷한 문제를 만나면 어떻게 접근할래?</li>
      </ol>
      <p>대안 비교(Q3)가 비어 있으면 평가 점수의 reflection 축이 0으로 계산돼. 형식적 답이 아니라 실제로 두 길을 상상해봐.</p>

      <h2>5. "답 달라"고 해봤자</h2>
      <p>AI에게 "그냥 답만 알려주세요"라고 해도, 게이팅 규칙이 답 제공을 막아. 대신 "왜 스스로 해보고 싶지 않은지" 반사 질문으로 돌려. 이건 시스템이 의도한 동작이야 — 포기하지 말고 계속 질문을 던져봐.</p>
    </main>
  );
}
