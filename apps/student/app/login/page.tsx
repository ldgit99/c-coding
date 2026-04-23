"use client";

import { useState } from "react";

type Action = "signin" | "signup" | "forgot";

export default function LoginPage() {
  const [action, setAction] = useState<Action>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const configured =
    typeof process !== "undefined" &&
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const switchAction = (next: Action) => {
    setAction(next);
    setStatus("idle");
    setErrorMsg("");
  };

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

      if (action === "signup") {
        const trimmedName = displayName.trim();
        if (trimmedName.length < 1) {
          throw new Error("이름을 입력해주세요.");
        }
        if (password.length < 6) {
          throw new Error("비밀번호는 6자 이상으로 설정해주세요.");
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: trimmedName },
          },
        });
        if (error) throw error;
        // Confirm email 이 꺼져있으면 session 이 즉시 발급됨.
        // 켜져있으면 session 이 null — 확인 메일 안내.
        if (data.session) {
          window.location.href = "/";
        } else {
          setStatus("sent");
        }
      } else if (action === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/";
      } else {
        // forgot — 비밀번호 분실 시에만 매직링크 발송
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setStatus("sent");
      }
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const isBusy = status === "sending" || (action !== "signin" && status === "sent");

  const subtitle =
    action === "signup"
      ? "이름·이메일·비밀번호로 바로 가입해요. 이메일 확인 없이 즉시 로그인됩니다."
      : action === "signin"
        ? "이메일과 비밀번호로 로그인해요."
        : "등록한 이메일로 로그인 링크를 보내드려요.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 py-12">
      <div className="w-full max-w-sm rounded-xl border border-border-soft bg-surface p-8 shadow-card">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral">
          Sign in
        </div>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tighter text-text-primary">
          경북대학교 프로그래밍1
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">{subtitle}</p>

        {/* 로그인 / 회원가입 토글 */}
        <div className="mt-5 flex gap-1 rounded-md border border-border-soft bg-bg p-1">
          <button
            type="button"
            onClick={() => switchAction("signin")}
            className={`flex-1 rounded px-3 py-1.5 text-[12px] font-medium transition-colors ${
              action === "signin"
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => switchAction("signup")}
            className={`flex-1 rounded px-3 py-1.5 text-[12px] font-medium transition-colors ${
              action === "signup"
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            회원가입
          </button>
        </div>

        {!configured && (
          <div className="mt-4 rounded-md border border-warning/20 bg-warning/5 p-3 text-[12px] leading-relaxed text-warning">
            이 배포는 데모 모드예요. Supabase 연결 없이{" "}
            <code className="font-mono">demo-student-001</code>로 자동 로그인됩니다.
          </div>
        )}

        <form onSubmit={submit} className="mt-5 space-y-4">
          {action === "signup" && (
            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-wider text-neutral">
                이름
              </span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                disabled={!configured || isBusy}
                placeholder="예: 홍길동"
                maxLength={40}
                className="mt-1 w-full rounded-md border border-border-soft bg-white px-3 py-2 text-[14px] text-text-primary placeholder:text-neutral focus:border-primary focus:outline-none focus:shadow-ring disabled:opacity-50"
              />
              <span className="mt-1 block text-[10px] leading-snug text-neutral">
                교사 대시보드에 표시될 실명.
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

          {action !== "forgot" && (
            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-wider text-neutral">
                {action === "signup" ? "비밀번호 (6자 이상)" : "비밀번호"}
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={!configured || isBusy}
                placeholder={action === "signup" ? "6자 이상" : "비밀번호 입력"}
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
              ? action === "signup"
                ? "가입 중…"
                : action === "signin"
                  ? "로그인 중…"
                  : "발송 중…"
              : status === "sent" && action === "forgot"
                ? "이메일 확인하세요"
                : action === "signup"
                  ? "가입하고 바로 시작"
                  : action === "signin"
                    ? "로그인"
                    : "재설정 링크 보내기"}
          </button>
        </form>

        {status === "sent" && action === "forgot" && (
          <div className="mt-4 rounded-md border border-success/20 bg-success/5 p-3 text-[12px] leading-relaxed text-success">
            {email}로 로그인 링크를 보냈어요. 이메일에서 링크를 클릭하면 돌아옵니다.
            (스팸함 먼저 확인!)
          </div>
        )}
        {status === "sent" && action === "signup" && (
          <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-3 text-[12px] leading-relaxed text-primary">
            가입 확인 이메일을 보냈어요. 이메일 확인 후 다시 로그인해주세요.
          </div>
        )}
        {status === "error" && errorMsg && (
          <div className="mt-4 rounded-md border border-error/20 bg-error/5 p-3 text-[12px] leading-relaxed text-error">
            {humanizeAuthError(errorMsg)}
          </div>
        )}

        {/* 부가 링크 */}
        <div className="mt-5 flex items-center justify-between text-[11px] text-neutral">
          {action === "signin" ? (
            <button
              type="button"
              onClick={() => switchAction("forgot")}
              className="transition-colors hover:text-primary"
            >
              비밀번호 잊음?
            </button>
          ) : action === "forgot" ? (
            <button
              type="button"
              onClick={() => switchAction("signin")}
              className="transition-colors hover:text-primary"
            >
              ← 로그인으로 돌아가기
            </button>
          ) : (
            <button
              type="button"
              onClick={() => switchAction("signin")}
              className="transition-colors hover:text-primary"
            >
              ← 이미 계정이 있어요
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

/** Supabase 원문 에러 메시지를 학생이 이해할 수 있는 한국어로. */
function humanizeAuthError(raw: string): string {
  const map: Array<[RegExp, string]> = [
    [/invalid login credentials/i, "이메일 또는 비밀번호가 일치하지 않아요."],
    [/user already registered/i, "이미 가입된 이메일이에요. 로그인 탭에서 로그인해주세요."],
    [/email rate limit/i, "이메일 발송 제한에 걸렸어요. 비밀번호 로그인으로 시도해주세요."],
    [/password.*weak|password.*short/i, "비밀번호를 6자 이상으로 설정해주세요."],
    [/network|fetch/i, "네트워크 오류. 잠시 후 다시 시도해주세요."],
  ];
  for (const [re, msg] of map) {
    if (re.test(raw)) return msg;
  }
  return raw;
}
