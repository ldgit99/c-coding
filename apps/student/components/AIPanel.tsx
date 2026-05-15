"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { EditorFocus } from "./CEditor";
import type { Mode } from "./ModeSwitch";
import { StuckDiagnostic } from "./StuckDiagnostic";
import { WalkthroughPrompt } from "./WalkthroughPrompt";

interface LastRunResult {
  status: "ok" | "compile_error" | "runtime_error" | "timeout" | "signal";
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  at?: string;
}

interface Finding {
  id: string;
  severity: "blocker" | "major" | "minor" | "style";
  line: number;
  category: string;
  kc: string;
  message: string;
  suggestion: string;
}

interface ReviewPayload {
  findings: Finding[];
  topIssues: string[];
  analysisMode: "lint+llm" | "llm-only";
  summary: string;
}

interface HintPayload {
  hintLevel: 1 | 2 | 3 | 4;
  hintType: string;
  message: string;
  relatedKC?: string[];
  requiresSelfExplanation?: boolean;
}

interface ChatResponse {
  intent?: string;
  route?: string;
  reason?: string;
  hint?: HintPayload;
  review?: ReviewPayload;
  gating?: { grantedLevel: 1 | 2 | 3 | 4; failedConditions: string[]; fadedFrom?: number };
  usedModel?: string;
  mocked?: boolean;
  error?: string;
  details?: Array<{ path?: (string | number)[]; message?: string; code?: string }>;
  pedagogyMode?: "hint" | "chat";
  safety?: {
    outboundVerdict?: "allow" | "sanitize" | "block";
    outboundReasons?: string[];
  };
}

type Tab = "chat" | "review";

interface AIPanelProps {
  editorCode: string;
  studentId: string;
  mode: Mode;
  assignmentCode?: string | null;
  /** 과제 제목 — 환영 턴 템플릿에 사용. 없으면 환영 턴 생략. */
  assignmentTitle?: string;
  /** 과제 학습 목표 (2개) — pair/tutor 모드에서 리스트로 노출. */
  learningObjectives?: string[];
  /** 과제 KC tags — Walkthrough prompt self-check 질문에 사용. */
  assignmentKcTags?: string[];
  /** 과제 열고 경과한 시간(초). Walkthrough prompt 트리거 기준. */
  elapsedSec?: number;
  /** 최고 hint level 변화를 상위로 통지 — SubmitDialog dependency flag 산출. */
  onMaxHintLevelChange?: (level: 1 | 2 | 3 | 4) => void;
  /**
   * 동일 과제에서 힌트가 누적 임계 (기본 5 회) 에 도달했을 때 1회 발사.
   * 부모가 격려 토스트로 전환 — 도움 요청을 학습 전략으로 긍정 안내 (부록 C ⑥).
   * assignmentCode 가 바뀌면 카운터 리셋.
   */
  onHelpAffirm?: () => void;
  /**
   * Coach 모드에서 컴파일·런타임 에러 발생 시 AI 가 먼저 말을 거는 트리거.
   * 부모가 새로운 error 이벤트마다 고유 id 를 올려주면 AIPanel 이 proactive
   * 턴을 1회 주입한다. null 이면 발화 안 함.
   */
  lastRunError?: { id: string; errorType: string } | null;
  /** 최신 run 결과 전체. 튜터 요청에 그대로 실음. */
  lastRunResult?: LastRunResult | null;
  /** Monaco 커서·선택 영역. 튜터에 전달해 "이 부분" 발화를 정확히 짚게. */
  editorFocus?: EditorFocus | null;
  /** 학생이 입력한 stdin. '내가 준 입력' 을 튜터가 볼 수 있도록. */
  editorStdin?: string;
  /** 시험 모드 — AI 기능 전면 차단 오버레이. */
  examMode?: boolean;
}

/**
 * 과제 선택 시 AI가 먼저 말 거는 환영 턴 — 결정적 템플릿.
 * LLM 호출 없음. research.md §3.2 Navigator-not-Driver 원칙 유지 (힌트 아님).
 * 학생이 문제를 읽고 재진술하도록 유도하는 소크라틱 L0 발화.
 */
function buildWelcomeMessage(params: {
  title?: string;
  objectives?: string[];
  mode: Mode;
}): string | null {
  const { title, objectives, mode } = params;
  if (!title) return null;
  if (mode === "solo") return null;

  const objLines =
    objectives && objectives.length > 0
      ? `\n\n오늘의 연습 포인트:\n${objectives
          .map((o, i) => `  ${["①", "②", "③"][i] ?? "•"} ${o}`)
          .join("\n")}`
      : "";

  if (mode === "coach") {
    return `안녕! "${title}"을(를) 같이 해볼게.${objLines}\n\n준비되면 네가 먼저 움직여봐. 도움이 필요하면 자연스럽게 말해 — 예시 코드까지 보여줄 수 있어. 수락 전 자기 설명은 필수야.`;
  }

  // pair (기본)
  return `안녕! "${title}" 시작이구나.${objLines}\n\n나는 옆에 있을게. 힌트는 네가 요청할 때만 원리·접근법까지 건네줄게. 먼저 편하게 시도해봐.`;
}

type HistoryEntry =
  | {
      kind: "text";
      role: "student" | "ai" | "system";
      text: string;
      meta?: string;
      level?: 1 | 2 | 3 | 4;
      requiresSelfExplanation?: boolean;
      accepted?: boolean;
      /** "hint" 이면 L·유형 배지 + 회색 카드. "chat" 이면 일반 말풍선. */
      pedagogyMode?: "hint" | "chat";
      /** 학생 1클릭 피드백 — 👍/👎/🤔. */
      feedback?: "up" | "down" | "confused";
      /** Safety Guard 차단 메시지 — Accept Gate·피드백 버튼 숨김. */
      blocked?: boolean;
    }
  | { kind: "review"; review: ReviewPayload; meta?: string };

/** 내부 디버그 문자열 제거 — LLM 응답 에도 서버 에도 한 번 더 방어선. */
function stripInternalDebug(text: string): string {
  return text
    .replace(/\(게이팅[^)]*\)\s*/g, "")
    .replace(/L\d+→L\d+:[^\n]+/g, "")
    .replace(/\bGating failures:[^\n]+/gi, "")
    .replace(/\bGranted level:[^\n]+/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** hintType enum → 학생이 이해 가능한 한국어 라벨. */
function humanHintType(hintType: string): string {
  switch (hintType) {
    case "question":
      return "질문";
    case "concept":
      return "개념";
    case "pseudocode":
      return "의사코드";
    case "example":
      return "예시";
    default:
      return hintType;
  }
}

/** 두 문자열의 토큰 겹침 비율 (0~1). 복붙 감지 휴리스틱용. */
function textSimilarity(a: string, b: string): number {
  const tokenize = (s: string): Set<string> =>
    new Set(
      s
        .replace(/[^\w가-힣]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 2),
    );
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  return inter / Math.min(A.size, B.size);
}

const MODE_PLACEHOLDER: Record<Mode, string> = {
  solo: "현재 Solo 모드 — 힌트 받으려면 Pair 이상으로 바꿔요",
  pair: "질문 또는 힌트 요청 (원리·접근법까지)",
  coach: "편하게 물어봐 — 예시 코드도 가능",
};

const MODE_CEILING_HINT: Record<Mode, string> = {
  solo: "Solo · L1 상한",
  pair: "Pair · L3 상한",
  coach: "Coach · L4 + Accept Gate",
};

function proactiveErrorMessage(errorType: string): string {
  const MAP: Record<string, string> = {
    compile: "컴파일이 실패했네. 어느 줄에서 빨간 밑줄이 떴는지 알려줄래? 같이 에러 메시지를 읽어보자.",
    timeout: "실행이 제한 시간을 넘겼어. 무한 루프이거나 반복 횟수가 너무 큰 건 아닐까? 루프 종료 조건을 같이 점검해볼까?",
    signal: "프로그램이 비정상 종료했어. 포인터 접근이나 배열 인덱스 범위를 확인해보면 좋을 것 같아. 의심되는 부분을 짚어줄래?",
    environment: "실행 환경 문제인 것 같아. 한 번 더 실행해보고 같은 에러가 나면 알려줘.",
  };
  return (
    MAP[errorType] ??
    `실행 결과에 문제가 보여 (${errorType}). 어느 지점부터 예상과 다르게 동작하는지 짚어주면 같이 들여다볼게.`
  );
}

function buildModeTransitionMessage(from: Mode, to: Mode): string {
  if (from === to) return "";
  const labels: Record<Mode, string> = { solo: "Solo", pair: "Pair", coach: "Coach" };
  const ceiling: Record<Mode, string> = {
    solo: "AI가 거의 침묵해요. 힌트 L1(방향 잡아주는 질문)까지만 가능.",
    pair: "원리·접근법·의사코드까지 받을 수 있어요. 예시 코드는 제공 안 함.",
    coach: "예시 코드까지 받을 수 있어요. 수락 전 자기 설명이 필요해요.",
  };
  return `🔄 ${labels[from]} → ${labels[to]} 로 전환. ${ceiling[to]}`;
}

export function AIPanel({
  editorCode,
  studentId,
  mode,
  assignmentCode,
  assignmentTitle,
  learningObjectives,
  assignmentKcTags,
  elapsedSec = 0,
  onMaxHintLevelChange,
  onHelpAffirm,
  lastRunError,
  lastRunResult,
  editorFocus,
  editorStdin,
  examMode = false,
}: AIPanelProps) {
  // 부록 C ⑥ — 힌트 누적 격려: 동일 과제에서 5회 받으면 1회 토스트.
  // ref 로 카운터 보존 (리렌더 무관), assignmentCode 변경 시 useEffect 로 리셋.
  const hintAffirmCountRef = useRef(0);
  const hintAffirmFiredRef = useRef(false);
  const HELP_AFFIRM_THRESHOLD = 5;
  const [tab, setTab] = useState<Tab>("chat");
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [supportLevel, setSupportLevel] = useState<0 | 1 | 2 | 3>(0);
  const [selfExplainTarget, setSelfExplainTarget] = useState<number | null>(null);
  const [selfExplainText, setSelfExplainText] = useState("");
  const welcomedAssignmentRef = useRef<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const stuckToBottomRef = useRef<boolean>(true);
  const hydratedAssignmentRef = useRef<string | null>(null);
  const previousModeRef = useRef<Mode>(mode);
  const [walkthroughDismissed, setWalkthroughDismissed] = useState(false);

  // 직전 에디터 스냅샷 (튜터가 최근 변경을 볼 수 있도록).
  const previousCodeRef = useRef<string>(editorCode);
  // 메시지 전송 직후의 코드도 보존 — L4 후 10초 내 붙여넣기 감지에 사용.
  const lastAiHintSnapshotRef = useRef<{
    at: number;
    level: 1 | 2 | 3 | 4;
    aiText: string;
    codeAtResponse: string;
  } | null>(null);

  // Assignment 별 history 캐시 — IndexedDB 없이 localStorage.
  const cacheKey = assignmentCode
    ? `cvibe.chat.${studentId}.${assignmentCode}`
    : null;

  // assignment 전환 시 캐시 복원 — 서버 hydration 보다 먼저 로컬 즉시 적용
  useEffect(() => {
    if (!cacheKey) return;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return;
      const cached = JSON.parse(raw) as HistoryEntry[];
      if (Array.isArray(cached) && cached.length > 0) {
        setHistory(cached);
        welcomedAssignmentRef.current = assignmentCode ?? null; // 복원됐으면 welcome 스킵
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  // 과제 전환 시 힌트 누적 카운터 리셋 — 격려 토스트는 과제당 1회.
  useEffect(() => {
    hintAffirmCountRef.current = 0;
    hintAffirmFiredRef.current = false;
  }, [assignmentCode]);

  // history 변화 시 캐시 저장 — 최근 50턴만
  useEffect(() => {
    if (!cacheKey) return;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(history.slice(-50)));
    } catch {
      // quota or private mode — ignore
    }
  }, [history, cacheKey]);

  // 새 턴 추가/로딩 상태 변화 시 맨 아래로 자동 스크롤 — 학생이 위로 읽고 있지
  // 않을 때만 (stuckToBottomRef 로 의도 존중).
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    if (!stuckToBottomRef.current) return;
    // 다음 paint 에 부드럽게 스크롤
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, [history, loading]);

  // 모드 변경 감지 → 시스템 메시지 턴 주입 (첫 마운트는 스킵)
  useEffect(() => {
    const prev = previousModeRef.current;
    if (prev === mode) return;
    const msg = buildModeTransitionMessage(prev, mode);
    previousModeRef.current = mode;
    if (!msg) return;
    setHistory((h) => [
      ...h,
      {
        kind: "text",
        role: "system",
        text: msg,
        meta: MODE_CEILING_HINT[mode],
      },
    ]);
  }, [mode]);

  // Coach 모드에서 새 run error 발생 시 AI 가 먼저 말 걸기 (proactivity 축).
  // lastRunError.id 가 바뀔 때만 1회 주입 → 같은 에러가 유지되면 중복 없음.
  const proactiveErrorIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (mode !== "coach") return;
    if (!lastRunError) return;
    if (proactiveErrorIdRef.current === lastRunError.id) return;
    proactiveErrorIdRef.current = lastRunError.id;
    const typeLabel = proactiveErrorMessage(lastRunError.errorType);
    setHistory((h) => [
      ...h,
      {
        kind: "text",
        role: "ai",
        text: typeLabel,
        meta: `proactive · ${lastRunError.errorType}`,
      },
    ]);
  }, [lastRunError, mode]);

  // 과제 전환 시 walkthrough 재활성
  useEffect(() => {
    setWalkthroughDismissed(false);
  }, [assignmentCode]);

  // 30분(1800초) 이상 경과 + 제출 안 했을 때 walkthrough prompt 표시
  const STAGNATION_THRESHOLD_SEC = 30 * 60;
  const showWalkthrough =
    !walkthroughDismissed &&
    elapsedSec >= STAGNATION_THRESHOLD_SEC &&
    !!assignmentCode;

  // 과제 전환 시 대화 히스토리는 해당 과제 것만 보이도록 초기화.
  // 서버(/api/conversations)에서 해당 assignmentId 로 필터된 턴을 복원.
  // 복원된 턴이 있으면 환영 턴 주입은 스킵, 없으면 empty 상태에서 welcome 주입.
  useEffect(() => {
    if (!assignmentCode || !studentId) return;
    if (hydratedAssignmentRef.current === assignmentCode) return;
    hydratedAssignmentRef.current = assignmentCode;

    // 새 과제로 전환 즉시 이전 대화 지우기
    setHistory([]);
    welcomedAssignmentRef.current = null;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/conversations?studentId=${encodeURIComponent(studentId)}&assignmentId=${encodeURIComponent(assignmentCode)}&limit=200`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { turns: ServerTurn[] };
        if (cancelled) return;
        if (data.turns && data.turns.length > 0) {
          setHistory(data.turns.map(toHistoryEntry));
          welcomedAssignmentRef.current = assignmentCode; // 복원됐으면 환영 턴 스킵
        }
      } catch {
        // ignore — 복원 실패 시 환영 턴이 정상적으로 주입됨
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assignmentCode, studentId]);

  // 과제 전환 시 환영 턴 1회 주입. 기존 대화가 복원됐으면 생략.
  useEffect(() => {
    if (!assignmentCode || !assignmentTitle) return;
    if (welcomedAssignmentRef.current === assignmentCode) return;
    const message = buildWelcomeMessage({
      title: assignmentTitle,
      objectives: learningObjectives,
      mode,
    });
    if (!message) return;
    // hydration이 먼저 반영되도록 짧은 딜레이
    const timer = setTimeout(() => {
      setHistory((h) => {
        if (h.length > 0) return h; // 이미 복원된 대화 있으면 스킵
        welcomedAssignmentRef.current = assignmentCode;
        return [
          ...h,
          {
            kind: "text",
            role: "ai",
            text: message,
            meta: `welcome · ${mode}`,
          },
        ];
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [assignmentCode, assignmentTitle, learningObjectives, mode]);

  const callChat = useCallback(
    async (utterance: string, opts: { requestedLevel?: 1 | 2 | 3 | 4 } = {}) => {
      const studentMsg = utterance || `Level ${opts.requestedLevel} 힌트 요청`;
      setHistory((h) => [...h, { kind: "text", role: "student", text: studentMsg }]);
      setLoading(true);
      const codeAtRequest = editorCode;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            utterance: studentMsg,
            sessionState: {
              studentId,
              supportLevel,
              mode,
              currentKC: [],
            },
            editorHasCode: editorCode.length > 20,
            editorCode,
            previousCode:
              previousCodeRef.current !== editorCode ? previousCodeRef.current : undefined,
            editorFocus: editorFocus ?? undefined,
            editorStdin: editorStdin && editorStdin.length > 0 ? editorStdin : undefined,
            lastRunResult: lastRunResult ?? undefined,
            assignmentCode,
            requestedLevel: opts.requestedLevel,
          }),
        });
        const data = (await res.json()) as ChatResponse;
        applyChatResponse(data, codeAtRequest);
        // 성공적 응답 이후에만 previousCode 갱신 — 다음 요청에서 diff 참조.
        previousCodeRef.current = editorCode;
      } catch (err) {
        setHistory((h) => [...h, { kind: "text", role: "ai", text: `요청 실패: ${String(err)}` }]);
      } finally {
        setLoading(false);
        setInput("");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assignmentCode, editorCode, mode, studentId, supportLevel, editorFocus, lastRunResult, editorStdin],
  );

  const applyChatResponse = useCallback((data: ChatResponse, codeAtRequest?: string) => {
    if (data.hint) {
      const blocked = data.safety?.outboundVerdict === "block";
      const pedagogyMode = data.pedagogyMode ?? (data.intent === "general_chat" ? "chat" : "hint");
      // 학생 UI 에는 모델명 노출하지 않음 — 교육에 불필요한 노이즈.
      const hintTypeLabel = humanHintType(data.hint.hintType);
      const meta = blocked
        ? "안전 검사"
        : pedagogyMode === "chat"
          ? data.mocked
            ? "연습 모드"
            : ""
          : data.mocked
            ? `L${data.hint.hintLevel} ${hintTypeLabel} · 연습`
            : `L${data.hint.hintLevel} ${hintTypeLabel}`;
      const cleanedMessage = stripInternalDebug(data.hint.message);
      setHistory((h) => [
        ...h,
        {
          kind: "text",
          role: "ai",
          text: cleanedMessage,
          meta,
          level: data.hint!.hintLevel,
          pedagogyMode,
          requiresSelfExplanation: blocked ? false : data.hint!.requiresSelfExplanation,
          accepted: false,
          blocked,
        },
      ]);
      if (!blocked) {
        setSupportLevel((prev) => Math.max(prev, data.hint!.hintLevel) as 0 | 1 | 2 | 3);
        onMaxHintLevelChange?.(data.hint!.hintLevel);
        // 부록 C ⑥ 정서적 안정 — 힌트 누적 5회 도달 시 1회 격려 토스트.
        // 도움 요청 = 학습 전략이라는 메시지를 학생에게 명시적으로 전달.
        hintAffirmCountRef.current += 1;
        if (
          !hintAffirmFiredRef.current &&
          hintAffirmCountRef.current >= HELP_AFFIRM_THRESHOLD
        ) {
          hintAffirmFiredRef.current = true;
          onHelpAffirm?.();
        }
      }

      // L4 후 복붙 감지를 위해 스냅샷 저장 (차단된 응답은 제외)
      if (!blocked && data.hint.hintLevel >= 3 && codeAtRequest != null) {
        lastAiHintSnapshotRef.current = {
          at: Date.now(),
          level: data.hint.hintLevel,
          aiText: cleanedMessage,
          codeAtResponse: codeAtRequest,
        };
      }
    } else if (data.review) {
      const meta = data.mocked ? `[mock] ${data.review.analysisMode}` : `${data.usedModel} · ${data.review.analysisMode}`;
      setHistory((h) => [...h, { kind: "review", review: data.review!, meta }]);
    } else if (data.error) {
      const detailSummary = data.details
        ? data.details
            .map((d) => `${(d.path ?? []).join(".")}: ${d.message ?? d.code ?? "?"}`)
            .join("; ")
        : "";
      const tag = data.route ?? "server";
      setHistory((h) => [
        ...h,
        {
          kind: "text",
          role: "ai",
          text: `[${tag}] ${data.error}${detailSummary ? `\n  ▸ ${detailSummary}` : ""}`,
        },
      ]);
    }
  }, [onMaxHintLevelChange]);

  // L4(예시 코드) 응답 직후 10초 이내 에디터가 AI 텍스트와 유사하게 바뀌면
  // 자동으로 자기설명 요구 턴 주입.
  useEffect(() => {
    const snap = lastAiHintSnapshotRef.current;
    if (!snap || snap.level < 3) return;
    if (Date.now() - snap.at > 10_000) return;
    if (editorCode === snap.codeAtResponse) return;
    const diff = editorCode.slice(snap.codeAtResponse.length);
    const similarity = textSimilarity(diff, snap.aiText);
    if (similarity >= 0.4) {
      lastAiHintSnapshotRef.current = null;
      setHistory((h) => [
        ...h,
        {
          kind: "text",
          role: "ai",
          text: "방금 내가 준 힌트를 그대로 붙여넣은 것 같네. 1-2문장으로 왜 그 코드가 필요한지, 무엇이 달라지는지 설명해줄래? 자기 언어로 정리되면 더 깊이 남아.",
          meta: "accept-gate",
          level: snap.level,
          requiresSelfExplanation: true,
          accepted: false,
          pedagogyMode: "chat",
        },
      ]);
    }
  }, [editorCode]);

  const submitTurnFeedback = useCallback(
    async (index: number, value: "up" | "down" | "confused") => {
      setHistory((h) =>
        h.map((entry, i) =>
          i === index && entry.kind === "text" && entry.role === "ai"
            ? { ...entry, feedback: value }
            : entry,
        ),
      );
      try {
        await fetch("/api/events/record", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            verb: "https://cvibe.app/verbs/hint-feedback",
            object: { type: "assignment", id: assignmentCode ?? "ungoverned" },
            result: { value, turnIndex: index },
          }),
        });
      } catch {
        // ignore — UI 피드백은 이미 적용됨
      }
      // 🤔 "무슨 말인지 모르겠어" → 자동 재시도 (다른 표현으로)
      if (value === "confused") {
        await callChat("지금 말이 좀 헷갈려. 다른 표현으로 다시 설명해줄래?");
      }
    },
    [assignmentCode, callChat],
  );

  const requestReview = useCallback(async () => {
    if (editorCode.trim().length === 0) {
      setHistory((h) => [
        ...h,
        {
          kind: "text",
          role: "ai",
          text: "에디터에 코드를 먼저 작성해봐 — Navigator, not Driver 원칙이야.",
        },
      ]);
      return;
    }
    await callChat("이 코드 검토해줘");
  }, [callChat, editorCode]);

  const submitSelfExplanation = useCallback(async () => {
    if (selfExplainTarget === null) return;
    const text = selfExplainText.trim();
    if (text.length < 10) return;
    await fetch("/api/self-explanation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, text, level: 4 }),
    });
    setHistory((h) =>
      h.map((entry, i) =>
        i === selfExplainTarget && entry.kind === "text"
          ? { ...entry, accepted: true }
          : entry,
      ),
    );
    setSelfExplainTarget(null);
    setSelfExplainText("");
  }, [selfExplainTarget, selfExplainText, studentId]);

  if (examMode) {
    return (
      <aside
        aria-label="ai-panel"
        className="flex h-full flex-col items-center justify-center overflow-hidden bg-bg p-6 text-center"
      >
        <div className="rounded-xl border border-error/30 bg-surface px-6 py-5 shadow-sm">
          <div className="text-4xl">🔒</div>
          <div className="mt-2 font-display text-xl font-semibold tracking-tighter text-text-primary">
            Exam 모드
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
            AI 튜터는 시험이 끝날 때까지 응답하지 않아요.
            <br />
            스스로 풀어내는 시간이에요.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside aria-label="ai-panel" className="flex h-full flex-col overflow-hidden bg-surface">
      <div className="flex border-b border-border-soft">
        {(["chat", "review"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 border-b-2 px-3 py-3 text-[11px] font-medium uppercase tracking-wider transition-colors ${
              tab === t
                ? "border-primary text-text-primary"
                : "border-transparent text-neutral hover:text-text-secondary"
            }`}
          >
            {tabLabel(t)}
          </button>
        ))}
      </div>

      <div
        ref={chatScrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          // 맨 아래 근처(60px 이내)에 있을 때만 'stick' 유지. 위로 스크롤 중이면 억제.
          stuckToBottomRef.current =
            el.scrollTop + el.clientHeight >= el.scrollHeight - 60;
        }}
        className="flex-1 overflow-auto px-5 py-4 text-[13px]"
      >
        {history.length === 0 && (
          <p className="leading-relaxed text-text-secondary">
            과제를 고르면 같이 시작해볼까. 힌트는 코드를 조금 써본 뒤에 요청할 수 있어.
            <br />
            <span className="text-neutral">Navigator, not Driver.</span>
          </p>
        )}
        {history.map((msg, i) =>
          msg.kind === "text" ? (
            msg.role === "system" ? (
              <div
                key={i}
                className="mb-4 rounded-md border border-dashed border-border-soft bg-bg px-3 py-2 text-[11px] text-text-secondary"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-neutral">
                    System
                  </span>
                  {msg.meta && (
                    <span className="font-mono text-[10px] text-neutral">· {msg.meta}</span>
                  )}
                </div>
                <div className="mt-1 whitespace-pre-wrap">{msg.text}</div>
              </div>
            ) : (
            <div
              key={i}
              className={`mb-4 flex gap-2 ${msg.role === "student" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "ai" && (
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                  AI
                </div>
              )}
              <div className={`max-w-[82%] ${msg.role === "student" ? "items-end" : "items-start"} flex flex-col`}>
                <div
                  className={`mb-1 flex items-baseline gap-2 text-[11px] ${
                    msg.role === "student" ? "flex-row-reverse text-neutral" : "text-neutral"
                  }`}
                >
                  <span className={msg.role === "student" ? "text-text-primary" : "text-primary"}>
                    {msg.role === "student" ? "나" : "AI 튜터"}
                  </span>
                  {msg.meta && <span className="text-neutral">· {msg.meta}</span>}
                </div>
                <div
                  className={`whitespace-pre-wrap rounded-xl px-3.5 py-2.5 leading-relaxed ${
                    msg.role === "student"
                      ? "rounded-br-sm bg-primary text-white"
                      : "rounded-bl-sm border border-border-soft bg-bg text-text-primary"
                  }`}
                >
                  {msg.text}
                </div>
                {msg.role === "ai" &&
                  !msg.blocked &&
                  msg.requiresSelfExplanation &&
                  !msg.accepted && (
                    <button
                      onClick={() => {
                        setSelfExplainTarget(i);
                        setSelfExplainText("");
                      }}
                      className="mt-2 self-start rounded-md border border-error/30 bg-error/5 px-3 py-1.5 text-[11px] font-medium text-error transition-colors hover:bg-error/10"
                    >
                      💭 이 예시를 반영하려면 → 자기 설명 필요
                    </button>
                  )}
                {msg.role === "ai" && msg.accepted && (
                  <div className="mt-1 text-[11px] text-success">✓ 자기 설명 제출됨 · 수락됨</div>
                )}
                {msg.role === "ai" && msg.blocked && (
                  <div className="mt-1 text-[10px] text-neutral">
                    🛡 안전 검사로 응답이 수정됐어요. 한 단계 낮은 힌트를 요청해보세요.
                  </div>
                )}
                {msg.role === "ai" && !msg.blocked && !msg.feedback && (
                  <div className="mt-1.5 flex items-center gap-1">
                    <FeedbackButton
                      label="👍 도움됐어"
                      title="이 응답이 도움됐어"
                      onClick={() => void submitTurnFeedback(i, "up")}
                    />
                    <FeedbackButton
                      label="🤔 헷갈려"
                      title="다른 표현으로 다시 설명 요청"
                      onClick={() => void submitTurnFeedback(i, "confused")}
                    />
                    <FeedbackButton
                      label="👎"
                      title="너무 떠먹여줬거나 너무 막연했어"
                      onClick={() => void submitTurnFeedback(i, "down")}
                    />
                  </div>
                )}
                {msg.role === "ai" && msg.feedback && (
                  <div className="mt-1 text-[10px] text-neutral">
                    피드백 기록됨 ·{" "}
                    {msg.feedback === "up"
                      ? "👍 도움됨"
                      : msg.feedback === "confused"
                        ? "🤔 재설명 요청"
                        : "👎 개선 필요"}
                  </div>
                )}
              </div>
              {msg.role === "student" && (
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-text-primary text-[11px] font-semibold text-white">
                  나
                </div>
              )}
            </div>
            )
          ) : (
            <ReviewCard key={i} review={msg.review} meta={msg.meta} />
          ),
        )}
        {loading && <div className="text-[12px] text-neutral">생각 중…</div>}
      </div>

      {tab === "review" && (
        <div className="border-t border-border-soft bg-bg px-4 py-3">
          <button
            onClick={() => void requestReview()}
            disabled={loading}
            className="w-full rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-white transition-all hover:-translate-y-px hover:bg-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            현재 코드 검토 요청
          </button>
        </div>
      )}

      {showWalkthrough && assignmentTitle && (
        <div className="border-t border-border-soft bg-surface px-4 py-3">
          <WalkthroughPrompt
            kcTags={assignmentKcTags ?? []}
            assignmentTitle={assignmentTitle}
            stagnationMinutes={Math.floor(elapsedSec / 60)}
            onDismiss={() => setWalkthroughDismissed(true)}
          />
        </div>
      )}

      <div className="border-t border-border-soft bg-surface px-4 py-3 space-y-2">
        <StuckDiagnostic
          onApply={(_cat, prefix) => {
            setInput((v) => (v.startsWith("[") ? v : prefix + v));
          }}
        />
        {/* 단축 버튼 — 의도를 말로 안 해도 되게 */}
        <div className="flex flex-wrap gap-1.5">
          <Shortcut
            label="📈 한 단계 더"
            title="다음 단계 힌트 요청 (supportLevel +1)"
            disabled={loading || supportLevel >= 3}
            onClick={() => {
              const next = Math.min(supportLevel + 1, 4) as 1 | 2 | 3 | 4;
              void callChat("한 단계 더 힌트 줄래?", { requestedLevel: next });
            }}
          />
          <Shortcut
            label="🔁 다른 각도로"
            title="같은 레벨에서 다른 방향의 힌트 요청"
            disabled={loading || supportLevel === 0}
            onClick={() => {
              const same = Math.max(1, supportLevel) as 1 | 2 | 3 | 4;
              void callChat("같은 레벨에서 다른 관점으로 다시 설명해줄래?", {
                requestedLevel: same,
              });
            }}
          />
          <Shortcut
            label="🤔 아직 헷갈려"
            title="같은 주제 재질문 (다른 표현으로)"
            disabled={loading}
            onClick={() => void callChat("아직 헷갈려. 조금 더 쉬운 예시로 말해줄래?")}
          />
          <Shortcut
            label="✅ 이해했어, 다음"
            title="스스로 더 풀어볼게 (supportLevel 자발 감소)"
            disabled={loading}
            onClick={() => {
              setSupportLevel((prev) => Math.max(0, prev - 1) as 0 | 1 | 2 | 3);
              void callChat(
                "이해했어. 잠깐 내가 더 해볼게. 막히면 다시 부를게.",
              );
            }}
          />
        </div>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void callChat(input);
              }
            }}
            placeholder={MODE_PLACEHOLDER[mode]}
            className="flex-1 rounded-md border border-border-soft bg-white px-3 py-1.5 text-[13px] text-text-primary placeholder:text-neutral focus:border-primary focus:outline-none focus:shadow-ring"
            disabled={loading}
          />
          <button
            onClick={() => void callChat(input)}
            disabled={loading || !input.trim()}
            className="rounded-md bg-primary px-3 text-[12px] font-medium text-white transition-all hover:-translate-y-px hover:bg-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            보내기
          </button>
        </div>
      </div>

      {selfExplainTarget !== null && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-text-primary/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-border-soft bg-surface p-6 shadow-card">
            <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
              Meta-cognition
            </div>
            <h3 className="mt-0.5 font-display text-xl font-semibold tracking-tighter text-text-primary">
              자기 설명 — 왜 이 수정이 필요한가?
            </h3>
            <p className="mt-2 text-[12px] leading-relaxed text-text-secondary">
              AI 제안을 수락하기 전 1~2문장으로 이유를 적어주세요. 메타인지 훈련의 핵심이에요.
            </p>
            <textarea
              autoFocus
              value={selfExplainText}
              onChange={(e) => setSelfExplainText(e.target.value)}
              className="mt-3 w-full rounded-md border border-border-soft bg-white p-3 text-[13px] text-text-primary focus:border-primary focus:outline-none focus:shadow-ring"
              rows={4}
              placeholder="예: 현재 내 코드는 ‥인데 AI의 제안이 ‥를 고쳐서 ‥가 맞아진다고 이해했다"
            />
            <div className="mt-1 text-[11px] text-neutral">
              {selfExplainText.trim().length}자 · 최소 10자
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setSelfExplainTarget(null);
                  setSelfExplainText("");
                }}
                className="rounded-md border border-border-soft px-3 py-1.5 text-[12px] text-text-primary transition-colors hover:border-primary hover:text-primary"
              >
                취소
              </button>
              <button
                onClick={() => void submitSelfExplanation()}
                disabled={selfExplainText.trim().length < 10}
                className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-white transition-all hover:-translate-y-px hover:bg-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                제출하고 수락
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function Shortcut({
  label,
  title,
  onClick,
  disabled,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="rounded-full border border-border-soft bg-white px-2.5 py-1 text-[11px] font-medium text-text-secondary transition-all hover:-translate-y-px hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
    >
      {label}
    </button>
  );
}

function FeedbackButton({
  label,
  title,
  onClick,
}: {
  label: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded-md border border-border-soft bg-white px-2 py-0.5 text-[10px] text-text-secondary transition-colors hover:border-primary hover:text-primary"
    >
      {label}
    </button>
  );
}

function ReviewCard({ review, meta }: { review: ReviewPayload; meta?: string }) {
  const top = review.findings.filter((f) => review.topIssues.includes(f.id));
  const rest = review.findings.filter((f) => !review.topIssues.includes(f.id));
  return (
    <div className="mb-4 rounded-xl border border-border-soft bg-bg p-4 transition-shadow hover:shadow-card">
      <div className="flex items-baseline gap-2 text-[10px] uppercase tracking-wider text-neutral">
        <span className="text-primary">Code Reviewer</span>
        {meta && <span className="font-mono">· {meta}</span>}
      </div>
      <div className="mt-1 text-[13px] text-text-primary">{review.summary}</div>
      {top.length === 0 && rest.length === 0 && (
        <div className="mt-2 text-[12px] text-neutral">눈에 띄는 이슈 없음.</div>
      )}
      {top.map((f) => (
        <FindingItem key={f.id} finding={f} highlight />
      ))}
      {rest.length > 0 && (
        <details className="mt-2 text-[12px]">
          <summary className="cursor-pointer text-neutral hover:text-text-secondary">
            추가 이슈 {rest.length}건
          </summary>
          {rest.map((f) => (
            <FindingItem key={f.id} finding={f} />
          ))}
        </details>
      )}
    </div>
  );
}

function FindingItem({ finding, highlight }: { finding: Finding; highlight?: boolean }) {
  const color =
    finding.severity === "blocker"
      ? "text-error"
      : finding.severity === "major"
        ? "text-warning"
        : "text-text-secondary";
  return (
    <div
      className={`mt-2 rounded-md ${highlight ? "border border-error/20 bg-error/5 p-3" : "px-1 py-1"}`}
    >
      <div className={`text-[10px] font-medium uppercase tracking-wider ${color}`}>
        [{finding.severity}] line {finding.line} · {finding.category} · {finding.kc}
      </div>
      <div className="mt-1 text-[12px] text-text-primary">{finding.message}</div>
      <div className="mt-1 text-[12px] italic text-text-secondary">{finding.suggestion}</div>
      {/* proposedCode 는 렌더하지 않음 — Navigator-not-Driver 원칙: 정답 코드 노출 금지. */}
    </div>
  );
}

function tabLabel(t: Tab): string {
  switch (t) {
    case "chat":
      return "대화";
    case "review":
      return "코드리뷰";
  }
}

interface ServerTurn {
  id: string;
  studentId: string;
  role: "student" | "ai";
  text: string;
  timestamp: string;
  assignmentId?: string;
  meta?: {
    hintLevel?: 1 | 2 | 3 | 4;
    hintType?: string;
    mode?: string;
    usedModel?: string;
    blockedBySafety?: boolean;
    kind?: string;
  };
}

function toHistoryEntry(turn: ServerTurn): HistoryEntry {
  const meta =
    turn.meta?.hintLevel && turn.meta?.hintType
      ? `L${turn.meta.hintLevel} ${humanHintType(turn.meta.hintType)}`
      : turn.meta?.kind === "code-review"
        ? "코드 리뷰"
        : undefined;
  return {
    kind: "text",
    role: turn.role,
    text: turn.text,
    meta,
    level: turn.meta?.hintLevel,
  };
}
