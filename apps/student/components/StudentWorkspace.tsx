"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AppUser } from "@cvibe/db";
import { UserMenu } from "@cvibe/shared-ui";

import { AIPanel } from "@/components/AIPanel";
import { AssignmentPanel, type AssignmentPublic } from "@/components/AssignmentPanel";
import { Celebration, type CelebrationMessage } from "@/components/Celebration";
import { CEditor, type EditorFocus } from "@/components/CEditor";
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
  const [examMode, setExamMode] = useState(false);
  const MODE_RANK: Record<Mode, number> = { solo: 0, pair: 1, coach: 2 };

  // 모드 전환 시 xAPI 이벤트 기록 — 하향(SRL novel indicator) 구분 표시.
  const handleModeChange = useCallback(
    (next: Mode) => {
      setMode((prev) => {
        if (prev === next) return prev;
        const decreased = MODE_RANK[next] < MODE_RANK[prev];
        const verb = decreased
          ? "https://cvibe.app/verbs/mode-decreased"
          : "https://cvibe.app/verbs/mode-changed";
        void fetch("/api/events/record", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            verb,
            object: { type: "assignment", id: assignment?.code ?? "ungoverned" },
            result: { from: prev, to: next, decreased },
            context: { mode: next },
          }),
        });
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assignment?.code],
  );

  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [submissionsSource, setSubmissionsSource] = useState<"supabase" | "memory">("memory");
  const [submissionsLoaded, setSubmissionsLoaded] = useState(false);
  const [showMyLearning, setShowMyLearning] = useState(false);

  const [focusActive, setFocusActive] = useState(false);
  const [focusMinutes] = useState(15);

  const [celebration, setCelebration] = useState<CelebrationMessage | null>(null);
  const celebratedRef = useRef<Set<string>>(new Set());

  // 과제별 경과 시간 (사용자에게 보여줄 학습 시간)
  const [assignmentStartedAt, setAssignmentStartedAt] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  // 현재 과제 세션에서 사용한 최고 hint level (dependency flag 산출용)
  const [maxHintLevel, setMaxHintLevel] = useState<number>(0);

  // 마지막 실행 에러 — Coach 모드에서 AI 선제 개입 트리거
  const [lastRunError, setLastRunError] = useState<{ id: string; errorType: string } | null>(null);

  // 최신 실행 결과 전체 (stdout/stderr) — 튜터에 주입해 맥락 정확도 상승
  const [lastRunResult, setLastRunResult] = useState<{
    status: "ok" | "compile_error" | "runtime_error" | "timeout" | "signal";
    stdout?: string;
    stderr?: string;
    exitCode?: number | null;
    at?: string;
  } | null>(null);

  // 에디터 커서·선택 — 튜터가 "이 부분" 발화를 정확히 짚도록
  const [editorFocus, setEditorFocus] = useState<EditorFocus | null>(null);

  // 반응형 패널 토글 — 좁은 화면에서 CEditor 가 가려지지 않도록 AssignmentPanel 과
  // AIPanel 을 독립 drawer 로 관리.
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  useEffect(() => {
    const apply = () => {
      const w = window.innerWidth;
      if (w < 900) {
        setShowLeftPanel(false);
        setShowRightPanel(false);
      } else if (w < 1200) {
        setShowLeftPanel(false);
        setShowRightPanel(true);
      } else {
        setShowLeftPanel(true);
        setShowRightPanel(true);
      }
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  const refreshSubmissions = useCallback(async () => {
    try {
      const res = await fetch("/api/my/submissions");
      if (!res.ok) return;
      const data = (await res.json()) as MySubmissionsResponse;
      setSubmissions(data.submissions ?? []);
      setSubmissionsSource(data.source);
    } catch {
      // ignore
    } finally {
      setSubmissionsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refreshSubmissions();
  }, [refreshSubmissions]);

  // 과제가 바뀌면 타이머 리셋 + 경과 시간 재시작 + hint level 리셋
  useEffect(() => {
    if (!assignment) return;
    setAssignmentStartedAt(Date.now());
    setElapsedSec(0);
    setMaxHintLevel(0);
  }, [assignment?.code]);

  useEffect(() => {
    if (!assignmentStartedAt) return;
    const t = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - assignmentStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [assignmentStartedAt]);

  const handleRunComplete = useCallback(
    (result: {
      executed: boolean;
      exitCode: number | null;
      errorType?: string;
      stdout?: string;
      stderr?: string;
    }) => {
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
      // 튜터에 넘길 전체 결과 저장 — errorType 없으면 'ok' 로.
      const statusMap: Record<string, "ok" | "compile_error" | "runtime_error" | "timeout" | "signal"> = {
        compile: "compile_error",
        timeout: "timeout",
        signal: "signal",
        environment: "runtime_error",
      };
      setLastRunResult({
        status: result.errorType ? statusMap[result.errorType] ?? "runtime_error" : "ok",
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        at: new Date().toISOString(),
      });
      // Coach 모드 proactive 트리거 — 에러 있을 때마다 id 갱신해 AIPanel 이 감지
      if (result.errorType) {
        setLastRunError({
          id: `${assignment.code}:${Date.now()}`,
          errorType: result.errorType,
        });
      } else {
        setLastRunError(null);
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
    <main className="flex h-screen flex-col overflow-hidden bg-bg">
      <InterventionBanner
        studentId={user.id}
        onModeChange={(next, unlock) => {
          setMode(next);
          setModeLocked(!unlock);
        }}
        onExamChange={(active) => {
          setExamMode(active);
          if (active) setModeLocked(true);
          void fetch("/api/events/record", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              verb: active
                ? "https://cvibe.app/verbs/exam-started"
                : "https://cvibe.app/verbs/exam-ended",
              object: { type: "assignment", id: assignment?.code ?? "ungoverned" },
              result: { examMode: active },
            }),
          });
        }}
      />
      {examMode && (
        <div className="border-b border-error/40 bg-error/10 px-6 py-3 text-[13px]">
          <div className="flex items-center gap-3">
            <span className="rounded-sm bg-error/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
              🔒 Exam
            </span>
            <span className="font-medium text-text-primary">시험 모드</span>
            <span className="text-text-secondary">
              AI 힌트·채팅·코드리뷰 모두 차단돼요. 교사만 해제할 수 있어요.
            </span>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-border-soft bg-surface/80 px-6 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-lg font-semibold tracking-tighter text-text-primary">
              경북대학교 프로그래밍1
            </span>
            <span className="text-[10px] uppercase tracking-wider text-neutral">
              C Pair Programming
            </span>
            {/* 사용자 라벨은 우측 UserMenu 로 이동. 헤더 좌측은 브랜드만 유지. */}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-text-secondary">
            <ModeSwitch mode={mode} onChange={handleModeChange} locked={modeLocked} />
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
              onClick={() => setShowLeftPanel((v) => !v)}
              className={`inline-flex h-8 items-center rounded-md border px-2.5 text-[11px] font-medium transition-all ${
                showLeftPanel
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border-soft text-text-primary hover:border-primary hover:text-primary"
              }`}
              title="과제 패널 열기/닫기"
              aria-pressed={showLeftPanel}
            >
              📋 과제
            </button>
            <button
              type="button"
              onClick={() => setShowRightPanel((v) => !v)}
              className={`inline-flex h-8 items-center rounded-md border px-2.5 text-[11px] font-medium transition-all ${
                showRightPanel
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border-soft text-text-primary hover:border-primary hover:text-primary"
              }`}
              title="AI 튜터 패널 열기/닫기"
              aria-pressed={showRightPanel}
            >
              💬 AI
            </button>
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
            <UserMenu
              displayName={user.displayName}
              mocked={user.mocked}
              email={user.email}
              loginPath="/login"
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left drawer — AssignmentPanel */}
        <aside
          className={`shrink-0 overflow-hidden border-r border-border-soft transition-[width] duration-200 ease-out ${
            showLeftPanel ? "w-[clamp(260px,22vw,340px)]" : "w-0"
          }`}
          aria-hidden={!showLeftPanel}
        >
          <div className="h-full w-[clamp(260px,22vw,340px)]">
            <AssignmentPanel
              selectedCode={assignment?.code ?? null}
              submissions={submissions}
              submissionsLoaded={submissionsLoaded}
              studentId={user.id}
              onSelect={(a) => {
                setAssignment(a);
                setEditorCode(a.starterCode);
              }}
            />
          </div>
        </aside>

        {/* Center — CEditor 항상 표시 */}
        <div className="min-w-0 flex-1">
          <CEditor
            key={assignment?.code ?? "none"}
            starterCode={assignment?.starterCode}
            onCodeChange={setEditorCode}
            onRunComplete={handleRunComplete}
            onFocusChange={setEditorFocus}
          />
        </div>

        {/* Right drawer — AIPanel */}
        <aside
          className={`relative shrink-0 overflow-hidden border-l border-border-soft transition-[width] duration-200 ease-out ${
            showRightPanel ? "w-[clamp(320px,26vw,400px)]" : "w-0"
          }`}
          aria-hidden={!showRightPanel}
        >
          <div className="flex h-full w-[clamp(320px,26vw,400px)] flex-col">
            <AIPanel
              editorCode={editorCode}
              studentId={user.id}
              mode={examMode ? "pair" : mode}
              examMode={examMode}
              assignmentCode={assignment?.code ?? null}
              assignmentTitle={assignment?.title}
              learningObjectives={assignment?.learningObjectives}
              assignmentKcTags={assignment?.kcTags}
              elapsedSec={elapsedSec}
              onMaxHintLevelChange={(lvl) =>
                setMaxHintLevel((prev) => Math.max(prev, lvl))
              }
              lastRunError={lastRunError}
              lastRunResult={lastRunResult}
              editorFocus={editorFocus}
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
        </aside>
      </div>

      {showSubmit && (
        <SubmitDialog
          editorCode={editorCode}
          assignmentCode={assignment?.code ?? null}
          previousSubmissions={submissions.filter(
            (s) => s.assignmentCode === assignment?.code,
          )}
          maxHintLevelUsed={maxHintLevel}
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
