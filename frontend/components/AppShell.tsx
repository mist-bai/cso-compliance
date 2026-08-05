"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, LogOut } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { AuthInfo, clearAuth, getAuth, roleHome } from "@/lib/api";

type Tab = { key: string; label: string };

export default function AppShell({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  rightSlot,
  children,
  requiredRoles,
}: {
  title: string;
  subtitle?: string;
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  rightSlot?: ReactNode;
  children: ReactNode;
  requiredRoles?: string[];
}) {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthInfo | null>(null);

  useEffect(() => {
    const info = getAuth();
    if (!info) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (requiredRoles && !requiredRoles.includes(info.role) && info.role !== "admin") {
      router.replace(roleHome(info.role));
      return;
    }
    setAuth(info);
  }, [router, requiredRoles]);

  if (!auth) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--muted-foreground)]">
        加载中…
      </div>
    );
  }

  const tabCols =
    tabs?.length === 5
      ? "grid-cols-5"
      : tabs?.length === 4
        ? "grid-cols-4"
        : tabs?.length === 3
          ? "grid-cols-3"
          : tabs?.length === 7
            ? "grid-cols-7"
            : tabs?.length === 9
              ? "grid-cols-3 md:grid-cols-9"
              : "grid-cols-2 md:grid-cols-4";

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-start gap-2.5">
            <Link
              href="/"
              className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md text-[var(--foreground)] hover:bg-[#f1f5f9]"
              aria-label="首页"
            >
              <Home size={18} strokeWidth={1.75} />
            </Link>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-[var(--foreground)]">
                <Link href="/">代理商合规管理系统</Link>
              </h1>
              <div className="text-xs text-[var(--muted-foreground)]">
                {subtitle || title}
                {auth.display_name ? ` · ${auth.display_name}` : ""}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {rightSlot}
            <button
              className="cso-btn-ghost h-9 px-2"
              onClick={() => {
                clearAuth();
                router.push("/");
              }}
              title="退出"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">退出</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        {tabs && tabs.length > 0 && (
          <div className={`cso-tabs mb-6 ${tabCols}`}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={activeTab === tab.key ? "cso-tab-active" : "cso-tab"}
                onClick={() => onTabChange?.(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    已申请待考试: "bg-amber-100 text-amber-800",
    考试通过待备案: "bg-sky-100 text-sky-800",
    备案有效: "bg-emerald-100 text-emerald-800",
    备案完成: "bg-emerald-100 text-emerald-800",
    备案撤销: "bg-rose-100 text-rose-800",
    计划中: "bg-slate-100 text-slate-700",
    待审批: "bg-amber-100 text-amber-800",
    已批准: "bg-sky-100 text-sky-800",
    已驳回: "bg-rose-100 text-rose-800",
    已完成: "bg-emerald-100 text-emerald-800",
    已提交: "bg-sky-100 text-sky-800",
    已通过: "bg-emerald-100 text-emerald-800",
    未开始: "bg-slate-100 text-slate-700",
    学习中: "bg-sky-100 text-sky-800",
    待考试: "bg-violet-100 text-violet-800",
    考试通过: "bg-emerald-100 text-emerald-800",
    考试未通过: "bg-rose-100 text-rose-800",
    启用: "bg-emerald-100 text-emerald-800",
    停用: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`cso-badge ${map[status] || "bg-slate-100 text-slate-700"}`}>
      {status}
    </span>
  );
}
