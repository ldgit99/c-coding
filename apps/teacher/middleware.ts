import { NextResponse, type NextRequest } from "next/server";

/**
 * 교사 앱 middleware — role=teacher 확인.
 *
 * Supabase env 없으면 DEMO_TEACHER_USER fallback(모두 통과).
 * 있으면 세션 쿠키 + role 필요.
 *
 * 주의: profile role 조회는 middleware에서 DB 왕복 없이 할 수 없으므로
 * 2단계 확인: (a) 세션 쿠키 존재 여부, (b) 실제 role은 각 Server Component·
 * Route Handler의 getSessionUser가 검증.
 */

const PUBLIC_PATHS = ["/login", "/auth", "/_next", "/favicon.ico"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseConfigured) {
    return NextResponse.next();
  }

  // PKCE code-verifier 쿠키는 세션 아님 — 정규식으로 실제 세션 토큰만 매칭.
  const AUTH_TOKEN_RE = /^sb-[^-]+-auth-token(\.\d+)?$/;
  const hasSessionCookie = request.cookies.getAll().some((c) => AUTH_TOKEN_RE.test(c.name));
  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
