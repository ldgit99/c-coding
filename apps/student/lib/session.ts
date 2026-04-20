import { cookies } from "next/headers";

import { resolveUserFromCookies, type AppUser } from "@cvibe/db";

/**
 * Next.js 15 async cookies() → @supabase/ssr CookieMethodsServer 어댑터.
 * Server Component·Route Handler에서 `await getSessionUser()`로 호출.
 */
export async function getSessionUser(): Promise<AppUser> {
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
    { preferredRole: "student" },
  );
}
