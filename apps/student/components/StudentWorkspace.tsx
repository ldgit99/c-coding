"use client";

import { useState } from "react";

import type { AppUser } from "@cvibe/db";

import { AIPanel } from "@/components/AIPanel";
import { AssignmentPanel, type AssignmentPublic } from "@/components/AssignmentPanel";
import { CEditor } from "@/components/CEditor";
import { InterventionBanner } from "@/components/InterventionBanner";
import { ModeSwitch, type Mode } from "@/components/ModeSwitch";
import { SubmitDialog } from "@/components/SubmitDialog";

export function StudentWorkspace({ user }: { user: AppUser }) {
  const [assignment, setAssignment] = useState<AssignmentPublic | null>(null);
  const [editorCode, setEditorCode] = useState("");
  const [showSubmit, setShowSubmit] = useState(false);
  const [mode, setMode] = useState<Mode>("pair");
  const [modeLocked, setModeLocked] = useState(false);

  return (
    <main className="flex h-screen flex-col bg-bg">
      <InterventionBanner
        studentId={user.id}
        onModeChange={(next, unlock) => {
          setMode(next);
          setModeLocked(!unlock);
        }}
      />
      <header className="sticky top-0 z-20 border-b border-border-soft bg-surface/80 px-6 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-lg font-semibold tracking-tighter text-text-primary">
              경북대학교 프로그래밍1
            </span>
            <span className="text-[10px] uppercase tracking-wider text-neutral">
              C Pair Programming
            </span>
            <span className="text-[12px] text-text-secondary">
              {user.displayName}
              {user.mocked && (
                <span className="ml-2 rounded-sm bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-warning">
                  demo
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-text-secondary">
            <ModeSwitch mode={mode} onChange={setMode} locked={modeLocked} />
            <span className="hidden text-neutral md:inline">KC 숙련도 —</span>
            <span className="hidden font-mono text-neutral md:inline">00:00</span>
            <button
              onClick={() => setShowSubmit(true)}
              disabled={editorCode.trim().length < 20}
              className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-[12px] font-medium text-white transition-all hover:-translate-y-px hover:bg-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              제출
            </button>
          </div>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-[320px_1fr_380px] divide-x divide-border-soft overflow-hidden">
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
