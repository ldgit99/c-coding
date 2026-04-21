"use client";

import { useState } from "react";

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
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 py-12">
      <div className="w-full max-w-sm rounded-xl border border-border-soft bg-surface p-8 shadow-card">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
          Teacher Sign in
        </div>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tighter text-text-primary">
          경북대학교 프로그래밍1
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
          교사용 magic-link 이메일 인증.
        </p>

        {!configured && (
          <div className="mt-4 rounded-md border border-warning/20 bg-warning/5 p-3 text-[12px] leading-relaxed text-warning">
            데모 모드 — <code className="font-mono">demo-teacher-001</code>로 자동 로그인.{" "}
            <a href="/" className="underline hover:text-warning/80">
              홈으로
            </a>
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-wider text-neutral">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!configured || status === "sending" || status === "sent"}
              placeholder="teacher@school.ac.kr"
              className="mt-1 w-full rounded-md border border-border-soft bg-white px-3 py-2 text-[14px] text-text-primary placeholder:text-neutral focus:border-primary focus:outline-none focus:shadow-ring disabled:opacity-50"
            />
          </label>
          <button
            type="submit"
            disabled={!configured || status === "sending" || status === "sent"}
            className="w-full rounded-md bg-primary px-3 py-2.5 text-[14px] font-medium text-white transition-all hover:-translate-y-px hover:bg-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            {status === "sent" ? "이메일 확인하세요" : "매직 링크 보내기"}
          </button>
        </form>

        {status === "error" && errorMsg && (
          <div className="mt-4 rounded-md border border-error/20 bg-error/5 p-3 text-[12px] leading-relaxed text-error">
            {errorMsg}
          </div>
        )}
      </div>
    </main>
  );
}
