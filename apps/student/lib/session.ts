import { cookies } from "next/headers";

import {
  resolveUserFromCookies,
  resolveUserFromRequest,
  type AppUser,
  type Role,
} from "@cvibe/db";

/**
 * Next.js 15 async cookies() → @supabase/ssr CookieMethodsServer 어댑터.
 * Server Component·Route Handler에서 `await getSessionUser()`로 호출.
 */
export async function getSessionUser(
  opts: { preferredRole?: Role } = { preferredRole: "student" },
): Promise<AppUser> {
  const cookieStore = await cookies();
  return resolveUserFromCookies(
    {
      getAll: () => cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
      setAll: (list) => {
        for (const c of list) {
          try {
            cookieStore.set(c.name, c.value, c.options);
          } catch {
            // Server Component에서 쿠키 쓰기 불가 — Route Handler에서만 동작
          }
        }
      },
    },
    opts,
  );
}

/**
 * Route Handler 전용 — Supabase 세션을 우선 확인하고, mocked(미인증) 이면
 * request 헤더/env 기반 demo fallback. `/api/submit` 등 cookie auth 필수
 * 엔드포인트에서 `resolveUserFromRequest` 를 이걸로 교체해야 실 DB 에 기록된다.
 */
export async function getRouteHandlerUser(
  request: Request,
  opts: { preferredRole?: Role } = { preferredRole: "student" },
): Promise<AppUser> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anon) {
    try {
      const user = await getSessionUser(opts);
      if (!user.mocked) return user;
    } catch {
      // cookie 파싱 실패 → 헤더/env fallback
    }
  }
  return resolveUserFromRequest(request, opts);
}
