import { NextResponse } from "next/server";

/**
 * GET /api/debug/env — 임시 진단용. env 주입 여부만 반환 (값 자체는 반환 안 함).
 *
 * Supabase 연결 문제를 격리하기 위한 1회성 엔드포인트. 파일럿 배포 전 반드시
 * 삭제하거나 접근을 막는다.
 */
export async function GET() {
  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: {
      present: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      length: process.env.NEXT_PUBLIC_SUPABASE_URL?.length ?? 0,
      startsWith: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 20) ?? null,
    },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: {
      present: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      length: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length ?? 0,
      startsWith: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 20) ?? null,
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      present: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length ?? 0,
      startsWith: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20) ?? null,
    },
    DATABASE_URL: {
      present: !!process.env.DATABASE_URL,
      length: process.env.DATABASE_URL?.length ?? 0,
      startsWith: process.env.DATABASE_URL?.slice(0, 30) ?? null,
    },
    STUDENT_APP_INTERNAL_URL: {
      present: !!process.env.STUDENT_APP_INTERNAL_URL,
      value: process.env.STUDENT_APP_INTERNAL_URL ?? null,
    },
    NEXT_PUBLIC_STUDENT_APP_URL: {
      present: !!process.env.NEXT_PUBLIC_STUDENT_APP_URL,
      value: process.env.NEXT_PUBLIC_STUDENT_APP_URL ?? null,
    },
  });
}
