import { NextResponse } from "next/server";

import {
  checkSafety,
  classify,
  requestHint,
  reviewCode,
  SessionStateSchema,
  type Hint,
  type Intent,
  type ReviewOutput,
  type SessionState,
} from "@cvibe/agents";
import { getAssignmentByCode } from "@cvibe/db";
import { checkRateLimit } from "@cvibe/shared-ui";
import { lintC } from "@cvibe/wasm-runtime";
import { buildStatement, recordEvent, recordTurn, Verbs } from "@cvibe/xapi";

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

  // SessionState 기본값 병합 후 검증
  const parsed = SessionStateSchema.safeParse({
    studentId: body.sessionState.studentId,
    assignmentId: body.sessionState.assignmentId,
    currentKC: body.sessionState.currentKC ?? [],
    mastery: body.sessionState.mastery ?? {},
    learningSignals: body.sessionState.learningSignals,
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

  const route = classify({
    actor: "student",
    utterance: body.utterance,
    sessionState,
    editorHasCode: body.editorHasCode,
  });

  // 대화 로그 — 학생 발화 원문 기록 (교사 전용 열람)
  recordTurn({
    studentId: sessionState.studentId,
    role: "student",
    text: body.utterance,
    assignmentId: body.assignmentCode ?? sessionState.assignmentId,
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
    // 현재 과제의 템플릿·KC 조회 — 힌트 context 강화
    const catalog = body.assignmentCode ? getAssignmentByCode(body.assignmentCode) : undefined;

    let hintResult;
    try {
      hintResult = await requestHint({
        utterance: safeUtterance,
        sessionState,
        requestedLevel: body.requestedLevel,
        restatedProblem: detectRestatement(safeUtterance),
        namedStuckPoint: detectStuckPoint(safeUtterance),
        editorCode: body.editorCode,
        assignmentTemplate: catalog?.template,
        assignmentKC: catalog?.kcTags,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Anthropic 호출 실패 (rate limit · invalid key · credit 소진 등) 시
      // 빈 500 대신 JSON으로 상세 반환해 클라이언트에서 확인 가능.
      return NextResponse.json(
        {
          route: "pedagogy-coach",
          error: "Pedagogy Coach 호출 실패",
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
    const finalHint: Hint =
      outbound.verdict === "block"
        ? { ...hint, message: "잠시 후 다시 시도해줘 — 응답이 안전 검사에서 막혔어." }
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
    recordTurn({
      studentId: sessionState.studentId,
      role: "ai",
      text: finalHint.message,
      assignmentId: body.assignmentCode ?? sessionState.assignmentId,
      meta: {
        hintLevel: finalHint.hintLevel,
        hintType: finalHint.hintType,
        mode: sessionState.mode,
        usedModel,
        blockedBySafety: outbound.verdict === "block",
      },
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
    recordTurn({
      studentId: sessionState.studentId,
      role: "ai",
      text: `[Code Review] ${review.summary}\n${review.findings
        .map((f) => `• [${f.severity}] L${f.line} ${f.message}`)
        .join("\n")}`,
      assignmentId: body.assignmentCode ?? sessionState.assignmentId,
      meta: { mode: sessionState.mode, usedModel },
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

/** 단순 휴리스틱 — 학생 발화에 문제 재진술 신호가 있는가. */
function detectRestatement(utterance: string): boolean {
  const patterns = [/입력은/, /출력은/, /목표는/, /해야\s*할\s*일/, /요구되는/];
  return patterns.some((p) => p.test(utterance));
}

/** 단순 휴리스틱 — 구체적 막힌 지점 지목. */
function detectStuckPoint(utterance: string): boolean {
  const patterns = [/\d+\s*번\s*줄/, /line\s*\d+/i, /루프에서/, /변수\s*\w+에서/, /이 부분/];
  return patterns.some((p) => p.test(utterance));
}
