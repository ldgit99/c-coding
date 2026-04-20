"use client";

import { useState } from "react";

import { AIPanel } from "@/components/AIPanel";
import { CEditor } from "@/components/CEditor";

/**
 * 학생 앱 엔트리 — research.md §3.1 3-패널 레이아웃.
 * Week 4~5: AI 패널에 실제 Pedagogy Coach 연결 (Socratic 4단계 + 게이팅).
 */
export default function StudentHome() {
  // 데모용 정적 studentId — Week 10에 Supabase Auth로 교체
  const studentId = "demo-student-001";
  const [editorCode, setEditorCode] = useState("");

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

        <CEditor onCodeChange={setEditorCode} />

        <AIPanel editorCode={editorCode} studentId={studentId} />
      </div>
    </main>
  );
}
