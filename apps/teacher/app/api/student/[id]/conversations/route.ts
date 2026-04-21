import { NextResponse } from "next/server";

/**
 * GET /api/student/[id]/conversations — 학생 앱 /api/conversations 프록시.
 *
 * 교사 세션 확인은 student app 쪽 middleware에 맡기되, 여기서는 쿼리 위임만 담당.
 * Supabase 연결 후에는 `conversations` 테이블을 RLS(teacher role) 하에 직접 SELECT.
 */
const STUDENT_URL =
  process.env.STUDENT_APP_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_STUDENT_APP_URL ??
  "http://localhost:3000";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const params = new URLSearchParams(url.searchParams);
  params.set("studentId", id);

  try {
    const res = await fetch(`${STUDENT_URL}/api/conversations?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { turns: [], error: `student app ${res.status}` },
        { status: res.status },
      );
    }
    return NextResponse.json(await res.json(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json({ turns: [], error: String(err) }, { status: 502 });
  }
}
