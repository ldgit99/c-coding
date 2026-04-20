import { NextResponse } from "next/server";

/**
 * 교사 → 학생 앱 개입 등록 프록시.
 *
 * 학생 앱의 /api/interventions POST를 서버 측에서 호출. 브라우저 fetch 대신
 * 서버 프록시로 우회하면 CORS preflight이 단순해지고, 나중에 Service Role
 * 인증도 중앙화 가능.
 */

const STUDENT_URL = process.env.STUDENT_APP_INTERNAL_URL ?? process.env.NEXT_PUBLIC_STUDENT_APP_URL ?? "http://localhost:3000";

export async function POST(request: Request) {
  const body = await request.text();
  const res = await fetch(`${STUDENT_URL}/api/interventions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
