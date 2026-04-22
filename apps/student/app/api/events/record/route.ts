import { NextResponse } from "next/server";

import { buildStatement, recordEvent, Verbs } from "@cvibe/xapi";

import { getRouteHandlerUser } from "@/lib/session";

/**
 * POST /api/events/record — 클라이언트가 발생시킨 xAPI 이벤트를 in-memory
 * store 에 기록한다. 현재 사용처:
 * - 모드 전환(modeChanged / modeDecreased)
 * - 향후 학생 ui 이벤트(accept-gate UI 액션 등)
 *
 * Whitelist 로만 허용 → 아무 verb 나 주입 방지.
 */
const ALLOWED = new Set<string>([
  Verbs.modeChanged,
  Verbs.modeDecreased,
  Verbs.examStarted,
  Verbs.examEnded,
]);

interface Body {
  verb: string;
  object?: {
    type: "kc" | "assignment" | "code";
    id?: string;
    slug?: string;
    submissionId?: string;
  };
  result?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!ALLOWED.has(body.verb)) {
    return NextResponse.json({ error: "verb not allowed" }, { status: 400 });
  }

  const user = await getRouteHandlerUser(request, { preferredRole: "student" });
  const object: NonNullable<Parameters<typeof buildStatement>[0]["object"]> =
    body.object?.type === "assignment"
      ? { type: "assignment", id: body.object.id ?? "ungoverned" }
      : body.object?.type === "kc"
        ? { type: "kc", slug: body.object.slug ?? "unknown" }
        : { type: "assignment", id: "ungoverned" };

  recordEvent(
    buildStatement({
      actor: { type: "student", id: user.id },
      verb: body.verb as (typeof Verbs)[keyof typeof Verbs],
      object,
      result: body.result,
      context: body.context,
    }),
  );

  return NextResponse.json({ ok: true });
}
