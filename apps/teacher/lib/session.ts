import { cookies } from "next/headers";

import { resolveUserFromCookies, type AppUser, type Role } from "@cvibe/db";

/**
 * 교사 앱 Server Component·Route Handler에서 사용.
 * 학생 앱과 구조 동일, 기본 preferredRole은 teacher.
 */
export async function getSessionUser(
  opts: { preferredRole?: Role } = { preferredRole: "teacher" },
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
            // Server Component에서 쿠키 쓰기 불가
          }
        }
      },
    },
    opts,
  );
}
