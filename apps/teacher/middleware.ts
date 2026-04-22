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

  // @supabase/ssr 는 세션 토큰이 길면 chunked cookie(`sb-<ref>-auth-token.0`,
  // `.1`) 로 저장한다. endsWith("-auth-token") 만 확인하면 chunked 케이스를
  // 놓쳐 로그인 직후에도 /login 으로 되돌려보내는 버그가 생긴다.
  const hasSessionCookie = request.cookies.getAll().some((c) => {
    if (!c.name.startsWith("sb-")) return false;
    return c.name.includes("-auth-token");
  });
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
