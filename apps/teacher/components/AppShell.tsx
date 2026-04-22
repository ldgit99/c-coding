"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import type { AppUser } from "@cvibe/db";

import { Sidebar } from "@/components/Sidebar";

const BARE_PATHS = [/^\/login(\/|$)/, /^\/auth(\/|$)/];

/**
 * 교사 앱 전체 레이아웃 — 좌측 사이드바 + 메인 영역.
 * 로그인·auth 경로에서는 사이드바 없이 children만 렌더.
 */
export function AppShell({ user, children }: { user: AppUser; children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const bare = BARE_PATHS.some((re) => re.test(pathname));

  if (bare) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar user={user} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
