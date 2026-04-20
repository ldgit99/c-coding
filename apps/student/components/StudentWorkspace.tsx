"use client";

import { useState } from "react";

import type { AppUser } from "@cvibe/db";

import { AIPanel } from "@/components/AIPanel";
import { AssignmentPanel, type AssignmentPublic } from "@/components/AssignmentPanel";
import { CEditor } from "@/components/CEditor";
import { InterventionBanner } from "@/components/InterventionBanner";
import { ModeSwitch, type Mode } from "@/components/ModeSwitch";
import { SubmitDialog } from "@/components/SubmitDialog";

/**
 * 클라이언트 워크스페이스 — Server Component가 user를 prop으로 주입.
 */
export function StudentWorkspace({ user }: { user: AppUser }) {
  const [assignment, setAssignment] = useState<AssignmentPublic | null>(null);
  const [editorCode, setEditorCode] = useState("");
  const [showSubmit, setShowSubmit] = useState(false);
  const [mode, setMode] = useState<Mode>("pair");
  const [modeLocked, setModeLocked] = useState(false);

  return (
    <main className="flex h-screen flex-col">
      <InterventionBanner
        studentId={user.id}
        onModeChange={(next) => {
          setMode(next);
          setModeLocked(true);
        }}
      />
      <header className="border-b bg-slate-50 px-4 py-2 text-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold">CVibe — C 짝프로그래밍</span>
            <span className="text-xs text-slate-500">
              {user.displayName}
              {user.mocked && <span className="ml-1 rounded bg-amber-100 px-1 text-amber-800">demo</span>}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <ModeSwitch mode={mode} onChange={setMode} locked={modeLocked} />
            <span>KC 숙련도: —</span>
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

        <AIPanel editorCode={editorCode} studentId={user.id} mode={mode} />
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
