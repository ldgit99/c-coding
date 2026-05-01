import { NextResponse } from "next/server";

import { ASSIGNMENTS, createServiceRoleClientIfAvailable } from "@cvibe/db";

/**
 * GET /api/cron/drift-check — 일일 카탈로그 ↔ DB drift 검사.
 *
 * Vercel Cron 으로 매일 1회 실행. drift 발견 시 응답에 명시 — 외부 알림 채널
 * (Slack webhook 등) 은 SLACK_WEBHOOK_URL env 가 있을 때만 POST.
 *
 * 인증: x-cron-secret 또는 Authorization: Bearer ${CRON_SECRET}.
 */

function checkAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const fromHeader = request.headers.get("x-cron-secret");
  const fromAuth = request.headers.get("authorization");
  return fromHeader === secret || fromAuth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClientIfAvailable();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "no-service-role-client" });
  }

  const { data: rows } = await supabase.from("assignments").select("code");
  const dbCodes = new Set((rows ?? []).map((r) => r.code as string));
  const catalogCodes = new Set(ASSIGNMENTS.map((a) => a.code));

  const missingInDb = [...catalogCodes].filter((c) => !dbCodes.has(c));
  const extraInDb = [...dbCodes].filter((c) => !catalogCodes.has(c));
  const inSync = missingInDb.length === 0 && extraInDb.length === 0;

  // Slack 알림 (env 가 있으면)
  if (!inSync) {
    const webhook = process.env.SLACK_WEBHOOK_URL;
    if (webhook) {
      const text = [
        `🚨 *CVibe assignment drift 발견*`,
        missingInDb.length > 0
          ? `DB 누락: \`${missingInDb.join(", ")}\``
          : null,
        extraInDb.length > 0 ? `DB 잔존: \`${extraInDb.join(", ")}\`` : null,
        `→ /settings 에서 Reseed Assignments 클릭 필요.`,
      ]
        .filter(Boolean)
        .join("\n");
      try {
        await fetch(webhook, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        });
      } catch {
        // ignore
      }
    }
  }

  return NextResponse.json({
    ok: true,
    inSync,
    missingInDb,
    extraInDb,
    ranAt: new Date().toISOString(),
  });
}
