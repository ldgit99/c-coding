import { NextResponse } from "next/server";

import { evaluateSelfExplanation } from "@cvibe/agents";
import { buildStatement, recordEvent, Verbs } from "@cvibe/xapi";

/**
 * POST /api/self-explanation — 학생이 AI 제안 수락 전 제출하는 자기 설명.
 *
 * research.md §3.1 / socratic-hinting 스킬의 Accept Gate 핵심 메커니즘.
 * 품질 평가는 `evaluateSelfExplanation` 런타임(Haiku + mock fallback)에 위임.
 * 응답에 axes·strengths·improvements도 포함해 UI가 학생에게 피드백 렌더 가능.
 */

interface SelfExplanationBody {
  studentId: string;
  text: string;
  level: 1 | 2 | 3 | 4;
  suggestionId?: string;
  kc?: string[];
  codeExcerpt?: string;
}

export async function POST(request: Request) {
  let body: SelfExplanationBody;
  try {
    body = (await request.json()) as SelfExplanationBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (text.length < 10) {
    return NextResponse.json({ error: "자기 설명은 최소 10자 이상이어야 한다." }, { status: 400 });
  }

  const { evaluation, usedModel, mocked } = await evaluateSelfExplanation({
    text,
    studentId: body.studentId,
    context: {
      hintLevel: body.level,
      kc: body.kc,
      codeExcerpt: body.codeExcerpt,
    },
  });

  const seCtx = { studentId: body.studentId };
  recordEvent(
    buildStatement({
      actor: { type: "student", id: body.studentId },
      verb: Verbs.selfExplanationSubmitted,
      object: { type: "code", submissionId: body.suggestionId ?? "adhoc" },
      result: {
        quality: evaluation.quality,
        wordCount: text.split(/\s+/).length,
        level: body.level,
        axes: evaluation.axes,
      },
    }),
    seCtx,
  );

  // 수락 이벤트 — Pedagogy Coach의 Accept Gate 요건 충족
  recordEvent(
    buildStatement({
      actor: { type: "student", id: body.studentId },
      verb: Verbs.aiSuggestionAccepted,
      object: { type: "code", submissionId: body.suggestionId ?? "adhoc" },
      result: { hadRationale: true, rationaleQuality: evaluation.quality },
    }),
    seCtx,
  );

  return NextResponse.json({
    accepted: true,
    quality: evaluation.quality,
    axes: evaluation.axes,
    strengths: evaluation.strengths,
    improvements: evaluation.improvements,
    usedModel,
    mocked,
  });
}
