import { NextResponse } from "next/server";

/**
 * 학생 앱의 /api/events를 서버측에서 프록시 fetch.
 * 브라우저 CORS 이슈를 우회하고, 인증 토큰 주입 시점을 통일한다.
 */

const STUDENT_URL = process.env.STUDENT_APP_INTERNAL_URL ?? process.env.NEXT_PUBLIC_STUDENT_APP_URL ?? "http://localhost:3000";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const qs = url.searchParams.toString();
  try {
    const res = await fetch(`${STUDENT_URL}/api/events${qs ? `?${qs}` : ""}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ events: [], error: `student app ${res.status}` }, { status: res.status });
    }
    return NextResponse.json(await res.json(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json({ events: [], error: String(err) }, { status: 502 });
  }
}
