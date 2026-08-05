"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AppShell, { StatusBadge } from "@/components/AppShell";
import { api } from "@/lib/api";

type Filing = {
  id: number;
  status: string;
  factory_name?: string;
  valid_from?: string;
  valid_to?: string;
};

type Visit = {
  id: number;
  period: string;
  visit_count: number;
  target_count: number;
  completion_rate?: number;
};

type Meeting = {
  id: number;
  title: string;
  status: string;
  meeting_date?: string;
};

const tabs = [
  { key: "todo", label: "待办任务" },
  { key: "filings", label: "备案明细" },
  { key: "visits", label: "拜访明细" },
  { key: "meetings", label: "学术会议" },
  { key: "training", label: "培训考试" },
];

export default function RepPage() {
  const [tab, setTab] = useState("todo");
  const [filings, setFilings] = useState<Filing[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [f, v, m] = await Promise.all([
        api<Filing[]>("/api/filings"),
        api<Visit[]>("/api/visits"),
        api<Meeting[]>("/api/meetings"),
      ]);
      setFilings(f);
      setVisits(v);
      setMeetings(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const activeFiling = filings[0];
  const currentPeriod = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const monthVisit = visits.find((v) => v.period === currentPeriod) || visits[0];

  async function addVisit(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/visits", {
        method: "POST",
        body: JSON.stringify({ period: currentPeriod, visit_count: 1 }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    }
  }

  return (
    <AppShell
      title="代表入口"
      subtitle={`代表入口 · 状态 ${activeFiling?.status || "未备案"}`}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      requiredRoles={["rep"]}
    >
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      {tab === "todo" && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="cso-card p-5">
            <h3 className="font-semibold">我的备案信息</h3>
            <p className="mt-3 text-2xl font-semibold text-emerald-700">
              {activeFiling?.status || "暂无"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {activeFiling
                ? `${activeFiling.factory_name} · ${activeFiling.valid_from} 至 ${activeFiling.valid_to}`
                : "尚未创建备案"}
            </p>
          </div>
          <div className="cso-card p-5">
            <h3 className="font-semibold">拜访任务 · 本月</h3>
            <p className="mt-3 text-2xl font-semibold">
              {monthVisit?.visit_count || 0}/{monthVisit?.target_count || 3} 次
            </p>
            <p className="mt-2 text-sm text-slate-500">每月需完成 3 次拜访</p>
            <form onSubmit={addVisit} className="mt-4">
              <button className="cso-btn-primary">提交 1 次拜访</button>
            </form>
          </div>
          <div className="cso-card p-5">
            <h3 className="font-semibold">培训考试</h3>
            <p className="mt-3 text-2xl font-semibold">1/5 门</p>
            <p className="mt-2 text-sm text-slate-500">4 门课程待完成（对接誉学院后更新）</p>
            <button className="cso-btn-secondary mt-4" onClick={() => setTab("training")}>
              前往学习
            </button>
          </div>
        </div>
      )}

      {tab === "filings" && (
        <section className="cso-card p-5">
          <h2 className="mb-3 text-lg font-semibold">备案明细</h2>
          <table className="min-w-full text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left">工厂</th>
                <th className="px-2 py-2 text-left">有效期</th>
                <th className="px-2 py-2 text-left">状态</th>
              </tr>
            </thead>
            <tbody>
              {filings.map((f) => (
                <tr key={f.id} className="border-b border-slate-100">
                  <td className="px-2 py-2.5">{f.factory_name}</td>
                  <td className="px-2 py-2.5">
                    {f.valid_from} ~ {f.valid_to}
                  </td>
                  <td className="px-2 py-2.5">
                    <StatusBadge status={f.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "visits" && (
        <section className="cso-card p-5">
          <h2 className="mb-3 text-lg font-semibold">拜访明细</h2>
          <table className="min-w-full text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left">周期</th>
                <th className="px-2 py-2 text-left">次数</th>
                <th className="px-2 py-2 text-left">目标</th>
                <th className="px-2 py-2 text-left">完成率</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id} className="border-b border-slate-100">
                  <td className="px-2 py-2.5">{v.period}</td>
                  <td className="px-2 py-2.5">{v.visit_count}</td>
                  <td className="px-2 py-2.5">{v.target_count}</td>
                  <td className="px-2 py-2.5">{v.completion_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "meetings" && (
        <section className="space-y-3">
          {meetings.map((m) => (
            <div key={m.id} className="cso-card flex items-center justify-between p-4">
              <div>
                <div className="font-medium">{m.title}</div>
                <div className="text-sm text-slate-500">{m.meeting_date || "日期待定"}</div>
              </div>
              <StatusBadge status={m.status} />
            </div>
          ))}
          {meetings.length === 0 && (
            <div className="cso-card p-8 text-center text-slate-500">暂无会议参与记录</div>
          )}
        </section>
      )}

      {tab === "training" && (
        <section className="cso-card p-8 text-center text-slate-500">
          在线培训与考试模块将对接誉学院。当前演示占位。
        </section>
      )}
    </AppShell>
  );
}
