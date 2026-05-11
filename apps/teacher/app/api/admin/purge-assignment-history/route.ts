import { NextResponse } from "next/server";

import { createServiceRoleClientIfAvailable } from "@cvibe/db";

import { requireTeacher } from "@/lib/guard";

/**
 * POST /api/admin/purge-assignment-history
 *
 * 특정 과제 (code) 의 옛 학생 기록을 삭제. 카탈로그가 새 문제로 교체된 뒤
 * 옛 정답·옛 hidden test 결과로 채점된 submissions·conversations·events·
 * drafts 가 남아 있어 분석을 오염시키는 경우 cleanup.
 *
 * Body:
 *   {
 *     "assignmentCode": "A02_pointer_swap_fn",
 *     "before": "2026-05-12T06:00:00Z",   // ISO — 이 시각 이전 row 만 삭제
 *     "confirm": true,                      // false 면 dry-run (count 만)
 *     "tables": ["submissions","conversations","events","drafts"]  // 옵션
 *   }
 *
 * 안전장치:
 *  - requireTeacher (Supabase teacher 세션 OR ADMIN_SECRET 헤더)
 *  - confirm=false 가 기본 — dry-run 으로 영향 row 수만 반환
 *  - before 필수 (timestamp 가드 없으면 새 문제로 푼 신규 제출도 날아감)
 *  - 결과 상세를 응답에 포함
 */

const ALLOWED_TABLES = new Set([
  "submissions",
  "conversations",
  "events",
  "drafts",
]);

interface Body {
  assignmentCode?: string;
  before?: string;
  confirm?: boolean;
  tables?: string[];
}

export async function POST(request: Request) {
  const auth = await requireTeacher(request);
  if (!auth.ok) return auth.response;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const code = body.assignmentCode?.trim();
  if (!code) {
    return NextResponse.json(
      { error: "assignmentCode 필수" },
      { status: 400 },
    );
  }
  const before = body.before?.trim();
  if (!before || Number.isNaN(Date.parse(before))) {
    return NextResponse.json(
      {
        error:
          "before (ISO timestamp) 필수 — 이 시각 이전의 row 만 삭제. 신규 기록 보호.",
      },
      { status: 400 },
    );
  }
  const confirm = body.confirm === true;
  const targets = (body.tables ?? Array.from(ALLOWED_TABLES))
    .filter((t) => ALLOWED_TABLES.has(t));
  if (targets.length === 0) {
    return NextResponse.json({ error: "tables 가 비어 있다" }, { status: 400 });
  }

  const supabase = createServiceRoleClientIfAvailable();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "no-service-role-client" },
      { status: 500 },
    );
  }

  // assignments.code → id (uuid)
  const { data: asg, error: asgErr } = await supabase
    .from("assignments")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (asgErr) {
    return NextResponse.json({ ok: false, error: asgErr.message }, { status: 500 });
  }
  if (!asg) {
    return NextResponse.json(
      { ok: false, error: `assignment not found: ${code}` },
      { status: 404 },
    );
  }
  const assignmentId = asg.id as string;

  // 각 테이블 별로 필터 + 카운트 / 삭제.
  // events 는 timestamp 컬럼, conversations 는 created_at, submissions/drafts 는
  // submitted_at / updated_at. drafts 는 새 문제로 자동 덮어쓰기되므로 보통
  // delete 대상.
  const tableSpec: Record<
    string,
    { col: string; assignmentCol: string; matchCode?: boolean }
  > = {
    submissions: { col: "submitted_at", assignmentCol: "assignment_id" },
    conversations: { col: "created_at", assignmentCol: "assignment_id" },
    events: { col: "timestamp", assignmentCol: "assignment_id" },
    drafts: { col: "updated_at", assignmentCol: "assignment_id" },
  };

  const summary: Array<{
    table: string;
    matched: number;
    deleted: number;
    error?: string;
  }> = [];

  for (const table of targets) {
    const spec = tableSpec[table];
    if (!spec) continue;
    // 1) dry-run count
    const countQuery = supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(spec.assignmentCol, assignmentId)
      .lt(spec.col, before);
    const { count, error: countErr } = await countQuery;
    if (countErr) {
      summary.push({ table, matched: 0, deleted: 0, error: countErr.message });
      continue;
    }
    const matched = count ?? 0;
    let deleted = 0;
    if (confirm && matched > 0) {
      const { error: delErr } = await supabase
        .from(table)
        .delete()
        .eq(spec.assignmentCol, assignmentId)
        .lt(spec.col, before);
      if (delErr) {
        summary.push({ table, matched, deleted: 0, error: delErr.message });
        continue;
      }
      deleted = matched;
    }
    summary.push({ table, matched, deleted });
  }

  return NextResponse.json({
    ok: true,
    mode: confirm ? "executed" : "dry-run",
    assignmentCode: code,
    assignmentId,
    before,
    summary,
    hint: confirm
      ? "삭제 완료. 복구 불가."
      : "dry-run 결과. 실제 삭제하려면 body 에 confirm:true 를 포함해 다시 호출하세요.",
  });
}
