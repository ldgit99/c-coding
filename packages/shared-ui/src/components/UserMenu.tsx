"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  /** 표시할 사용자 이름 (보통 user.displayName) */
  displayName: string;
  /** demo / mocked 상태 여부 */
  mocked?: boolean;
  /** 로그인한 이메일 (선택 — 드롭다운에 표시) */
  email?: string;
  /**
   * 로그아웃 후 이동할 경로. 학생: "/login", 교사: "/login".
   * redirect 는 onLogout 에서 처리 — 컴포넌트는 signOut 만 호출.
   */
  loginPath?: string;
}

/**
 * 헤더 우측 사용자 메뉴. 아바타 이니셜 + 이름 클릭 → 드롭다운에 로그아웃.
 *
 * Supabase env 가 없으면 demo 모드로 로그아웃 비활성(의미 없음).
 * 있으면 supabase.auth.signOut() 호출 + loginPath 로 하드 리다이렉트 (쿠키
 * 정리가 확실하게 되도록).
 */
export function UserMenu({ displayName, mocked, email, loginPath = "/login" }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const configured =
    typeof process !== "undefined" &&
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const handleLogout = async () => {
    setBusy(true);
    try {
      if (configured) {
        const { createBrowserClient } = await import("@supabase/ssr");
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );
        await supabase.auth.signOut();
      }
    } catch {
      // fall through — 어차피 리다이렉트로 상태 리셋
    } finally {
      window.location.href = loginPath;
    }
  };

  const initial = (displayName || "?").trim().charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-2 rounded-md border border-border-soft bg-white px-1.5 pr-3 text-[11px] font-medium text-text-primary transition-colors hover:border-primary hover:text-primary"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
          {initial}
        </span>
        <span className="max-w-[120px] truncate">{displayName}</span>
        {mocked && (
          <span className="rounded-sm bg-warning/10 px-1 py-0.5 text-[9px] uppercase tracking-wider text-warning">
            demo
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1.5 w-56 rounded-lg border border-border-soft bg-surface p-1 shadow-card"
        >
          <div className="px-3 py-2 text-[12px]">
            <div className="font-medium text-text-primary">{displayName}</div>
            {email && <div className="mt-0.5 font-mono text-[10px] text-neutral">{email}</div>}
            {mocked && (
              <div className="mt-1 text-[10px] uppercase tracking-wider text-warning">
                demo 모드 · 로그아웃 없음
              </div>
            )}
          </div>
          <div className="my-1 h-px bg-border-soft" />
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={busy || mocked}
            className="w-full rounded px-3 py-2 text-left text-[12px] font-medium text-text-primary transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "로그아웃 중…" : "로그아웃"}
          </button>
        </div>
      )}
    </div>
  );
}
