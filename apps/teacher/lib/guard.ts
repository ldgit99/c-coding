import { NextResponse } from "next/server";

import { getSessionUser } from "./session";

/**
 * 교사 전용 endpoint 가드. 다음 중 하나를 요구한다:
 *  1) Supabase 세션 쿠키 → role==='teacher'
 *  2) `x-admin-secret` 헤더 또는 `Authorization: Bearer ...` 가 ADMIN_SECRET 일치
 *
 * 둘 다 실패하면 401. demo 모드(env 미설정) 에서는 mocked teacher 가
 * 통과하지만, 운영에서는 위 두 조건 중 하나가 반드시 만족돼야 한다.
 */
export async function requireTeacher(request: Request): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret) {
    const fromHeader = request.headers.get("x-admin-secret");
    const fromAuth = request.headers.get("authorization");
    if (fromHeader === adminSecret || fromAuth === `Bearer ${adminSecret}`) {
      return { ok: true, userId: "admin-secret" };
    }
  }
  try {
    const user = await getSessionUser({ preferredRole: "teacher" });
    if (user.role === "teacher" && !user.mocked) {
      return { ok: true, userId: user.id };
    }
    // mocked teacher 는 demo 모드에서만 통과. NEXT_PUBLIC_SUPABASE_URL 이
    // 있으면 demo 가 아니므로 차단.
    if (user.role === "teacher" && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return { ok: true, userId: user.id };
    }
  } catch {
    // fall through → 401
  }
  return {
    ok: false,
    response: NextResponse.json(
      { error: "unauthorized", hint: "교사 로그인 또는 ADMIN_SECRET 헤더가 필요합니다." },
      { status: 401 },
    ),
  };
}
