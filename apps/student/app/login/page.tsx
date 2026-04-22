"use client";

import { useState } from "react";

type Mode = "magic" | "password";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
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

      if (mode === "magic") {
        const trimmedName = displayName.trim();
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            // 이름은 first-signup 때 트리거가 `raw_user_meta_data->>'display_name'` 으로 꺼내 저장.
            // 이후 로그인에서도 metadata 는 갱신되지만 `profiles.display_name` 은 덮어쓰지 않음.
            data: trimmedName ? { display_name: trimmedName } : undefined,
          },
        });
        if (error) throw error;
        setStatus("sent");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        window.location.href = "/";
      }
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const isBusy = status === "sending" || (mode === "magic" && status === "sent");

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 py-12">
      <div className="w-full max-w-sm rounded-xl border border-border-soft bg-surface p-8 shadow-card">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
          Sign in
        </div>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tighter text-text-primary">
          경북대학교 프로그래밍1
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
          {mode === "magic"
            ? "학교 이메일로 매직 링크를 보내드려요. 로그인 후 바로 과제로 넘어갑니다."
            : "관리자가 생성한 계정으로 로그인합니다."}
        </p>

        <div className="mt-5 flex gap-1 rounded-md border border-border-soft bg-bg p-1">
          <button
            type="button"
            onClick={() => {
              setMode("magic");
              setStatus("idle");
              setErrorMsg("");
            }}
            className={`flex-1 rounded px-3 py-1.5 text-[12px] font-medium transition-colors ${
              mode === "magic"
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            매직 링크
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("password");
              setStatus("idle");
              setErrorMsg("");
            }}
            className={`flex-1 rounded px-3 py-1.5 text-[12px] font-medium transition-colors ${
              mode === "password"
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            비밀번호
          </button>
        </div>

        {!configured && (
          <div className="mt-4 rounded-md border border-warning/20 bg-warning/5 p-3 text-[12px] leading-relaxed text-warning">
            이 배포는 데모 모드예요. Supabase 연결 없이{" "}
            <code className="font-mono">demo-student-001</code>로 자동 로그인됩니다.
          </div>
        )}

        <form onSubmit={submit} className="mt-5 space-y-4">
          {mode === "magic" && (
            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-wider text-neutral">
                이름 (처음 로그인 시)
              </span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={!configured || isBusy}
                placeholder="예: 홍길동"
                maxLength={40}
                className="mt-1 w-full rounded-md border border-border-soft bg-white px-3 py-2 text-[14px] text-text-primary placeholder:text-neutral focus:border-primary focus:outline-none focus:shadow-ring disabled:opacity-50"
              />
              <span className="mt-1 block text-[10px] leading-snug text-neutral">
                교사 대시보드에 표시될 이름이에요. 기존 사용자는 비워둬도 됩니다.
              </span>
            </label>
          )}

          <label className="block">
            <span className="text-[10px] font-medium uppercase tracking-wider text-neutral">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!configured || isBusy}
              placeholder="you@gmail.com"
              className="mt-1 w-full rounded-md border border-border-soft bg-white px-3 py-2 text-[14px] text-text-primary placeholder:text-neutral focus:border-primary focus:outline-none focus:shadow-ring disabled:opacity-50"
            />
          </label>

          {mode === "password" && (
            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-wider text-neutral">
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={!configured || isBusy}
                placeholder="관리자가 설정한 비밀번호"
                className="mt-1 w-full rounded-md border border-border-soft bg-white px-3 py-2 text-[14px] text-text-primary placeholder:text-neutral focus:border-primary focus:outline-none focus:shadow-ring disabled:opacity-50"
              />
            </label>
          )}

          <button
            type="submit"
            disabled={!configured || isBusy}
            className="w-full rounded-md bg-primary px-3 py-2.5 text-[14px] font-medium text-white transition-all hover:-translate-y-px hover:bg-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            {status === "sending"
              ? mode === "magic" ? "발송 중…" : "로그인 중…"
              : status === "sent"
                ? "이메일 확인하세요"
                : mode === "magic" ? "매직 링크 보내기" : "로그인"}
          </button>
        </form>

        {status === "sent" && mode === "magic" && (
          <div className="mt-4 rounded-md border border-success/20 bg-success/5 p-3 text-[12px] leading-relaxed text-success">
            {email}로 로그인 링크를 보냈어요. 이메일에서 링크를 클릭하면 돌아옵니다.
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
