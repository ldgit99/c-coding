import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Supabase 클라이언트 — 클라이언트/서버/서비스 롤 3종.
 *
 * 주의: service_role은 서버 경로(API Route, Edge Function, Cron)에서만 사용.
 * 브라우저 번들에 포함되면 RLS가 우회되어 학생 간 격리가 깨진다.
 */

export function createAnonClient(
  url: string = requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  anonKey: string = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

export function createServiceRoleClient(
  url: string = requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  serviceKey: string = requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("service role 클라이언트를 브라우저에서 생성하려는 시도 — 서버 전용입니다.");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Drizzle ORM — Student Modeler 배치, 분석 쿼리, 마이그레이션 유틸 등
 * 복잡 쿼리가 필요한 서버 경로에서 사용.
 */
export function createDrizzleClient(
  connectionString: string = requireEnv("SUPABASE_POSTGRES_URL"),
) {
  const queryClient = postgres(connectionString, { prepare: false });
  return drizzle(queryClient, { schema });
}

export type DrizzleClient = ReturnType<typeof createDrizzleClient>;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`환경변수 ${name}가 설정되지 않았습니다.`);
  return value;
}
