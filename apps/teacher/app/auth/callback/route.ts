import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!code || !supabaseUrl || !anonKey) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  try {
    const { createServerClient } = await import("@supabase/ssr");
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll: () => cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
        setAll: (list) => {
          for (const c of list) {
            try {
              cookieStore.set(c.name, c.value, c.options);
            } catch {
              // ignore
            }
          }
        },
      },
    });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));
    }
  } catch (err) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(String(err))}`, url.origin),
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
