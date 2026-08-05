"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AppShell, { StatusBadge } from "@/components/AppShell";
import { api } from "@/lib/api";

type Filing = {
  id: number;
  rep_name?: string;
  id_card?: string;
  agent_name?: string;
  provider_name?: string;
  factory_name?: string;
  valid_from?: string;
  valid_to?: string;
  status: string;
};

type Visit = {
  id: number;
  rep_name?: string;
  provider_name?: string;
  visit_count: number;
  completion_rate?: number;
  period: string;
  uploaded_on?: string;
};

type Meeting = {
  id: number;
  title: string;
  location?: string;
  status: string;
  rep_name?: string;
};

type Report = {
  id: number;
  title: string;
  period: string;
  status: string;
};

type Factory = { id: number; name: string };
type Provider = { id: number; name: string };

const tabs = [
  { key: "filings", label: "代表备案" },
  { key: "visits", label: "代表拜访" },
  { key: "meetings", label: "学术会议" },
  { key: "training", label: "代表培训" },
  { key: "reports", label: "报告提交" },
];

export default function AgentPage() {
  const [tab, setTab] = useState("filings");
  const [filings, setFilings] = useState<Filing[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState<string>("");
  const [factoryId, setFactoryId] = useState<string>("");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    try {
      const [f, v, m, r, fac, pro] = await Promise.all([
        api<Filing[]>(`/api/filings${providerId ? `?provider_id=${providerId}` : ""}`),
        api<Visit[]>("/api/visits"),
        api<Meeting[]>("/api/meetings"),
        api<Report[]>("/api/reports"),
        api<Factory[]>("/api/factories"),
        api<Provider[]>("/api/providers"),
      ]);
      setFilings(f);
      setVisits(v);
      setMeetings(m);
      setReports(r);
      setFactories(fac);
      setProviders(pro);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);

  const filteredFilings = useMemo(() => {
    return filings.filter((row) => {
      if (factoryId && String(row) && factories.find((f) => String(f.id) === factoryId)?.name !== row.factory_name) {
        return false;
      }
      if (!q) return true;
      return (row.rep_name || "").includes(q) || (row.id_card || "").includes(q);
    });
  }, [filings, factoryId, factories, q]);

  async function onCreateFiling(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await api("/api/filings", {
        method: "POST",
        body: JSON.stringify({
          name: fd.get("name"),
          id_card: fd.get("id_card"),
          factory_id: Number(fd.get("factory_id")),
          phone: fd.get("phone") || null,
          valid_from: fd.get("valid_from") || null,
          valid_to: fd.get("valid_to") || null,
        }),
      });
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    }
  }

  async function submitSummary(id: number) {
    const summary = window.prompt("请输入会议总结");
    if (!summary) return;
    await api(`/api/meetings/${id}/summary`, {
      method: "POST",
      body: JSON.stringify({ summary }),
    });
    await load();
  }

  async function submitReport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/api/reports", {
      method: "POST",
      body: JSON.stringify({
        title: fd.get("title"),
        period: fd.get("period"),
        content: fd.get("content"),
      }),
    });
    e.currentTarget.reset();
    await load();
  }

  return (
    <AppShell
      title="代理商入口"
      subtitle="誉衡药业 · 真实服务商主数据（大连博道等）"
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      requiredRoles={["agent"]}
      rightSlot={
        <label className="flex items-center gap-2 text-sm text-slate-600">
          服务商
          <select
            className="cso-input w-auto"
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
          >
            <option value="">全部</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      }
    >
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      {tab === "filings" && (
        <section className="cso-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">代表备案列表</h2>
              <p className="text-sm text-slate-500">管理代表的备案信息和状态</p>
            </div>
            <button className="cso-btn-primary" onClick={() => setShowCreate(true)}>
              + 新增代表备案
            </button>
          </div>
          <div className="mb-4 flex flex-wrap gap-3">
            <input
              className="cso-input max-w-xs"
              placeholder="搜索姓名或身份证号..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="cso-input w-auto"
              value={factoryId}
              onChange={(e) => setFactoryId(e.target.value)}
            >
              <option value="">全部工厂</option>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="px-2 py-2">姓名</th>
                  <th className="px-2 py-2">身份证号</th>
                  <th className="px-2 py-2">代理商</th>
                  <th className="px-2 py-2">服务商</th>
                  <th className="px-2 py-2">备案工厂</th>
                  <th className="px-2 py-2">有效期</th>
                  <th className="px-2 py-2">状态</th>
                </tr>
              </thead>
              <tbody>
                {filteredFilings.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-2 py-2.5">{row.rep_name}</td>
                    <td className="px-2 py-2.5">{row.id_card}</td>
                    <td className="px-2 py-2.5">{row.agent_name}</td>
                    <td className="px-2 py-2.5">{row.provider_name}</td>
                    <td className="px-2 py-2.5">{row.factory_name}</td>
                    <td className="px-2 py-2.5">
                      {row.valid_from || "-"} ~ {row.valid_to || "-"}
                    </td>
                    <td className="px-2 py-2.5">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "visits" && (
        <section className="cso-card p-5">
          <h2 className="text-lg font-semibold">代表拜访统计</h2>
          <p className="mb-4 text-sm text-slate-500">
            查看名下代表的拜访记录和活动统计（拜访记录由代表自行提交）
          </p>
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="px-2 py-2">代表姓名</th>
                <th className="px-2 py-2">服务商</th>
                <th className="px-2 py-2">拜访次数</th>
                <th className="px-2 py-2">完成率</th>
                <th className="px-2 py-2">统计周期</th>
                <th className="px-2 py-2">上传日期</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-2 py-2.5">{row.rep_name}</td>
                  <td className="px-2 py-2.5">{row.provider_name}</td>
                  <td className="px-2 py-2.5">{row.visit_count} 次</td>
                  <td className="px-2 py-2.5">{row.completion_rate}%</td>
                  <td className="px-2 py-2.5">{row.period}</td>
                  <td className="px-2 py-2.5">{row.uploaded_on || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "meetings" && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">学术会议</h2>
          {meetings.map((m) => (
            <div key={m.id} className="cso-card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="font-medium">{m.title}</div>
                <div className="text-sm text-slate-500">
                  {m.location || "地点待定"} · {m.rep_name || "未指定代表"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={m.status} />
                {m.status === "待提交总结" && (
                  <button className="cso-btn-primary" onClick={() => submitSummary(m.id)}>
                    提交总结
                  </button>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === "training" && (
        <section className="cso-card p-8 text-center">
          <h2 className="text-lg font-semibold">代表培训</h2>
          <p className="mt-2 text-slate-500">
            培训课程与考试将对接誉学院 / marketing-platform 培训模块。当前为占位页。
          </p>
        </section>
      )}

      {tab === "reports" && (
        <section className="grid gap-4 lg:grid-cols-2">
          <form className="cso-card space-y-3 p-5" onSubmit={submitReport}>
            <h2 className="text-lg font-semibold">提交合规报告</h2>
            <input className="cso-input" name="title" placeholder="报告标题" required />
            <input className="cso-input" name="period" placeholder="周期，如 2026-Q1" required />
            <textarea className="cso-input min-h-28" name="content" placeholder="报告内容" />
            <button className="cso-btn-primary">提交</button>
          </form>
          <div className="cso-card p-5">
            <h2 className="mb-3 text-lg font-semibold">已提交报告</h2>
            <ul className="space-y-2 text-sm">
              {reports.map((r) => (
                <li key={r.id} className="flex items-center justify-between border-b border-slate-100 py-2">
                  <span>
                    {r.title} · {r.period}
                  </span>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
          <form className="cso-card w-full max-w-lg space-y-3 p-6" onSubmit={onCreateFiling}>
            <h3 className="text-lg font-semibold">新增代表备案</h3>
            <input className="cso-input" name="name" placeholder="姓名" required />
            <input className="cso-input" name="id_card" placeholder="身份证号" required />
            <input className="cso-input" name="phone" placeholder="手机号" />
            <select className="cso-input" name="factory_id" required>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input className="cso-input" type="date" name="valid_from" />
              <input className="cso-input" type="date" name="valid_to" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="cso-btn-secondary" onClick={() => setShowCreate(false)}>
                取消
              </button>
              <button className="cso-btn-primary">保存</button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
