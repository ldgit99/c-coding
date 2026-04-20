"use client";

import { useState } from "react";

import { AIPanel } from "@/components/AIPanel";
import { CEditor } from "@/components/CEditor";
import { SubmitDialog } from "@/components/SubmitDialog";

/**
 * 학생 앱 엔트리 — research.md §3.1 3-패널 레이아웃.
 * Week 7: "제출" 버튼 + 리플렉션 + 4축 루브릭 채점 카드.
 */
export default function StudentHome() {
  const studentId = "demo-student-001";
  const [editorCode, setEditorCode] = useState("");
  const [showSubmit, setShowSubmit] = useState(false);

  return (
    <main className="flex h-screen flex-col">
      <header className="border-b bg-slate-50 px-4 py-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-semibold">CVibe — C 짝프로그래밍</span>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span>KC 숙련도: —</span>
            <span>AI 개입: pair</span>
            <span>경과: 00:00</span>
            <button
              onClick={() => setShowSubmit(true)}
              disabled={editorCode.trim().length < 20}
              className="rounded bg-slate-900 px-2 py-1 text-white disabled:opacity-50"
            >
              제출
            </button>
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

      {showSubmit && (
        <SubmitDialog editorCode={editorCode} onClose={() => setShowSubmit(false)} />
      )}
    </main>
  );
}
