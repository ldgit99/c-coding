import { NextResponse } from "next/server";

import { buildStatement, recordEvent, Verbs } from "@cvibe/xapi";

/**
 * POST /api/self-explanation — 학생이 AI 제안 수락 전 제출하는 자기 설명.
 *
 * research.md §3.1 / socratic-hinting 스킬의 Accept Gate 핵심 메커니즘.
 * 품질 평가는 간단한 길이 기반 휴리스틱(10+ 문자, 공백 포함). 미래에는
 * LLM 평가로 구체성·논리 연결성 점수화.
 */

interface SelfExplanationBody {
  studentId: string;
  text: string;
  level: 1 | 2 | 3 | 4;
  suggestionId?: string;
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

  const quality = scoreQuality(text);
  recordEvent(
    buildStatement({
      actor: { type: "student", id: body.studentId },
      verb: Verbs.selfExplanationSubmitted,
      object: { type: "code", submissionId: body.suggestionId ?? "adhoc" },
      result: { quality, wordCount: text.split(/\s+/).length, level: body.level },
    }),
  );

  // 동시에 수락 이벤트 발행 — Pedagogy Coach의 요구를 충족
  recordEvent(
    buildStatement({
      actor: { type: "student", id: body.studentId },
      verb: Verbs.aiSuggestionAccepted,
      object: { type: "code", submissionId: body.suggestionId ?? "adhoc" },
      result: { hadRationale: true, rationaleQuality: quality },
    }),
  );

  return NextResponse.json({ accepted: true, quality });
}

/** 0~1 사이의 품질 점수. 길이·다양성·접속사 단서 기반 heuristic. */
function scoreQuality(text: string): number {
  const length = Math.min(text.length / 150, 1); // 최대 1
  const connectors = /왜냐하면|그래서|따라서|때문에|만약/.test(text) ? 0.2 : 0;
  const concrete = /변수|함수|루프|배열|조건|포인터|인덱스|NULL|주소/.test(text) ? 0.2 : 0;
  const score = 0.4 + length * 0.2 + connectors + concrete;
  return Math.max(0, Math.min(1, score));
}
