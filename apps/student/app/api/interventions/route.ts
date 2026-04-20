import { NextResponse } from "next/server";

import { buildStatement, recordEvent, Verbs } from "@cvibe/xapi";

/**
 * 교사 개입 기록 — 학생 앱과 교사 앱 간 통신 채널.
 *
 * POST: 교사 앱이 새 개입을 등록 (모드 강제 변경, 쪽지 전송).
 * GET: 학생 브라우저가 자기 앞으로 온 미적용 개입을 폴링.
 *
 * 현재는 프로세스 내 링 버퍼. 운영에서는 Supabase `interventions` 테이블.
 */

export interface InterventionPayload {
  id: string;
  studentId: string; // 원본 학생 ID (브라우저 hint용, 해시 전 값)
  type: "mode_change" | "direct_message" | "hint_inject" | "difficulty_patch";
  payload: Record<string, unknown>;
  createdAt: string;
  teacherId: string;
  applied: boolean;
}

interface Store {
  items: InterventionPayload[];
}

const globalKey = "__cvibe_interventions__";

function getStore(): Store {
  const g = globalThis as unknown as Record<string, Store>;
  if (!g[globalKey]) g[globalKey] = { items: [] };
  return g[globalKey]!;
}

export async function POST(request: Request) {
  let body: Partial<InterventionPayload>;
  try {
    body = (await request.json()) as Partial<InterventionPayload>;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body.studentId || !body.type || !body.teacherId) {
    return NextResponse.json({ error: "studentId, type, teacherId 필수" }, { status: 400 });
  }
  const item: InterventionPayload = {
    id: crypto.randomUUID(),
    studentId: body.studentId,
    type: body.type,
    payload: body.payload ?? {},
    createdAt: new Date().toISOString(),
    teacherId: body.teacherId,
    applied: false,
  };
  getStore().items.push(item);

  // xAPI 이벤트 기록
  recordEvent(
    buildStatement({
      actor: { type: "teacher", id: body.teacherId },
      verb: Verbs.teacherIntervened,
      object: { type: "assignment", id: "live" },
      result: { interventionType: body.type, targetStudent: body.studentId },
    }),
  );

  return NextResponse.json({ intervention: item }, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get("studentId");
  if (!studentId) {
    return NextResponse.json({ error: "studentId 쿼리 필수" }, { status: 400 });
  }
  const onlyUnapplied = url.searchParams.get("pending") === "1";
  const store = getStore();
  const filtered = store.items.filter(
    (i) => i.studentId === studentId && (!onlyUnapplied || !i.applied),
  );
  return NextResponse.json({ interventions: filtered }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as { id: string };
  const store = getStore();
  const target = store.items.find((i) => i.id === body.id);
  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });
  target.applied = true;
  return NextResponse.json({ intervention: target });
}
