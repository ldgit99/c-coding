import { NextResponse } from "next/server";

import {
  classify,
  requestHint,
  reviewCode,
  SessionStateSchema,
  type Hint,
  type Intent,
  type ReviewOutput,
  type SessionState,
} from "@cvibe/agents";
import { lintC } from "@cvibe/wasm-runtime";

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

  if (route.route === "pedagogy-coach") {
    const { hint, gating, usedModel, mocked } = await requestHint({
      utterance: body.utterance,
      sessionState,
      requestedLevel: body.requestedLevel,
      restatedProblem: detectRestatement(body.utterance),
      namedStuckPoint: detectStuckPoint(body.utterance),
    });
    return NextResponse.json({
      intent: route.intent satisfies Intent,
      route: route.route,
      reason: route.reason,
      hint: hint satisfies Hint,
      gating,
      usedModel,
      mocked,
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
