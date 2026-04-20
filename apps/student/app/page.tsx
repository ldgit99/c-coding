"use client";

import { useState } from "react";

import { AIPanel } from "@/components/AIPanel";
import { AssignmentPanel, type AssignmentPublic } from "@/components/AssignmentPanel";
import { CEditor } from "@/components/CEditor";
import { SubmitDialog } from "@/components/SubmitDialog";

/**
 * 학생 앱 엔트리 — research.md §3.1 3-패널.
 * Week 8: 실제 과제 카탈로그(10개) 좌측 렌더 + starter_code 주입.
 */
export default function StudentHome() {
  const studentId = "demo-student-001";
  const [assignment, setAssignment] = useState<AssignmentPublic | null>(null);
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
        <AssignmentPanel
          selectedCode={assignment?.code ?? null}
          onSelect={(a) => {
            setAssignment(a);
            setEditorCode(a.starterCode);
          }}
        />

        <CEditor
          key={assignment?.code ?? "none"}
          starterCode={assignment?.starterCode}
          onCodeChange={setEditorCode}
        />

        <AIPanel editorCode={editorCode} studentId={studentId} />
      </div>

      {showSubmit && (
        <SubmitDialog
          editorCode={editorCode}
          assignmentCode={assignment?.code ?? null}
          onClose={() => setShowSubmit(false)}
        />
      )}
    </main>
  );
}
