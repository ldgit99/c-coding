import { NextResponse } from "next/server";

import {
  createServiceRoleClientIfAvailable,
  fetchDraft,
  upsertDraft,
} from "@cvibe/db";
import { buildStatement, recordEvent, Verbs } from "@cvibe/xapi";

import { getRouteHandlerUser } from "@/lib/session";

/**
 * GET  /api/drafts?assignmentCode=A01_array_2d_sum  → 학생의 draft 코드 반환.
 * PUT  /api/drafts                                  → body: { assignmentCode, code }
 *                                                     → upsert.
 *
 * 에디터 자동 저장 — 5초 디바운스로 PUT, 마운트 시 GET 으로 복구.
 * Supabase env 미설정 시 GET 은 빈 응답, PUT 은 200 + ok=false 로 graceful.
 */

export async function GET(request: Request) {
  const url = new URL(request.url);
  const assignmentCode = url.searchParams.get("assignmentCode");
  if (!assignmentCode) {
    return NextResponse.json({ error: "assignmentCode 가 필요하다" }, { status: 400 });
  }

  const user = await getRouteHandlerUser(request, { preferredRole: "student" });
  const supabase = createServiceRoleClientIfAvailable();
  if (!supabase) {
    return NextResponse.json({ code: null, updatedAt: null, source: "demo" });
  }

  const { code, updatedAt, error } = await fetchDraft(supabase, {
    studentId: user.id,
    assignmentCode,
  });
  return NextResponse.json({ code, updatedAt, source: "supabase", error });
}

interface PutBody {
  assignmentCode: string;
  code: string;
}

export async function PUT(request: Request) {
  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body.assignmentCode || typeof body.code !== "string") {
    return NextResponse.json(
      { error: "assignmentCode 와 code 가 필요하다" },
      { status: 400 },
    );
  }
  // 너무 큰 코드는 거부 (50KB)
  if (body.code.length > 50_000) {
    return NextResponse.json({ error: "code 가 너무 크다 (50KB 초과)" }, { status: 413 });
  }

  const user = await getRouteHandlerUser(request, { preferredRole: "student" });
  const supabase = createServiceRoleClientIfAvailable();
  if (!supabase) {
    return NextResponse.json({ ok: false, source: "demo" });
  }

  const result = await upsertDraft(supabase, {
    studentId: user.id,
    assignmentCode: body.assignmentCode,
    code: body.code,
  });

  // xAPI — 자동 저장 발생 (분석용, 코드 본문은 events 에 저장 안 함)
  recordEvent(
    buildStatement({
      actor: { type: "student", id: user.id },
      verb: Verbs.draftSaved,
      object: { type: "assignment", id: body.assignmentCode },
      result: { codeLength: body.code.length },
    }),
  );

  return NextResponse.json({ ok: result.ok, error: result.error, source: "supabase" });
}
