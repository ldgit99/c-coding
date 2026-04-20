import { CEditor } from "@/components/CEditor";

/**
 * 학생 앱 엔트리 — research.md §3.1 3-패널 레이아웃.
 * - 좌: 문제 설명 (Week 8 Problem Architect 통합 후 실제 과제)
 * - 중: Monaco 에디터 + 실행 패널 (Judge0 경로, Week 3 후반 clang.wasm으로 전환)
 * - 우: AI 협력 패널 (Week 4~5 Pedagogy Coach 통합)
 */
export default function StudentHome() {
  return (
    <main className="flex h-screen flex-col">
      <header className="border-b bg-slate-50 px-4 py-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-semibold">CVibe — C 짝프로그래밍</span>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span>KC 숙련도: —</span>
            <span>AI 개입: pair</span>
            <span>경과: 00:00</span>
          </div>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-[320px_1fr_360px] divide-x overflow-hidden">
        <aside aria-label="problem-panel" className="overflow-auto p-4">
          <h2 className="mb-2 text-base font-semibold">문제</h2>
          <p className="text-sm text-slate-600">
            과제가 아직 할당되지 않았어요. 왼쪽은 placeholder — Week 8에 Problem Architect 산출물로 채워집니다.
          </p>
        </aside>

        <CEditor />

        <aside aria-label="ai-panel" className="overflow-auto p-4">
          <div className="mb-3 flex gap-2 text-xs">
            <button className="rounded border px-2 py-1">대화</button>
            <button className="rounded border px-2 py-1">힌트</button>
            <button className="rounded border px-2 py-1">리플렉션</button>
            <button className="rounded border px-2 py-1">코드리뷰</button>
          </div>
          <p className="text-sm text-slate-600">
            AI 협력 패널입니다. 코드를 한 번이라도 작성하거나 실행해야 대화가 시작돼요 —
            <em>Navigator, not Driver</em> 원칙이에요.
          </p>
        </aside>
      </div>
    </main>
  );
}
