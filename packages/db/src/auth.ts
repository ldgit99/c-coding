import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";

/**
 * Auth 추상 레이어 — Week 10 Supabase Auth 전환 대비.
 *
 * 운영: `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY`가 설정된
 * 환경에서는 Supabase SSR 클라이언트의 getUser()를 사용.
 * 개발/데모: 설정이 없거나 `CVIBE_DEMO_USER` env가 지정된 환경에서는 mock user
 * 반환. 하드코딩 학생 ID(`demo-student-001`)를 제거한 것이 핵심.
 */

export type Role = "student" | "teacher" | "admin";

export interface AppUser {
  id: string;
  email: string;
  role: Role;
  displayName: string;
  cohortId?: string;
  mocked: boolean;
}

export const DEMO_STUDENT_USER: AppUser = {
  id: "demo-student-001",
  email: "demo-student@cvibe.dev",
  role: "student",
  displayName: "데모 학생",
  cohortId: "cohort-2026-spring-cs1",
  mocked: true,
};

export const DEMO_TEACHER_USER: AppUser = {
  id: "demo-teacher-001",
  email: "demo-teacher@cvibe.dev",
  role: "teacher",
  displayName: "데모 교사",
  mocked: true,
};

/**
 * Next.js Server Component·Route Handler에서 사용.
 * cookies는 Next.js 15 async cookies()를 호출부가 전달.
 */
export async function resolveUserFromCookies(
  cookieStore: CookieMethodsServer,
  opts: { preferredRole?: Role } = {},
): Promise<AppUser> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return fallbackUser(opts.preferredRole);
  }

  try {
    const supabase = createServerClient(url, anon, { cookies: cookieStore });
    const { data } = await supabase.auth.getUser();
    if (!data.user) return fallbackUser(opts.preferredRole);

    // profiles 테이블에서 role/cohort 조회
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, display_name, cohort_id")
      .eq("id", data.user.id)
      .single();

    return {
      id: data.user.id,
      email: data.user.email ?? "",
      role: (profile?.role as Role) ?? opts.preferredRole ?? "student",
      displayName: profile?.display_name ?? data.user.email ?? "User",
      cohortId: profile?.cohort_id ?? undefined,
      mocked: false,
    };
  } catch {
    return fallbackUser(opts.preferredRole);
  }
}

/**
 * API Route Handler 용 — Supabase Auth 연결 안 됐거나 dev 환경에서는 demo user.
 * 실제 auth가 붙으면 이 함수가 throw하도록 전환.
 */
export function resolveUserFromRequest(
  request: Request,
  opts: { preferredRole?: Role } = {},
): AppUser {
  // 1) 헤더 기반 override (개발 툴링에서 편함)
  const headerRole = request.headers.get("x-cvibe-role");
  const headerId = request.headers.get("x-cvibe-user-id");
  if (headerRole && headerId) {
    return {
      id: headerId,
      email: `${headerId}@cvibe.dev`,
      role: (headerRole as Role) ?? "student",
      displayName: headerId,
      mocked: true,
    };
  }

  // 2) env override
  const envOverride = process.env.CVIBE_DEMO_USER;
  if (envOverride) {
    try {
      const parsed = JSON.parse(envOverride) as Partial<AppUser>;
      return { ...fallbackUser(opts.preferredRole), ...parsed, mocked: true };
    } catch {
      // ignore
    }
  }

  // 3) 기본 fallback
  return fallbackUser(opts.preferredRole);
}

function fallbackUser(preferredRole?: Role): AppUser {
  if (preferredRole === "teacher") return DEMO_TEACHER_USER;
  return DEMO_STUDENT_USER;
}
