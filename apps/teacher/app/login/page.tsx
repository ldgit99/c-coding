"use client";

import { useState } from "react";

/**
 * 교사 로그인 — 학생 앱과 동일한 magic-link 흐름.
 * 로그인 후 profile.role=teacher 확인은 Server Component의 getSessionUser가 담당.
 */
export default function TeacherLoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const configured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    if (!configured) {
      setStatus("error");
      setErrorMsg("Supabase 환경변수 미설정 — 데모 모드에서는 홈으로 바로 가세요.");
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
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
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
        <h1 className="text-xl font-semibold">CVibe 교사 로그인</h1>
        <p className="mt-1 text-xs text-slate-500">교사용 magic-link 이메일 인증.</p>

        {!configured && (
          <div className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-800">
            데모 모드 — <code>demo-teacher-001</code>로 자동 로그인.{" "}
            <a href="/" className="underline">
              홈으로
            </a>
          </div>
        )}

        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={!configured || status === "sending" || status === "sent"}
            placeholder="teacher@school.ac.kr"
            className="w-full rounded border px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={!configured || status === "sending" || status === "sent"}
            className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {status === "sent" ? "이메일 확인하세요" : "매직 링크 보내기"}
          </button>
        </form>

        {status === "error" && errorMsg && (
          <div className="mt-3 rounded bg-rose-50 p-2 text-xs text-rose-800">{errorMsg}</div>
        )}
      </div>
    </main>
  );
}
