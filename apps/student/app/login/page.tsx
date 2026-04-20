"use client";

import { useState } from "react";

/**
 * 학생 로그인 — Supabase magic-link.
 *
 * Supabase env가 없으면 기능은 비활성이지만 폼은 렌더 — 배포 체크리스트용.
 * 운영에서는 NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY 필요.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const configured =
    typeof process !== "undefined" &&
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    if (!configured) {
      setStatus("error");
      setErrorMsg(
        "Supabase 환경변수가 설정되지 않았어요. 배포 관리자가 NEXT_PUBLIC_SUPABASE_URL을 주입해야 해요.",
      );
      return;
    }

    try {
      const { createBrowserClient } = await import("@supabase/ssr");
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">CVibe 로그인</h1>
        <p className="mt-1 text-xs text-slate-500">
          학교 이메일로 매직 링크를 보내드려요. 로그인 후 바로 과제로 넘어갑니다.
        </p>

        {!configured && (
          <div className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-800">
            이 배포는 데모 모드예요. Supabase 연결 없이 <code>demo-student-001</code>로
            자동 로그인됩니다. 홈으로 바로 이동하세요.
          </div>
        )}

        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-sm">
            이메일
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!configured || status === "sending" || status === "sent"}
              placeholder="you@ewha.ac.kr"
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={!configured || status === "sending" || status === "sent"}
            className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {status === "sending" ? "발송 중…" : status === "sent" ? "이메일 확인하세요" : "매직 링크 보내기"}
          </button>
        </form>

        {status === "sent" && (
          <div className="mt-3 rounded bg-emerald-50 p-2 text-xs text-emerald-800">
            {email}로 로그인 링크를 보냈어요. 이메일에서 링크를 클릭하면 돌아옵니다.
          </div>
        )}
        {status === "error" && errorMsg && (
          <div className="mt-3 rounded bg-rose-50 p-2 text-xs text-rose-800">{errorMsg}</div>
        )}

        <div className="mt-4 text-center text-xs text-slate-500">
          <a href="/" className="underline">
            데모 모드로 돌아가기
          </a>
        </div>
      </div>
    </main>
  );
}
