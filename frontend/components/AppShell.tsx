"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        加载中…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <Link href="/" className="text-lg font-semibold text-slate-900">
              代理商合规管理系统
            </Link>
            <div className="text-xs text-slate-500">
              {subtitle || title} · {auth.display_name}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {rightSlot}
            <button
              className="cso-btn-secondary"
              onClick={() => {
                clearAuth();
                router.push("/");
              }}
            >
              退出
            </button>
          </div>
        </div>
        {tabs && tabs.length > 0 && (
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`cso-tab ${activeTab === tab.key ? "cso-tab-active" : ""}`}
                onClick={() => onTabChange?.(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    已申请待考试: "bg-amber-100 text-amber-800",
    考试通过待备案: "bg-sky-100 text-sky-800",
    备案有效: "bg-emerald-100 text-emerald-800",
    备案撤销: "bg-rose-100 text-rose-800",
    待审批: "bg-amber-100 text-amber-800",
    已批准: "bg-sky-100 text-sky-800",
    待提交总结: "bg-violet-100 text-violet-800",
    已完成: "bg-emerald-100 text-emerald-800",
    已提交: "bg-sky-100 text-sky-800",
    已通过: "bg-emerald-100 text-emerald-800",
  };
  return (
    <span className={`cso-badge ${map[status] || "bg-slate-100 text-slate-700"}`}>
      {status}
    </span>
  );
}
