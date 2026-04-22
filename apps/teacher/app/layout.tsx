import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { getSessionUser } from "@/lib/session";

import "./globals.css";

export const metadata: Metadata = {
  title: "경북대학교 프로그래밍1 — 교사 대시보드",
  description: "수업 오케스트레이션 컨트롤 타워",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser({ preferredRole: "teacher" });
  return (
    <html lang="ko">
      <body>
        <AppShell user={user}>{children}</AppShell>
      </body>
    </html>
  );
}
