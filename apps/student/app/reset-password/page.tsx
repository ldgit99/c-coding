"use client";

import { useEffect, useState } from "react";

/**
 * /reset-password — 매직링크로 들어와 세션이 발급된 후 "새 비밀번호 설정".
 *
 * 흐름:
 *   1) 학생이 /login 에서 "비밀번호 잊음" → signInWithOtp(emailRedirectTo=/reset-password)
 *   2) 메일 링크 클릭 → /auth/callback 이 exchangeCodeForSession → 이 페이지로 redirect
 *   3) 학생이 새 비밀번호 입력 → supabase.auth.updateUser({password}) → /
 *
 * 세션이 없으면 /login 으로 돌려보냄.
 */
export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "saving" | "done" | "error">(
    "checking",
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [email, setEmail] = useState<string | null>(null);

  const configured =
    typeof process !== "undefined" &&
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!configured) {
      setStatus("error");
      setErrorMsg("Supabase 환경변수가 설정되지 않았어요.");
      return;
    }
    void (async () => {
      try {
        const { createBrowserClient } = await import("@supabase/ssr");
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          // 링크 만료 또는 세션 없음 → 로그인으로 회귀
          window.location.href = "/login?error=session-expired";
          return;
        }
        setEmail(data.user.email ?? null);
        setStatus("idle");
      } catch (err) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [configured]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (password.length < 6) {
      setErrorMsg("비밀번호는 6자 이상이어야 해요.");
      return;
    }
    if (password !== confirm) {
      setErrorMsg("비밀번호가 서로 달라요. 다시 확인해주세요.");
      return;
    }
    setStatus("saving");
    try {
      const { createBrowserClient } = await import("@supabase/ssr");
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setStatus("done");
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 py-12">
      <div className="w-full max-w-sm rounded-xl border border-border-soft bg-surface p-8 shadow-card">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
          Password Reset
        </div>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tighter text-text-primary">
          새 비밀번호 설정
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
          {email ? (
            <>
              <span className="font-medium text-text-primary">{email}</span>
              <br />
              앞으로 이 비밀번호로 로그인하세요.
            </>
          ) : (
            "세션 확인 중…"
          )}
        </p>

        {status === "checking" && (
          <div className="mt-6 text-[13px] text-neutral">세션 확인 중이에요…</div>
        )}

        {(status === "idle" || status === "saving" || status === "error") && email && (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-wider text-neutral">
                새 비밀번호 (6자 이상)
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={status === "saving"}
                className="mt-1 w-full rounded-md border border-border-soft bg-white px-3 py-2 text-[14px] text-text-primary focus:border-primary focus:outline-none focus:shadow-ring disabled:opacity-50"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-wider text-neutral">
                비밀번호 확인
              </span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                disabled={status === "saving"}
                className="mt-1 w-full rounded-md border border-border-soft bg-white px-3 py-2 text-[14px] text-text-primary focus:border-primary focus:outline-none focus:shadow-ring disabled:opacity-50"
              />
            </label>
            <button
              type="submit"
              disabled={status === "saving"}
              className="w-full rounded-md bg-primary px-3 py-2.5 text-[14px] font-medium text-white transition-all hover:-translate-y-px hover:bg-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "saving" ? "저장 중…" : "비밀번호 설정"}
            </button>
          </form>
        )}

        {status === "done" && (
          <div className="mt-4 rounded-md border border-success/20 bg-success/5 p-3 text-[12px] leading-relaxed text-success">
            ✅ 비밀번호가 설정됐어요. 곧 과제 화면으로 이동합니다.
          </div>
        )}
        {status === "error" && errorMsg && (
          <div className="mt-4 rounded-md border border-error/20 bg-error/5 p-3 text-[12px] leading-relaxed text-error">
            {errorMsg}
          </div>
        )}
      </div>
    </main>
  );
}
