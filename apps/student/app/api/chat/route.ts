import { NextResponse } from "next/server";

import {
  checkSafety,
  classifyLLM,
  requestHint,
  reviewCode,
  SessionStateSchema,
  type Hint,
  type Intent,
  type ReviewOutput,
  type SessionState,
} from "@cvibe/agents";
import {
  createServiceRoleClientIfAvailable,
  getAssignmentByCode,
  insertConversationTurn,
} from "@cvibe/db";
import { checkRateLimit } from "@cvibe/shared-ui";
import { lintC } from "@cvibe/wasm-runtime";
import { buildStatement, recordEvent, recordTurn, Verbs } from "@cvibe/xapi";

import { computeServerSideSignals } from "@/lib/learning-signals-server";
import { loadReferenceSolution } from "@/lib/seed-private";

// /api/chat 기본 제한: 학생당 분당 20건. Anthropic 비용 폭발 방지.
const CHAT_RATE = { name: "chat", capacity: 20, refillPerSec: 20 / 60 };

/**
 * POST /api/chat — 학생 발화를 받아 Supervisor 분류 + 해당 에이전트 응답.
 *
 * MVP (Week 4~5): hint_request만 Pedagogy Coach로 실제 라우팅.
 * 그 외 intent는 400 Not Implemented 반환 + 각 에이전트 Week 목표 안내.
 *
 * 서버 경로에서만 ANTHROPIC_API_KEY 사용 — 학생 브라우저 노출 차단.
 */

interface ChatRequestBody {
  utterance: string;
  sessionState: Partial<SessionState> & { studentId: string };
  editorHasCode: boolean;
  editorCode?: string;
  /** 커밋 직전 에디터 스냅샷 — diff 인지용. 5분 이상 이전이면 무시. */
  previousCode?: string;
  /** Monaco 커서 · 선택 영역. */
  editorFocus?: {
    line: number;
    column?: number;
    selectionText?: string;
  };
  /** 학생이 에디터 하단 입력란에 넣은 stdin 값 (실행 시 프로그램에 전달됨). */
  editorStdin?: string;
  /** 최신 run 결과 — 서버가 xAPI 에서 뽑는 것보다 정확. */
  lastRunResult?: {
    status: "ok" | "compile_error" | "runtime_error" | "timeout" | "signal";
    stdout?: string;
    stderr?: string;
    exitCode?: number | null;
    at?: string;
  };
  /** 현재 과제의 code(예: "A03_arrays_basic"). Safety Guard reference_solution 로드에 사용. */
  assignmentCode?: string;
  requestedLevel?: 1 | 2 | 3 | 4;
}

export async function POST(request: Request) {
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (typeof body.utterance !== "string" || body.utterance.trim().length === 0) {
    return NextResponse.json({ error: "utterance는 필수다" }, { status: 400 });
  }

  // Rate limit — 학생 ID 기준 (IP fallback)
  const rateKey =
    body.sessionState.studentId ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "anonymous";
  const rl = checkRateLimit(CHAT_RATE, rateKey);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "요청이 너무 잦아요. 잠시 후 다시 시도해주세요.",
        retryAfterMs: rl.retryAfterMs,
      },
      {
        status: 429,
        headers: { "Retry-After": Math.ceil(rl.retryAfterMs / 1000).toString() },
      },
    );
  }

  // 서버가 신뢰 소스: assignment catalog 에서 kcTags 가져와 currentKC 강제.
  const catalog = body.assignmentCode ? getAssignmentByCode(body.assignmentCode) : undefined;
  const enforcedKC = catalog?.kcTags ?? body.sessionState.currentKC ?? [];

  // 서버에서 실 learning signals 계산 (submissions + xAPI 이벤트 + 최근 발화)
  const supabaseForWrites = createServiceRoleClientIfAvailable();
  const {
    signals,
    priorTurns,
    recentError,
    learnerProfile,
    hintTurnsSinceLastExplanation,
  } = await computeServerSideSignals({
    supabase: supabaseForWrites,
    studentId: body.sessionState.studentId,
    assignmentCode: body.assignmentCode,
    editorCodeLength: body.editorCode?.length ?? 0,
  });

  // SessionState 기본값 병합 후 검증 — 클라이언트가 보낸 가짜 signals 는 무시
  const parsed = SessionStateSchema.safeParse({
    studentId: body.sessionState.studentId,
    assignmentId: body.sessionState.assignmentId,
    currentKC: enforcedKC,
    mastery: body.sessionState.mastery ?? {},
    learningSignals: signals,
    dependency: body.sessionState.dependency,
    conversation: body.sessionState.conversation ?? [],
    editorSnapshot: body.sessionState.editorSnapshot,
    interventionFlags: body.sessionState.interventionFlags ?? [],
    supportLevel: body.sessionState.supportLevel ?? 0,
    selfExplanationRequired: body.sessionState.selfExplanationRequired ?? false,
    teacherInterventionLevel: body.sessionState.teacherInterventionLevel,
    mode: body.sessionState.mode ?? "pair",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid sessionState", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const sessionState = parsed.data;

  // Haiku 기반 LLM 분류 — 실패 시 regex fallback.
  const route = await classifyLLM({
    actor: "student",
    utterance: body.utterance,
    sessionState,
    editorHasCode: body.editorHasCode,
  });

  // 대화 로그 — 학생 발화 원문 기록 (교사 전용 열람)
  // supabaseForWrites 는 이미 상단에서 생성됨 (learning-signals 계산에 재사용)
  const conversationAssignmentId =
    body.assignmentCode ?? sessionState.assignmentId;
  recordTurn({
    studentId: sessionState.studentId,
    role: "student",
    text: body.utterance,
    assignmentId: conversationAssignmentId,
    meta: { mode: sessionState.mode },
  });
  void insertConversationTurn(supabaseForWrites, {
    studentId: sessionState.studentId,
    assignmentId: conversationAssignmentId,
    role: "student",
    text: body.utterance,
    meta: { mode: sessionState.mode },
  });

  // inbound Safety Guard — 학생 발화에 PII·프롬프트 인젝션 사전 처리
  const inbound = checkSafety({
    direction: "inbound",
    agent: "supervisor",
    payload: body.utterance,
    mode: sessionState.mode,
  });
  const safeUtterance = inbound.sanitizedPayload || body.utterance;

  // 현재 과제의 reference_solution 로드 (outbound 유사도 검사에 사용).
  // seed-private 파일 없거나 assignmentCode 미제공 시 undefined → 유사도 검사 스킵.
  const referenceSolution = body.assignmentCode
    ? (await loadReferenceSolution(body.assignmentCode)) ?? undefined
    : undefined;

  if (route.route === "pedagogy-coach") {
    // catalog 는 이미 상단에서 조회됨 — 재사용
    // 에디터 코드에 lintC 실행해 findings 주입
    const lintFindings = body.editorCode && body.editorCode.trim().length > 0
      ? await safeLint(body.editorCode)
      : [];

    const pedagogyMode =
      route.intent === "hint_request" || body.requestedLevel != null ? "hint" : "chat";

    let hintResult;
    try {
      hintResult = await requestHint({
        utterance: safeUtterance,
        sessionState,
        requestedLevel: body.requestedLevel,
        restatedProblem: detectRestatement(safeUtterance),
        namedStuckPoint: detectStuckPoint(safeUtterance),
        editorCode: body.editorCode,
        previousCode: body.previousCode,
        editorFocus: body.editorFocus,
        lastStdin: body.editorStdin,
        assignmentTemplate: catalog?.template,
        assignmentKC: catalog?.kcTags,
        assignmentDifficulty: catalog?.difficulty,
        assignmentTitle: catalog?.title,
        visibleTests: catalog?.visibleTests,
        lintFindings,
        recentError,
        lastRunResult: body.lastRunResult,
        learnerProfile,
        priorTurns,
        pedagogyMode,
        requestMidExplanation: hintTurnsSinceLastExplanation >= 3,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Anthropic 호출 실패 (rate limit · invalid key · credit 소진 등) 시
      // 빈 500 대신 JSON으로 상세 반환해 클라이언트에서 확인 가능.
      return NextResponse.json(
        {
          route: "pedagogy-coach",
          error: "AI 튜터 호출 실패",
          details: [{ path: ["anthropic"], message, code: "upstream_llm_error" }],
        },
        { status: 502 },
      );
    }
    const { hint, gating, usedModel, mocked } = hintResult;
    // outbound Safety Guard — AI 응답에 정답 유출·코드 블록 과다·욕설 검사
    const outbound = checkSafety({
      direction: "outbound",
      agent: "pedagogy-coach",
      payload: hint.message,
      referenceSolution,
      mode: sessionState.mode,
    });
    // 차단된 응답은 L1 수준으로 강등해 Accept Gate / 자기설명 요구를 끈다.
    const blockedMessage =
      "이 응답이 정답과 너무 비슷해서 막혔어. 한 단계 낮은 힌트를 요청하거나, 질문을 조금 다르게 다시 해볼래?";
    const finalHint: Hint =
      outbound.verdict === "block"
        ? {
            ...hint,
            message: blockedMessage,
            hintLevel: 1,
            hintType: "question",
            requiresSelfExplanation: false,
            relatedKC: hint.relatedKC,
          }
        : { ...hint, message: outbound.sanitizedPayload };

    // xAPI: requested-hint + received-hint
    recordEvent(
      buildStatement({
        actor: { type: "student", id: sessionState.studentId },
        verb: Verbs.requestedHint,
        object:
          (finalHint.relatedKC?.[0])
            ? { type: "kc", slug: finalHint.relatedKC[0] }
            : { type: "assignment", id: sessionState.assignmentId ?? "ungoverned" },
        result: {
          hintLevel: finalHint.hintLevel,
          attemptNo: sessionState.learningSignals?.attemptCount ?? 0,
          mode: sessionState.mode,
        },
        context: { assignmentId: sessionState.assignmentId, sessionId: sessionState.studentId },
      }),
    );
    // 대화 로그 — AI 응답 원문 기록 (safety block 여부도 함께)
    const aiTurnMeta = {
      hintLevel: finalHint.hintLevel,
      hintType: finalHint.hintType,
      mode: sessionState.mode,
      usedModel,
      blockedBySafety: outbound.verdict === "block",
    };
    recordTurn({
      studentId: sessionState.studentId,
      role: "ai",
      text: finalHint.message,
      assignmentId: conversationAssignmentId,
      meta: aiTurnMeta,
    });
    void insertConversationTurn(supabaseForWrites, {
      studentId: sessionState.studentId,
      assignmentId: conversationAssignmentId,
      role: "ai",
      text: finalHint.message,
      meta: aiTurnMeta,
    });

    if (outbound.verdict === "block") {
      recordEvent(
        buildStatement({
          actor: { type: "agent", id: "safety-guard" },
          verb: Verbs.blockedBySafety,
          object: { type: "assignment", id: sessionState.assignmentId ?? "ungoverned" },
          result: { reason: outbound.reasons.join(";") },
        }),
      );
    } else {
      recordEvent(
        buildStatement({
          actor: { type: "student", id: sessionState.studentId },
          verb: Verbs.receivedHint,
          object:
            (finalHint.relatedKC?.[0])
              ? { type: "kc", slug: finalHint.relatedKC[0] }
              : { type: "assignment", id: sessionState.assignmentId ?? "ungoverned" },
          result: { hintLevel: finalHint.hintLevel, hintType: finalHint.hintType },
        }),
      );
    }

    return NextResponse.json({
      intent: route.intent satisfies Intent,
      route: route.route,
      reason: route.reason,
      hint: finalHint,
      gating,
      usedModel,
      mocked,
      pedagogyMode,
      safety: {
        inboundReasons: inbound.reasons,
        outboundVerdict: outbound.verdict,
        outboundReasons: outbound.reasons,
      },
    });
  }

  if (route.route === "code-reviewer") {
    if (!body.editorCode || body.editorCode.trim().length === 0) {
      return NextResponse.json(
        { intent: route.intent, route: route.route, reason: "에디터에 코드가 없다" },
        { status: 400 },
      );
    }
    const lintResult = await lintC(body.editorCode);
    const { review, usedModel, mocked } = await reviewCode({
      code: body.editorCode,
      studentLevel: "novice",
      lintResult,
    });
    const reviewText = `[Code Review] ${review.summary}\n${review.findings
      .map((f) => `• [${f.severity}] L${f.line} ${f.message}`)
      .join("\n")}`;
    const reviewAssignmentId = body.assignmentCode ?? sessionState.assignmentId;
    recordTurn({
      studentId: sessionState.studentId,
      role: "ai",
      text: reviewText,
      assignmentId: reviewAssignmentId,
      meta: { mode: sessionState.mode, usedModel },
    });
    void insertConversationTurn(supabaseForWrites, {
      studentId: sessionState.studentId,
      assignmentId: reviewAssignmentId,
      role: "ai",
      text: reviewText,
      meta: { mode: sessionState.mode, usedModel, kind: "code-review" },
    });
    return NextResponse.json({
      intent: route.intent satisfies Intent,
      route: route.route,
      reason: route.reason,
      review: review satisfies ReviewOutput,
      usedModel,
      mocked,
    });
  }

  // 미구현 라우트 — 해당 에이전트 착수 주차를 반환
  const weekByRoute: Record<string, string> = {
    "runtime-debugger": "Week 6 (별도 /api/debug 엔드포인트 사용)",
    assessment: "Week 7",
    "problem-architect": "Week 8",
    "teacher-copilot": "Week 9",
    "safety-guard": "Week 10",
  };
  return NextResponse.json(
    {
      intent: route.intent,
      route: route.route,
      reason: route.reason,
      error: `${route.route}는 아직 구현되지 않았다 (${weekByRoute[route.route] ?? "TBD"} 마일스톤).`,
    },
    { status: 501 },
  );
}

/** 문제 재진술 감지 — 입력·출력 언급이나 문제 요약 형태. */
function detectRestatement(utterance: string): boolean {
  const patterns = [
    /입력은/,
    /출력은/,
    /목표는/,
    /해야\s*할\s*일/,
    /요구되는/,
    /문제(는|가)/,
    /(주어진|n개의)\s*(배열|정수|값)/,
    /평균|합계|최대|최소|정렬/,
  ];
  return patterns.some((p) => p.test(utterance));
}

/** 구체적 막힌 지점 지목 — 변수명·라인 번호·함수명·에러 타입. */
function detectStuckPoint(utterance: string): boolean {
  const patterns = [
    /\d+\s*번\s*줄/,
    /line\s*\d+/i,
    /루프에서/,
    /변수\s*\w+/,
    /함수\s*\w+/,
    /이\s*(부분|줄|라인|함수|변수)/,
    /(세그폴트|segfault|segmentation)/i,
    /(null|undefined)\s*(참조|에러)?/i,
    /(out of bounds|경계)/i,
    /(컴파일|런타임)\s*(에러|오류)/,
    /어떻게\s*(접근|수정|고쳐)/,
  ];
  return patterns.some((p) => p.test(utterance));
}

/** lintC 결과를 LintFinding[] 으로 좁혀서 반환. 실패 시 빈 배열. */
async function safeLint(
  code: string,
): Promise<Array<{ line?: number; severity: "error" | "warning" | "info"; message: string }>> {
  try {
    const result = await lintC(code);
    const warnings = (result.warnings ?? []).slice(0, 10);
    return warnings.map((w) => ({
      line: w.line,
      severity:
        w.severity === "error" ? "error" : w.severity === "warning" ? "warning" : "info",
      message: w.message,
    }));
  } catch {
    return [];
  }
}
