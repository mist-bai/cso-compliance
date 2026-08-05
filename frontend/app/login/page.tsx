"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login, roleHome } from "@/lib/api";

const demos: Record<string, { username: string; label: string }> = {
  agent: { username: "agent_huabei", label: "代理商" },
  rep: { username: "rep_luohao", label: "代表" },
  compliance: { username: "compliance", label: "合规看板" },
  admin: { username: "admin", label: "后台管理" },
  academy: { username: "academy", label: "课程管理" },
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const role = params.get("role") || "";
  const next = params.get("next");
  const preset = demos[role];

  const [username, setUsername] = useState(preset?.username || "admin");
  const [password, setPassword] = useState("demo123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const title = useMemo(
    () => (preset ? `${preset.label}登录` : "系统登录"),
    [preset]
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const auth = await login(username, password);
      router.replace(next || roleHome(auth.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="cso-card w-full max-w-md p-8">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">
        演示密码统一为 <code>demo123</code>
      </p>

      <label className="mt-6 block text-sm text-slate-600">
        用户名
        <input
          className="cso-input mt-1"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
      </label>
      <label className="mt-4 block text-sm text-slate-600">
        密码
        <input
          type="password"
          className="cso-input mt-1"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <button className="cso-btn-primary mt-6 w-full" disabled={loading}>
        {loading ? "登录中…" : "登录"}
      </button>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
        {Object.entries(demos).map(([key, d]) => (
          <button
            key={key}
            type="button"
            className="rounded-md border border-slate-200 px-2 py-1.5 text-left hover:bg-slate-50"
            onClick={() => {
              setUsername(d.username);
              setPassword("demo123");
            }}
          >
            {d.label}: {d.username}
          </button>
        ))}
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense fallback={<div className="text-slate-500">加载登录页…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
