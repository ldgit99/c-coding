import Link from "next/link";

export default function DocsHome() {
  return (
    <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto", fontFamily: "system-ui, sans-serif", lineHeight: 1.6 }}>
      <h1>CVibe 문서</h1>
      <p>학생–AI 짝프로그래밍 플랫폼의 사용자 가이드와 교사 매뉴얼이에요.</p>

      <h2>가이드</h2>
      <ul>
        <li>
          <Link href="/teacher-manual">교사 매뉴얼</Link> — 대시보드 해석, 개입 시점 판단, AI 개입 수준 조정
        </li>
        <li>
          <Link href="/student-onboarding">학생 온보딩</Link> — 첫 사용자를 위한 워크플로우, Navigator 원칙, 리플렉션 요령
        </li>
        <li>
          <Link href="/pilot-retrospective">파일럿 회고</Link> — 첫 수업 로그에서 얻은 개선 항목과 다음 이터레이션 계획
        </li>
      </ul>

      <h2>참고</h2>
      <ul>
        <li><a href="https://github.com/anthropics/claude-code">Claude Code</a></li>
        <li><a href="https://platform.claude.com/docs/en/agent-sdk/typescript">Claude Agent SDK</a></li>
      </ul>
    </main>
  );
}
