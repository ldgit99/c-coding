import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js middleware — 학생 앱의 role guard.
 *
 * - Supabase env가 없으면 모든 요청 통과 (데모 모드).
 * - 있으면 supabase-auth-token cookie를 검사 → 로그인 없으면 /login으로 리다이렉트.
 * - /login, /auth/callback, /api/*, 정적 자산은 공개.
 *
 * 교사 전용 route(`/teacher/*`)는 학생 앱에 없으므로 별도 가드는 교사 앱에
 * 미러 복제해 배치. 여기서는 인증 여부만 확인.
 */

const PUBLIC_PATHS = ["/login", "/auth", "/_next", "/favicon.ico"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 공개 경로
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  // API는 각 route가 자체 auth 검증 (resolveUserFromRequest)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseConfigured) {
    // 데모 모드 — 모든 요청 통과, resolveUserFromCookies가 DEMO_STUDENT_USER 반환
    return NextResponse.next();
  }

  // Supabase 세션 쿠키 — @supabase/ssr이 `sb-<project-ref>-auth-token` 형식으로 저장
  const hasSessionCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));
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
