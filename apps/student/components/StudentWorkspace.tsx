"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AppUser } from "@cvibe/db";

import { AIPanel } from "@/components/AIPanel";
import { AssignmentPanel, type AssignmentPublic } from "@/components/AssignmentPanel";
import { Celebration, type CelebrationMessage } from "@/components/Celebration";
import { CEditor } from "@/components/CEditor";
import { FocusMode } from "@/components/FocusMode";
import { InterventionBanner } from "@/components/InterventionBanner";
import { ModeSwitch, type Mode } from "@/components/ModeSwitch";
import { MyLearningDialog } from "@/components/MyLearningDialog";
import { SubmitDialog } from "@/components/SubmitDialog";

interface SubmissionRow {
  id: string;
  assignmentCode: string | null;
  assignmentTitle: string | null;
  kcTags: string[];
  difficulty: number | null;
  finalScore: number | null;
  passed: boolean;
  rubricScores: Record<string, number | null> | null;
  submittedAt: string;
}

interface MySubmissionsResponse {
  studentId: string;
  submissions: SubmissionRow[];
  source: "supabase" | "memory";
}

export function StudentWorkspace({ user }: { user: AppUser }) {
  const [assignment, setAssignment] = useState<AssignmentPublic | null>(null);
  const [editorCode, setEditorCode] = useState("");
  const [showSubmit, setShowSubmit] = useState(false);
  const [mode, setMode] = useState<Mode>("pair");
  const [modeLocked, setModeLocked] = useState(false);

  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [submissionsSource, setSubmissionsSource] = useState<"supabase" | "memory">("memory");
  const [showMyLearning, setShowMyLearning] = useState(false);

  const [focusActive, setFocusActive] = useState(false);
  const [focusMinutes] = useState(15);

  const [celebration, setCelebration] = useState<CelebrationMessage | null>(null);
  const celebratedRef = useRef<Set<string>>(new Set());

  // 과제별 경과 시간 (사용자에게 보여줄 학습 시간)
  const [assignmentStartedAt, setAssignmentStartedAt] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const refreshSubmissions = useCallback(async () => {
    try {
      const res = await fetch("/api/my/submissions");
      if (!res.ok) return;
      const data = (await res.json()) as MySubmissionsResponse;
      setSubmissions(data.submissions ?? []);
      setSubmissionsSource(data.source);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void refreshSubmissions();
  }, [refreshSubmissions]);

  // 과제가 바뀌면 타이머 리셋 + 경과 시간 재시작
  useEffect(() => {
    if (!assignment) return;
    setAssignmentStartedAt(Date.now());
    setElapsedSec(0);
  }, [assignment?.code]);

  useEffect(() => {
    if (!assignmentStartedAt) return;
    const t = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - assignmentStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [assignmentStartedAt]);

  const handleRunComplete = useCallback(
    (result: { executed: boolean; exitCode: number | null; errorType?: string }) => {
      if (!assignment) return;
      const key = `compile:${user.id}:${assignment.code}`;
      if (result.executed && !result.errorType && !celebratedRef.current.has(key)) {
        celebratedRef.current.add(key);
        setCelebration({
          id: key,
          kind: "compile",
          title: "컴파일 통과",
          body: "첫 실행이 정상 종료됐어. visible test 도 맞춰보자.",
        });
      }
    },
    [assignment, user.id],
  );

  const handleSubmitSuccess = useCallback(
    (passed: boolean) => {
      void refreshSubmissions();
      if (passed && assignment) {
        const key = `submit-pass:${user.id}:${assignment.code}`;
        if (!celebratedRef.current.has(key)) {
          celebratedRef.current.add(key);
          setCelebration({
            id: key,
            kind: "submit",
            title: "과제 통과!",
            body: `"${assignment.title}" 통과했어. 학습 기록에 추가됐어.`,
          });
        }
      }
    },
    [assignment, refreshSubmissions, user.id],
  );

  const mm = Math.floor(elapsedSec / 60)
    .toString()
    .padStart(2, "0");
  const ss = (elapsedSec % 60).toString().padStart(2, "0");

  const passedCount = useMemo(
    () => new Set(submissions.filter((s) => s.passed).map((s) => s.assignmentCode)).size,
    [submissions],
  );

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
          <div className="flex items-center gap-3 text-[11px] text-text-secondary">
            <ModeSwitch mode={mode} onChange={setMode} locked={modeLocked} />
            <button
              type="button"
              onClick={() => setFocusActive((v) => !v)}
              className={`inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-[11px] font-medium transition-all ${
                focusActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border-soft text-text-primary hover:border-primary hover:text-primary"
              }`}
              title="AI 없이 혼자 풀어보는 집중 시간"
            >
              🎯 Focus
            </button>
            <span
              className="hidden font-mono tabular-nums text-neutral md:inline"
              title={`이 과제에서 경과된 시간`}
            >
              {mm}:{ss}
            </span>
            <span className="hidden text-[11px] text-neutral md:inline">
              · {passedCount}개 통과
            </span>
            <button
              type="button"
              onClick={() => setShowMyLearning(true)}
              className="inline-flex h-8 items-center rounded-md border border-border-soft bg-white px-2.5 text-[11px] font-medium text-text-primary transition-all hover:-translate-y-px hover:border-primary hover:text-primary"
            >
              내 학습
            </button>
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
          submissions={submissions}
          onSelect={(a) => {
            setAssignment(a);
            setEditorCode(a.starterCode);
          }}
        />

        <CEditor
          key={assignment?.code ?? "none"}
          starterCode={assignment?.starterCode}
          onCodeChange={setEditorCode}
          onRunComplete={handleRunComplete}
        />

        <div className="relative">
          <AIPanel
            editorCode={editorCode}
            studentId={user.id}
            mode={mode}
            assignmentCode={assignment?.code ?? null}
            assignmentTitle={assignment?.title}
            learningObjectives={assignment?.learningObjectives}
            assignmentKcTags={assignment?.kcTags}
            elapsedSec={elapsedSec}
          />
          <FocusMode
            active={focusActive}
            minutes={focusMinutes}
            onEnd={(summary) => {
              setFocusActive(false);
              setCelebration({
                id: `focus:${Date.now()}`,
                kind: "visible-test",
                title: summary.completed ? "집중 시간 완주" : "집중 시간 종료",
                body: `AI 없이 ${Math.floor(summary.elapsedSec / 60)}분 ${summary.elapsedSec % 60}초 혼자 풀었어.`,
              });
            }}
          />
        </div>
      </div>

      {showSubmit && (
        <SubmitDialog
          editorCode={editorCode}
          assignmentCode={assignment?.code ?? null}
          onClose={() => setShowSubmit(false)}
          onSubmitted={handleSubmitSuccess}
        />
      )}

      {showMyLearning && (
        <MyLearningDialog
          submissions={submissions}
          source={submissionsSource}
          onClose={() => setShowMyLearning(false)}
        />
      )}

      <Celebration message={celebration} onDismiss={() => setCelebration(null)} />
    </main>
  );
}
