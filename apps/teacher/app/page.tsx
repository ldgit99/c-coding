/**
 * 교사 대시보드 엔트리 — research.md §4.1 3단 뷰(Classroom/Student/Assignment) 스캐폴드.
 * Week 1~2 범위는 placeholder만. Realtime + SSE 통합은 Week 9.
 */
export default function TeacherHome() {
  return (
    <main className="p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">CVibe — 교사 대시보드</h1>
        <nav className="flex gap-3 text-sm">
          <a href="#classroom">Classroom</a>
          <a href="#student">Student</a>
          <a href="#assignment">Assignment</a>
        </nav>
      </header>

      <section id="classroom" className="mb-6 rounded border p-4">
        <h2 className="mb-2 font-semibold">Classroom View</h2>
        <p className="text-sm text-slate-600">
          반 전체 히트맵·진행률이 여기에 표시됩니다. (Realtime 연결 대기)
        </p>
      </section>

      <section id="intervention" className="mb-6 rounded border p-4">
        <h2 className="mb-2 font-semibold">Intervention Queue</h2>
        <p className="text-sm text-slate-600">Teacher Copilot이 아직 권고를 생성하지 않았어요.</p>
      </section>

      <section id="misconceptions" className="rounded border p-4">
        <h2 className="mb-2 font-semibold">Common Misconceptions</h2>
        <p className="text-sm text-slate-600">
          Student Modeler 배치(15분 주기) 실행 후 집계됩니다.
        </p>
      </section>
    </main>
  );
}
