"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import type { AppUser } from "@cvibe/db";
import { UserMenu } from "@cvibe/shared-ui";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** prefix 매칭으로 active 판정. 정확 매칭이면 exact:true */
  exact?: boolean;
  /** 서버에서 끌어온 badge 숫자 키 */
  badgeKey?: "queue" | "students";
}

const ITEMS: NavItem[] = [
  { href: "/", label: "개요", icon: "🏠", exact: true },
  { href: "/queue", label: "개입 큐", icon: "🚨", badgeKey: "queue" },
  { href: "/students", label: "학생 명단", icon: "👥", badgeKey: "students" },
  { href: "/submissions", label: "제출 현황", icon: "📝" },
  { href: "/conversations", label: "대화 분석", icon: "💬" },
  { href: "/research", label: "연구", icon: "🔬" },
  { href: "/settings", label: "설정", icon: "⚙️" },
];

export function Sidebar({ user }: { user: AppUser }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [badges, setBadges] = useState<{ queue?: number; students?: number }>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cvibe.teacher.sidebarCollapsed");
      if (saved === "1") setCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("cvibe.teacher.sidebarCollapsed", collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [qRes, sRes] = await Promise.all([
          fetch("/api/classroom", { cache: "no-store" }),
          fetch("/api/students", { cache: "no-store" }),
        ]);
        if (cancelled) return;
        const q = (await qRes.json()) as { interventionQueue?: unknown[] };
        const s = (await sRes.json()) as { students?: unknown[] };
        setBadges({
          queue: Array.isArray(q.interventionQueue) ? q.interventionQueue.length : 0,
          students: Array.isArray(s.students) ? s.students.length : 0,
        });
      } catch {
        // ignore
      }
    };
    void load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-border-soft bg-surface transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-4">
        {!collapsed && (
          <div>
            <div className="font-display text-sm font-semibold tracking-tight text-text-primary">
              CVibe 교사
            </div>
            <div className="text-[10px] uppercase tracking-wider text-neutral">
              경북대 프로그래밍1
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-md border border-border-soft text-[11px] text-text-secondary transition-colors hover:border-primary hover:text-primary"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      <nav className="mt-2 flex-1 overflow-y-auto px-2">
        <ul className="space-y-0.5">
          {ITEMS.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
            return (
              <li key={item.href}>
                <a
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`group flex h-9 items-center gap-3 rounded-md px-2 text-[13px] transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-text-secondary hover:bg-bg hover:text-text-primary"
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[14px]">
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate font-medium">{item.label}</span>
                      {badge !== undefined && badge > 0 && (
                        <span
                          className={`ml-auto rounded-full px-1.5 py-px text-[10px] font-medium ${
                            active
                              ? "bg-primary text-white"
                              : "bg-border-soft text-text-secondary group-hover:bg-primary/20 group-hover:text-primary"
                          }`}
                        >
                          {badge}
                        </span>
                      )}
                    </>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border-soft p-3">
        {collapsed ? (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary"
            title={user.email}
          >
            {(user.displayName ?? user.email ?? "?").slice(0, 1).toUpperCase()}
          </div>
        ) : (
          <UserMenu
            displayName={user.displayName}
            mocked={user.mocked}
            email={user.email}
            loginPath="/login"
          />
        )}
      </div>
    </aside>
  );
}
